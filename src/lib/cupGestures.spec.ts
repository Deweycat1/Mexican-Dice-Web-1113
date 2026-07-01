import { resolveCupGesture } from './cupGestures';

describe('resolveCupGesture', () => {
  it('recognizes a stationary tap', () => {
    expect(resolveCupGesture(4, -3)).toBe('tap');
  });

  it('recognizes an upward swipe', () => {
    expect(resolveCupGesture(8, -58)).toBe('swipe-up');
    expect(resolveCupGesture(20, -36)).toBe('swipe-up');
  });

  it('recognizes horizontal swipes in either direction', () => {
    expect(resolveCupGesture(-55, 6)).toBe('swipe-left');
    expect(resolveCupGesture(61, -4)).toBe('swipe-right');
  });

  it('recognizes short, intentional flicks', () => {
    expect(resolveCupGesture(3, -21, 0.05, -0.8)).toBe('swipe-up');
    expect(resolveCupGesture(-22, 4, -0.7, 0.1)).toBe('swipe-left');
  });

  it('ignores ambiguous diagonal movement', () => {
    expect(resolveCupGesture(45, -45)).toBeNull();
  });

  it('does not turn small accidental movement into a gesture', () => {
    expect(resolveCupGesture(16, -8)).toBeNull();
    expect(resolveCupGesture(4, -17, 0.05, -0.2)).toBeNull();
  });
});
