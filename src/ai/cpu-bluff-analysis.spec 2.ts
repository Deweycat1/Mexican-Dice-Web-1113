/**
 * CPU Bluff-Calling Behavior Analysis
 * Tests AI decision-making for calling bluffs on different roll types
 */

import LearningAIOpponent from './LearningAIOpponent';

describe('CPU Bluff-Calling Analysis', () => {
  it('should analyze bluff-calling rates for all roll types', () => {
    const ai = new LearningAIOpponent();
    const rollTypes = [
      { roll: 21, label: '21 (Mexican)' },
      { roll: 31, label: '31 (Reverse)' },
      { roll: 41, label: '41 (Social)' },
      { roll: 22, label: '22' },
      { roll: 33, label: '33' },
      { roll: 44, label: '44' },
      { roll: 55, label: '55' },
      { roll: 66, label: '66' },
      { roll: 32, label: '32' },
      { roll: 42, label: '42' },
      { roll: 43, label: '43' },
      { roll: 52, label: '52' },
      { roll: 53, label: '53' },
      { roll: 54, label: '54' },
      { roll: 62, label: '62' },
      { roll: 63, label: '63' },
      { roll: 64, label: '64' },
      { roll: 65, label: '65' },
    ];

    const trialsPerRoll = 1000;
    const results: Array<{
      roll: number;
      label: string;
      callCount: number;
      callRate: number;
    }> = [];

    console.log('\n🎲 CPU Bluff-Call Analysis (1000 trials per roll)\n');
    console.log('=' .repeat(70));

    rollTypes.forEach(({ roll, label }) => {
      let callCount = 0;

      for (let i = 0; i < trialsPerRoll; i++) {
        // AI decides whether to call opponent's claim
        const decision = ai.decide(
          roll,       // opponent's claim
          55,         // our roll (doesn't matter for calling decision)
          roll - 1    // previous claim (lower than current)
        );

        if (decision === 'call') {
          callCount++;
        }
      }

      const callRate = (callCount / trialsPerRoll) * 100;
      results.push({ roll, label, callCount, callRate });
    });

    // Display results
    console.log('\nRoll\t\t\tCalls/1000\tCall Rate');
    console.log('-'.repeat(70));

    // Categorize results
    const mexican = results.filter(r => r.roll === 21);
    const reverse = results.filter(r => r.roll === 31);
    const social = results.filter(r => r.roll === 41);
    const doubles = results.filter(r => 
      r.roll !== 21 && r.roll !== 31 && r.roll !== 41 && 
      Math.floor(r.roll / 10) === (r.roll % 10)
    );
    const normal = results.filter(r => {
      const hi = Math.floor(r.roll / 10);
      const lo = r.roll % 10;
      return r.roll !== 21 && r.roll !== 31 && r.roll !== 41 && hi !== lo;
    });

    const printCategory = (name: string, items: typeof results) => {
      if (items.length === 0) return;

      console.log(`\n${name}:`);
      items.forEach(stat => {
        console.log(`${stat.label}\t\t${stat.callCount}\t\t${stat.callRate.toFixed(2)}%`);
      });

      const avg = items.reduce((sum, s) => sum + s.callRate, 0) / items.length;
      console.log(`  Average: ${avg.toFixed(2)}%`);
    };

    printCategory('🌮 MEXICAN', mexican);
    printCategory('🔄 REVERSE', reverse);
    printCategory('🎉 SOCIAL', social);
    printCategory('🎲 DOUBLES', doubles);
    printCategory('📊 NORMAL PAIRS', normal);

    // Overall summary
    const totalCalls = results.reduce((sum, r) => sum + r.callCount, 0);
    const totalTrials = results.length * trialsPerRoll;
    const overallRate = (totalCalls / totalTrials) * 100;

    console.log('\n' + '='.repeat(70));
    console.log('📈 SUMMARY\n');
    console.log(`Total Trials: ${totalTrials.toLocaleString()}`);
    console.log(`Total Calls: ${totalCalls.toLocaleString()}`);
    console.log(`Overall Call Rate: ${overallRate.toFixed(2)}%`);

    const sorted = [...results].sort((a, b) => b.callRate - a.callRate);
    console.log(`\nMost Called: ${sorted[0].label} (${sorted[0].callRate.toFixed(2)}%)`);
    console.log(`Least Called: ${sorted[sorted.length - 1].label} (${sorted[sorted.length - 1].callRate.toFixed(2)}%)`);

    console.log('='.repeat(70));
    console.log('\n✅ Analysis Complete!\n');

    // Basic assertions
    expect(results.length).toBe(rollTypes.length);
    expect(totalTrials).toBe(rollTypes.length * trialsPerRoll);
  });
});

