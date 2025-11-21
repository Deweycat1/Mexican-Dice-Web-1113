import { categorizeClaim, claimMatchesRoll, compareClaims, nextHigherClaim } from '../engine/mexican';
import { LearningAIDiceOpponent } from './LearningAIOpponent';

describe('CPU Bluff Calling Analysis', () => {
  test('CPU bluff-calling rates across multiple scenarios (100 games worth)', () => {
    // Initialize AI with game rules
    const ai = new LearningAIDiceOpponent('CPU');
    ai.setRules(compareClaims, nextHigherClaim, categorizeClaim, claimMatchesRoll);
    
    // Test claims that player might make
    const claimTypes = {
      'Mexican (21)': 21,
      'Reverse Mexican (31)': 31,
      'Social Reverse (41)': 41,
      'Double 6s (66)': 66,
      'Double 5s (55)': 55,
      'Double 4s (44)': 44,
      'Double 3s (33)': 33,
      'Double 2s (22)': 22,
      'Double 1s (11)': 11,
      '6-5 (65)': 65,
      '6-4 (64)': 64,
      '6-3 (63)': 63,
      '6-2 (62)': 62,
      '6-1 (61)': 61,
      '5-4 (54)': 54,
      '5-3 (53)': 53,
      '5-2 (52)': 52,
      '5-1 (51)': 51,
      '4-3 (43)': 43,
      '4-2 (42)': 42,
      '3-2 (32)': 32,
    };
    
    // Different CPU roll scenarios
    const cpuRollScenarios = [
      { label: 'Weak Roll (32)', roll: [3, 2] as [number, number] },
      { label: 'Medium Roll (54)', roll: [5, 4] as [number, number] },
      { label: 'Strong Roll (66)', roll: [6, 6] as [number, number] },
      { label: 'Mexican Roll (21)', roll: [2, 1] as [number, number] },
    ];
    
    const results: Record<string, Record<string, { calls: number; raises: number; callRate: number }>> = {};
    const trialsPerCombination = 25; // 25 trials × 4 scenarios = 100 games per claim
    
    cpuRollScenarios.forEach(({ label: scenarioLabel, roll: cpuRoll }) => {
      results[scenarioLabel] = {};
      
      Object.entries(claimTypes).forEach(([claimLabel, claimValue]) => {
        let callCount = 0;
        let raiseCount = 0;
        
        for (let i = 0; i < trialsPerCombination; i++) {
          // For reverse claims (31/41), simulate different baseline scenarios
          let actualClaim = claimValue;
          let baselineClaim = claimValue;
          
          // Test reverses after Mexican (21) and after 66
          if (claimValue === 31 || claimValue === 41) {
            // Alternate between testing reverse after Mexican vs after 66
            if (i % 2 === 0) {
              baselineClaim = 21;  // Reverse after Mexican
            } else {
              baselineClaim = 66;  // Reverse after high double
            }
          }
          
          const decision = ai.decideAction('player', baselineClaim, cpuRoll, i, actualClaim);
          
          if (decision.type === 'call_bluff') {
            callCount++;
          } else {
            raiseCount++;
          }
        }
        
        results[scenarioLabel][claimLabel] = {
          calls: callCount,
          raises: raiseCount,
          callRate: (callCount / trialsPerCombination) * 100,
        };
      });
    });
    
    // Report results
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  CPU BLUFF CALLING ANALYSIS (100 games: 25 trials × 4 scenarios)║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    cpuRollScenarios.forEach(({ label: scenarioLabel }) => {
      console.log(`\n━━━ ${scenarioLabel} ━━━\n`);
      console.log('Player Claim            │ Calls │ Raises │ Call Rate');
      console.log('────────────────────────┼───────┼────────┼──────────');
      
      // Sort by call rate descending for this scenario
      Object.entries(results[scenarioLabel])
        .sort(([, a], [, b]) => b.callRate - a.callRate)
        .forEach(([claimLabel, data]) => {
          const labelPadded = claimLabel.padEnd(23);
          const callsPadded = data.calls.toString().padStart(5);
          const raisesPadded = data.raises.toString().padStart(6);
          const ratePadded = data.callRate.toFixed(0).padStart(7) + '%';
          console.log(`${labelPadded} │${callsPadded} │${raisesPadded} │${ratePadded}`);
        });
      
      // Category summaries for this scenario
      const scenarioData = results[scenarioLabel];
      const mexican = scenarioData['Mexican (21)'];
      const reverses = [scenarioData['Reverse Mexican (31)'], scenarioData['Social Reverse (41)']];
      const doubles = Object.entries(scenarioData)
        .filter(([label]) => label.includes('Double'))
        .map(([, data]) => data);
      const normals = Object.entries(scenarioData)
        .filter(([label]) => !label.includes('Double') && !label.includes('Mexican') && !label.includes('Reverse') && !label.includes('Social'))
        .map(([, data]) => data);
      
      const avgCallRate = (items: typeof mexican[]) => {
        const totalCalls = items.reduce((sum, item) => sum + item.calls, 0);
        const totalTrials = items.length * trialsPerCombination;
        return (totalCalls / totalTrials) * 100;
      };
      
      console.log('\n  Category Averages:');
      console.log(`    Mexican:         ${mexican.callRate.toFixed(0)}% call rate`);
      console.log(`    Reverses (31/41): ${avgCallRate(reverses).toFixed(0)}% avg call rate`);
      console.log(`    Doubles:         ${avgCallRate(doubles).toFixed(0)}% avg call rate`);
      console.log(`    Normal Pairs:    ${avgCallRate(normals).toFixed(0)}% avg call rate`);
    });
    
    // Overall summary across all scenarios
    console.log('\n\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│ OVERALL SUMMARY (All Scenarios Combined)                    │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    
    const overallSummary: Record<string, { totalCalls: number; totalTrials: number }> = {};
    
    Object.entries(claimTypes).forEach(([claimLabel]) => {
      let totalCalls = 0;
      let totalTrials = 0;
      
      cpuRollScenarios.forEach(({ label: scenarioLabel }) => {
        const data = results[scenarioLabel][claimLabel];
        totalCalls += data.calls;
        totalTrials += trialsPerCombination;
      });
      
      overallSummary[claimLabel] = { totalCalls, totalTrials };
    });
    
    console.log('\nPlayer Claim            │ Total Calls │ Call Rate');
    console.log('────────────────────────┼─────────────┼──────────');
    
    Object.entries(overallSummary)
      .sort(([, a], [, b]) => (b.totalCalls / b.totalTrials) - (a.totalCalls / a.totalTrials))
      .forEach(([claimLabel, data]) => {
        const labelPadded = claimLabel.padEnd(23);
        const callsPadded = data.totalCalls.toString().padStart(11);
        const ratePadded = ((data.totalCalls / data.totalTrials) * 100).toFixed(0).padStart(7) + '%';
        console.log(`${labelPadded} │${callsPadded} │${ratePadded}`);
      });
    
    console.log('\n');
    
    // Test passes as long as we get results
    expect(Object.keys(results).length).toBe(cpuRollScenarios.length);
  });
});
