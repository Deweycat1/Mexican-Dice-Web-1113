import { buildClaimOptions } from '../src/lib/claimOptions';
import { enumerateClaims, isAlwaysClaimable, meetsOrBeats } from '../src/engine/mexican';

const assertEveryOptionIsLegal = (options: number[], lastClaim: number | null) => {
  for (const option of options) {
    const legal =
      lastClaim == null ||
      meetsOrBeats(option, lastClaim) ||
      isAlwaysClaimable(option);
    expect(legal).toBe(true);
  }
};

describe('buildClaimOptions', () => {
  it('includes all starting claims except Social when there is no previous claim', () => {
    const opts = buildClaimOptions(null, null);
    const everyClaim = enumerateClaims().filter((c) => c !== 41);
    expect(opts).toEqual(everyClaim);
  });

  it('only offers meets-or-beats options after a normal claim', () => {
    const lastClaim = 53;
    const opts = buildClaimOptions(lastClaim, null);
    assertEveryOptionIsLegal(opts, lastClaim);
  });

  it('only offers Mexican lockdown claims after 21', () => {
    const opts = buildClaimOptions(21, null);
    expect(opts).toHaveLength(2);
    expect(opts).toEqual(expect.arrayContaining([21, 31]));
  });

  it('always keeps special claims available even if they would be lower', () => {
    const opts = buildClaimOptions(66, null);
    expect(opts).toEqual(expect.arrayContaining([21, 31]));
    assertEveryOptionIsLegal(opts, 66);
  });

  it('never returns an option that is worse than the previous claim', () => {
    const lastClaim = 64;
    const opts = buildClaimOptions(lastClaim, null);
    assertEveryOptionIsLegal(opts, lastClaim);
  });
});

describe('claim option source helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('Quick Play feeds lastClaim + lastPlayerRoll into buildClaimOptions', () => {
    jest.isolateModules(() => {
      const mock = jest.fn(() => [900]);
      jest.doMock('../src/lib/claimOptions', () => ({ buildClaimOptions: mock }));
      const { getQuickPlayClaimOptions } = require('../src/lib/claimOptionSources');
      const result = getQuickPlayClaimOptions(63, 54);
      expect(mock).toHaveBeenCalledWith(63, 54);
      expect(result).toEqual([900]);
    });
  });

  it('Survival feeds the same inputs as Quick Play', () => {
    jest.isolateModules(() => {
      const mock = jest.fn(() => [901]);
      jest.doMock('../src/lib/claimOptions', () => ({ buildClaimOptions: mock }));
      const { getSurvivalClaimOptions } = require('../src/lib/claimOptionSources');
      const result = getSurvivalClaimOptions(52, 65);
      expect(mock).toHaveBeenCalledWith(52, 65);
      expect(result).toEqual([901]);
    });
  });

  it('Online mode forwards the resolved baseline claim rather than the last literal claim', () => {
    jest.isolateModules(() => {
      const mock = jest.fn(() => [902]);
      jest.doMock('../src/lib/claimOptions', () => ({ buildClaimOptions: mock }));
      const { getOnlineClaimOptions } = require('../src/lib/claimOptionSources');
      const baseline = 64;
      const result = getOnlineClaimOptions(baseline, 55);
      expect(mock).toHaveBeenCalledWith(baseline, 55);
      expect(result).toEqual([902]);
    });
  });
});
