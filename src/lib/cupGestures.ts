export type CupGesture = 'tap' | 'swipe-up' | 'swipe-left' | 'swipe-right' | null;

const TAP_DISTANCE = 12;
const SWIPE_DISTANCE = 42;
const DIRECTION_BIAS = 1.12;

export function resolveCupGesture(dx: number, dy: number): CupGesture {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (dy <= -SWIPE_DISTANCE && absY >= absX * DIRECTION_BIAS) {
    return 'swipe-up';
  }
  if (absX >= SWIPE_DISTANCE && absX >= absY * DIRECTION_BIAS) {
    return dx < 0 ? 'swipe-left' : 'swipe-right';
  }
  if (absX <= TAP_DISTANCE && absY <= TAP_DISTANCE) {
    return 'tap';
  }
  return null;
}
