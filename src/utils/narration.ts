export function formatCallBluffMessage(opts: {
  callerName: string;
  defenderName: string;
  defenderToldTruth: boolean;
  penalty?: number;
  useEmDash?: boolean;
}) {
  const {
    callerName,
    defenderName,
    defenderToldTruth,
    penalty = 1,
    useEmDash = false,
  } = opts;

  const separator = '...';
  const pointText = penalty === 1 ? 'point' : 'points';
  const possessive = defenderName === 'You' ? 'your' : `${defenderName}'s`;
  const prefix = `${callerName} called ${possessive} bluff! `;

  if (defenderToldTruth) {
    const defenderPhrase = defenderName === 'You' ? 'You were' : `${defenderName} was`;
    return `${prefix}${defenderPhrase} telling the truth${separator}${callerName} lost ${penalty} ${pointText}`;
  }

  return `${prefix}${defenderName} was bluffing${separator}${defenderName} lost ${penalty} ${pointText}`;
}

export default formatCallBluffMessage;
