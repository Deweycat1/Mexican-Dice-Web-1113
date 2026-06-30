import { getClaimActionLabel } from './claimActionLabel';

describe('getClaimActionLabel', () => {
  test.each([
    [53, 'Claim 53'],
    [65, 'Claim 65'],
    [22, 'Claim 22'],
    [21, 'Claim Inferno'],
    [31, 'Claim Reverse'],
    [41, 'Reveal Social'],
  ])('formats roll %s as %s', (roll, expected) => {
    expect(getClaimActionLabel(roll)).toBe(expected);
  });

  test.each([null, undefined, Number.NaN])('uses a safe fallback for %s', (roll) => {
    expect(getClaimActionLabel(roll)).toBe('Claim Roll');
  });
});

