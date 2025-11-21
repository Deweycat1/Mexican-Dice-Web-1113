import { ClaimCategory, DicePair, normalizeRoll, rankValue } from '../engine/mexican';

type Vector = number[];
type Matrix = number[][];

const identityMatrix = (size: number): Matrix => {
  const matrix: Matrix = [];
  for (let i = 0; i < size; i += 1) {
    const row = new Array(size).fill(0);
    row[i] = 1;
    matrix.push(row);
  }
  return matrix;
};

const cloneMatrix = (input: Matrix): Matrix => input.map((row) => [...row]);

const invertMatrix = (matrix: Matrix): Matrix => {
  const size = matrix.length;
  const augmented: Matrix = matrix.map((row, rowIndex) => [
    ...row,
    ...identityMatrix(size)[rowIndex],
  ]);

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col; row < size; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][col]) < 1e-12) {
      throw new Error('Matrix is singular and cannot be inverted');
    }
    if (pivot !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivot];
      augmented[pivot] = temp;
    }
    const pivotValue = augmented[col][col];
    for (let j = 0; j < 2 * size; j += 1) {
      augmented[col][j] /= pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row !== col) {
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * size; j += 1) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }

  const inverse: Matrix = [];
  for (let i = 0; i < size; i += 1) {
    inverse.push(augmented[i].slice(size));
  }
  return inverse;
};

const matrixVectorProduct = (matrix: Matrix, vector: Vector): Vector =>
  matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));

const outerProduct = (vector: Vector): Matrix => {
  const size = vector.length;
  const result: Matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      result[i][j] = vector[i] * vector[j];
    }
  }
  return result;
};

const addMatrixInPlace = (target: Matrix, increment: Matrix) => {
  for (let i = 0; i < target.length; i += 1) {
    for (let j = 0; j < target[i].length; j += 1) {
      target[i][j] += increment[i][j];
    }
  }
};

class BetaTracker {
  alpha: number;

  beta: number;

  constructor(alpha = 1, beta = 1) {
    this.alpha = alpha;
    this.beta = beta;
  }

  mean() {
    return this.alpha / (this.alpha + this.beta);
  }

  thompson() {
    // Basic Beta sampling via inverse transform (fallback for deterministic tests)
    const u = Math.random();
    return this.quantile(u);
  }

  update(success: boolean) {
    if (success) {
      this.alpha += 1;
    } else {
      this.beta += 1;
    }
  }

  private quantile(p: number) {
    // Approximate inverse Beta using arithmetic mean approximation.
    const total = this.alpha + this.beta;
    const mu = this.mean();
    const variance = (this.alpha * this.beta) / (total * total * (total + 1));
    const sigma = Math.sqrt(Math.max(variance, 1e-9));
    const z = Math.sqrt(2) * inverseErf(2 * p - 1);
    const value = mu + z * sigma;
    if (Number.isNaN(value)) {
      return mu;
    }
    return Math.min(Math.max(value, 0), 1);
  }
}

const inverseErf = (x: number) => {
  // Approximation by Numerical Recipes
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const first = (2 / (Math.PI * a)) + ln / 2;
  const second = Math.sqrt(first * first - ln / a);
  const sign = x < 0 ? -1 : 1;
  return sign * Math.sqrt(second - first);
};

class OpponentProfile {
  bluffRate: Record<ClaimCategory, BetaTracker>;

  callRate: BetaTracker;

  smallRaisePref: BetaTracker;

  mexicanClaimCount: number;

  totalClaimCount: number;

  constructor() {
    this.bluffRate = {
      mexican: new BetaTracker(1, 4),  // Start VERY skeptical of Mexican claims (20% belief)
      double: new BetaTracker(2, 1),   // Doubles are hard to beat - assume 67% bluff rate initially
      normal: new BetaTracker(1, 1),
      special: new BetaTracker(1, 1),
    };
    this.callRate = new BetaTracker(1, 2);
    this.smallRaisePref = new BetaTracker(1, 1);
    this.mexicanClaimCount = 0;
    this.totalClaimCount = 0;
  }
}

class LinUCB {
  private readonly d: number;

  private readonly alpha: number;

  A: Matrix;

  b: Vector;

  constructor(d: number, alpha = 0.9) {
    this.d = d;
    this.alpha = alpha;
    this.A = identityMatrix(d);
    this.b = new Array(d).fill(0);
  }

  private Ainv() {
    return invertMatrix(this.A);
  }

  choose(contexts: Record<string, Vector>) {
    const inv = this.Ainv();
    const theta = matrixVectorProduct(inv, this.b);
    const scores: Record<string, number> = {};

    Object.entries(contexts).forEach(([action, vector]) => {
      const mu = vector.reduce((sum, value, index) => sum + theta[index] * value, 0);
      const tmp = matrixVectorProduct(inv, vector);
      const variance = vector.reduce((sum, value, index) => sum + value * tmp[index], 0);
      const bonus = this.alpha * Math.sqrt(Math.max(variance, 0));
      scores[action] = mu + bonus;
    });

    const best = Object.entries(scores).reduce((acc, entry) => (entry[1] > acc[1] ? entry : acc));
    return { action: best[0], scores };
  }

  update(vector: Vector, reward: number) {
    addMatrixInPlace(this.A, outerProduct(vector));
    this.b = this.b.map((value, index) => value + reward * vector[index]);
  }

  snapshot() {
    return {
      A: cloneMatrix(this.A),
      b: [...this.b],
    };
  }

  load(state: { A: number[][]; b: number[] }) {
    this.A = cloneMatrix(state.A);
    this.b = [...state.b];
  }
}

type LastContext = {
  opponentId: string;
  action: 'CALL' | 'RAISE';
  context: Vector;
} | null;

export class LearningAIDiceOpponent {
  private readonly playerId: string;

  private readonly bandit: LinUCB;

  private readonly profiles = new Map<string, OpponentProfile>();

  private callRiskBias = -0.15;

  private truthBias = 0.0;

  private lastContext: LastContext = null;

  private compareClaimsFn: ((a: number, b: number) => 1 | 0 | -1) | null = null;

  private nextHigherClaimFn: ((value: number) => number | null) | null = null;

  private categorizeClaimFn: ((value: number | null) => ClaimCategory) | null = null;

  private claimMatchesRollFn: ((claim: number | null, roll: number | DicePair | null) => boolean) | null = null;

  constructor(playerId = 'CPU') {
    this.playerId = playerId;
    this.bandit = new LinUCB(12, 0.35);
  }

  setRules(
    compareFn: (a: number, b: number) => 1 | 0 | -1,
    nextHigherFn: (value: number) => number | null,
    categorizeFn: (value: number | null) => ClaimCategory,
    claimMatchesFn: (claim: number | null, roll: number | DicePair | null) => boolean
  ) {
    this.compareClaimsFn = compareFn;
    this.nextHigherClaimFn = nextHigherFn;
    this.categorizeClaimFn = categorizeFn;
    this.claimMatchesRollFn = claimMatchesFn;
  }

  decideAction(
    opponentId: string,
    currentClaim: number | null,
    myRoll: DicePair,
    roundIndex = 0,
    actualClaimValue: number | null = null  // Actual claim including reverses (31/41)
  ): { type: 'call_bluff' } | { type: 'raise'; claim: number } {
    this.assertRulesReady();

    if (currentClaim == null) {
      let opening = this.canonicalClaimFromRoll(myRoll);
      // More aggressive opening: always jump if weak, frequently jump even if not
      if (this.isWeakTruth(opening)) {
        opening = this.pressureJumpAbove(normalizeRoll(4, 3));
      } else if (Math.random() < 0.5) {
        // 50% chance to bluff even with good opening for leverage
        opening = this.pressureJumpAbove(opening);
      }
      this.lastContext = null;
      return { type: 'raise', claim: opening };
    }

    const profile = this.getProfile(opponentId);
    const category = this.categorizeClaimFn!(currentClaim);
    
    // Track Mexican claim frequency
    if (category === 'mexican') {
      profile.mexicanClaimCount++;
    }
    profile.totalClaimCount++;
    
    // If player claims Mexican too frequently (more than 1 in 20 claims, when true odds are 1/36)
    // become MUCH more suspicious
    const mexicanFrequency = profile.mexicanClaimCount / Math.max(profile.totalClaimCount, 1);
    const suspicionBoost = mexicanFrequency > 0.08 ? 0.4 : (mexicanFrequency > 0.05 ? 0.2 : 0);

    const truthful = this.bestTruthfulAbove(currentClaim, myRoll);
    
    // Strategic bluffing: even with truthful options, sometimes bluff for leverage
    const shouldBluffForLeverage = truthful != null && Math.random() < 0.35;
    
    if (truthful != null && !shouldBluffForLeverage && Math.random() < 0.45 + this.truthBias) {
      this.lastContext = null;
      return { type: 'raise', claim: truthful };
    }

    const catBluffMean = (profile.bluffRate[category] ?? new BetaTracker(1, 1)).mean();
    const pCallMean = profile.callRate.mean();
    const dist = this.distanceFromTruth(currentClaim, myRoll);
    const oneHot = this.categoryOneHot(category);

    const callContext = this.makeContext(
      currentClaim,
      roundIndex,
      oneHot,
      catBluffMean,
      pCallMean,
      truthful != null,
      dist,
      0
    );
    const raiseContext = this.makeContext(
      currentClaim,
      roundIndex,
      oneHot,
      catBluffMean,
      pCallMean,
      truthful != null,
      dist,
      1
    );

    // CRITICAL: Doubles are HARD to beat (need another double or Mexican), always high-stakes
    // Normal pairs are easier to beat (any higher pair or double)
    // Special claims (31, 41) are reverses - must evaluate separately
    const isEasyToBeat = category === 'normal' && currentClaim < 62 && truthful != null;
    
    // For high-stakes claims (Mexican, ALL doubles, high pairs, specials), evaluate calling bluff
    const isHighStakes = category === 'mexican' || 
                         category === 'special' ||
                         category === 'double' ||  // ALL doubles are high-stakes (hard to beat)
                         (category === 'normal' && currentClaim >= 62);

    if (isHighStakes) {
      // For high-stakes claims, use DIRECT probability comparison (not EV)
      // This ensures we call when we believe opponent is likely bluffing
      const pBluffSample = (profile.bluffRate[category] ?? new BetaTracker(1, 1)).mean();
      
      // Probability thresholds: If we think opponent bluffs MORE than this %, call
      let pThreshold = 0.50; // Default: call if we think they bluff >50%
      
      if (category === 'mexican') {
        // Mexican (21) - True odds are 1/36 (2.78%), so be VERY suspicious
        // Target: ~95% call rate with initial 20% bluff belief (BetaTracker 1,4)
        // With pBluff = 20%, threshold of 5% means almost always call (20% > 5%)
        pThreshold = 0.05 - suspicionBoost;
        // Floor at 3% to ensure very high call rate
        pThreshold = Math.max(pThreshold, 0.03);
      } else if (category === 'double') {
        // Doubles are VERY hard to beat (1/36 each, need specific double or Mexican)
        // Be aggressive on ALL doubles since they're inherently suspicious
        if (currentClaim >= 66) {
          pThreshold = 0.25;  // Very aggressive on 66 (only Mexican beats it)
        } else if (currentClaim >= 55) {
          pThreshold = 0.30;  // Very aggressive on 55, 44
        } else if (currentClaim >= 33) {
          pThreshold = 0.35;  // Aggressive on 33, 22
        } else {
          pThreshold = 0.40;  // Skeptical on 11 (easier to beat with any double)
        }
      } else if (category === 'normal' && currentClaim >= 64) {
        // High normal pairs
        pThreshold = 0.45;
      } else if (category === 'special') {
        // Special (31, 41) are reverses - must evaluate carefully
        // 31 reflects previous claim back, so AI must beat original claim
        // Check if this is a reverse after Mexican or high double - be VERY aggressive
        const isReverseAfterHighClaim = (actualClaimValue === 31 || actualClaimValue === 41) && 
                                         (currentClaim === 21 || currentClaim === 66);
        if (isReverseAfterHighClaim) {
          pThreshold = 0.05;  // Very aggressive (95% call rate) on reverses after Mexican/66
        } else {
          // If AI can't beat high claims (Mexican, high doubles), be aggressive
          const canBeatHighClaims = truthful != null && this.compareClaimsFn!(truthful, 62) >= 0;
          pThreshold = canBeatHighClaims ? 0.50 : 0.35; // More aggressive if weak roll
        }
      }
      
      if (pBluffSample >= pThreshold) {
        this.lastContext = { opponentId, action: 'CALL', context: callContext };
        return { type: 'call_bluff' };
      }
    }

    // For low claims that are easily beatable, never call - just raise
    if (isEasyToBeat) {
      const claim = truthful != null && Math.random() < 0.60 + this.truthBias
        ? truthful
        : this.pickPressureClaim(currentClaim, true);
      this.lastContext = { opponentId, action: 'RAISE', context: raiseContext };
      return { type: 'raise', claim };
    }

    // For medium claims, use bandit to decide
    const { action } = this.bandit.choose({ CALL: callContext, RAISE: raiseContext });

    if (action === 'CALL') {
      // Apply less aggressive threshold for medium claims
      const pBluffSample = (profile.bluffRate[category] ?? new BetaTracker(1, 1)).mean();
      const evCall = (2 * pBluffSample - 1) - this.callRiskBias;
      
      if (evCall >= -0.10) {
        this.lastContext = { opponentId, action: 'CALL', context: callContext };
        return { type: 'call_bluff' };
      }
    }

    // When bluffing, go bold - pick a pressure claim that jumps higher
    const claim = truthful != null && Math.random() < 0.40 + this.truthBias
      ? truthful
      : this.pickPressureClaim(currentClaim, true);

    this.lastContext = { opponentId, action: 'RAISE', context: raiseContext };
    return { type: 'raise', claim };
  }

  observeShowdown(opponentId: string, opponentClaim: number | null, actualOpponentRoll: number | null) {
    if (opponentClaim == null || actualOpponentRoll == null) return;
    const wasBluff = !this.claimMatchesRollFn!(opponentClaim, actualOpponentRoll);
    const category = this.categorizeClaimFn!(opponentClaim);
    const profile = this.getProfile(opponentId);
    profile.bluffRate[category] = profile.bluffRate[category] ?? new BetaTracker(1, 1);
    profile.bluffRate[category].update(wasBluff);
  }

  observeOurRaiseResolved(opponentId: string, cpuClaim: number | null, cpuRoll: number | null, opponentCalled: boolean) {
    if (cpuClaim == null || cpuRoll == null) return;
    const profile = this.getProfile(opponentId);
    profile.callRate.update(opponentCalled);
  }

  observeOpponentRaiseSize(opponentId: string, currentClaim: number | null, newClaim: number | null) {
    if (currentClaim == null || newClaim == null) return;
    const steps = this.stepDistance(currentClaim, newClaim);
    const profile = this.getProfile(opponentId);
    profile.smallRaisePref.update(steps <= 1);
  }

  observeRoundOutcome(didCpuWinRound: boolean) {
    if (!this.lastContext) return;
    this.bandit.update(this.lastContext.context, didCpuWinRound ? 1 : -1);
    this.lastContext = null;
  }

  state() {
    const profileEntries: Record<string, {
      bluffRate: Record<string, [number, number]>;
      callRate: [number, number];
      smallRaisePref: [number, number];
    }> = {};

    this.profiles.forEach((profile, key) => {
      profileEntries[key] = {
        bluffRate: Object.fromEntries(
          Object.entries(profile.bluffRate).map(([cat, tracker]) => [cat, [tracker.alpha, tracker.beta]])
        ),
        callRate: [profile.callRate.alpha, profile.callRate.beta],
        smallRaisePref: [profile.smallRaisePref.alpha, profile.smallRaisePref.beta],
      };
    });

    return {
      profiles: profileEntries,
      bandit: this.bandit.snapshot(),
    };
  }

  loadState(state: {
    profiles?: Record<string, {
      bluffRate: Record<string, [number, number]>;
      callRate: [number, number];
      smallRaisePref: [number, number];
    }>;
    bandit?: { A: number[][]; b: number[] };
  }) {
    if (state.bandit) {
      this.bandit.load(state.bandit);
    }
    Object.entries(state.profiles ?? {}).forEach(([opponentId, data]) => {
      const profile = new OpponentProfile();
      Object.entries(data.bluffRate ?? {}).forEach(([cat, [alpha, beta]]) => {
        profile.bluffRate[cat as ClaimCategory] = new BetaTracker(alpha, beta);
      });
      const [callAlpha, callBeta] = data.callRate ?? [1, 1];
      profile.callRate = new BetaTracker(callAlpha, callBeta);
      const [smallAlpha, smallBeta] = data.smallRaisePref ?? [1, 1];
      profile.smallRaisePref = new BetaTracker(smallAlpha, smallBeta);
      profile.mexicanClaimCount = 0;
      profile.totalClaimCount = 0;
      this.profiles.set(opponentId, profile);
    });
  }

  profileSnapshot(opponentId: string) {
    const profile = this.getProfile(opponentId);
    return {
      bluffRate: Object.fromEntries(
        Object.entries(profile.bluffRate).map(([cat, tracker]) => [cat, tracker.mean()])
      ),
      callRate: profile.callRate.mean(),
      smallRaisePref: profile.smallRaisePref.mean(),
    };
  }

  banditSnapshot() {
    return this.bandit.snapshot();
  }

  private assertRulesReady() {
    if (
      !this.compareClaimsFn ||
      !this.nextHigherClaimFn ||
      !this.categorizeClaimFn ||
      !this.claimMatchesRollFn
    ) {
      throw new Error('LearningAIDiceOpponent rules not configured');
    }
  }

  private getProfile(opponentId: string) {
    if (!this.profiles.has(opponentId)) {
      this.profiles.set(opponentId, new OpponentProfile());
    }
    return this.profiles.get(opponentId)!;
  }

  private canonicalClaimFromRoll(roll: DicePair) {
    return normalizeRoll(roll[0], roll[1]);
  }

  private bestTruthfulAbove(currentClaim: number, myRoll: DicePair) {
    const truthClaim = this.canonicalClaimFromRoll(myRoll);
    return this.compareClaimsFn!(truthClaim, currentClaim) > 0 ? truthClaim : null;
  }

  private pickPressureClaim(currentClaim: number, allowBluff: boolean) {
    let step = 1;
    if (allowBluff) {
      const profile = this.getProfile('player');
      const callMean = profile.callRate.mean();
      const rand = Math.random();
      // More aggressive stepping for bolder bluffs
      if (rand < 0.6) step += 1; // 60% chance to jump 2 steps
      if (callMean > 0.55 && rand < 0.4) step += 1;
      if (callMean > 0.70 && rand < 0.3) step += 1;
    }
    let claim: number | null = currentClaim;
    for (let i = 0; i < step; i += 1) {
      const next = this.nextHigherClaimFn!(claim!);
      if (next == null) {
        claim = 21;
        break;
      }
      claim = next;
    }
    return claim ?? currentClaim;
  }

  private pressureJumpAbove(baseline: number) {
    let claim: number | null = baseline;
    const steps = Math.random() < 0.66 ? 1 : 2;
    for (let i = 0; i < steps; i += 1) {
      const next = this.nextHigherClaimFn!(claim!);
      if (next == null) {
        claim = 21;
        break;
      }
      claim = next;
    }
    return claim ?? baseline;
  }

  private isWeakTruth(claim: number) {
    return this.categorizeClaimFn!(claim) === 'normal';
  }

  private categoryOneHot(category: ClaimCategory) {
    return [
      category === 'mexican' ? 1 : 0,
      category === 'double' ? 1 : 0,
      category === 'normal' ? 1 : 0,
      category === 'special' ? 1 : 0,
    ];
  }

  private distanceFromTruth(currentClaim: number, myRoll: DicePair) {
    const truth = this.canonicalClaimFromRoll(myRoll);
    if (this.compareClaimsFn!(truth, currentClaim) <= 0) return 0;
    let steps = 0;
    let cursor: number | null = currentClaim;
    while (cursor != null && this.compareClaimsFn!(cursor, truth) < 0 && steps < 20) {
      cursor = this.nextHigherClaimFn!(cursor);
      steps += 1;
    }
    return steps;
  }

  private stepDistance(a: number, b: number) {
    if (this.compareClaimsFn!(a, b) >= 0) return 0;
    let steps = 0;
    let cursor: number | null = a;
    while (cursor != null && this.compareClaimsFn!(cursor, b) < 0 && steps < 30) {
      cursor = this.nextHigherClaimFn!(cursor);
      steps += 1;
    }
    return steps;
  }

  private makeContext(
    currentClaim: number,
    roundIndex: number,
    categoryVector: number[],
    catBluffMean: number,
    pCallMean: number,
    truthPossible: boolean,
    distance: number,
    actionFlag: number
  ): Vector {
    const claimStrength = this.normalizeClaimStrength(currentClaim);
    const roundFeature = Math.min(roundIndex / 12, 1);
    const distFeature = Math.min(distance / 6, 1);
    return [
      1,
      claimStrength,
      roundFeature,
      categoryVector[0],
      categoryVector[1],
      categoryVector[2],
      categoryVector[3],
      catBluffMean,
      pCallMean,
      truthPossible ? 1 : 0,
      distFeature,
      actionFlag,
    ];
  }

  private normalizeClaimStrength(claim: number) {
    const max = rankValue(21);
    const min = rankValue(31);
    const value = rankValue(claim);
    return (value - min) / (max - min);
  }
}

export default LearningAIDiceOpponent;
