export type CupGesture = 'tap' | 'swipe-up' | 'swipe-left' | 'swipe-right' | null;

const TAP_DISTANCE = 14;
const SWIPE_DISTANCE = 34;
const FLICK_DISTANCE = 18;
const FLICK_VELOCITY = 0.35;

export function resolveCupGesture(
  dx: number,
  dy: number,
  vx = 0,
  vy = 0
): CupGesture {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const isUpwardSwipe =
    dy <= -SWIPE_DISTANCE || (dy <= -FLICK_DISTANCE && vy <= -FLICK_VELOCITY);
  const isSideSwipe =
    absX >= SWIPE_DISTANCE ||
    (absX >= FLICK_DISTANCE && Math.abs(vx) >= FLICK_VELOCITY);

  if (isUpwardSwipe && absY > absX) {
    return 'swipe-up';
  }
  if (isSideSwipe && absX > absY) {
    return dx < 0 ? 'swipe-left' : 'swipe-right';
  }
  if (absX <= TAP_DISTANCE && absY <= TAP_DISTANCE) {
    return 'tap';
  }
  return null;
}
