/**
 * Card Maker — busca de cartas/regras/sabor/artes no Scryfall e aplicação em cartas customizadas.
 */
import {
  CardFaceData,
  CardLang,
  CardLayout,
  CustomCard,
  FrameColor,
  MakerRarity,
  cloneCard,
  createBlankCard,
  createBlankFace,
  parsePlaneswalkerText,
  parseSagaText,
  abilitiesToText,
  chaptersToText,
} from './model';

const API = 'https://api.scryfall.com';

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

export interface RefFace {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  flavorText: string;
  power: string;
  toughness: string;
  loyalty: string;
  artCrop: string;
  image: string;
  artist: string;
  colors: string[];
}

export interface RefCard {
  id: string;
  oracleId: string;
  name: string;
  lang: string;
  layout: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: MakerRarity;
  releasedAt: string;
  artist: string;
  scryfallUri: string;
  isDfc: boolean;
  faces: RefFace[];
}

export type SearchMode = 'name' | 'rules' | 'flavor' | 'flavorByName' | 'artist';

export interface SearchResult {
  cards: RefCard[];
  total: number;
  hasMore: boolean;
  nextPage?: string;
}

export interface SetInfo {
  code: string;
  name: string;
  type: string;
  releasedAt: string;
  iconUri: string;
  cardCount: number;
  digital: boolean;
}

/* ------------------------------------------------------------------ */
/* Requisições (fila com intervalo mínimo, como pede o Scryfall)        */
/* ------------------------------------------------------------------ */

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function scryFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const run = async () => {
    const wait = Math.max(0, lastRequestAt + 110 - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    lastRequestAt = Date.now();
    return fetch(url, { headers: { Accept: 'application/json' }, signal });
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

/* ------------------------------------------------------------------ */
/* Parse                                                                */
/* ------------------------------------------------------------------ */

const DFC_LAYOUTS = ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseFace(raw: any, parent: any): RefFace {
  const foreign = parent.lang && parent.lang !== 'en';
  const uris = raw.image_uris || parent.image_uris || {};
  return {
    name: str(foreign ? raw.printed_name || raw.name : raw.name),
    manaCost: str(raw.mana_cost),
    typeLine: str(foreign ? raw.printed_type_line || raw.type_line : raw.type_line),
    oracleText: str(foreign ? raw.printed_text ?? raw.oracle_text : raw.oracle_text),
    flavorText: str(raw.flavor_text),
    power: str(raw.power),
    toughness: str(raw.toughness),
    loyalty: str(raw.loyalty),
    artCrop: str(uris.art_crop),
    image: str(uris.normal || uris.large || uris.small),
    artist: str(raw.artist || parent.artist),
    colors: Array.isArray(raw.colors) ? raw.colors : Array.isArray(parent.colors) ? parent.colors : [],
  };
}

export function parseRef(raw: any): RefCard {
  const layout = str(raw.layout);
  const hasFaces = Array.isArray(raw.card_faces) && raw.card_faces.length > 0;
  const isDfc = hasFaces && raw.card_faces.length > 1 && DFC_LAYOUTS.includes(layout);
  let faces: RefFace[];
  if (hasFaces && isDfc) {
    faces = raw.card_faces.slice(0, 2).map((f: any) => parseFace(f, raw));
  } else if (hasFaces && raw.card_faces.length > 1) {
    // split / adventure / flip: tudo em uma única face física
    const parsed: RefFace[] = raw.card_faces.map((f: any) => parseFace(f, raw));
    const main = { ...parsed[0] };
    main.name = str(raw.name);
    main.manaCost = parsed.map((f) => f.manaCost).filter(Boolean).join(' // ');
    main.typeLine = str(raw.type_line);
    main.oracleText = parsed.map((f, i) => (i === 0 ? f.oracleText : `${f.name}${f.manaCost ? ' ' + f.manaCost : ''} — ${f.typeLine}\n${f.oracleText}`)).join('\n');
    faces = [main];
  } else {
    faces = [parseFace(raw, raw)];
  }
  const rarity = (['common', 'uncommon', 'rare', 'mythic'].includes(raw.rarity) ? raw.rarity : 'special') as MakerRarity;
  return {
    id: str(raw.id),
    oracleId: str(raw.oracle_id),
    name: str(raw.lang && raw.lang !== 'en' ? raw.printed_name || raw.name : raw.name),
    lang: str(raw.lang) || 'en',
    layout,
    setCode: str(raw.set).toUpperCase(),
    setName: str(raw.set_name),
    collectorNumber: str(raw.collector_number),
    rarity,
    releasedAt: str(raw.released_at),
    artist: str(raw.artist),
    scryfallUri: str(raw.scryfall_uri),
    isDfc,
    faces,
  };
}

/* ------------------------------------------------------------------ */
/* Busca                                                                */
/* ------------------------------------------------------------------ */

export function buildSearchQuery(input: string, mode: SearchMode): string {
  const q = input.trim();
  if (!q) return '';
  // Sintaxe avançada do Scryfall é repassada sem alterações.
  if (/[:"]/.test(q)) return mode === 'flavorByName' ? `${q} has:flavor` : q;
  const safe = q.replace(/"/g, '');
  switch (mode) {
    case 'rules':
      return `o:"${safe}"`;
    case 'flavor':
      return `ft:"${safe}"`;
    case 'flavorByName':
      return `${safe} has:flavor`;
    case 'artist':
      return `a:"${safe}"`;
    default:
      return safe;
  }
}

export async function searchReferences(
  input: string,
  mode: SearchMode,
  signal?: AbortSignal,
  pageUrl?: string
): Promise<SearchResult> {
  const query = buildSearchQuery(input, mode);
  if (!query && !pageUrl) return { cards: [], total: 0, hasMore: false };
  let url = pageUrl;
  if (!url) {
    const unique = mode === 'flavor' || mode === 'flavorByName' ? 'prints' : mode === 'artist' ? 'art' : 'cards';
    const order = unique === 'prints' ? 'released' : mode === 'name' ? 'name' : 'edhrec';
    const dir = unique === 'prints' ? '&dir=desc' : '';
    url = `${API}/cards/search?q=${encodeURIComponent(query)}&unique=${unique}&order=${order}${dir}`;
  }
  const res = await scryFetch(url, signal);
  if (res.status === 404) return { cards: [], total: 0, hasMore: false };
  if (!res.ok) throw new Error(`O Scryfall respondeu com erro ${res.status}.`);
  const data = await res.json();
  let cards: RefCard[] = (data.data || []).map(parseRef);
  if (mode === 'flavor' || mode === 'flavorByName') {
    const seen = new Set<string>();
    cards = cards.filter((c) => {
      const flavor = c.faces.map((f) => f.flavorText).join('|').trim();
      if (!flavor) return false;
      const key = `${c.name}|${flavor}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return { cards, total: data.total_cards ?? cards.length, hasMore: Boolean(data.has_more), nextPage: data.next_page };
}

/** Galeria de artes (uma por ilustração distinta) por nome de carta ou artista. */
export async function searchArt(
  input: string,
  mode: 'name' | 'artist',
  signal?: AbortSignal,
  pageUrl?: string
): Promise<SearchResult> {
  const q = input.trim();
  if (!q && !pageUrl) return { cards: [], total: 0, hasMore: false };
  let url = pageUrl;
  if (!url) {
    const query = /[:"]/.test(q) ? q : mode === 'artist' ? `a:"${q.replace(/"/g, '')}"` : q;
    const order = mode === 'artist' ? 'released' : 'edhrec';
    const dir = mode === 'artist' ? '&dir=desc' : '';
    url = `${API}/cards/search?q=${encodeURIComponent(query)}&unique=art&order=${order}${dir}&include_extras=true`;
  }
  const res = await scryFetch(url, signal);
  if (res.status === 404) return { cards: [], total: 0, hasMore: false };
  if (!res.ok) throw new Error(`O Scryfall respondeu com erro ${res.status}.`);
  const data = await res.json();
  const cards: RefCard[] = (data.data || []).map(parseRef).filter((c: RefCard) => c.faces.some((f) => f.artCrop));
  return { cards, total: data.total_cards ?? cards.length, hasMore: Boolean(data.has_more), nextPage: data.next_page };
}

/** Todas as artes distintas de uma carta (para o seletor de arte). */
export async function fetchArtVariants(name: string, signal?: AbortSignal): Promise<RefCard[]> {
  const q = `!"${name.replace(/"/g, '')}"`;
  const url = `${API}/cards/search?q=${encodeURIComponent(q)}&unique=art&order=released&dir=desc&include_extras=true`;
  const res = await scryFetch(url, signal);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map(parseRef);
}

/** Tenta obter a impressão em português (ou outro idioma) de uma carta. */
export async function fetchLocalizedPrint(ref: RefCard, lang: CardLang, signal?: AbortSignal): Promise<RefCard | null> {
  if (lang === 'en') return ref;
  try {
    if (ref.setCode && ref.collectorNumber) {
      const direct = await scryFetch(
        `${API}/cards/${ref.setCode.toLowerCase()}/${encodeURIComponent(ref.collectorNumber)}/${lang}`,
        signal
      );
      if (direct.ok) return parseRef(await direct.json());
    }
    const q = `oracleid:${ref.oracleId} lang:${lang}`;
    const res = await scryFetch(
      `${API}/cards/search?q=${encodeURIComponent(q)}&unique=prints&include_multilingual=true&order=released&dir=desc`,
      signal
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = (data.data || []).map(parseRef)[0];
    return first || null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Edições (sets)                                                       */
/* ------------------------------------------------------------------ */

const SETS_KEY = 'dms_cardmaker_sets_v1';
let setsMemo: SetInfo[] | null = null;

export async function loadSets(): Promise<SetInfo[]> {
  if (setsMemo) return setsMemo;
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { t: number; data: SetInfo[] };
      if (Date.now() - parsed.t < 7 * 24 * 3600 * 1000 && parsed.data.length > 0) {
        setsMemo = parsed.data;
        return setsMemo;
      }
    }
  } catch {
    /* cache inválido — recarrega */
  }
  const res = await scryFetch(`${API}/sets`);
  if (!res.ok) throw new Error('Não foi possível carregar a lista de edições.');
  const json = await res.json();
  const data: SetInfo[] = (json.data || []).map((s: any) => ({
    code: str(s.code).toUpperCase(),
    name: str(s.name),
    type: str(s.set_type),
    releasedAt: str(s.released_at),
    iconUri: str(s.icon_svg_uri),
    cardCount: Number(s.card_count) || 0,
    digital: Boolean(s.digital),
  }));
  data.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  setsMemo = data;
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* quota — segue só em memória */
  }
  return data;
}

export function setIconUrl(code: string): string {
  return code ? `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg` : '';
}

/* ------------------------------------------------------------------ */
/* Aplicar referência em uma carta                                      */
/* ------------------------------------------------------------------ */

export type RefField = 'name' | 'cost' | 'type' | 'rules' | 'pt' | 'flavor' | 'art' | 'artist' | 'set';

export const REF_FIELD_LABELS: Record<RefField, string> = {
  name: 'Nome',
  cost: 'Custo de mana',
  type: 'Linha de tipo',
  rules: 'Texto de regras',
  pt: 'Poder / Resistência / Lealdade',
  flavor: 'Texto de sabor',
  art: 'Arte',
  artist: 'Artista',
  set: 'Edição, raridade e número',
};

function layoutFromType(typeLine: string, current: CardLayout): CardLayout {
  if (/planeswalker/i.test(typeLine)) return 'planeswalker';
  if (/\bsaga\b/i.test(typeLine)) return 'saga';
  if (/\btoken\b|\bficha\b/i.test(typeLine)) return 'token';
  return current === 'planeswalker' || current === 'saga' ? 'standard' : current;
}

function mapColors(cols: string[]): FrameColor[] {
  const valid = cols.filter((c) => 'WUBRG'.includes(c)) as FrameColor[];
  if (valid.length === 0) return [];
  if (valid.length > 2) return ['M'];
  return valid;
}

export interface ApplyOptions {
  rulesMode: 'replace' | 'append';
}

export function applyRefToFace(face: CardFaceData, rf: RefFace, fields: Set<RefField>, opts: ApplyOptions): CardFaceData {
  const next: CardFaceData = JSON.parse(JSON.stringify(face));
  const wantsRules = fields.has('rules');
  const wantsType = fields.has('type');
  const typeForLayout = wantsType ? rf.typeLine : wantsRules ? rf.typeLine : next.typeLine;

  if (wantsRules || wantsType) {
    const layout = layoutFromType(typeForLayout, next.layout);
    // Só troca para planeswalker/saga quando o texto de regras também vem junto.
    if (wantsRules || layout === 'standard') next.layout = layout;
  }

  if (fields.has('name')) next.name = rf.name;
  if (fields.has('cost')) {
    next.manaCost = rf.manaCost;
    if (!rf.manaCost && rf.colors.length > 0) {
      next.autoColor = false;
      next.colors = mapColors(rf.colors);
    } else {
      next.autoColor = true;
      next.colors = [];
    }
  }
  if (wantsType) next.typeLine = rf.typeLine;
  if (wantsRules) {
    if (next.layout === 'planeswalker') {
      const abilities = parsePlaneswalkerText(rf.oracleText);
      next.abilities = opts.rulesMode === 'append' ? [...next.abilities, ...abilities] : abilities;
    } else if (next.layout === 'saga') {
      const { chapters, rest } = parseSagaText(rf.oracleText);
      next.chapters = opts.rulesMode === 'append' ? [...next.chapters, ...chapters] : chapters;
      next.rulesText = opts.rulesMode === 'append' && next.rulesText ? `${next.rulesText}\n${rest}` : rest;
    } else {
      next.rulesText = opts.rulesMode === 'append' && next.rulesText.trim() ? `${next.rulesText.trim()}\n${rf.oracleText}` : rf.oracleText;
    }
  }
  if (fields.has('pt')) {
    next.power = rf.power;
    next.toughness = rf.toughness;
    if (rf.loyalty) next.loyalty = rf.loyalty;
  }
  if (fields.has('flavor')) next.flavorText = rf.flavorText;
  if (fields.has('art') && rf.artCrop) {
    next.art = { ...next.art, src: rf.artCrop, zoom: 1, px: 0.5, py: 0.5, flipX: false, origin: 'scryfall' };
  }
  if (fields.has('artist')) next.artist = rf.artist;
  return next;
}

export function applyRefToCard(card: CustomCard, faceIndex: number, ref: RefCard, fields: Set<RefField>, opts: ApplyOptions): CustomCard {
  const next = cloneCard(card, false);
  const rf = ref.faces[Math.min(faceIndex, ref.faces.length - 1)];
  next.faces[faceIndex] = applyRefToFace(next.faces[faceIndex], rf, fields, opts);
  if (fields.has('set')) {
    next.meta.setCode = ref.setCode;
    next.meta.setName = ref.setName;
    next.meta.setIconUri = setIconUrl(ref.setCode);
    next.meta.iconMode = 'set';
    next.meta.collectorNumber = ref.collectorNumber;
    next.meta.rarity = ref.rarity;
    if (ref.lang === 'pt' || ref.lang === 'en') next.meta.language = ref.lang;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export const ALL_REF_FIELDS: RefField[] = ['name', 'cost', 'type', 'rules', 'pt', 'flavor', 'art', 'artist', 'set'];

/** Cria uma carta nova já preenchida a partir de uma carta existente. */
export function createCardFromRef(ref: RefCard): CustomCard {
  const card = createBlankCard({ faces: ref.faces.map(() => createBlankFace('standard')) });
  const fields = new Set<RefField>(ALL_REF_FIELDS);
  ref.faces.forEach((_rf, i) => {
    card.faces[i] = applyRefToFace(card.faces[i], ref.faces[i], fields, { rulesMode: 'replace' });
  });
  card.meta.setCode = ref.setCode;
  card.meta.setName = ref.setName;
  card.meta.setIconUri = setIconUrl(ref.setCode);
  card.meta.iconMode = 'set';
  card.meta.collectorNumber = ref.collectorNumber;
  card.meta.rarity = ref.rarity;
  card.meta.language = ref.lang === 'pt' ? 'pt' : 'en';
  return card;
}

/** Texto de apoio: como o conteúdo atual ficaria (para pré-visualizar o "antes/depois"). */
export function describeRefFace(rf: RefFace): string {
  const parts = [rf.oracleText, rf.flavorText ? `“${rf.flavorText}”` : ''].filter(Boolean);
  return parts.join('\n');
}

export { abilitiesToText, chaptersToText };
