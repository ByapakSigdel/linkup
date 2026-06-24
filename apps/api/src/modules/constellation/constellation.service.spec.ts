import { applyContribution } from './constellation.service';

describe('applyContribution', () => {
  const A = 'user-a';
  const B = 'user-b';

  it('lights a custom star immediately', () => {
    const r = applyContribution({}, 'custom', A, { text: 'our song' });
    expect(r.status).toBe('lit');
    expect(r.answers).toEqual({ [A]: { text: 'our song' } });
    expect(r.litAt).toBeInstanceOf(Date);
  });

  it('shared star stays pending with one side, lights with both', () => {
    const one = applyContribution({}, 'shared', A, { text: 'a' });
    expect(one.status).toBe('pending');
    expect(one.litAt).toBeNull();
    const both = applyContribution(one.answers, 'shared', B, { text: 'b' });
    expect(both.status).toBe('lit');
    expect(both.answers).toEqual({ [A]: { text: 'a' }, [B]: { text: 'b' } });
  });

  it('guess star: subject then guesser lights it', () => {
    const subj = applyContribution({}, 'guess', A, { role: 'subject', text: 'tea' });
    expect(subj.status).toBe('pending');
    expect(subj.answers).toMatchObject({ subjectId: A, answer: { text: 'tea' } });
    const guess = applyContribution(subj.answers, 'guess', B, { role: 'guesser', text: 'coffee' });
    expect(guess.status).toBe('lit');
    expect(guess.answers).toMatchObject({
      subjectId: A, answer: { text: 'tea' }, guess: { by: B, text: 'coffee' }, matched: null,
    });
  });

  it('guess star: guesser first then subject still lights', () => {
    const guess = applyContribution({}, 'guess', B, { role: 'guesser', text: 'coffee' });
    expect(guess.status).toBe('pending');
    const subj = applyContribution(guess.answers, 'guess', A, { role: 'subject', text: 'tea' });
    expect(subj.status).toBe('lit');
  });
});
