/*
 * The dictionary options code names: the reader, its word list and keywords,
 * the importer, and the rules that single out one option (plan 0012, ADR 0033).
 * An option is its list and its number, held as text, as a Spec ID's slot
 * holds it. Numbers never move, so these stay true in every environment;
 * `options.test.ts` checks each against the dictionary the migrations make.
 * An option added by suggestion is not named here: the reader finds it by its
 * search words.
 */

export const PRODUCT_TYPE = {
  bowlLid: '1',
  cupLid: '2',
  bowl: '3',
  standUpPouch: '4',
  cup: '5',
  portionCup: '6',
  portionCupLid: '7',
  container: '8',
  containerLid: '9',
  containerWithLid: '10',
  hingedContainer: '11',
  takeoutBox: '12',
  fryCarton: '13',
  foldingCarton: '14',
  shippingBox: '15',
  bag: '16',
  napkin: '17',
  wrapOrSheet: '18',
  filmOrRoll: '19',
  plate: '20',
  tray: '21',
  pan: '22',
  cupCarrier: '23',
  straw: '24',
  stirrer: '25',
  fork: '26',
  knife: '27',
  spoon: '28',
  cutleryKit: '29',
  sachet: '30',
  label: '31',
  bowlWithLid: '32',
  cupWithLid: '33',
  portionCupWithLid: '34',
  glove: '35',
  cupSleeve: '36',
} as const;

export const MATERIAL = {
  pet: '1',
  rpet: '2',
  pp: '3',
  ps: '4',
  epsFoam: '5',
  hdpe: '6',
  ldpe: '7',
  lldpe: '8',
  pla: '9',
  psm: '10',
  /** Polymer, grade not known: every polymer is a grade of it. */
  polymer: '11',
  kraft: '12',
  brownKraft: '13',
  whiteKraft: '14',
  virginKraft: '15',
  recycledKraft: '16',
  cupStock: '17',
  sbs: '18',
  corrugated: '19',
  greaseproof: '20',
  tissue: '21',
  waxPaper: '22',
  semiGloss: '23',
  /** Paper and paperboard, grade not known: every paper is a grade of it. */
  paper: '24',
  bagasse: '25',
  bamboo: '26',
  grass: '27',
  seaweed: '28',
  /** Molded fibre, grade not known. */
  moldedFibre: '29',
  aluminium: '30',
  /** Metal, grade not known. */
  metal: '31',
  birch: '32',
  silicone: '33',
  paperPolymerLaminate: '34',
  nitrile: '35',
  latex: '36',
  vinyl: '37',
  cpe: '38',
} as const;

export const COATING = {
  noCoating: '1',
  peInside: '2',
  peOutside: '3',
  peBothSides: '4',
  peSideNotStated: '5',
  plaLined: '6',
  cpetCoated: '7',
  greaseResistant: '8',
  waxCoated: '9',
  filmLaminated: '10',
  siliconeCoated: '11',
  powderFree: '12',
  powdered: '13',
} as const;

export const COLOUR_CLARITY = {
  clear: '1',
  translucent: '2',
  white: '3',
  brown: '4',
  black: '5',
} as const;

export const SHAPE = {
  round: '1',
  square: '2',
  rectangular: '3',
  oval: '4',
} as const;

export const PROFILE = {
  dome: '1',
  halfDome: '2',
  flat: '3',
} as const;

/** A capacity's unit: the digit after `G` in a code, and the first character of its slot. */
export const CAPACITY_UNIT = {
  ounces: '1',
  millilitres: '2',
  servings: '3',
  count: '4',
  grams: '5',
} as const;

export const WALL = {
  singleWall: '1',
  doubleWall: '2',
  rippleWall: '3',
} as const;

export const PRINT = {
  noPrint: '1',
  oneColour: '2',
  twoColours: '3',
  threeColours: '4',
  fourColours: '5',
  fiveColours: '6',
  sixColours: '7',
  sevenColours: '8',
  eightColours: '9',
  fullColour: '10',
} as const;

export const LID_OPENING = {
  closed: '1',
  sipThrough: '2',
  strawHole: '3',
} as const;

export const HANDLE = {
  noHandle: '1',
  twisted: '2',
  flatTape: '3',
  tShirt: '4',
} as const;

export const WRAP = {
  notWrapped: '1',
  paperWrapped: '2',
  filmWrapped: '3',
} as const;

export const WINDOW = {
  noWindow: '1',
  withWindow: '2',
} as const;
