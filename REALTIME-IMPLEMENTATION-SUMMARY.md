# Realtime Multiplayer Implementation Summary

## Overview
Enhanced the online match screen to support **true realtime multiplayer** using Supabase Realtime subscriptions. Both players now see updates instantly without any manual refresh.

---

## Files Modified

### 1. `app/online/[gameId].tsx` (Primary Changes)

#### ✅ Improved Realtime Subscription
**Before:**
- Only listened to `UPDATE` events
- Minimal logging
- No connection status handling

**After:**
- Listens to `*` (all events: INSERT, UPDATE, DELETE)
- Comprehensive logging with emojis for easy debugging
- Connection status handling (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT)
- Cleanup on component unmount

```typescript
const channel = supabase
  .channel(`game-${gameId}`)
  .on('postgres_changes', {
    event: '*', // ← Changed from 'UPDATE' to '*'
    schema: 'public',
    table: 'games',
    filter: `id=eq.${gameId}`,
  }, (payload) => {
    console.log('📨 Realtime update received:', payload.eventType, payload.new);
    if (payload.new) {
      setGame(payload.new as OnlineGame);
    }
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Realtime subscription active');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Realtime subscription error');
    } else if (status === 'TIMED_OUT') {
      console.error('⏱️ Realtime subscription timed out');
    } else {
      console.log('📡 Realtime status:', status);
    }
  });
```

#### ✅ Enhanced Initial Load with Auth
**Added:**
- Comprehensive console logging for debugging
- Better error messages for auth failures
- RLS-specific error handling (PGRST116 = not found)
- Auth failure detection

```typescript
// Phase 3: Initialize auth to ensure user has session
console.log('🔐 Initializing authentication...');
const user = await initializeAuth();

if (!user) {
  throw new Error('Failed to authenticate with Supabase');
}

console.log('✅ Authenticated as user:', user.id);
```

#### ✅ Improved Error States
**Added:**
- "Back to Menu" button on error screens
- `FeltBackground` wrapper for consistent styling
- Better loading message: "Connecting to your match..."

#### ✅ Auto-Close Claim Picker Modal
**Fixed:**
- Modal now closes automatically after successful claim
- Previously stayed open after claim submission

```typescript
} else {
  setMyRoll(null);
  setClaimPickerOpen(false); // ← Added this line
  // Real-time subscription will update game state
}
```

---

## How It Works

### Data Flow (Fire-and-Forget Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│  Player A: Taps "Roll" Button                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  handleRoll() → saveHiddenRoll() → Update Supabase          │
│  - Calls secure helper (hiddenRolls.ts)                     │
│  - Writes to game_rolls_hidden table                        │
│  - Updates last_action_at timestamp                         │
│  - NO manual setGame() call                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Database: Row Updated                             │
│  - game_rolls_hidden: New roll inserted                     │
│  - games: Timestamp updated                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Realtime: Emits postgres_changes Event            │
│  - Event type: UPDATE                                       │
│  - Payload: { new: {...updated game row...} }              │
└─────────────┬──────────────────────┬─────────────────────────┘
              │                      │
              ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│  Player A's Browser  │  │  Player B's Browser  │
│  - Receives event    │  │  - Receives event    │
│  - setGame(new)      │  │  - setGame(new)      │
│  - UI auto-updates   │  │  - UI auto-updates   │
└──────────────────────┘  └──────────────────────┘
```

### Key Principle: Single Source of Truth
- ✅ **Only Realtime subscription updates `game` state**
- ✅ Action handlers (roll, claim, bluff) only **write to database**
- ✅ No manual state computation on client side
- ✅ Both players always see exactly what's in the database

---

## Security Maintained

All Phase 3 security features remain intact:

### ✅ Anonymous Authentication
- `initializeAuth()` called before any Supabase operations
- Session persisted across app restarts
- Stable user.id for RLS enforcement

### ✅ Hidden Dice Rolls
- Actual rolls stored in `game_rolls_hidden` table
- RLS ensures only roller can see their roll
- Opponent never sees roll value until bluff resolution

### ✅ Server-Side Validation
- Bluff resolution via `resolveBluffSecure()` RPC
- Runs in database, cannot be tampered
- Returns only outcome, not opponent's roll details

### ✅ Rate Limiting
- `checkRateLimit()` prevents spam (500ms minimum)
- Enforced via `last_action_at` timestamp checks
- All action handlers respect rate limits

### ✅ Row Level Security (RLS)
- Only participants can view/update their games
- Third parties completely blocked
- Enforced at database level

---

## Testing Instructions

See `REALTIME-TESTING-CHECKLIST.md` for comprehensive test suite.

### Quick Test:
1. Open two browsers (one in incognito mode)
2. Create a game in Browser 1
3. Join the same game in Browser 2
4. **Expected:** Browser 1 updates automatically when Browser 2 joins
5. Take turns rolling/claiming
6. **Expected:** Both players see moves instantly

### Console Logs to Look For:
```
🔐 Initializing authentication...
✅ Authenticated as user: [uuid]
📥 Fetching game data...
✅ Game loaded: [gameId]
📡 Setting up Realtime subscription for game: [gameId]
✅ Realtime subscription active
📨 Realtime update received: UPDATE {...}
```

---

## Performance

### Expected Latency:
- **Local network:** <100ms
- **Same region:** <300ms  
- **Cross-region:** <1000ms

### Resource Usage:
- **WebSocket connections:** 1 per player
- **Database queries:** Initial fetch + triggered by Realtime events
- **Memory:** Minimal (single subscription per game)

---

## Known Behaviors

### ✅ Expected Behaviors:
1. **Both players must be authenticated** before joining
2. **Realtime connection auto-reconnects** after network disruption
3. **Hidden rolls persist** across browser refresh
4. **Game over modal appears** automatically for both players
5. **Leave Match (forfeit)** triggers winner modal for opponent

### ⚠️ Edge Cases Handled:
1. **Network goes offline:** Subscription auto-reconnects when back online
2. **Player refreshes mid-turn:** Roll and claim state restored from database
3. **Multiple games open:** Each subscription filters by unique game ID
4. **RLS denies access:** Clear error message shown

---

## Future Enhancements (Not Implemented)

These could be added later without breaking existing code:

1. **Typing indicators:** Show when opponent is thinking
2. **Turn timer:** Auto-forfeit if player doesn't act in 30s
3. **Game history replay:** Show sequence of all moves
4. **Chat/emotes:** Let players communicate during match
5. **Reconnection banner:** UI indicator when connection drops
6. **Optimistic UI updates:** Show action immediately, rollback on error

---

## Rollback Plan

If Realtime causes issues:

1. **Disable Realtime in Supabase Dashboard:**
   - Settings → API → Realtime → Disable

2. **Revert Code:**
   ```bash
   git revert [commit-hash]
   git push
   ```

3. **Fallback Behavior:**
   - Players would need to manually refresh to see updates
   - All security features still work
   - Game logic unchanged

---

## Support

### Debugging Realtime Issues:

1. **Check Supabase Dashboard → Logs**
   - Look for Realtime connection errors
   - Verify messages are being sent

2. **Browser DevTools → Network → WS**
   - Find Supabase WebSocket connection
   - Should see heartbeat messages every ~30s

3. **Console Logs**
   - Look for `✅ Realtime subscription active`
   - If missing, check Supabase URL and API key

4. **Verify RLS Policies**
   - Run: `SELECT * FROM games WHERE id = '[gameId]'` as authenticated user
   - Should return the game row

---

## Success Metrics

✅ **Realtime updates work both ways**  
✅ **No manual refresh required**  
✅ **All Phase 3 security intact**  
✅ **Game over modal appears for both players**  
✅ **Hidden dice remain hidden**  
✅ **Rate limiting prevents spam**  
✅ **Reconnection works automatically**  

---

## Commit Message

```
feat: Add Realtime multiplayer sync for online matches

- Enhanced Realtime subscription to listen to all events (INSERT, UPDATE, DELETE)
- Added comprehensive logging for connection status and updates
- Improved error handling for auth failures and RLS denials
- Auto-close claim picker modal after successful claim
- Added "Back to Menu" buttons on error screens
- Updated loading message to "Connecting to your match..."

All Phase 3 security features maintained:
- Hidden dice rolls with RLS
- Server-side bluff resolution
- Rate limiting (500ms)
- Anonymous authentication

Tested with two browsers - both players see updates instantly without refresh.
```
