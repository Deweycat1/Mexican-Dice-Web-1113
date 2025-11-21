# Mexican Dice Game - AI Coding Instructions

## Project Overview
Cross-platform (iOS, Android, Web) Mexican Dice game built with Expo, React Native, and TypeScript. Features a self-learning AI opponent using contextual bandit algorithms (LinUCB) and Beta distribution tracking.

## Architecture

### Core Components
- **Game Engine** (`src/engine/mexican.ts`): Pure functional game logic with immutable operations
  - Claims encoded as 2-digit integers (e.g., `21` = Mexican, `65` = 6-5 pair)
  - Ranking system: Mexican (tier 3) > Doubles (tier 2) > Normal pairs (tier 1)
  - Mexican Lockdown: Once `21` is claimed, only `{21, 31, 41}` are legal until bluff called
  - Reverse claims (`31`, `41`) allow "answering" without raising the claim
- **State Management** (`src/state/useGameStore.ts`): Zustand store with dual modes
  - Quick Play: Best-of-5 games with persistent AI learning
  - Survival Mode: Endless streak tracking with global leaderboard
- **AI Opponent** (`src/ai/LearningAIOpponent.ts`): Multi-armed bandit with opponent modeling
  - LinUCB for action selection with Thompson sampling for exploration
  - Tracks opponent bluff rates by claim category (mexican/double/normal/special)
  - State persists via `expo-file-system` (native) or localStorage (web)
- **Serverless API** (`api/`): Vercel Edge Functions using `@vercel/kv` for stats/leaderboards

### Data Flow
1. User rolls → `playerRoll()` updates Zustand store → triggers `recordRollStat()` API call
2. User claims → `playerClaim(value)` → AI observes → `cpuTurn()` decides response
3. Bluff called → `resolveBluff()` calculates penalty → AI updates learning parameters → persist state

## Key Patterns

### Roll Normalization
Dice always represented high-first: `normalizeRoll(3, 5)` → `53`, `normalizeRoll(2, 1)` → `21` (Mexican)

### Claim Comparison
Use `compareClaims(a, b)` returning `-1|0|1`. Never implement custom sorting logic.
```typescript
compareClaims(21, 66) === 1  // Mexican beats all doubles
compareClaims(44, 65) === 1  // Doubles beat normal pairs
```

### Mexican Lockdown Rule
Critical gameplay mechanic enforced in `isLegalRaise()`:
```typescript
if (isMexican(prevClaim)) {
  return isAlwaysClaimable(nextClaim);  // Only {21, 31, 41} allowed
}
```

### AI Learning Pipeline
```typescript
// When CPU makes a claim:
pendingCpuRaise = { claim, roll, normalized };
// When player responds:
aiOpponent.observeOurRaiseResolved('player', claim, normalized, opponentCalled);
persistAiState();  // Always persist after observation
```

## Development Workflow

### Testing
```bash
npm test              # Run Jest tests (ts-jest config)
npm test -- --watch   # Watch mode for TDD
```
- **Critical**: All game logic in `src/engine/` must have `.spec.ts` coverage
- Test files use deterministic RNG: `mockRandomValues([0.5, 0.3])` (see `rng.ts`)
- Survival/Quick Play modes maintain separate claim histories (`claims` vs `survivalClaims`)

### Testing the 31 Reverse Mechanic
The `31` claim is a special "reverse" that **reflects** the previous claim back to the original claimer. Critical test scenarios:

```typescript
// Example: Player A claims 66, Player B reverses with 31
// Result: Player A must now match/beat their own 66 or call bluff
test('31 reverses claim - original claimer must beat their own claim', () => {
  // CPU claims 66
  useGameStore.setState({
    turn: 'player',
    lastClaim: 66,
    lastCpuRoll: 66,  // CPU actually rolled 66 (truthful)
    lastPlayerRoll: 31,
  });
  
  // Player reverses with 31
  playerClaim(31);
  
  // Turn passes back to CPU who must now beat/match their own 66
  expect(state.turn).toBe('cpu');
  expect(state.lastClaim).toBe(31);
  
  // On CPU's next turn, they need to claim 66+ or 21/31/41 or call bluff
  // The 31 acts as a "mirror" - original claim is still the baseline
});
```

**Key reverse behaviors:**
1. `isReverseOf(prevClaim, 31)` returns `true` for any non-null `prevClaim`
2. Turn immediately passes back: `31` doesn't raise the claim level, it deflects
3. Original claimer faces their own claim as the new baseline
4. Bluff resolution uses `lastAction: 'reverseVsMexican'` when `31` follows `21` (triggers 2-point penalty)
5. `isLegalRaise(prev, 31)` always returns `true` - `31` is "always claimable"

**Reverse vs Normal claims:**
- Normal: Claim must beat previous (`compareClaims(next, prev) >= 0`)
- Reverse: `31` bypasses comparison, acts as defensive move
- After reverse: Original claimer's actual roll determines truth when bluff called

**Multiple 31 reverses in sequence (CRITICAL):**
When players exchange multiple 31 claims (e.g., 66 → 31 → 31 → 31), the ORIGINAL baseline (66) is preserved throughout the chain via `baselineClaim`:
- `isReverseOf(prev, 31)` returns `true` for any different value (false if prev is also 31)
- Each reverse keeps `baselineClaim` pointing to the original claim (66)
- After the chain, next non-reverse claim must beat the **original 66**, not the 31
- Example: After 66→31→31→31, valid next moves must beat **66**: Mexican (21), another 31, or 66+

```typescript
test('Multiple 31s: baseline STAYS 66, not shifts to 31', () => {
  // After 66 → 31 → 31 → 31 chain
  expect(state.baselineClaim).toBe(66);      // Original preserved!
  expect(isLegalRaise(66, 21)).toBe(true);   // Mexican always works
  expect(isLegalRaise(66, 31)).toBe(true);   // Can reverse again
  expect(isLegalRaise(66, 66)).toBe(true);   // Match original
  expect(isLegalRaise(66, 43)).toBe(false);  // 43 doesn't beat 66 (normal < double)
  // Critical: Must beat ORIGINAL 66, not the intermediate 31s
});
```

**Implementation:** Store tracks `baselineClaim` separately from `lastClaim`:
- On reverse (31/41): `baselineClaim` remains unchanged (preserves original)
- On normal claim: `baselineClaim` updates to new claim value
- Legality checks use `baselineClaim` instead of `lastClaim`

### Running Locally
```bash
npm install
npm start             # Expo dev server (scan QR for mobile)
npm run web           # Web-only mode (uses localStorage for persistence)
```

### Deployment
- **Web**: `npm run build:web` → Vercel (config: `vercel.json`)
- **API Routes**: Auto-deployed with Vercel, require `@vercel/kv` KV namespace

## Common Pitfalls

1. **Never mutate Zustand state directly** - always use `set()` with new objects
2. **Modal claims must filter out `41`** - use `buildClaimOptions()` helper (see `src/lib/claimOptions.ts`)
3. **Mexican Lockdown violations** - claiming non-special values after `21` auto-penalizes 2 points
4. **Turn lock management** - wrap async operations with `beginTurnLock()`/`endTurnLock()` to prevent UI race conditions
5. **AI state persistence** - `saveAiState()` must be called after every `observe*()` method
6. **Survival history separation** - Use `survivalHistory`/`survivalClaims`, not `history`/`claims` in survival mode
7. **Claims history persistence** - `newGame()` does NOT reset `claims[]` array to preserve history across games in Quick Play sessions

## File Conventions
- Components: PascalCase (`BluffModal.tsx`, `NarrationBanner.tsx`)
- Utilities: camelCase (`narration.ts`, `claimOptions.ts`)
- Tests: Co-located `.spec.ts` files
- Types: Inline in source files, centralized image types in `types/images.d.ts`

## Styling
- Dark green felt theme: `#0B3A26` (defined in `app/_layout.tsx` and `constants/theme.ts`)
- Responsive: `SafeAreaView` + platform checks (`Platform.OS !== 'web'`)
- Animations: `react-native-reanimated` for dice rolls, `Animated.Value` for UI feedback

## External Dependencies
- **Haptics**: `expo-haptics` for tactile feedback (mobile only)
- **Audio**: `expo-av` for background music/SFX via `useBackgroundMusic` hook
- **Navigation**: `expo-router` file-based routing (`app/` directory structure)
