import { resolveCupGesture } from './cupGestures';

describe('resolveCupGesture', () => {
  it('recognizes a stationary tap', () => {
    expect(resolveCupGesture(4, -3)).toBe('tap');
  });

  it('recognizes an upward swipe', () => {
    expect(resolveCupGesture(8, -58)).toBe('swipe-up');
  });

  it('recognizes horizontal swipes in either direction', () => {
    expect(resolveCupGesture(-55, 6)).toBe('swipe-left');
    expect(resolveCupGesture(61, -4)).toBe('swipe-right');
  });

  it('ignores ambiguous diagonal movement', () => {
    expect(resolveCupGesture(45, -45)).toBeNull();
  });
});
