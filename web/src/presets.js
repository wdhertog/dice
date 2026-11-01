// Preconfigured dice combinations.
// group: { type, count, skin? (overrides the chosen theme), label? }
// mode: how the result is summarised (see evaluate.js)
export const PRESETS = [
  { id: 'one', name: '1 dobbelsteen', sub: 'Mens erger je niet, Ganzenbord', groups: [{ type: 'd6', count: 1 }], mode: 'sum' },
  { id: 'two', name: '2 dobbelstenen', sub: 'Monopoly, Kolonisten van Catan', groups: [{ type: 'd6', count: 2 }], mode: 'sum' },
  { id: 'yahtzee', name: 'Yahtzee', sub: '5 dobbelstenen', groups: [{ type: 'd6', count: 5 }], mode: 'yahtzee' },
  {
    id: 'risk',
    name: 'Risk',
    sub: '3 aanval tegen 2 verdediging',
    groups: [
      { type: 'd6', count: 3, skin: 'ruby', label: 'Aanval' },
      { type: 'd6', count: 2, skin: 'sapphire', label: 'Verdediging' },
    ],
    mode: 'risk',
  },
  {
    id: 'risk21',
    name: 'Risk 2 tegen 1',
    sub: '2 aanval tegen 1 verdediging',
    groups: [
      { type: 'd6', count: 2, skin: 'ruby', label: 'Aanval' },
      { type: 'd6', count: 1, skin: 'sapphire', label: 'Verdediging' },
    ],
    mode: 'risk',
  },
  { id: 'farkle', name: '10.000 / Farkle', sub: '6 dobbelstenen', groups: [{ type: 'd6', count: 6 }], mode: 'sum' },
  { id: 'd20', name: 'D&D d20', sub: 'Aanval, check, saving throw', groups: [{ type: 'd20', count: 1 }], mode: 'sum' },
  { id: 'adv', name: 'D&D voordeel / nadeel', sub: '2× d20', groups: [{ type: 'd20', count: 2 }], mode: 'advantage' },
  {
    id: 'dndset',
    name: 'D&D set',
    sub: 'd4, d6, d8, d10, d12, d20, d%',
    groups: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map((type) => ({ type, count: 1 })),
    mode: 'list',
  },
  { id: 'stats', name: 'D&D eigenschap', sub: '4d6, laagste valt af', groups: [{ type: 'd6', count: 4 }], mode: 'dropLowest' },
  { id: 'fireball', name: 'Fireball', sub: '8d6 schade', groups: [{ type: 'd6', count: 8 }], mode: 'sum' },
  { id: 'sneak', name: 'Greatsword + sneak', sub: '2d6 + 3d6', groups: [{ type: 'd6', count: 2, label: 'Wapen' }, { type: 'd6', count: 3, skin: 'onyx', label: 'Sneak attack' }], mode: 'sum' },
  {
    id: 'percent',
    name: 'Percentage',
    sub: 'd100 + d10',
    groups: [
      { type: 'd100', count: 1 },
      { type: 'd10', count: 1 },
    ],
    mode: 'percent',
  },
];
