export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special';

export type DeckFormat =
  | 'commander'
  | 'standard'
  | 'modern'
  | 'pioneer'
  | 'pauper'
  | 'legacy'
  | 'vintage'
  | 'brawl'
  | 'casual';

export type CardCategory =
  | 'commander'
  | 'partner'
  | 'companion'
  | 'main'
  | 'sideboard'
  | 'maybeboard';

export interface CardPrint {
  id: string;
  oracleId?: string;
  printsSearchUri?: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageUrl: string;
  imageUrlLarge?: string;
  imageUrlArtCrop?: string;
  releasedAt?: string;
  artist?: string;
  priceUsd?: number;
  frame?: string;
  cardFaces?: CardFace[];
}

export interface CardFace {
  name: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  imageUrl: string;
  imageUrlLarge?: string;
  imageUrlSmall?: string;
  imageUrlArtCrop?: string;
  artist?: string;
  frame?: string;
}

export interface Card {
  id: string;
  oracleId?: string;
  name: string;
  namePt?: string;
  manaCost?: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
  colors: string[];
  colorIdentity: string[];
  power?: string;
  toughness?: string;
  rarity: CardRarity;
  setName: string;
  setCode: string;
  collectorNumber: string;
  imageUrl: string;
  imageUrlLarge?: string;
  imageUrlSmall?: string;
  imageUrlArtCrop?: string;
  priceUsd?: number;
  isFoil?: boolean;
  printsSearchUri?: string;
  allPrints?: CardPrint[];
  cardFaces?: CardFace[];
  faceLabel?: 'frente' | 'verso' | string;
  layout?: string;
  meldResultName?: string;
  meldResultUri?: string;
  artist?: string;
  frame?: string;
}

export interface CollectionItem {
  id: string; // unique collection entry id
  card: Card;
  quantity: number; // total owned
  inUseQuantity?: number; // dynamically computed
  availableQuantity?: number; // dynamically computed (quantity - inUseQuantity)
  usedInDecks?: Array<{ deckId: string; deckName: string; count: number }>;
  isFoil?: boolean;
  condition?: 'NM' | 'SP' | 'MP' | 'HP' | 'DMG';
  language?: string;
  notes?: string;
  dateAdded: string;
  tags?: string[];
}

export interface DeckCard {
  card: Card;
  quantity: number;
  category: CardCategory;
  collectionItemId?: string;
  isFoil?: boolean;
  instanceId?: string;
}

export interface DeckTag {
  id: string;
  name: string;
  color: string;
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  description?: string;
  commanderCard?: Card;
  partnerCard?: Card;
  cards: DeckCard[];
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export type UtilityCategory =
  | 'tokens'
  | 'planes'
  | 'emblems'
  | 'dungeons'
  | 'markers'
  | 'schemes'
  | 'conspiracies'
  | 'attractions';

export interface TokenCard {
  id: string;
  oracleId?: string;
  printsSearchUri?: string;
  name: string;
  typeLine: string;
  oracleText?: string;
  colors: string[];
  power?: string;
  toughness?: string;
  imageUrl: string;
  imageUrlLarge?: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  cardFaces?: CardFace[];
  faceLabel?: 'frente' | 'verso' | string;
  layout?: string;
  meldResultName?: string;
  meldResultUri?: string;
  artist?: string;
  frame?: string;
}

export interface ProxyItem {
  id: string;
  card: Card | TokenCard;
  quantity: number;
  isToken?: boolean;
}

export interface SystemBackup {
  app: 'dms-mtg-manager' | 'proliferate';
  schemaVersion: number;
  exportedAt: string;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  deckTags?: DeckTag[];
}

export type ViewMode = 'table' | 'grid';

export interface UserProfile {
  uid: string;
  username: string;
  email?: string; // Private / confidential
  isAnonymous?: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudUserData {
  app: 'dms-mtg-manager' | 'proliferate';
  schemaVersion: number;
  updatedAt: string;
  clientSessionId?: string;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  deckTags?: DeckTag[];
  settings?: Record<string, any>;
}

/**
 * Checks if a card is double-faced (Transform, MDFC, Battle, Meld, Reversible, Double-Faced Token)
 * Excluding physical split / adventure / flip / aftermath / normal cards that share the same single front face.
 */
export function isDoubleFacedCard(card?: Card | TokenCard | null): boolean {
  if (!card) return false;

  const layout = card.layout?.toLowerCase();

  // 1. Explicitly single-faced layouts are NEVER double-faced
  if (
    layout &&
    ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
      layout
    )
  ) {
    return false;
  }

  // 2. Adventure cards (unless transform) are single-faced
  if (card.typeLine?.toLowerCase().includes('adventure') && !layout?.includes('transform')) {
    return false;
  }

  // 3. Known double-faced card layouts
  if (
    layout &&
    [
      'transform',
      'modal_dfc',
      'meld',
      'battle',
      'reversible_card',
      'double_faced_token',
      'double_sided',
      'art_series',
    ].includes(layout)
  ) {
    return true;
  }

  // 4. Meld cards
  if ('meldResultName' in card && Boolean(card.meldResultName)) {
    return true;
  }

  // 5. Card with valid multiple faces already attached (excluding single-faced layouts)
  if (card.cardFaces && card.cardFaces.length > 1) {
    return true;
  }

  return false;
}

/**
 * Flexible card name matching for Magic: The Gathering cards.
 * Handles split / transform / modal_dfc cards where one system stores "Front // Back"
 * and another stores just "Front" or uses different slash spacing.
 */
export function isCardNameMatch(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;
  const a = nameA.toLowerCase().trim();
  const b = nameB.toLowerCase().trim();
  if (a === b) return true;

  // Normalize delimiters (" // ", " / ", or "//" all become " // ")
  const aClean = a.replace(/\s*\/{1,2}\s*/g, ' // ');
  const bClean = b.replace(/\s*\/{1,2}\s*/g, ' // ');
  if (aClean === bClean) return true;

  const aFront = aClean.split(' // ')[0].trim();
  const bFront = bClean.split(' // ')[0].trim();
  if (aFront && bFront && aFront === bFront) return true;

  const aBack = aClean.includes(' // ') ? aClean.split(' // ')[1].trim() : '';
  const bBack = bClean.includes(' // ') ? bClean.split(' // ')[1].trim() : '';
  if (aBack && bBack && aBack === bBack) return true;

  // Check if one is exactly the front face of the other
  if (aFront === b || bFront === a) return true;

  return false;
}

/**
 * Safely compares two cards to determine if they represent the exact same print/art version.
 * Prevents MPCFill alters or custom arts with generic set codes/numbers from erroneously matching
 * cards with different names. Also distinguishes double-faced cards that have different back face arts.
 */
export function isSameCardPrint(a?: Card | null, b?: Card | null): boolean {
  if (!a || !b) return false;
  if (!isCardNameMatch(a.name, b.name)) return false;
  if (a.id === b.id) return true;

  // Check back faces if either card has resolved faces
  const aBackImg = a.cardFaces?.[1]?.imageUrl;
  const bBackImg = b.cardFaces?.[1]?.imageUrl;
  if (aBackImg && bBackImg && aBackImg !== bBackImg) {
    return false;
  }

  const isAlterOrCustom =
    a.setCode === 'MPC' ||
    a.setCode === 'CUSTOM' ||
    a.collectorNumber === '★' ||
    b.setCode === 'MPC' ||
    b.setCode === 'CUSTOM' ||
    b.collectorNumber === '★';
  if (isAlterOrCustom) {
    return Boolean(a.imageUrl && b.imageUrl && a.imageUrl === b.imageUrl);
  }
  return Boolean(
    a.setCode &&
      b.setCode &&
      a.setCode.toLowerCase() === b.setCode.toLowerCase() &&
      a.collectorNumber &&
      b.collectorNumber &&
      a.collectorNumber === b.collectorNumber
  );
}


