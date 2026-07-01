import {
  createSurvivalTutorialState,
  survivalTutorialReducer,
  type SurvivalTutorialAction,
} from './survivalTutorialMachine';

const play = (actions: SurvivalTutorialAction[]) =>
  actions.reduce(survivalTutorialReducer, createSurvivalTutorialState());

const COMPLETE_TUTORIAL: SurvivalTutorialAction[] = [
  { type: 'CONTINUE' },
  { type: 'CALL_BLUFF' },
  { type: 'CONTINUE' },
  { type: 'ROLL_INFERNO' },
  { type: 'CLAIM_INFERNO' },
  { type: 'CONTINUE' },
  { type: 'CALL_BLUFF' },
];

describe('Survival interactive tutorial', () => {
  it('teaches +1, Inferno +2, and sudden death in one short run', () => {
    const state = play(COMPLETE_TUTORIAL);

    expect(state.stage).toBe('complete');
    expect(state.streak).toBe(3);
    expect(state.runEnded).toBe(true);
    expect(state.exampleLetterLit).toBe(true);
    expect(state.history).toContain('Wrong bluff call — tutorial run ended at 3');
  });

  it('adds one for a normal win', () => {
    const state = play(COMPLETE_TUTORIAL.slice(0, 2));

    expect(state.stage).toBe('normal-win');
    expect(state.streak).toBe(1);
    expect(state.activeRoll).toBe(32);
  });

  it('adds two for an Inferno win and lights only an example letter', () => {
    const state = play(COMPLETE_TUTORIAL.slice(0, 5));

    expect(state.stage).toBe('inferno-win');
    expect(state.streak).toBe(3);
    expect(state.exampleLetterLit).toBe(true);
  });

  it('ignores actions that are not part of the current lesson', () => {
    const initial = createSurvivalTutorialState();

    expect(survivalTutorialReducer(initial, { type: 'CALL_BLUFF' })).toBe(initial);
    expect(survivalTutorialReducer(initial, { type: 'ROLL_INFERNO' })).toBe(initial);
  });

  it('resets without retaining tutorial progress', () => {
    const completed = play(COMPLETE_TUTORIAL);
    expect(survivalTutorialReducer(completed, { type: 'RESET' })).toEqual(
      createSurvivalTutorialState()
    );
  });
});
