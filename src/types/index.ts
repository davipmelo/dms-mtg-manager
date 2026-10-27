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
}

export interface ProxyItem {
  id: string;
  card: Card | TokenCard;
  quantity: number;
  isToken?: boolean;
}

export interface SystemBackup {
  app: 'dms-mtg-manager';
  schemaVersion: number;
  exportedAt: string;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
}

export type ViewMode = 'table' | 'grid' | 'stacked';
