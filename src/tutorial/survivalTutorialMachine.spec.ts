import {
  createSurvivalTutorialState,
  survivalTutorialPrompts,
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
    expect(state.currentClaim).toBe(31);
    expect(state.activeRoll).toBe(32);
    expect(state.history).toContain('You claimed 22');
    expect(state.history).toContain('Infernoman claimed 31 (Reverse)');
  });

  it('adds two for an Inferno win and lights only an example letter', () => {
    const state = play(COMPLETE_TUTORIAL.slice(0, 5));

    expect(state.stage).toBe('inferno-win');
    expect(state.streak).toBe(3);
    expect(state.exampleLetterLit).toBe(true);
  });

  it('distinguishes the streak reward from real-roll letter rewards', () => {
    const claimPrompt = survivalTutorialPrompts['claim-inferno'];
    const resultPrompt = survivalTutorialPrompts['inferno-win'];

    expect(claimPrompt.body).toContain('21 is claimed');
    expect(claimPrompt.body).toContain('even if the claim is a bluff');
    expect(resultPrompt.body).toContain('real roll did not create the +2');
    expect(resultPrompt.body).toContain('first rolled 21 awards');
    expect(resultPrompt.body).toContain('Bluffing 21 never awards letters');
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
