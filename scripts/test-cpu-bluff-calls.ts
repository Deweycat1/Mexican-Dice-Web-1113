/**
 * Test CPU Bluff-Calling Behavior Across 100 Games
 * 
 * This script simulates gameplay and tracks how often the CPU calls bluffs
 * for each possible roll type.
 */

import { useGameStore } from '../src/state/useGameStore';

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
  })
) as jest.Mock;

interface BluffCallStats {
  roll: string;
  totalBluffs: number;
  callsAttempted: number;
  callRate: number;
}

const getAllPossibleRolls = (): string[] => {
  const rolls: string[] = [];
  // Special rolls
  rolls.push('21', '31', '41');
  // Doubles
  for (let i = 2; i <= 6; i++) {
    rolls.push(`${i}${i}`);
  }
  // Normal pairs (high first)
  for (let high = 2; high <= 6; high++) {
    for (let low = 1; low < high; low++) {
      rolls.push(`${high}${low}`);
    }
  }
  return rolls;
};

const runBluffCallTest = async () => {
  console.log('\n🎲 Starting CPU Bluff-Call Analysis (100 Games)\n');
  console.log('=' .repeat(80));

  const allRolls = getAllPossibleRolls();
  const bluffStats: Map<string, { total: number; called: number }> = new Map();
  
  // Initialize stats
  allRolls.forEach(roll => {
    bluffStats.set(roll, { total: 0, called: 0 });
  });

  let totalGames = 0;
  let totalBluffScenarios = 0;

  // Run 100 games
  for (let gameNum = 1; gameNum <= 100; gameNum++) {
    // Reset store for new game
    const store = useGameStore.getState();
    store.newGame();

    let turnCount = 0;
    const maxTurns = 50; // Prevent infinite loops

    // Play until game over or max turns
    while (!store.gameOver && turnCount < maxTurns) {
      turnCount++;
      const currentState = useGameStore.getState();

      if (currentState.turn === 'player') {
        // Player's turn - make a random claim
        const roll = currentState.lastPlayerRoll;
        
        if (!roll) {
          // Need to roll first
          currentState.playerRoll();
          await new Promise(resolve => setTimeout(resolve, 10));
          continue;
        }

        // Make a claim (could be truth or bluff)
        const rollValue = parseInt(`${roll[0]}${roll[1]}`, 10);
        const prevClaim = currentState.lastClaim || 0;
        
        // Decide to claim truthfully or bluff
        const shouldBluff = Math.random() < 0.4; // 40% bluff rate
        let claimValue: number;

        if (shouldBluff) {
          // Bluff - claim higher than actual roll
          const possibleBluffs = allRolls
            .map(r => parseInt(r, 10))
            .filter(v => v > Math.max(prevClaim, rollValue));
          
          if (possibleBluffs.length > 0) {
            claimValue = possibleBluffs[Math.floor(Math.random() * possibleBluffs.length)];
          } else {
            claimValue = rollValue; // Can't bluff, claim truth
          }
        } else {
          // Tell truth
          claimValue = rollValue;
        }

        currentState.playerClaim(claimValue);
        await new Promise(resolve => setTimeout(resolve, 10));

      } else {
        // CPU's turn
        const currentState = useGameStore.getState();
        const playerClaim = currentState.lastClaim;
        const playerRoll = currentState.lastPlayerRoll;

        if (playerClaim && playerRoll) {
          const playerRollValue = parseInt(`${playerRoll[0]}${playerRoll[1]}`, 10);
          const isPlayerBluffing = playerClaim !== playerRollValue;

          // Track this bluff scenario
          const rollKey = String(playerClaim).padStart(2, '0');
          const stats = bluffStats.get(rollKey);
          
          if (stats && isPlayerBluffing) {
            stats.total++;
            totalBluffScenarios++;
          }

          // Let CPU make decision
          await currentState.cpuTurn();
          await new Promise(resolve => setTimeout(resolve, 10));

          // Check if CPU called the bluff
          const newState = useGameStore.getState();
          const lastAction = newState.lastAction;
          
          if (stats && isPlayerBluffing && lastAction === 'bluffCall') {
            stats.called++;
          }
        } else {
          // CPU needs to roll
          await currentState.cpuTurn();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    totalGames++;
    
    // Progress indicator
    if (gameNum % 10 === 0) {
      console.log(`Progress: ${gameNum}/100 games completed...`);
    }
  }

  // Calculate and display results
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS: CPU Bluff-Call Rates by Roll Type\n');
  console.log('='.repeat(80));

  const results: BluffCallStats[] = [];

  allRolls.forEach(roll => {
    const stats = bluffStats.get(roll);
    if (stats && stats.total > 0) {
      results.push({
        roll,
        totalBluffs: stats.total,
        callsAttempted: stats.called,
        callRate: (stats.called / stats.total) * 100,
      });
    }
  });

  // Sort by roll value
  results.sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));

  // Group by category
  const mexican = results.filter(r => r.roll === '21');
  const reverse = results.filter(r => r.roll === '31');
  const social = results.filter(r => r.roll === '41');
  const doubles = results.filter(r => r.roll !== '21' && r.roll !== '31' && r.roll !== '41' && r.roll[0] === r.roll[1]);
  const normal = results.filter(r => {
    const roll = r.roll;
    return roll !== '21' && roll !== '31' && roll !== '41' && roll[0] !== roll[1];
  });

  const printCategory = (name: string, emoji: string, items: BluffCallStats[]) => {
    if (items.length === 0) return;
    
    console.log(`\n${emoji} ${name}:`);
    console.log('-'.repeat(80));
    console.log('Roll\t\tBluffs Seen\tCalls Made\tCall Rate');
    console.log('-'.repeat(80));
    
    items.forEach(stat => {
      const rollLabel = stat.roll === '21' ? '21 (Mexican)' :
                       stat.roll === '31' ? '31 (Reverse)' :
                       stat.roll === '41' ? '41 (Social)' : stat.roll;
      
      console.log(
        `${rollLabel}\t\t${stat.totalBluffs}\t\t${stat.callsAttempted}\t\t${stat.callRate.toFixed(2)}%`
      );
    });

    const avgCallRate = items.reduce((sum, s) => sum + s.callRate, 0) / items.length;
    console.log('-'.repeat(80));
    console.log(`Average Call Rate: ${avgCallRate.toFixed(2)}%\n`);
  };

  printCategory('MEXICAN', '🌮', mexican);
  printCategory('REVERSE', '🔄', reverse);
  printCategory('SOCIAL', '🎉', social);
  printCategory('DOUBLES', '🎲', doubles);
  printCategory('NORMAL PAIRS', '📊', normal);

  // Overall summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY\n');
  console.log(`Total Games Played: ${totalGames}`);
  console.log(`Total Bluff Scenarios: ${totalBluffScenarios}`);
  
  if (results.length > 0) {
    const totalCalls = results.reduce((sum, r) => sum + r.callsAttempted, 0);
    const totalBluffs = results.reduce((sum, r) => sum + r.totalBluffs, 0);
    const overallRate = totalBluffs > 0 ? (totalCalls / totalBluffs) * 100 : 0;
    
    console.log(`Total Bluff Calls Made: ${totalCalls}`);
    console.log(`Overall Call Rate: ${overallRate.toFixed(2)}%`);
    
    // Find highest and lowest call rates
    const sorted = [...results].sort((a, b) => b.callRate - a.callRate);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    
    console.log(`\nMost Called: ${highest.roll} (${highest.callRate.toFixed(2)}%)`);
    console.log(`Least Called: ${lowest.roll} (${lowest.callRate.toFixed(2)}%)`);
  }
  
  console.log('='.repeat(80));
  console.log('\n✅ Analysis Complete!\n');
};

// Run the test
runBluffCallTest().catch(console.error);
