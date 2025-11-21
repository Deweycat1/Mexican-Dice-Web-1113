# Realtime Multiplayer - Testing Checklist

## Prerequisites
✅ Supabase Realtime is enabled on `public.games` table  
✅ Phase 3 security migration has been run (`supabase-phase3-security.sql`)  
✅ Anonymous auth is enabled in Supabase Dashboard  
✅ Code has been deployed/updated

---

## Test 1: Basic Realtime Connection

### Steps:
1. Open Browser 1 (or Device 1)
2. Navigate to the app and tap "Play Online"
3. Tap "Start Quick Match" to create a game
4. Note the Game ID in the URL (e.g., `/online/abc-123-def`)
5. Open Browser 2 (or Device 2) in **incognito/private mode**
6. Navigate to the same Game ID URL

### Expected Results:
- ✅ Browser 1: Shows "Waiting for your friend to join..."
- ✅ Browser 2: Shows game screen with both players
- ✅ Browser 1: **Automatically updates** to show "Both players joined. Starting game..."
- ✅ No manual refresh required
- ✅ Console logs show: `✅ Realtime subscription active`

### Check Console Logs:
```
📡 Setting up Realtime subscription for game: [gameId]
✅ Realtime subscription active
📨 Realtime update received: UPDATE {...}
```

---

## Test 2: Turn-Based Gameplay Sync

### Steps:
1. With both players in the game (from Test 1)
2. **Player 1**: Tap "Roll" button
3. **Player 1**: Note your roll value
4. **Player 1**: Tap "Bluff Options" and select a claim
5. Switch to **Player 2** browser/device

### Expected Results:
- ✅ **Player 2**: Screen **automatically updates** to show "Your turn"
- ✅ **Player 2**: Can see the current claim value
- ✅ **Player 2**: Can now tap "Roll" or "Call Bluff"
- ✅ **Player 1**: Screen shows "Friend's turn" without refresh
- ✅ No stale data visible

### Check Console Logs (Both Players):
```
📨 Realtime update received: UPDATE {...current_player: "player2"...}
```

---

## Test 3: Call Bluff - Both Players See Outcome

### Steps:
1. **Player 1**: Roll and make a **false claim** (e.g., roll 43 but claim 65)
2. **Player 2**: Tap "Call Bluff"
3. Wait for alert to appear on Player 2's screen
4. Switch to **Player 1** browser/device

### Expected Results:
- ✅ **Player 2**: Sees alert: "Bluff caught! 1 point penalty."
- ✅ **Player 2**: Score updates automatically (Player 1 loses 1 point)
- ✅ **Player 1**: Screen **automatically updates** with new scores
- ✅ **Player 1**: Turn indicator updates (turn passes back)
- ✅ Both players see identical game state

### Check Console Logs:
```
📨 Realtime update received: UPDATE {...player1_score: X, current_player: "player1"...}
```

---

## Test 4: Game Over - Both Players See Winner

### Steps:
1. Continue playing until one player reaches 5 points
2. The losing player makes their final mistake
3. Wait for game to end

### Expected Results:
- ✅ **Both players**: Game over modal appears **automatically**
- ✅ **Winner**: Modal shows "You Win!" with fireworks
- ✅ **Loser**: Modal shows "You Lose" with appropriate message
- ✅ Both see correct final scores
- ✅ No manual refresh needed

### Check Console Logs:
```
📨 Realtime update received: UPDATE {...status: "finished", winner: "player1"...}
```

---

## Test 5: Leave Match (Forfeit)

### Steps:
1. Start a new game with two players
2. **Player 1**: Tap "Leave Match"
3. **Player 1**: Confirm forfeit
4. Switch to **Player 2** browser/device

### Expected Results:
- ✅ **Player 1**: Navigated back to menu
- ✅ **Player 2**: Game over modal appears **automatically**
- ✅ **Player 2**: Modal shows "You Win!" (opponent forfeited)
- ✅ Realtime subscription triggered the game-over state

### Check Console Logs (Player 2):
```
📨 Realtime update received: UPDATE {...status: "finished", winner: "player2"...}
```

---

## Test 6: Hidden Dice Security

### Steps:
1. Open Browser 1 and Browser 2 in the same game
2. **Player 1**: Roll dice (note your roll value)
3. **Player 2**: Open browser DevTools → Application → Local Storage
4. **Player 2**: Try to find Player 1's roll value
5. **Player 2**: Open Supabase Dashboard → Table Editor → `games`
6. **Player 2**: Find the game row and check `current_roll` column
7. **Player 2**: Check `game_rolls_hidden` table

### Expected Results:
- ✅ `current_roll` in `games` table is `NULL` or empty
- ✅ In `game_rolls_hidden` table, Player 2 can only see **their own roll**
- ✅ Player 1's roll is **not visible** to Player 2 in database
- ✅ UI shows only "Your Roll: —" for Player 2 (not Player 1's dice)
- ✅ Player 1 sees their own dice values

### Check RLS:
Try this SQL query as Player 2's user:
```sql
SELECT * FROM game_rolls_hidden WHERE game_id = '[gameId]';
```
Should return **only Player 2's roll**, never Player 1's.

---

## Test 7: Rate Limiting (Spam Prevention)

### Steps:
1. **Player 1**: Rapidly tap "Roll" button 10 times very fast
2. Check console logs

### Expected Results:
- ✅ Only **one roll** is processed
- ✅ Console shows: `⏱️ Rate limit: action too soon`
- ✅ Subsequent taps within 500ms are ignored
- ✅ No duplicate rolls created

### Alternative Test:
1. **Player 1**: Make a claim
2. **Player 2**: Rapidly tap "Call Bluff" 5 times
3. Should only process once

---

## Test 8: Reconnection (Network Disruption)

### Steps:
1. Start a game with two players
2. **Player 1**: Open DevTools → Network tab → Go offline
3. Wait 5 seconds
4. **Player 1**: Go back online
5. **Player 2**: Make a move (roll or claim)

### Expected Results:
- ✅ **Player 1**: Realtime subscription automatically reconnects
- ✅ **Player 1**: Receives the update from Player 2
- ✅ Console shows reconnection status
- ✅ No manual refresh needed

### Check Console Logs:
```
📡 Realtime status: CHANNEL_ERROR (during offline)
📡 Realtime status: SUBSCRIBED (after reconnection)
📨 Realtime update received: UPDATE {...}
```

---

## Test 9: Multiple Games Simultaneously

### Steps:
1. Create **Game A** with Browser 1 & Browser 2
2. Create **Game B** with Browser 3 & Browser 4 (different users)
3. Make moves in Game A
4. Make moves in Game B

### Expected Results:
- ✅ Game A players only see updates for Game A
- ✅ Game B players only see updates for Game B
- ✅ No cross-contamination between games
- ✅ Each subscription filters correctly by `id=eq.[gameId]`

---

## Test 10: Browser Refresh (State Persistence)

### Steps:
1. **Player 1**: Start a game and make a few moves
2. **Player 1**: Roll dice but **don't claim yet**
3. **Player 1**: Hard refresh the browser (Cmd+Shift+R or Ctrl+F5)

### Expected Results:
- ✅ Game state is restored from Supabase
- ✅ Current scores, turn, and claim are correct
- ✅ **Your roll is reloaded** from `game_rolls_hidden` table
- ✅ Can continue playing without issues

### Check Console Logs:
```
🎲 Loading hidden roll...
✅ Hidden roll found: [rollValue]
```

---

## Common Issues & Debugging

### Issue: "Realtime subscription timed out"
**Cause:** Supabase Realtime not enabled or network issues  
**Fix:** 
- Check Supabase Dashboard → Settings → API → Realtime is enabled
- Check browser console for network errors
- Verify Supabase URL and anon key are correct

### Issue: Player 2 doesn't see Player 1's moves
**Cause:** Subscription not set up correctly or RLS blocking updates  
**Fix:**
- Check console for `✅ Realtime subscription active`
- Verify both players are authenticated (check user ID in console)
- Check RLS policies allow participants to view the game

### Issue: "Match not found or access denied"
**Cause:** RLS policy blocking access or game doesn't exist  
**Fix:**
- Verify player is authenticated before joining game
- Check `player1_id` or `player2_id` matches authenticated user
- Verify game exists in Supabase table

### Issue: Hidden rolls visible in database
**Cause:** RLS not enabled on `game_rolls_hidden` table  
**Fix:**
- Run Phase 3 migration script again
- Verify RLS is enabled in Supabase Dashboard
- Check policies exist: "Users can view their own rolls"

### Issue: Both players can act at the same time
**Cause:** Turn validation not working or stale state  
**Fix:**
- Check `isMyTurn` logic in component
- Verify `current_player` is updating in database
- Add client-side button disable during processing

---

## Performance Benchmarks

### Expected Latency:
- **Local network**: <100ms update propagation
- **Same region**: <300ms update propagation
- **Cross-region**: <1000ms update propagation

### Check Network Tab:
1. Open DevTools → Network → WS (WebSocket)
2. Find Supabase Realtime connection
3. Verify messages are being sent/received
4. Should see heartbeat messages every ~30 seconds

---

## Success Criteria

✅ All 10 tests pass  
✅ No manual refresh required anywhere  
✅ Both players see updates within 1 second  
✅ Hidden dice remain hidden in database  
✅ RLS policies prevent unauthorized access  
✅ Rate limiting prevents spam  
✅ Game over modal appears for both players  
✅ Network reconnection works automatically  

---

## Reporting Issues

If any test fails, report:
1. Which test failed (Test #)
2. Console logs from both players
3. Network tab showing Realtime messages
4. Supabase table state (screenshot of `games` row)
5. Browser/device used

---

## Next Steps After Testing

1. ✅ Confirm all security tests pass
2. ✅ Monitor Supabase logs for errors
3. ✅ Test with real users on different networks
4. ✅ Verify production deployment works
5. ✅ Add analytics/monitoring for game completion rates
