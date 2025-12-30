export const MEXICAN_ICON = '__FLAME_ICON__';

export const WOMP_WOMP_MESSAGES = [
  'Womp womp.',
  'Unfortunate.',
  'Oof.',
  'Yeah… no.',
  "That’s rough.",
  'You tried.',
  'A swing and a miss.',
];

type WompWompIndexRef = { current: number };

export const getNextWompWompMessage = (prevIndexRef: WompWompIndexRef) => {
  const total = WOMP_WOMP_MESSAGES.length;
  let nextIndex = Math.floor(Math.random() * total);
  if (nextIndex === prevIndexRef.current) {
    nextIndex = (nextIndex + 1) % total;
  }
  prevIndexRef.current = nextIndex;
  return { text: WOMP_WOMP_MESSAGES[nextIndex], index: nextIndex };
};
