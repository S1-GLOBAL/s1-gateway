import { describe, expect, it } from 'vitest';
import { stageIcons } from './stage-icons';

const counts = (specificationsReceived: number, quoted: number, sampling: number, inProduction: number) => ({
  specificationsReceived,
  quoted,
  sampling,
  inProduction,
});

describe('stageIcons', () => {
  it('lights every stage reached, and says how many reached each', () => {
    expect(stageIcons(counts(2, 2, 1, 1))).toEqual([
      { key: 'specifications-received', lit: true, label: 'Specifications received: 2 manufacturers' },
      { key: 'quoted', lit: true, label: 'Quoted: 2 manufacturers' },
      { key: 'sampling', lit: true, label: 'Sampling: 1 manufacturer' },
      { key: 'in-production', lit: true, label: 'In production: 1 manufacturer' },
      { key: 'none', lit: false, label: '2 manufacturers recorded' },
    ]);
  });

  it('says "none" for a stage nobody reached, and the singular for one manufacturer', () => {
    expect(stageIcons(counts(1, 0, 0, 0)).map(({ lit, label }) => [lit, label])).toEqual([
      [true, 'Specifications received: 1 manufacturer'],
      [false, 'Quoted: none'],
      [false, 'Sampling: none'],
      [false, 'In production: none'],
      [false, '1 manufacturer recorded'],
    ]);
  });

  it('lights only the fifth when there are no manufacturers', () => {
    const icons = stageIcons(counts(0, 0, 0, 0));
    expect(icons.filter((icon) => icon.lit).map((icon) => icon.label)).toEqual(['No manufacturers yet']);
  });
});
