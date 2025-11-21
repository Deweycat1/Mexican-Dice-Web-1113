# CPU Bluff-Calling Analysis Report
**Mexican Dice Web Game - AI Behavior Analysis**  
Date: 2024  
Test Suite: `src/ai/cpu-bluff-analysis.spec.ts`

---

## Executive Summary

Analyzed CPU's bluff-calling behavior across 100 games (25 trials × 4 roll scenarios) to measure how often the AI calls bluffs on different claim types.

### Key Findings

**Overall Bluff-Call Rates (All Scenarios Combined):**
- **Mexican (21)**: **100%** - CPU ALWAYS calls Mexican claims
- **High Normal Pairs (62-65)**: **84-86%** - Very aggressive
- **Reverse Claims (31/41)**: **74-75%** - High suspicion
- **Doubles (11-66)**: **0%** - Never calls (strategic raise instead)
- **Low Normal Pairs (32-61)**: **0%** - Never calls (strategic raise instead)

---

## Detailed Analysis by Scenario

### Scenario 1: Weak Roll (32) - CPU Has Worst Hand

**Top Called Claims:**
1. Mexican (21) - 100% call rate
2. Social Reverse (41) - 100% call rate
3. High Normal Pairs (62-65) - 100% call rate
4. Reverse Mexican (31) - 68% call rate

**Never Called:**
- All Doubles (0%)
- All Low Normal Pairs below 62 (0%)

**Insight:** When CPU has a weak roll, it aggressively calls high claims it can't beat, but strategically raises on lower claims to maintain pressure.

---

### Scenario 2: Medium Roll (54) - CPU Has Average Hand

**Top Called Claims:**
1. Mexican (21) - 100% call rate
2. High Normal Pairs (62-65) - 100% call rate
3. Reverse Mexican (31) - 84% call rate
4. Social Reverse (41) - 44% call rate

**Never Called:**
- All Doubles (0%)
- All Normal Pairs below 62 (0%)

**Insight:** With a medium roll, CPU maintains high aggression on Mexican and high pairs but becomes more selective on reverses.

---

### Scenario 3: Strong Roll (66) - CPU Has Double Sixes

**Top Called Claims:**
1. Mexican (21) - 100% call rate
2. Reverse Mexican (31) - 84% call rate
3. 6-4 (64) - 72% call rate
4. 6-5 (65) - 68% call rate

**Never Called:**
- All Doubles (0%)
- All Normal Pairs below 62 (0%)

**Insight:** Even with the strongest double, CPU aggressively challenges Mexican and high pairs. Strategic decision to raise on Doubles rather than call.

---

### Scenario 4: Mexican Roll (21) - CPU Has Best Hand

**Top Called Claims:**
1. Mexican (21) - 100% call rate (mirror claim)
2. Social Reverse (41) - 84% call rate
3. 6-3 (63) - 80% call rate
4. 6-5 (65) - 76% call rate

**Never Called:**
- All Doubles (0%)
- All Normal Pairs below 62 (0%)

**Insight:** When CPU holds Mexican, it still calls Mexican claims 100% (knows odds are against player having it too), and aggressively challenges high claims.

---

## Category Summaries

### Mexican Claims (21)
- **Overall:** 100% call rate across all scenarios
- **Strategy:** Hardcoded aggressive behavior due to extreme rarity (1/36 = 2.78% true odds)
- **Code Reference:** Line 348-362 in `LearningAIOpponent.ts` - threshold set to 17% with suspicion boost

### Reverse Claims (31, 41)
- **Overall:** 74-75% avg call rate
- **Variation:** 64-84% depending on CPU's roll
- **Strategy:** High suspicion as these are tactical deflection moves
- **Code Reference:** Lines 377-380 - threshold based on whether CPU can beat high claims

### Double Claims (11, 22, 33, 44, 55, 66)
- **Overall:** 0% call rate across ALL scenarios
- **Strategy:** Classified as "easy to beat" (line 387) - CPU strategically raises instead of calling
- **Reason:** Doubles are low enough that CPU prefers to maintain pressure by raising rather than risk calling

### Normal Pair Claims
- **High Pairs (62-65):** 84-86% call rate (treated as high-stakes)
- **Low Pairs (32-61):** 0% call rate (classified as "easy to beat")
- **Threshold:** Line 387 marks claims < 62 as never worth calling

---

## AI Decision Logic Flow

Based on code analysis (`LearningAIOpponent.ts` lines 270-410):

```
1. Is claim Mexican? 
   → YES: 100% call (pThreshold = 17%)
   
2. Is claim high-stakes? (Mexican, high doubles ≥44, high pairs ≥62, specials)
   → YES: Direct probability comparison
   → NO: Continue to step 3
   
3. Is claim "easy to beat"? (< 52 or < 62 if CPU can truthfully beat)
   → YES: NEVER call, always raise
   → NO: Use LinUCB bandit algorithm
   
4. LinUCB decision with Expected Value calculation:
   EV = (2 × p_bluff - 1) - callRiskBias
   Call if EV ≥ -0.10
```

---

## Recommendations

### For Gameplay Balance:
1. ✅ **Mexican aggression is appropriate** - 100% call rate matches 1/36 true odds
2. ⚠️ **Doubles never called** - Consider adding occasional calls on 66/55 for realism
3. ✅ **High pairs heavily challenged** - Good pressure on risky claims

### For Player Strategy:
1. **Never bluff Mexican** - CPU calls 100% of the time
2. **Doubles are safe bluffs** - CPU never calls, always raises
3. **High pairs (62-65) are risky** - 84-86% call rate means high chance of being caught
4. **Reverses (31/41) are tactical** - 74% call rate makes them moderate risk

---

## Test Methodology

- **Test File:** `src/ai/cpu-bluff-analysis.spec.ts`
- **Scenarios:** 4 CPU roll types (Weak/Medium/Strong/Mexican)
- **Trials:** 25 trials per claim type per scenario = 100 total games
- **Claims Tested:** 21 different claim types (Mexican, Reverses, Doubles, Normal Pairs)
- **Total Decisions Analyzed:** 2,100 AI decisions

---

## Technical Notes

### AI Architecture:
- **Algorithm:** LinUCB (Linear Upper Confidence Bound) contextual bandit
- **Learning:** Beta distribution tracking for opponent bluff rates
- **Categories:** Mexican, Special (reverses), Double, Normal
- **Thresholds:** Dynamic based on claim category and CPU's roll strength

### Key Code Sections:
- **Decision Logic:** Lines 270-410 in `LearningAIOpponent.ts`
- **Threshold Definitions:** Lines 348-380
- **Easy-to-Beat Check:** Line 387
- **LinUCB Integration:** Lines 399-410

---

## Conclusion

The CPU AI demonstrates sophisticated bluff-calling behavior with category-specific thresholds:
- Hyper-aggressive on Mexican (100%)
- Aggressive on high pairs (84-86%)
- Selective on reverses (74%)
- Strategic avoidance on doubles/low pairs (0% - prefers raising)

This creates a challenging opponent that punishes Mexican bluffs while maintaining strategic pressure through raises rather than always calling bluffs.
