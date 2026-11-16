/**
 * Card Maker — modelo de dados, utilitários e catálogos (frames, raridades, palavras-chave, modelos).
 * Mantido livre de DOM para poder ser testado em Node.
 */

export type FrameStyle = 'modern' | 'classic' | 'parchment' | 'showcase' | 'neon' | 'borderless';
export type CardLayout = 'standard' | 'saga' | 'planeswalker' | 'token';
/** W U B R G + M (ouro/multicolor) + A (artefato) + L (terreno) + C (incolor) */
export type FrameColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'A' | 'L' | 'C';
export type MakerRarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special';
export type BorderColor = 'black' | 'white' | 'silver' | 'gold';
export type FoilMode = 'none' | 'foil' | 'etched';
export type CardLang = 'pt' | 'en';
export type IconMode = 'set' | 'custom' | 'none';
export type MultiStyle = 'gold' | 'gradient';
export type TextAlign = 'left' | 'center';
export type CustomIcon = 'diamond' | 'star' | 'shield' | 'flame' | 'moon' | 'bolt' | 'leaf' | 'skull';

export interface ArtState {
  /** data: URL (upload) ou URL remota com CORS liberado (Scryfall). Vazio = sem arte. */
  src: string;
  /** zoom relativo ao "cover" (1 = preenche a moldura) */
  zoom: number;
  /** ponto focal horizontal/vertical, 0..1 */
  px: number;
  py: number;
  flipX: boolean;
  brightness: number; // 100 = normal
  contrast: number;
  saturation: number;
  /** de onde veio (apenas informativo) */
  origin?: string;
}

export interface PwAbility {
  id: string;
  /** "+1", "−2", "0", "−X" ou vazio (habilidade estática) */
  cost: string;
  text: string;
}

export interface SagaChapter {
  id: string;
  /** "I", "II, III", "IV" ... */
  marks: string;
  text: string;
}

export interface CardFaceData {
  layout: CardLayout;
  name: string;
  manaCost: string;
  typeLine: string;
  rulesText: string;
  flavorText: string;
  power: string;
  toughness: string;
  loyalty: string;
  abilities: PwAbility[];
  chapters: SagaChapter[];
  /** true = cor do frame detectada a partir do custo / tipo */
  autoColor: boolean;
  colors: FrameColor[];
  art: ArtState;
  artist: string;
  /** 1 = automático (reduz até caber). <1 reduz, >1 aumenta o limite superior */
  textScale: number;
  textAlign: TextAlign;
  /** esconder caixa de texto (útil para cartas "só arte") */
  hideTextBox: boolean;
}

export interface CardMeta {
  frameStyle: FrameStyle;
  multiStyle: MultiStyle;
  borderColor: BorderColor;
  setCode: string;
  setName: string;
  setIconUri: string;
  iconMode: IconMode;
  customIcon: CustomIcon;
  rarity: MakerRarity;
  collectorNumber: string;
  collectorTotal: string;
  language: CardLang;
  copyright: string;
  showFooter: boolean;
  foil: FoilMode;
  holoStamp: boolean;
  /** coroa de lendária (auto = quando o tipo contém "Lendária/Legendary") */
  legendCrown: boolean;
}

export interface CustomCard {
  id: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  meta: CardMeta;
  faces: CardFaceData[];
}

export interface CardIndexEntry {
  id: string;
  name: string;
  typeLine: string;
  setCode: string;
  rarity: MakerRarity;
  frameStyle: FrameStyle;
  faceCount: number;
  thumb: string;
  updatedAt: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Catálogos                                                            */
/* ------------------------------------------------------------------ */

export const FRAME_STYLES: { id: FrameStyle; label: string; description: string }[] = [
  { id: 'modern', label: 'Moderno', description: 'Moldura clássica atual, placas coloridas e borda preta' },
  { id: 'classic', label: 'Clássico 93', description: 'Visual das primeiras edições, moldura grossa e texturizada' },
  { id: 'parchment', label: 'Pergaminho', description: 'Papel envelhecido, tinta e bordas ornamentadas' },
  { id: 'showcase', label: 'Grafite', description: 'Showcase escuro com realces âmbar, na identidade do site' },
  { id: 'neon', label: 'Néon', description: 'Futurista com cantos chanfrados e brilho de neon' },
  { id: 'borderless', label: 'Sem borda', description: 'Arte ocupando a carta inteira, caixas translúcidas' },
];

export const LAYOUTS: { id: CardLayout; label: string; description: string }[] = [
  { id: 'standard', label: 'Padrão', description: 'Criaturas, mágicas, artefatos, terrenos' },
  { id: 'saga', label: 'Saga', description: 'Capítulos numerados com arte lateral' },
  { id: 'planeswalker', label: 'Planeswalker', description: 'Habilidades de lealdade' },
  { id: 'token', label: 'Ficha', description: 'Sem custo de mana, arte maior' },
];

export const FRAME_COLORS: { id: FrameColor; label: string }[] = [
  { id: 'W', label: 'Branco' },
  { id: 'U', label: 'Azul' },
  { id: 'B', label: 'Preto' },
  { id: 'R', label: 'Vermelho' },
  { id: 'G', label: 'Verde' },
  { id: 'M', label: 'Ouro' },
  { id: 'A', label: 'Artefato' },
  { id: 'L', label: 'Terreno' },
  { id: 'C', label: 'Incolor' },
];

export const RARITIES: { id: MakerRarity; label: string; color: string }[] = [
  { id: 'common', label: 'Comum', color: '#18181b' },
  { id: 'uncommon', label: 'Incomum', color: '#bfd0d8' },
  { id: 'rare', label: 'Rara', color: '#e0c261' },
  { id: 'mythic', label: 'Mítica', color: '#f0642a' },
  { id: 'special', label: 'Especial', color: '#a65cc4' },
];

export const BORDER_COLORS: { id: BorderColor; label: string; hex: string }[] = [
  { id: 'black', label: 'Preta', hex: '#0b0b0c' },
  { id: 'white', label: 'Branca', hex: '#f1efe8' },
  { id: 'silver', label: 'Prata', hex: '#aeb4ba' },
  { id: 'gold', label: 'Dourada', hex: '#c9a64a' },
];

export const CUSTOM_ICONS: { id: CustomIcon; label: string }[] = [
  { id: 'diamond', label: 'Losango' },
  { id: 'star', label: 'Estrela' },
  { id: 'shield', label: 'Escudo' },
  { id: 'flame', label: 'Chama' },
  { id: 'moon', label: 'Lua' },
  { id: 'bolt', label: 'Raio' },
  { id: 'leaf', label: 'Folha' },
  { id: 'skull', label: 'Caveira' },
];

export const LANGUAGES: { id: CardLang; label: string; code: string }[] = [
  { id: 'pt', label: 'Português', code: 'PT' },
  { id: 'en', label: 'English', code: 'EN' },
];

export const SYMBOL_PALETTE: { sym: string; label: string }[] = [
  { sym: '{T}', label: 'Virar' },
  { sym: '{W}', label: 'Branco' },
  { sym: '{U}', label: 'Azul' },
  { sym: '{B}', label: 'Preto' },
  { sym: '{R}', label: 'Vermelho' },
  { sym: '{G}', label: 'Verde' },
  { sym: '{C}', label: 'Incolor' },
  { sym: '{X}', label: 'X' },
  { sym: '{1}', label: '1' },
  { sym: '{2}', label: '2' },
  { sym: '{3}', label: '3' },
  { sym: '{W/U}', label: 'Híbrido W/U' },
  { sym: '{2/W}', label: 'Híbrido 2/W' },
  { sym: '{G/P}', label: 'Phyrexian G' },
  { sym: '{S}', label: 'Neve' },
  { sym: '{E}', label: 'Energia' },
  { sym: '{Q}', label: 'Desvirar' },
];

export interface KeywordDef {
  id: string;
  pt: { name: string; reminder: string };
  en: { name: string; reminder: string };
}

export const KEYWORDS: KeywordDef[] = [
  {
    id: 'flying',
    pt: { name: 'Voar', reminder: 'Esta criatura só pode ser bloqueada por criaturas com voar ou alcance.' },
    en: { name: 'Flying', reminder: "This creature can't be blocked except by creatures with flying or reach." },
  },
  {
    id: 'first-strike',
    pt: { name: 'Iniciativa', reminder: 'Esta criatura causa dano de combate antes das criaturas sem iniciativa.' },
    en: { name: 'First strike', reminder: 'This creature deals combat damage before creatures without first strike.' },
  },
  {
    id: 'double-strike',
    pt: { name: 'Golpe duplo', reminder: 'Esta criatura causa dano de combate com iniciativa e também com dano normal.' },
    en: { name: 'Double strike', reminder: 'This creature deals both first-strike and regular combat damage.' },
  },
  {
    id: 'deathtouch',
    pt: { name: 'Toque mortífero', reminder: 'Qualquer quantidade de dano que esta criatura cause a uma criatura é suficiente para destruí-la.' },
    en: { name: 'Deathtouch', reminder: 'Any amount of damage this deals to a creature is enough to destroy it.' },
  },
  {
    id: 'haste',
    pt: { name: 'Ímpeto', reminder: 'Esta criatura pode atacar e usar {T} assim que entrar sob seu controle.' },
    en: { name: 'Haste', reminder: 'This creature can attack and {T} as soon as it comes under your control.' },
  },
  {
    id: 'hexproof',
    pt: { name: 'Resistência a magia', reminder: 'Esta criatura não pode ser alvo de mágicas nem de habilidades que seus oponentes controlam.' },
    en: { name: 'Hexproof', reminder: "This creature can't be the target of spells or abilities your opponents control." },
  },
  {
    id: 'indestructible',
    pt: { name: 'Indestrutível', reminder: 'Dano e efeitos de destruição não destroem esta permanente.' },
    en: { name: 'Indestructible', reminder: "Damage and effects that say \"destroy\" don't destroy this permanent." },
  },
  {
    id: 'lifelink',
    pt: { name: 'Vínculo com a vida', reminder: 'O dano causado por esta criatura também faz você ganhar essa quantidade de vida.' },
    en: { name: 'Lifelink', reminder: 'Damage dealt by this creature also causes you to gain that much life.' },
  },
  {
    id: 'menace',
    pt: { name: 'Ameaçar', reminder: 'Esta criatura não pode ser bloqueada, exceto por duas ou mais criaturas.' },
    en: { name: 'Menace', reminder: "This creature can't be blocked except by two or more creatures." },
  },
  {
    id: 'reach',
    pt: { name: 'Alcance', reminder: 'Esta criatura pode bloquear criaturas com voar.' },
    en: { name: 'Reach', reminder: 'This creature can block creatures with flying.' },
  },
  {
    id: 'trample',
    pt: { name: 'Atropelar', reminder: 'Esta criatura pode causar seu dano de combate excedente ao jogador ou planeswalker que ela estiver atacando.' },
    en: { name: 'Trample', reminder: 'This creature can deal excess combat damage to the player or planeswalker it’s attacking.' },
  },
  {
    id: 'vigilance',
    pt: { name: 'Vigilância', reminder: 'Atacar não faz esta criatura virar.' },
    en: { name: 'Vigilance', reminder: "Attacking doesn't cause this creature to tap." },
  },
  {
    id: 'flash',
    pt: { name: 'Lampejo', reminder: 'Você pode lançar esta mágica a qualquer momento em que puder lançar um instantâneo.' },
    en: { name: 'Flash', reminder: 'You may cast this spell any time you could cast an instant.' },
  },
  {
    id: 'defender',
    pt: { name: 'Defensor', reminder: 'Esta criatura não pode atacar.' },
    en: { name: 'Defender', reminder: "This creature can't attack." },
  },
];

export function keywordText(k: KeywordDef, lang: CardLang, withReminder: boolean): string {
  const d = lang === 'pt' ? k.pt : k.en;
  return withReminder ? `${d.name} (${d.reminder})` : d.name;
}

/** Atalhos de linha de tipo */
export const TYPE_CHIPS: Record<CardLang, { label: string; insert: string }[]> = {
  pt: [
    { label: 'Criatura', insert: 'Criatura — ' },
    { label: 'Lendária', insert: 'Lendária ' },
    { label: 'Artefato', insert: 'Artefato' },
    { label: 'Encantamento', insert: 'Encantamento' },
    { label: 'Terreno', insert: 'Terreno' },
    { label: 'Mágica Instantânea', insert: 'Mágica Instantânea' },
    { label: 'Feitiço', insert: 'Feitiço' },
    { label: 'Planeswalker', insert: 'Planeswalker — ' },
    { label: 'Saga', insert: 'Encantamento — Saga' },
    { label: 'Equipamento', insert: 'Artefato — Equipamento' },
  ],
  en: [
    { label: 'Creature', insert: 'Creature — ' },
    { label: 'Legendary', insert: 'Legendary ' },
    { label: 'Artifact', insert: 'Artifact' },
    { label: 'Enchantment', insert: 'Enchantment' },
    { label: 'Land', insert: 'Land' },
    { label: 'Instant', insert: 'Instant' },
    { label: 'Sorcery', insert: 'Sorcery' },
    { label: 'Planeswalker', insert: 'Planeswalker — ' },
    { label: 'Saga', insert: 'Enchantment — Saga' },
    { label: 'Equipment', insert: 'Artifact — Equipment' },
  ],
};

/* ------------------------------------------------------------------ */
/* Fábricas                                                             */
/* ------------------------------------------------------------------ */

let uidCounter = 0;
export function uid(prefix = 'cm'): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${uidCounter}`;
}

export function createBlankArt(): ArtState {
  return {
    src: '',
    zoom: 1,
    px: 0.5,
    py: 0.5,
    flipX: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  };
}

export function createBlankFace(layout: CardLayout = 'standard'): CardFaceData {
  return {
    layout,
    name: '',
    manaCost: '',
    typeLine: '',
    rulesText: '',
    flavorText: '',
    power: '',
    toughness: '',
    loyalty: '',
    abilities: [],
    chapters: [],
    autoColor: true,
    colors: [],
    art: createBlankArt(),
    artist: '',
    textScale: 1,
    textAlign: 'left',
    hideTextBox: false,
  };
}

export const DEFAULT_COPYRIGHT = 'Carta customizada · Não oficial';

export function createDefaultMeta(): CardMeta {
  return {
    frameStyle: 'modern',
    multiStyle: 'gold',
    borderColor: 'black',
    setCode: 'CUS',
    setName: 'Edição Personalizada',
    setIconUri: '',
    iconMode: 'custom',
    customIcon: 'diamond',
    rarity: 'rare',
    collectorNumber: '001',
    collectorTotal: '',
    language: 'pt',
    copyright: DEFAULT_COPYRIGHT,
    showFooter: true,
    foil: 'none',
    holoStamp: true,
    legendCrown: true,
  };
}

export function createBlankCard(partial?: { meta?: Partial<CardMeta>; faces?: CardFaceData[] }): CustomCard {
  const now = new Date().toISOString();
  return {
    id: uid('card'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    meta: { ...createDefaultMeta(), ...(partial?.meta || {}) },
    faces: partial?.faces && partial.faces.length > 0 ? partial.faces : [createBlankFace('standard')],
  };
}

export function cloneCard(card: CustomCard, newId = true): CustomCard {
  const copy: CustomCard = JSON.parse(JSON.stringify(card));
  if (newId) {
    copy.id = uid('card');
    const now = new Date().toISOString();
    copy.createdAt = now;
    copy.updatedAt = now;
  }
  return copy;
}

export function cardTitle(card: CustomCard): string {
  const names = card.faces.map((f) => f.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(' // ') : 'Carta sem nome';
}

export function toIndexEntry(card: CustomCard, thumb: string): CardIndexEntry {
  return {
    id: card.id,
    name: cardTitle(card),
    typeLine: card.faces[0]?.typeLine || '',
    setCode: card.meta.setCode,
    rarity: card.meta.rarity,
    frameStyle: card.meta.frameStyle,
    faceCount: card.faces.length,
    thumb,
    updatedAt: card.updatedAt,
    createdAt: card.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Mana & cores                                                         */
/* ------------------------------------------------------------------ */

/**
 * Converte "{2}{W}{U}" ou "2WU" em uma lista de símbolos sem chaves: ['2','W','U'].
 */
export function parseManaCost(input: string): string[] {
  const raw = (input || '').trim();
  if (!raw) return [];
  if (raw.includes('{')) {
    const out: string[] = [];
    const re = /\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) out.push(m[1].toUpperCase());
    return out;
  }
  const out: string[] = [];
  const re = /\d+|[WUBRGCXYZSEP]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out.push(m[0].toUpperCase());
  return out;
}

/** Converte o custo digitado ("2WU") para o formato canônico "{2}{W}{U}". */
export function normalizeManaCost(input: string): string {
  const syms = parseManaCost(input);
  return syms.map((s) => `{${s}}`).join('');
}

const COLOR_LETTERS = ['W', 'U', 'B', 'R', 'G'] as const;

/** Cores de mana (WUBRG) presentes em um custo, incluindo híbridos e phyrexianos. */
export function colorsInManaCost(manaCost: string): string[] {
  const found = new Set<string>();
  for (const sym of parseManaCost(manaCost)) {
    for (const part of sym.split('/')) {
      if ((COLOR_LETTERS as readonly string[]).includes(part)) found.add(part);
    }
  }
  return COLOR_LETTERS.filter((c) => found.has(c));
}

const TYPE_LAND = /\b(land|terreno)\b/i;
const TYPE_ARTIFACT = /\b(artifact|artefato)\b/i;
const TYPE_LEGENDARY = /\b(legendary|lend[aá]ri[ao]s?)\b/i;

export function isLegendary(typeLine: string): boolean {
  return TYPE_LEGENDARY.test(typeLine || '');
}

/** Detecta as cores do frame a partir do custo/tipo. */
export function detectFrameColors(face: Pick<CardFaceData, 'manaCost' | 'typeLine'>, multiStyle: MultiStyle): FrameColor[] {
  const cols = colorsInManaCost(face.manaCost) as FrameColor[];
  if (cols.length === 1) return cols;
  if (cols.length === 2) return multiStyle === 'gradient' ? cols : ['M'];
  if (cols.length > 2) return ['M'];
  if (TYPE_LAND.test(face.typeLine)) return ['L'];
  if (TYPE_ARTIFACT.test(face.typeLine)) return ['A'];
  return ['C'];
}

/** Cores efetivamente usadas no desenho do frame. */
export function resolveFrameColors(face: CardFaceData, meta: Pick<CardMeta, 'multiStyle'>): FrameColor[] {
  if (face.autoColor || face.colors.length === 0) return detectFrameColors(face, meta.multiStyle);
  const cols = face.colors;
  if (cols.length === 2) {
    // ouro e cores simples têm um único valor; para 2 cores respeitar o estilo.
    const bothBasic = cols.every((c) => (COLOR_LETTERS as readonly string[]).includes(c));
    if (bothBasic && meta.multiStyle === 'gold') return ['M'];
  }
  if (cols.length > 2) return ['M'];
  return cols.slice(0, 2);
}

/* ------------------------------------------------------------------ */
/* Pequenos utilitários de texto                                        */
/* ------------------------------------------------------------------ */

export function sanitizeFileName(name: string): string {
  const cleaned = (name || 'carta')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(0, 60) || 'carta';
}

export function romanNumeral(n: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let rest = Math.max(1, Math.min(39, Math.floor(n)));
  for (const [v, s] of map) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Conversão de texto de Planeswalker / Saga (usado ao importar)        */
/* ------------------------------------------------------------------ */

const PW_LINE = /^([+\-−–]?\s?(?:\d+|X))\s*:\s*(.*)$/;

export function parsePlaneswalkerText(text: string): PwAbility[] {
  const out: PwAbility[] = [];
  for (const line of (text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = PW_LINE.exec(trimmed);
    if (m) {
      out.push({ id: uid('ab'), cost: m[1].replace(/\s/g, '').replace(/[-–]/g, '−'), text: m[2] });
    } else {
      out.push({ id: uid('ab'), cost: '', text: trimmed });
    }
  }
  return out;
}

const SAGA_LINE = /^((?:[IVX]+)(?:\s*,\s*[IVX]+)*)\s*[—–-]\s*(.*)$/;

export function parseSagaText(text: string): { chapters: SagaChapter[]; rest: string } {
  const chapters: SagaChapter[] = [];
  const rest: string[] = [];
  for (const line of (text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = SAGA_LINE.exec(trimmed);
    if (m) chapters.push({ id: uid('ch'), marks: m[1].replace(/\s+/g, ' '), text: m[2] });
    else if (chapters.length > 0 && !/^\(/.test(trimmed)) chapters[chapters.length - 1].text += ' ' + trimmed;
    else rest.push(trimmed);
  }
  return { chapters, rest: rest.join('\n') };
}

/** Converte habilidades de PW em texto simples (ex.: ao trocar de layout). */
export function abilitiesToText(abilities: PwAbility[]): string {
  return abilities.map((a) => (a.cost ? `${a.cost}: ${a.text}` : a.text)).join('\n');
}

export function chaptersToText(chapters: SagaChapter[]): string {
  return chapters.map((c) => `${c.marks} — ${c.text}`).join('\n');
}

/* ------------------------------------------------------------------ */
/* Modelos iniciais                                                     */
/* ------------------------------------------------------------------ */

export interface CardTemplate {
  id: string;
  label: string;
  description: string;
  build: () => CustomCard;
}

function face(partial: Partial<CardFaceData>): CardFaceData {
  return { ...createBlankFace(partial.layout || 'standard'), ...partial };
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'blank',
    label: 'Em branco',
    description: 'Comece do zero',
    build: () => createBlankCard(),
  },
  {
    id: 'legend',
    label: 'Criatura lendária',
    description: 'Multicolor com habilidades e P/R',
    build: () =>
      createBlankCard({
        faces: [
          face({
            name: 'Aurelia, Guardiã das Brasas',
            manaCost: '{2}{R}{W}',
            typeLine: 'Criatura Lendária — Humano Guerreiro',
            rulesText:
              'Voar, vigilância\nToda vez que Aurelia atacar, criaturas que você controla ganham +1/+0 até o fim do turno.\n{T}: Aurelia causa 1 de dano a qualquer alvo.',
            flavorText: '"A chama que não se apaga é a que aprendeu a esperar."',
            power: '3',
            toughness: '4',
          }),
        ],
      }),
  },
  {
    id: 'instant',
    label: 'Mágica instantânea',
    description: 'Efeito rápido de uma só linha',
    build: () =>
      createBlankCard({
        meta: { rarity: 'uncommon', holoStamp: false },
        faces: [
          face({
            name: 'Reflexo da Maré',
            manaCost: '{1}{U}',
            typeLine: 'Mágica Instantânea',
            rulesText: 'Anule a mágica alvo, a menos que seu controlador pague {2}.\nCompre um card.',
            flavorText: 'A água sempre encontra o caminho de volta.',
          }),
        ],
      }),
  },
  {
    id: 'sorcery',
    label: 'Feitiço',
    description: 'Efeito poderoso no seu turno',
    build: () =>
      createBlankCard({
        meta: { rarity: 'mythic' },
        faces: [
          face({
            name: 'Tempestade de Cinzas',
            manaCost: '{X}{R}{R}',
            typeLine: 'Feitiço',
            rulesText:
              'Tempestade de Cinzas causa X de dano a cada criatura e a cada oponente.\nSe X for 5 ou mais, exile o card do topo do seu grimório; você pode jogá-lo até o fim do próximo turno.',
            flavorText: 'Do céu caiu a noite, e a noite tinha gosto de brasa.',
          }),
        ],
      }),
  },
  {
    id: 'equipment',
    label: 'Equipamento',
    description: 'Artefato com equipar',
    build: () =>
      createBlankCard({
        meta: { rarity: 'rare' },
        faces: [
          face({
            name: 'Lâmina do Alvorecer',
            manaCost: '{2}',
            typeLine: 'Artefato — Equipamento',
            rulesText:
              'A criatura equipada recebe +2/+1 e tem vínculo com a vida.\nQuando Lâmina do Alvorecer entrar no campo de batalha, anexe-a a uma criatura alvo que você controla.\nEquipar {3}',
            flavorText: 'Forjada na primeira luz, ela nunca esqueceu o calor.',
          }),
        ],
      }),
  },
  {
    id: 'land',
    label: 'Terreno',
    description: 'Terreno com habilidade de mana',
    build: () =>
      createBlankCard({
        meta: { rarity: 'common', holoStamp: false },
        faces: [
          face({
            name: 'Vale dos Sussurros',
            typeLine: 'Terreno',
            rulesText: 'Vale dos Sussurros entra no campo de batalha virado.\n{T}: Adicione {G} ou {U}.',
            flavorText: 'Quem escuta o vale, jamais volta o mesmo.',
            autoColor: false,
            colors: ['G', 'U'],
          }),
        ],
      }),
  },
  {
    id: 'planeswalker',
    label: 'Planeswalker',
    description: 'Habilidades de lealdade',
    build: () =>
      createBlankCard({
        meta: { rarity: 'mythic' },
        faces: [
          face({
            layout: 'planeswalker',
            name: 'Ilyra, Tecelã de Marés',
            manaCost: '{3}{U}{U}',
            typeLine: 'Planeswalker Lendária — Ilyra',
            loyalty: '4',
            abilities: [
              { id: uid('ab'), cost: '+1', text: 'Olhe os três cards do topo do seu grimório. Coloque um na sua mão e o resto no fundo.' },
              { id: uid('ab'), cost: '−2', text: 'Devolva a permanente alvo à mão do seu dono.' },
              { id: uid('ab'), cost: '−7', text: 'Controle o próximo turno de um oponente alvo.' },
            ],
          }),
        ],
      }),
  },
  {
    id: 'saga',
    label: 'Saga',
    description: 'Três capítulos',
    build: () =>
      createBlankCard({
        meta: { rarity: 'rare' },
        faces: [
          face({
            layout: 'saga',
            name: 'A Queda da Cidadela',
            manaCost: '{3}{B}',
            typeLine: 'Encantamento — Saga',
            rulesText: '(À medida que esta Saga entra e depois do seu compasso, adicione um marcador de tradição. Sacrifique depois do III.)',
            chapters: [
              { id: uid('ch'), marks: 'I', text: 'Cada oponente sacrifica uma criatura.' },
              { id: uid('ch'), marks: 'II', text: 'Cada jogador descarta um card.' },
              { id: uid('ch'), marks: 'III', text: 'Devolva um card de criatura do seu cemitério ao campo de batalha.' },
            ],
          }),
        ],
      }),
  },
  {
    id: 'token',
    label: 'Ficha de criatura',
    description: 'Ficha 1/1 com habilidade',
    build: () =>
      createBlankCard({
        meta: { rarity: 'common', holoStamp: false, setCode: 'TCUS', setName: 'Fichas Personalizadas', collectorNumber: '001' },
        faces: [
          face({
            layout: 'token',
            name: 'Esquilo Mecânico',
            typeLine: 'Ficha de Criatura Artefato — Construto',
            rulesText: 'Voar',
            power: '1',
            toughness: '1',
            autoColor: false,
            colors: ['A'],
          }),
        ],
      }),
  },
  {
    id: 'dfc',
    label: 'Dupla face',
    description: 'Criatura que se transforma',
    build: () =>
      createBlankCard({
        meta: { rarity: 'rare' },
        faces: [
          face({
            name: 'Caçador Noturno',
            manaCost: '{2}{G}',
            typeLine: 'Criatura — Humano Licantropo',
            rulesText: 'No início de cada fase de manutenção, se nenhuma mágica foi lançada no turno anterior, transforme Caçador Noturno.',
            power: '2',
            toughness: '2',
            flavorText: 'Sob a lua cheia, o caçador torna-se a caça.',
          }),
          face({
            name: 'Fera da Lua Cheia',
            typeLine: 'Criatura — Licantropo',
            rulesText: 'Atropelar\nNo início de cada fase de manutenção, se um jogador lançou duas ou mais mágicas no turno anterior, transforme Fera da Lua Cheia.',
            power: '4',
            toughness: '4',
            autoColor: false,
            colors: ['G'],
          }),
        ],
      }),
  },
];
