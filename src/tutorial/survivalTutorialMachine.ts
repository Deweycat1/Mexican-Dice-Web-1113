export type SurvivalTutorialStage =
  | 'welcome'
  | 'call-first-bluff'
  | 'normal-win'
  | 'roll-inferno'
  | 'claim-inferno'
  | 'inferno-win'
  | 'call-truth'
  | 'complete';

export type SurvivalTutorialAction =
  | { type: 'RESET' }
  | { type: 'CONTINUE' }
  | { type: 'CALL_BLUFF' }
  | { type: 'ROLL_INFERNO' }
  | { type: 'CLAIM_INFERNO' };

export type SurvivalTutorialState = {
  stage: SurvivalTutorialStage;
  streak: number;
  runEnded: boolean;
  currentClaim: number | null;
  claimOwner: 'player' | 'cpu' | null;
  activeRoll: number | null;
  rollOwner: 'player' | 'cpu' | null;
  diceHidden: boolean;
  exampleLetterLit: boolean;
  history: string[];
};

export type SurvivalTutorialPrompt = {
  lesson: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
};

export const createSurvivalTutorialState = (): SurvivalTutorialState => ({
  stage: 'welcome',
  streak: 0,
  runEnded: false,
  currentClaim: null,
  claimOwner: null,
  activeRoll: null,
  rollOwner: null,
  diceHidden: false,
  exampleLetterLit: false,
  history: [],
});

const addHistory = (state: SurvivalTutorialState, ...entries: string[]) =>
  [...state.history, ...entries].slice(-4);

export function survivalTutorialReducer(
  state: SurvivalTutorialState,
  action: SurvivalTutorialAction
): SurvivalTutorialState {
  if (action.type === 'RESET') return createSurvivalTutorialState();

  switch (state.stage) {
    case 'welcome':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'call-first-bluff',
        currentClaim: 43,
        claimOwner: 'cpu',
        activeRoll: 32,
        rollOwner: 'cpu',
        diceHidden: true,
        history: ['Infernoman claimed 43'],
      };

    case 'call-first-bluff':
      if (action.type !== 'CALL_BLUFF') return state;
      return {
        ...state,
        stage: 'normal-win',
        streak: 1,
        diceHidden: false,
        history: addHistory(state, 'You caught a bluff — normal win: streak +1'),
      };

    case 'normal-win':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'roll-inferno',
        currentClaim: null,
        claimOwner: null,
        activeRoll: null,
        rollOwner: 'player',
        diceHidden: false,
      };

    case 'roll-inferno':
      if (action.type !== 'ROLL_INFERNO') return state;
      return {
        ...state,
        stage: 'claim-inferno',
        activeRoll: 21,
        rollOwner: 'player',
        diceHidden: false,
        history: addHistory(state, 'You rolled a real 21 (Inferno)'),
      };

    case 'claim-inferno':
      if (action.type !== 'CLAIM_INFERNO') return state;
      return {
        ...state,
        stage: 'inferno-win',
        streak: 3,
        currentClaim: 21,
        claimOwner: 'player',
        exampleLetterLit: true,
        history: addHistory(
          state,
          'Real Inferno win: streak +2',
          'Example INFERNO letter lit'
        ),
      };

    case 'inferno-win':
      if (action.type !== 'CONTINUE') return state;
      return {
        ...state,
        stage: 'call-truth',
        currentClaim: 44,
        claimOwner: 'cpu',
        activeRoll: 44,
        rollOwner: 'cpu',
        diceHidden: true,
        history: addHistory(state, 'Infernoman claimed 44'),
      };

    case 'call-truth':
      if (action.type !== 'CALL_BLUFF') return state;
      return {
        ...state,
        stage: 'complete',
        runEnded: true,
        diceHidden: false,
        history: addHistory(state, 'Wrong bluff call — tutorial run ended at 3'),
      };

    case 'complete':
      return state;
  }
}

export const survivalTutorialPrompts: Record<
  SurvivalTutorialStage,
  SurvivalTutorialPrompt
> = {
  welcome: {
    lesson: 1,
    eyebrow: 'ICEMAN • SURVIVAL STREAKS',
    title: 'One loss ends the run',
    body: 'Quick Play dice rules still apply, but there are no scorekeeper dice here. Win each round to grow your streak. Lose once and the run is over.',
    actionLabel: 'Start a Short Run',
  },
  'call-first-bluff': {
    lesson: 1,
    eyebrow: 'ICEMAN • NORMAL WIN',
    title: 'Catch one bluff',
    body: 'Infernoman claims 43, but his covered dice are really 32. Swipe the cup up or tap Call Bluff.',
  },
  'normal-win': {
    lesson: 1,
    eyebrow: 'ICEMAN • STREAK +1',
    title: 'A normal win adds one',
    body: 'Your streak is now 1. Your Best saves your personal record, while Global Best is the streak everyone is chasing.',
    actionLabel: 'Try an Inferno',
  },
  'roll-inferno': {
    lesson: 2,
    eyebrow: 'ICEMAN • INFERNO BONUS',
    title: 'A real 21 is worth more',
    body: 'Tap the cup or the Roll button. This sandbox rigs one real Inferno so you can see its Survival bonus.',
  },
  'claim-inferno': {
    lesson: 2,
    eyebrow: 'ICEMAN • REAL INFERNO',
    title: 'Claim your 21',
    body: 'A Survival round won with an Inferno adds 2 to the streak instead of 1. Claim the real roll.',
  },
  'inferno-win': {
    lesson: 2,
    eyebrow: 'ICEMAN • STREAK +2',
    title: 'Your streak jumped to 3',
    body: 'Rolling a real 21 can also sometimes light a missing INFERNO letter. This example lights one; real letters are not guaranteed and are stored on this device.',
    actionLabel: 'See How a Run Ends',
  },
  'call-truth': {
    lesson: 3,
    eyebrow: 'ICEMAN • SUDDEN DEATH',
    title: 'Now make one wrong call',
    body: 'Infernoman claims 44 and really rolled 44. Call Bluff intentionally to see what a single lost round does. This tutorial cannot affect your real streak.',
  },
  complete: {
    lesson: 3,
    eyebrow: 'ICEMAN • RUN COMPLETE',
    title: 'The run ended at 3',
    body: 'That is Survival: normal wins add 1, Inferno wins add 2, real 21s may award letters, and one loss ends the run. Use the Quick Play tutorial for the full dice rules.',
    actionLabel: 'Enter Inferno Mode',
  },
};
