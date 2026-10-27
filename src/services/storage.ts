import { CollectionItem, Deck, ProxyItem, Card, SystemBackup } from '../types';

const STORAGE_KEYS = {
  COLLECTION: 'dms_mtg_collection_v1',
  DECKS: 'dms_mtg_decks_v1',
  PROXIES: 'dms_mtg_proxies_v1',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string): boolean {
  return Boolean(val && UUID_REGEX.test(val.trim()));
}

// Initial starter collection with verified Scryfall UUIDs, image URLs, and printsSearchUri
export const SAMPLE_STARTER_CARDS: Card[] = [
  {
    id: '46ca0b66-a000-4483-b916-f5b89e710244',
    oracleId: '6ad8011d-3471-4369-9d68-b264cc027487',
    name: 'Sol Ring',
    manaCost: '{1}',
    cmc: 1,
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}{C}.',
    colors: [],
    colorIdentity: [],
    rarity: 'uncommon',
    setName: 'Commander Masters',
    setCode: 'CMM',
    collectorNumber: '410',
    imageUrl: 'https://cards.scryfall.io/normal/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A6ad8011d-3471-4369-9d68-b264cc027487&unique=prints',
    priceUsd: 1.94,
  },
  {
    id: 'ae5f9fb1-5a55-4db3-98a1-2628e3598c18',
    oracleId: '4457ed35-7c10-48c8-9776-456485fdf070',
    name: 'Lightning Bolt',
    manaCost: '{R}',
    cmc: 1,
    typeLine: 'Instant',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    colors: ['R'],
    colorIdentity: ['R'],
    rarity: 'uncommon',
    setName: "Commander Legends: Battle for Baldur's Gate",
    setCode: 'CLB',
    collectorNumber: '187',
    imageUrl: 'https://cards.scryfall.io/normal/front/a/e/ae5f9fb1-5a55-4db3-98a1-2628e3598c18.jpg?1783922736',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/a/e/ae5f9fb1-5a55-4db3-98a1-2628e3598c18.jpg?1783922736',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/a/e/ae5f9fb1-5a55-4db3-98a1-2628e3598c18.jpg?1783922736',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A4457ed35-7c10-48c8-9776-456485fdf070&unique=prints',
    priceUsd: 2.2,
  },
  {
    id: '043b2d30-a40f-4d47-933b-80544512f9c2',
    oracleId: '53236dd7-845a-444c-96d5-f41ed7325d8f',
    name: 'Rhystic Study',
    manaCost: '{2}{U}',
    cmc: 3,
    typeLine: 'Enchantment',
    oracleText: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    colors: ['U'],
    colorIdentity: ['U'],
    rarity: 'rare',
    setName: 'Wilds of Eldraine: Enchanting Tales',
    setCode: 'WOT',
    collectorNumber: '25',
    imageUrl: 'https://cards.scryfall.io/normal/front/0/4/043b2d30-a40f-4d47-933b-80544512f9c2.jpg?1783914927',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/0/4/043b2d30-a40f-4d47-933b-80544512f9c2.jpg?1783914927',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/0/4/043b2d30-a40f-4d47-933b-80544512f9c2.jpg?1783914927',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A53236dd7-845a-444c-96d5-f41ed7325d8f&unique=prints',
    priceUsd: 38.5,
  },
  {
    id: '1920dae4-fb92-4f19-ae4b-eb3276b8dac7',
    oracleId: 'cc187110-1148-4090-bbb8-e205694a39f5',
    name: 'Counterspell',
    manaCost: '{U}{U}',
    cmc: 2,
    typeLine: 'Instant',
    oracleText: 'Counter target spell.',
    colors: ['U'],
    colorIdentity: ['U'],
    rarity: 'uncommon',
    setName: 'Modern Horizons 2',
    setCode: 'MH2',
    collectorNumber: '267',
    imageUrl: 'https://cards.scryfall.io/normal/front/1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg?1783926788',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg?1783926788',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg?1783926788',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Acc187110-1148-4090-bbb8-e205694a39f5&unique=prints',
    priceUsd: 2.69,
  },
  {
    id: 'd0d33d52-3d28-4635-b985-51e126289259',
    oracleId: '7e6b9b59-cd68-4e3c-827b-38833c92d6eb',
    name: "Atraxa, Praetors' Voice",
    manaCost: '{G}{W}{U}{B}',
    cmc: 4,
    typeLine: 'Legendary Creature — Phyrexian Angel Horror',
    oracleText: 'Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.',
    colors: ['W', 'U', 'B', 'G'],
    colorIdentity: ['W', 'U', 'B', 'G'],
    power: '4',
    toughness: '4',
    rarity: 'mythic',
    setName: 'Double Masters',
    setCode: '2XM',
    collectorNumber: '190',
    imageUrl: 'https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1783930136',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1783930136',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1783930136',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7e6b9b59-cd68-4e3c-827b-38833c92d6eb&unique=prints',
    priceUsd: 27.64,
  },
  {
    id: 'a24b4cb6-cebb-428b-8654-74347a6a8d63',
    oracleId: '82004860-e589-4e38-8d61-8c0210e4ea39',
    name: 'Demonic Tutor',
    manaCost: '{1}{B}',
    cmc: 2,
    typeLine: 'Sorcery',
    oracleText: 'Search your library for a card, put that card into your hand, then shuffle.',
    colors: ['B'],
    colorIdentity: ['B'],
    rarity: 'rare',
    setName: 'Commander Masters',
    setCode: 'CMM',
    collectorNumber: '150',
    imageUrl: 'https://cards.scryfall.io/normal/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1783915679',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1783915679',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1783915679',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A82004860-e589-4e38-8d61-8c0210e4ea39&unique=prints',
    priceUsd: 66.5,
  },
  {
    id: '496849a5-4b24-4eae-8bfb-d46f645d85ea',
    oracleId: 'd3a0b660-358c-41bd-9cd2-41fbf3491b1a',
    name: 'Birds of Paradise',
    manaCost: '{G}',
    cmc: 1,
    typeLine: 'Creature — Bird',
    oracleText: 'Flying\n{T}: Add one mana of any color.',
    colors: ['G'],
    colorIdentity: ['G'],
    power: '0',
    toughness: '1',
    rarity: 'rare',
    setName: 'Dominaria Remastered',
    setCode: 'DMR',
    collectorNumber: '151',
    imageUrl: 'https://cards.scryfall.io/normal/front/4/9/496849a5-4b24-4eae-8bfb-d46f645d85ea.jpg?1783918450',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/4/9/496849a5-4b24-4eae-8bfb-d46f645d85ea.jpg?1783918450',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/4/9/496849a5-4b24-4eae-8bfb-d46f645d85ea.jpg?1783918450',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ad3a0b660-358c-41bd-9cd2-41fbf3491b1a&unique=prints',
    priceUsd: 11.52,
  },
  {
    id: 'c77ebe57-ea56-4300-b293-6260c4c01a43',
    oracleId: 'd75b9c82-1b49-4c3e-a1b5-aeef57d6644b',
    name: 'Cyclonic Rift',
    manaCost: '{1}{U}',
    cmc: 2,
    typeLine: 'Instant',
    oracleText: "Return target nonland permanent you don't control to its owner's hand.\nOverload {6}{U}",
    colors: ['U'],
    colorIdentity: ['U'],
    rarity: 'rare',
    setName: 'Commander Masters',
    setCode: 'CMM',
    collectorNumber: '84',
    imageUrl: 'https://cards.scryfall.io/normal/front/c/7/c77ebe57-ea56-4300-b293-6260c4c01a43.jpg?1783915703',
    imageUrlLarge: 'https://cards.scryfall.io/large/front/c/7/c77ebe57-ea56-4300-b293-6260c4c01a43.jpg?1783915703',
    imageUrlArtCrop: 'https://cards.scryfall.io/art_crop/front/c/7/c77ebe57-ea56-4300-b293-6260c4c01a43.jpg?1783915703',
    printsSearchUri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ad75b9c82-1b49-4c3e-a1b5-aeef57d6644b&unique=prints',
    priceUsd: 30.22,
  },
];

const STARTER_BY_NAME = new Map<string, Card>(
  SAMPLE_STARTER_CARDS.map((c) => [c.name.toLowerCase(), c])
);

const BROKEN_IMAGE_SNIPPETS = [
  '4c56ab73-0419',
  'f29ba16f-c8fb',
  'd6914dba-0d27',
  '3d69a3e0-6a2e',
  'c77eae57-6729',
];

/**
 * Repairs legacy starter card records stored in localStorage that had non-UUID IDs or broken image URLs.
 */
function repairCardRecord(card: Card): { card: Card; repaired: boolean } {
  const hasInvalidId = !isValidUuid(card.id);
  const hasInvalidOracle = Boolean(card.oracleId && !isValidUuid(card.oracleId));
  const hasBrokenImage = BROKEN_IMAGE_SNIPPETS.some((s) => card.imageUrl?.includes(s));

  if (hasInvalidId || hasInvalidOracle || hasBrokenImage) {
    const starterMatch = STARTER_BY_NAME.get(card.name.toLowerCase());
    if (starterMatch) {
      return {
        card: {
          ...starterMatch,
          isFoil: card.isFoil ?? starterMatch.isFoil,
        },
        repaired: true,
      };
    }
  }
  return { card, repaired: false };
}

export function getStoredCollection(): CollectionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COLLECTION);
    if (!raw) {
      const initial: CollectionItem[] = SAMPLE_STARTER_CARDS.map((card, idx) => ({
        id: `col-${idx + 1}`,
        card,
        quantity: idx === 1 ? 4 : idx === 3 ? 3 : 1,
        dateAdded: new Date().toISOString(),
      }));
      localStorage.setItem(STORAGE_KEYS.COLLECTION, JSON.stringify(initial));
      return initial;
    }

    const parsed: CollectionItem[] = JSON.parse(raw);
    let anyRepaired = false;
    const migrated = parsed.map((item) => {
      const { card, repaired } = repairCardRecord(item.card);
      if (repaired) anyRepaired = true;
      return repaired ? { ...item, card } : item;
    });

    if (anyRepaired) {
      localStorage.setItem(STORAGE_KEYS.COLLECTION, JSON.stringify(migrated));
    }
    return migrated;
  } catch (err) {
    console.error('Error reading collection from storage:', err);
    return [];
  }
}

export function saveCollection(collection: CollectionItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COLLECTION, JSON.stringify(collection));
  } catch (err) {
    console.error('Error saving collection to storage:', err);
  }
}

export function getStoredDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DECKS);
    if (!raw) {
      const atraxaCard = SAMPLE_STARTER_CARDS[4];
      const solRing = SAMPLE_STARTER_CARDS[0];
      const rhystic = SAMPLE_STARTER_CARDS[2];
      const counter = SAMPLE_STARTER_CARDS[3];
      const demonic = SAMPLE_STARTER_CARDS[5];
      const birds = SAMPLE_STARTER_CARDS[6];
      const cyclonic = SAMPLE_STARTER_CARDS[7];

      const initialDecks: Deck[] = [
        {
          id: 'deck-1',
          name: 'Atraxa Proliferate Control',
          format: 'commander',
          description: 'Commander deck focado em contadores +1/+1 e planeswalkers',
          commanderCard: atraxaCard,
          coverImageUrl: atraxaCard.imageUrlArtCrop || atraxaCard.imageUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            { card: atraxaCard, quantity: 1, category: 'commander' },
            { card: solRing, quantity: 1, category: 'main' },
            { card: rhystic, quantity: 1, category: 'main' },
            { card: counter, quantity: 1, category: 'main' },
            { card: demonic, quantity: 1, category: 'main' },
            { card: birds, quantity: 1, category: 'main' },
            { card: cyclonic, quantity: 1, category: 'main' },
          ],
        },
      ];
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(initialDecks));
      return initialDecks;
    }

    const parsed: Deck[] = JSON.parse(raw);
    let anyRepaired = false;
    const migrated = parsed.map((deck) => {
      let deckRepaired = false;
      let commanderCard = deck.commanderCard;
      if (commanderCard) {
        const res = repairCardRecord(commanderCard);
        if (res.repaired) {
          commanderCard = res.card;
          deckRepaired = true;
        }
      }

      let partnerCard = deck.partnerCard;
      if (partnerCard) {
        const res = repairCardRecord(partnerCard);
        if (res.repaired) {
          partnerCard = res.card;
          deckRepaired = true;
        }
      }

      const nextCards = deck.cards.map((dc) => {
        const res = repairCardRecord(dc.card);
        if (res.repaired) {
          deckRepaired = true;
          return { ...dc, card: res.card };
        }
        return dc;
      });

      const hasBrokenCover = BROKEN_IMAGE_SNIPPETS.some((s) => deck.coverImageUrl?.includes(s));
      const coverImageUrl = hasBrokenCover
        ? commanderCard?.imageUrlArtCrop || nextCards[0]?.card.imageUrlArtCrop
        : deck.coverImageUrl || commanderCard?.imageUrlArtCrop;

      if (deckRepaired || hasBrokenCover) {
        anyRepaired = true;
        return {
          ...deck,
          commanderCard,
          partnerCard,
          coverImageUrl,
          cards: nextCards,
        };
      }
      return deck;
    });

    if (anyRepaired) {
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(migrated));
    }
    return migrated;
  } catch (err) {
    console.error('Error reading decks from storage:', err);
    return [];
  }
}

export function saveDecks(decks: Deck[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
  } catch (err) {
    console.error('Error saving decks to storage:', err);
  }
}

export function getStoredProxies(): ProxyItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROXIES);
    if (!raw) return [];
    const parsed: ProxyItem[] = JSON.parse(raw);
    let anyRepaired = false;
    const migrated = parsed.map((item) => {
      const res = repairCardRecord(item.card as Card);
      if (res.repaired) {
        anyRepaired = true;
        return { ...item, card: res.card };
      }
      return item;
    });
    if (anyRepaired) {
      localStorage.setItem(STORAGE_KEYS.PROXIES, JSON.stringify(migrated));
    }
    return migrated;
  } catch (err) {
    console.error('Error reading proxies from storage:', err);
    return [];
  }
}

export function saveProxies(proxies: ProxyItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROXIES, JSON.stringify(proxies));
  } catch (err) {
    console.error('Error saving proxies to storage:', err);
  }
}

/**
 * Computes "inUseQuantity", "availableQuantity", and "usedInDecks" for all cards in collection.
 */
export function calculateCollectionDeckUsage(collection: CollectionItem[], decks: Deck[]): CollectionItem[] {
  const usageMap = new Map<string, Array<{ deckId: string; deckName: string; count: number }>>();

  for (const deck of decks) {
    for (const item of deck.cards) {
      const cardKey = item.card.name.toLowerCase();
      const existing = usageMap.get(cardKey) || [];
      existing.push({
        deckId: deck.id,
        deckName: deck.name,
        count: item.quantity,
      });
      usageMap.set(cardKey, existing);
    }
  }

  return collection.map((colItem) => {
    const cardKey = colItem.card.name.toLowerCase();
    const usedInDecks = usageMap.get(cardKey) || [];
    const inUseQuantity = usedInDecks.reduce((sum, d) => sum + d.count, 0);
    const availableQuantity = Math.max(0, colItem.quantity - inUseQuantity);

    return {
      ...colItem,
      inUseQuantity,
      availableQuantity,
      usedInDecks,
    };
  });
}

/**
 * Generates a full portable JSON snapshot of the user's personal system
 * (collection pool, decks, proxy studio queue, selected arts, foil flags, notes).
 */
export function createSystemBackup(
  collection: CollectionItem[],
  decks: Deck[],
  proxies: ProxyItem[]
): SystemBackup {
  const cleanCollection: CollectionItem[] = collection.map(
    ({ inUseQuantity, availableQuantity, usedInDecks, ...rest }) => rest
  );

  return {
    app: 'dms-mtg-manager',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collection: cleanCollection,
    decks,
    proxies,
  };
}

/**
 * Validates and normalizes an imported SystemBackup JSON string.
 */
export function parseSystemBackup(rawJson: string): SystemBackup {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Formato de backup inválido. Selecione um arquivo .json gerado pelo DMS MTG Manager.');
  }

  if (!Array.isArray(parsed.collection) || !Array.isArray(parsed.decks)) {
    throw new Error('O arquivo JSON não contém as estruturas completas do sistema (coleção e decks).');
  }

  const normalizedCollection: CollectionItem[] = parsed.collection
    .filter((item: any) => item && item.card && typeof item.card.name === 'string')
    .map((item: any, idx: number) => {
      const { card } = repairCardRecord(item.card);
      const { inUseQuantity, availableQuantity, usedInDecks, ...rest } = item;
      return {
        ...rest,
        id: rest.id || `col-restored-${idx + 1}`,
        card,
        quantity: Math.max(1, Number(rest.quantity) || 1),
        dateAdded: rest.dateAdded || new Date().toISOString(),
      };
    });

  const normalizedDecks: Deck[] = parsed.decks
    .filter((deck: any) => deck && typeof deck.name === 'string' && Array.isArray(deck.cards))
    .map((deck: any, idx: number) => {
      const commanderCard = deck.commanderCard ? repairCardRecord(deck.commanderCard).card : undefined;
      const partnerCard = deck.partnerCard ? repairCardRecord(deck.partnerCard).card : undefined;
      const cards = deck.cards
        .filter((dc: any) => dc && dc.card && typeof dc.card.name === 'string')
        .map((dc: any) => ({
          ...dc,
          card: repairCardRecord(dc.card).card,
          quantity: Math.max(1, Number(dc.quantity) || 1),
          category: dc.category || 'main',
        }));

      return {
        ...deck,
        id: deck.id || `deck-restored-${idx + 1}`,
        format: deck.format || 'commander',
        commanderCard,
        partnerCard,
        cards,
        createdAt: deck.createdAt || new Date().toISOString(),
        updatedAt: deck.updatedAt || new Date().toISOString(),
      };
    });

  const normalizedProxies: ProxyItem[] = Array.isArray(parsed.proxies)
    ? parsed.proxies
        .filter((p: any) => p && p.card && typeof p.card.name === 'string')
        .map((p: any, idx: number) => ({
          ...p,
          id: p.id || `proxy-restored-${idx + 1}`,
          card: repairCardRecord(p.card as Card).card,
          quantity: Math.max(1, Number(p.quantity) || 1),
        }))
    : [];

  return {
    app: 'dms-mtg-manager',
    schemaVersion: Number(parsed.schemaVersion) || 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    collection: normalizedCollection,
    decks: normalizedDecks,
    proxies: normalizedProxies,
  };
}
