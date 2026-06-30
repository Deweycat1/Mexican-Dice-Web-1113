import {
  createTutorialState,
  tutorialReducer,
  type TutorialAction,
} from './quickPlayTutorialMachine';

const play = (actions: TutorialAction[]) => actions.reduce(tutorialReducer, createTutorialState());

const COMPLETE_MATCH: TutorialAction[] = [
  { type: 'CONTINUE' },
  { type: 'CONTINUE' },
  { type: 'ROLL' },
  { type: 'CLAIM_TRUTH' },
  { type: 'ROLL' },
  { type: 'CLAIM_TRUTH' },
  { type: 'OPEN_HISTORY' },
  { type: 'CLOSE_HISTORY' },
  { type: 'ROLL' },
  { type: 'OPEN_BLUFF_OPTIONS' },
  { type: 'SELECT_CLAIM', claim: 65 },
  { type: 'CONTINUE' },
  { type: 'CALL_BLUFF' },
  { type: 'CONTINUE' },
  { type: 'ROLL' },
  { type: 'SHOW_SOCIAL' },
  { type: 'CONTINUE' },
  { type: 'ROLL' },
  { type: 'CLAIM_REVERSE' },
  { type: 'CONTINUE' },
  { type: 'CALL_BLUFF' },
];

describe('Quick Play interactive tutorial', () => {
  test('plays a complete six-round match with the expected final score', () => {
    const state = play(COMPLETE_MATCH);

    expect(state.stage).toBe('complete');
    expect(state.round).toBe(6);
    expect(state.playerScore).toBe(4);
    expect(state.cpuScore).toBe(0);
    expect(state.diceHidden).toBe(false);
    expect(state.history).toContain('You won the tutorial match');
  });

  test('ignores actions that are not currently being taught', () => {
    const initial = createTutorialState();

    expect(tutorialReducer(initial, { type: 'ROLL' })).toBe(initial);

    const ranking = tutorialReducer(initial, { type: 'CONTINUE' });
    expect(tutorialReducer(ranking, { type: 'CALL_BLUFF' })).toBe(ranking);
  });

  test('only accepts the guided 65 bluff and allows backing out of the picker', () => {
    const beforePicker = play(COMPLETE_MATCH.slice(0, 10));
    expect(beforePicker.stage).toBe('select-65');
    expect(beforePicker.bluffOptionsOpen).toBe(true);

    const wrongClaim = tutorialReducer(beforePicker, { type: 'SELECT_CLAIM', claim: 66 });
    expect(wrongClaim).toBe(beforePicker);

    const backedOut = tutorialReducer(beforePicker, { type: 'CANCEL_BLUFF_OPTIONS' });
    expect(backedOut.stage).toBe('open-bluff-options');
    expect(backedOut.bluffOptionsOpen).toBe(false);
  });

  test('Social resets the round without changing either score', () => {
    const throughSocial = play(COMPLETE_MATCH.slice(0, 16));

    expect(throughSocial.stage).toBe('social-result');
    expect(throughSocial.playerScore).toBe(4);
    expect(throughSocial.cpuScore).toBe(3);
    expect(throughSocial.currentClaim).toBeNull();
  });

  test('the final false Inferno costs two points', () => {
    const beforeCall = play(COMPLETE_MATCH.slice(0, -1));
    expect(beforeCall.stage).toBe('call-inferno');
    expect(beforeCall.cpuScore).toBe(2);

    const completed = tutorialReducer(beforeCall, { type: 'CALL_BLUFF' });
    expect(completed.cpuScore).toBe(0);
  });
});
