import { getRollDiceColorways } from './dice';

describe('roll dice colorways', () => {
  it('shows Iceman high in blue and low in orange', () => {
    expect(getRollDiceColorways('player')).toEqual(['blue', 'orange']);
  });

  it('shows Infernoman high in orange and low in blue', () => {
    expect(getRollDiceColorways('cpu')).toEqual(['orange', 'blue']);
  });
});
