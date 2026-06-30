export type TutorialStage =
  | 'welcome'
  | 'ranking'
  | 'cup-controls'
  | 'roll-53'
  | 'read-53'
  | 'answer-61'
  | 'claim-62'
  | 'open-history'
  | 'close-history'
  | 'answer-64'
  | 'open-bluff-options'
  | 'select-65'
  | 'bluff-caught'
  | 'call-65'
  | 'cpu-bluff-caught'
  | 'roll-social'
  | 'show-social'
  | 'social-result'
  | 'answer-54-with-reverse'
  | 'claim-reverse'
  | 'reverse-result'
  | 'call-inferno'
  | 'complete';

export type TutorialAction =
  | { type: 'RESET' }
  | { type: 'CONTINUE' }
  | { type: 'ROLL' }
  | { type: 'CLAIM_TRUTH' }
  | { type: 'OPEN_HISTORY' }
  | { type: 'CLOSE_HISTORY' }
  | { type: 'OPEN_BLUFF_OPTIONS' }
  | { type: 'CANCEL_BLUFF_OPTIONS' }
  | { type: 'SELECT_CLAIM'; claim: number }
  | { type: 'CALL_BLUFF' }
  | { type: 'SHOW_SOCIAL' }
  | { type: 'CLAIM_REVERSE' };

export type TutorialState = {
  stage: TutorialStage;
  round: number;
  playerScore: number;
  cpuScore: number;
  currentClaim: number | null;
  claimOwner: 'player' | 'cpu' | null;
  activeRoll: number | null;
  diceOwner: 'player' | 'cpu' | null;
  diceHidden: boolean;
  history: string[];
  historyOpen: boolean;
  bluffOptionsOpen: boolean;
};

export type TutorialPrompt = {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
  lesson: number;
};

export const TUTORIAL_ROUND_COUNT = 6;

export const createTutorialState = (): TutorialState => ({
  stage: 'welcome',
  round: 0,
  playerScore: 5,
  cpuScore: 5,
  currentClaim: null,
  claimOwner: null,
  activeRoll: null,
  diceOwner: null,
  diceHidden: false,
  history: [],
  historyOpen: false,
  bluffOptionsOpen: false,
});

const addHistory = (state: TutorialState, ...entries: string[]) =>
  [...state.history, ...entries].slice(-10);

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  if (action.type === 'RESET') return createTutorialState();

  switch (state.stage) {
    case 'welcome':
      if (action.type !== 'CONTINUE') return state;
      return { ...state, stage: 'ranking' };

    case 'ranking':
      if (action.type !== 'CONTINUE') return state;
      return { ...state, stage: 'cup-controls' };

    case 'cup-controls':
      if (action.type !== 'CONTINUE') return state;
      return { ...state, stage: 'roll-53', round: 1 };

    case 'roll-53':
      if (action.type !== 'ROLL') return state;
      return {
        ...state,
        stage: 'read-53',
        activeRoll: 53,
        diceOwner: 'player',
        diceHidden: false,
      };

    case 'read-53':
      if (action.type !== 'CLAIM_TRUTH') return state;
      return {
        ...state,
        stage: 'answer-61',
        currentClaim: 61,
        claimOwner: 'cpu',
        activeRoll: 61,
        diceOwner: 'cpu',
        diceHidden: true,
        history: addHistory(state, 'You claimed 53', 'Infernoman claimed 61'),
      };

    case 'answer-61':
      if (action.type !== 'ROLL') return state;
      return {
        ...state,
        stage: 'claim-62',
        activeRoll: 62,
        diceOwner: 'player',
        diceHidden: false,
      };

    case 'claim-62':
      if (action.type !== 'CLAIM_TRUTH') return state;
      return {
        ...state,
        stage: 'open-history',
        cpuScore: 4,
        currentClaim: null,
        claimOwner: null,
        history: addHistory(
          state,
          'You claimed 62',
          'Infernoman called bluff — your claim was true',
          'Infernoman lost 1 point'
        ),
      };

    case 'open-history':
      if (action.type !== 'OPEN_HISTORY') return state;
      return { ...state, stage: 'close-history', historyOpen: true };

    case 'close-history':
      if (action.type !== 'CLOSE_HISTORY') return state;
      return {
        ...state,
        stage: 'answer-64',
        round: 2,
        currentClaim: 64,
        claimOwner: 'cpu',
        activeRoll: 64,
        diceOwner: 'cpu',
        diceHidden: true,
        historyOpen: false,
        history: addHistory(state, 'Infernoman claimed 64'),
      };

    case 'answer-64':
      if (action.type !== 'ROLL') return state;
      return {
        ...state,
        stage: 'open-bluff-options',
        activeRoll: 32,
        diceOwner: 'player',
        diceHidden: false,
      };

    case 'open-bluff-options':
      if (action.type !== 'OPEN_BLUFF_OPTIONS') return state;
      return { ...state, stage: 'select-65', bluffOptionsOpen: true };

    case 'select-65':
      if (action.type === 'CANCEL_BLUFF_OPTIONS') {
        return { ...state, stage: 'open-bluff-options', bluffOptionsOpen: false };
      }
      if (action.type !== 'SELECT_CLAIM' || action.claim !== 65) return state;
      return {
        ...state,
        stage: 'bluff-caught',
        playerScore: 4,
        currentClaim: null,
        claimOwner: null,
        bluffOptionsOpen: false,
        history: addHistory(
          state,
          'You claimed 65 with a roll of 32',
          'Infernoman caught your bluff',
          'You lost 1 point'
        ),
      };

    case 'bluff-caught':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'call-65',
        round: 3,
        currentClaim: 65,
        claimOwner: 'cpu',
        activeRoll: 54,
        diceOwner: 'cpu',
        diceHidden: true,
        history: addHistory(state, 'Infernoman claimed 65'),
      };

    case 'call-65':
      if (action.type !== 'CALL_BLUFF') return state;
      return {
        ...state,
        stage: 'cpu-bluff-caught',
        cpuScore: 3,
        currentClaim: null,
        claimOwner: null,
        diceHidden: false,
        history: addHistory(
          state,
          'You called bluff — Infernoman rolled 54',
          'Infernoman lost 1 point'
        ),
      };

    case 'cpu-bluff-caught':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'roll-social',
        round: 4,
        currentClaim: null,
        claimOwner: null,
        activeRoll: null,
        diceOwner: null,
        diceHidden: false,
      };

    case 'roll-social':
      if (action.type !== 'ROLL') return state;
      return {
        ...state,
        stage: 'show-social',
        activeRoll: 41,
        diceOwner: 'player',
        diceHidden: false,
      };

    case 'show-social':
      if (action.type !== 'SHOW_SOCIAL') return state;
      return {
        ...state,
        stage: 'social-result',
        currentClaim: null,
        claimOwner: null,
        history: addHistory(state, 'You showed 41 (Social)', 'Round reset — no points lost'),
      };

    case 'social-result':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'answer-54-with-reverse',
        round: 5,
        currentClaim: 54,
        claimOwner: 'cpu',
        activeRoll: 54,
        diceOwner: 'cpu',
        diceHidden: true,
        history: addHistory(state, 'Infernoman claimed 54'),
      };

    case 'answer-54-with-reverse':
      if (action.type !== 'ROLL') return state;
      return {
        ...state,
        stage: 'claim-reverse',
        activeRoll: 31,
        diceOwner: 'player',
        diceHidden: false,
      };

    case 'claim-reverse':
      if (action.type !== 'CLAIM_REVERSE') return state;
      return {
        ...state,
        stage: 'reverse-result',
        cpuScore: 2,
        currentClaim: null,
        claimOwner: null,
        history: addHistory(
          state,
          'You claimed 31 (Reverse)',
          'Infernoman called bluff — your Reverse was real',
          'Infernoman lost 1 point'
        ),
      };

    case 'reverse-result':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'call-inferno',
        round: 6,
        currentClaim: 21,
        claimOwner: 'cpu',
        activeRoll: 65,
        diceOwner: 'cpu',
        diceHidden: true,
        history: addHistory(state, 'Infernoman claimed 21 (Inferno)'),
      };

    case 'call-inferno':
      if (action.type !== 'CALL_BLUFF') return state;
      return {
        ...state,
        stage: 'complete',
        cpuScore: 0,
        currentClaim: 21,
        claimOwner: 'cpu',
        diceHidden: false,
        history: addHistory(
          state,
          'You called bluff — Infernoman rolled 65',
          'False Inferno: Infernoman lost 2 points',
          'You won the tutorial match'
        ),
      };

    case 'complete':
      return state;
  }
}

export const tutorialPrompts: Record<TutorialStage, TutorialPrompt> = {
  welcome: {
    eyebrow: 'ICEMAN • GAME PLAN',
    title: 'I’ll guide your first match',
    body: 'Your goal is to make Infernoman lose all five points. Follow my highlighted moves and we’ll play a complete six-round game.',
    actionLabel: 'Start Tutorial',
    lesson: 1,
  },
  ranking: {
    eyebrow: 'ICEMAN • ROLL RANKING',
    title: 'Know what beats what',
    body: 'Read the higher die first. Match or beat the current claim. Mixed rolls rank by number, doubles beat every mixed roll, and 21 (Inferno) beats everything.',
    actionLabel: 'Next — Cup Controls',
    lesson: 1,
  },
  'cup-controls': {
    eyebrow: 'ICEMAN • THE DICE CUP',
    title: 'Play with the cup or the buttons',
    body: 'Tap a ready cup to shake. When Infernoman hands you a claim, swipe up to call bluff and lift the cup, or swipe sideways to believe him and clear the hidden dice. Every gesture has a matching button, so use whichever feels better.',
    actionLabel: 'Practice in the Match',
    lesson: 2,
  },
  'roll-53': {
    eyebrow: 'ICEMAN • ROUND 1',
    title: 'Start with a roll',
    body: 'No claim is active, so you can establish the first claim. Tap the highlighted Roll button.',
    lesson: 1,
  },
  'read-53': {
    eyebrow: 'ICEMAN • READ YOUR DICE',
    title: 'Five and three make 53',
    body: 'The higher die is always read first. Your real roll is legal, so claim it truthfully.',
    lesson: 1,
  },
  'answer-61': {
    eyebrow: 'ICEMAN • ACCEPT OR CHALLENGE',
    title: 'Infernoman claims 61',
    body: 'Rolling accepts his claim. Your next roll must then match or beat 61. Calling Bluff would challenge whether he really rolled it. For now, tap Roll.',
    lesson: 1,
  },
  'claim-62': {
    eyebrow: 'ICEMAN • MEET OR BEAT',
    title: '62 beats 61',
    body: 'Your roll is high enough. Claim the real 62 and pass the decision back to Infernoman.',
    lesson: 1,
  },
  'open-history': {
    eyebrow: 'ICEMAN • SCORING',
    title: 'A wrong caller loses a point',
    body: 'Infernoman challenged your truthful 62, so his score dropped. Scorekeeper dice count upward: face 1 is full health; face 6 means game over. Tap Recent Events.',
    lesson: 2,
  },
  'close-history': {
    eyebrow: 'ICEMAN • RECENT EVENTS',
    title: 'This is your match record',
    body: 'It keeps the last ten claims and outcomes. Close it when you’re ready for round two.',
    lesson: 2,
  },
  'answer-64': {
    eyebrow: 'ICEMAN • ROUND 2',
    title: 'Infernoman claims 64',
    body: 'Roll to accept the claim. If your dice come up short, you’ll need to bluff or make a special play.',
    lesson: 3,
  },
  'open-bluff-options': {
    eyebrow: 'ICEMAN • YOUR ROLL IS TOO LOW',
    title: '32 cannot follow 64',
    body: 'You cannot claim 32 truthfully here. Open Bluff Options to see a legal claim.',
    lesson: 3,
  },
  'select-65': {
    eyebrow: 'ICEMAN • CHOOSE A CLAIM',
    title: 'Bluff with 65',
    body: '65 beats 64, so it is legal to claim—even though your dice show 32. Select 65.',
    lesson: 3,
  },
  'bluff-caught': {
    eyebrow: 'ICEMAN • BLUFF EXPOSED',
    title: 'The bluffer loses a point',
    body: 'Infernoman called correctly. Your scorekeeper die climbed from 1 to 2. Bluffing creates options, but getting caught costs you.',
    actionLabel: 'Continue',
    lesson: 3,
  },
  'call-65': {
    eyebrow: 'ICEMAN • ROUND 3',
    title: 'Now test his claim',
    body: 'Infernoman claims 65. You could roll to accept, but I don’t trust the heat coming off those dice. Tap Call Bluff.',
    lesson: 4,
  },
  'cpu-bluff-caught': {
    eyebrow: 'ICEMAN • GOOD CALL',
    title: 'His actual roll was 54',
    body: 'The claim was false, so Infernoman lost a point. The caller loses only when the challenged claim was true.',
    actionLabel: 'Continue',
    lesson: 4,
  },
  'roll-social': {
    eyebrow: 'ICEMAN • ROUND 4',
    title: 'Time for a special roll',
    body: 'Special rolls change the normal flow. Tap Roll.',
    lesson: 5,
  },
  'show-social': {
    eyebrow: 'ICEMAN • 41 SOCIAL',
    title: 'A Social must be shown',
    body: '41 can never be bluffed. Showing it clears every claim, ends the round with no penalty, and passes the dice.',
    lesson: 5,
  },
  'social-result': {
    eyebrow: 'ICEMAN • ROUND RESET',
    title: 'No one lost a point',
    body: 'The claim chain is clear and the scores stay the same. That is the safe reset created by a Social.',
    actionLabel: 'Continue',
    lesson: 5,
  },
  'answer-54-with-reverse': {
    eyebrow: 'ICEMAN • ROUND 5',
    title: 'Infernoman claims 54',
    body: 'Roll to accept his claim. This time the dice have another special lesson ready.',
    lesson: 5,
  },
  'claim-reverse': {
    eyebrow: 'ICEMAN • 31 REVERSE',
    title: 'Send the challenge back',
    body: '31 is always playable. A Reverse reflects the active challenge back to the previous player, who must answer it. Claim your real Reverse.',
    lesson: 5,
  },
  'reverse-result': {
    eyebrow: 'ICEMAN • REVERSE CONFIRMED',
    title: 'He challenged the truth',
    body: 'Infernoman called your real Reverse a bluff and lost a point. A Reverse against an Inferno would still keep the two-point penalty at stake.',
    actionLabel: 'Final Round',
    lesson: 5,
  },
  'call-inferno': {
    eyebrow: 'ICEMAN • ROUND 6',
    title: '21 Inferno puts two points at stake',
    body: 'Inferno outranks every normal roll and double. Respond with a real 21, 31, or 41; bluff 21 or 31; or Call Bluff. Catch a false Inferno and the bluffer loses two points.',
    lesson: 6,
  },
  complete: {
    eyebrow: 'ICEMAN • MATCH COMPLETE',
    title: 'You froze the flames',
    body: 'Infernoman claimed 21 but rolled 65, so he lost two points and reached zero. You used claims, bluffs, Social, Reverse, and Inferno to finish a full game.',
    actionLabel: 'Finish Tutorial',
    lesson: 6,
  },
};
