export function didCarry(
  prev: [number, number],
  curr: [number, number]
): boolean {
  return (
    prev[0] === curr[0] ||
    prev[0] === curr[1] ||
    prev[1] === curr[0] ||
    prev[1] === curr[1]
  );
}
