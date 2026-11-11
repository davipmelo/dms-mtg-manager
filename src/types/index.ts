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
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
}

/**
 * Checks if a card is double-faced (Transform, MDFC, Battle, Meld, Reversible, Double-Faced Token)
 * Excluding physical split / adventure / flip cards that share the same single front face.
 */
export function isDoubleFacedCard(card?: Card | TokenCard | null): boolean {
  if (!card) return false;
  if (card.cardFaces && card.cardFaces.length > 1) return true;
  if (
    card.layout &&
    ['transform', 'modal_dfc', 'meld', 'battle', 'reversible_card', 'double_faced_token'].includes(
      card.layout
    )
  ) {
    return true;
  }
  if (card.layout && ['split', 'adventure', 'flip'].includes(card.layout)) {
    return false;
  }
  if (card.name && card.name.includes(' // ')) {
    return true;
  }
  if ('meldResultName' in card && Boolean(card.meldResultName)) {
    return true;
  }
  return false;
}

/**
 * Safely compares two cards to determine if they represent the exact same print/art version.
 * Prevents MPCFill alters or custom arts with generic set codes/numbers from erroneously matching
 * cards with different names. Also distinguishes double-faced cards that have different back face arts.
 */
export function isSameCardPrint(a?: Card | null, b?: Card | null): boolean {
  if (!a || !b) return false;
  if (a.name.toLowerCase().trim() !== b.name.toLowerCase().trim()) return false;
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


