import { Card, CardPrint, TokenCard, UtilityCategory } from '../types';

const API_BASE = 'https://api.scryfall.com';
const cardCache = new Map<string, Card>();

/**
 * Standardizes a raw Scryfall API JSON object into our application Card model.
 * Handles double-faced cards (MDFC / Transform), split cards, planar cards, and normal cards.
 */
export function parseScryfallCard(raw: any): Card {
  // If double-faced or transform card, extract primary face
  const isMultiFace = raw.card_faces && raw.card_faces.length > 0 && !raw.image_uris;
  const primaryFace = isMultiFace ? raw.card_faces[0] : raw;

  const imageUris = raw.image_uris || (primaryFace && primaryFace.image_uris) || {};
  const normalImg = imageUris.normal || imageUris.large || imageUris.small || '';
  const largeImg = imageUris.large || imageUris.png || normalImg;
  const smallImg = imageUris.small || normalImg;
  const artCropImg = imageUris.art_crop || normalImg;

  return {
    id: raw.id,
    oracleId: raw.oracle_id || primaryFace?.oracle_id,
    name: raw.name,
    namePt: raw.printed_name || undefined,
    manaCost: raw.mana_cost ?? primaryFace?.mana_cost ?? '',
    cmc: typeof raw.cmc === 'number' ? raw.cmc : 0,
    typeLine: raw.type_line || primaryFace?.type_line || '',
    oracleText: raw.oracle_text || primaryFace?.oracle_text || '',
    colors: raw.colors || primaryFace?.colors || [],
    colorIdentity: raw.color_identity || [],
    power: raw.power ?? primaryFace?.power ?? undefined,
    toughness: raw.toughness ?? primaryFace?.toughness ?? undefined,
    rarity: raw.rarity || 'common',
    setName: raw.set_name || raw.set?.toUpperCase() || '',
    setCode: (raw.set || '').toUpperCase(),
    collectorNumber: raw.collector_number || '',
    imageUrl: normalImg,
    imageUrlLarge: largeImg,
    imageUrlSmall: smallImg,
    imageUrlArtCrop: artCropImg,
    priceUsd: raw.prices?.usd ? parseFloat(raw.prices.usd) : undefined,
    isFoil: raw.foil === true,
    printsSearchUri: raw.prints_search_uri,
  };
}

/**
 * Autocomplete search for card names (returns array of matching names).
 */
export async function searchAutocomplete(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `${API_BASE}/cards/autocomplete?q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Scryfall autocomplete error:', err);
    return [];
  }
}

/**
 * Fetch a card by exact or fuzzy name. Checks cache first.
 */
export async function getCardByName(name: string): Promise<Card | null> {
  const cleanName = name.trim();
  const cacheKey = `name:${cleanName.toLowerCase()}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey)!;
  }

  try {
    // Try exact first
    let res = await fetch(`${API_BASE}/cards/named?exact=${encodeURIComponent(cleanName)}`, {
      headers: { Accept: 'application/json' },
    });

    // If not found, try fuzzy
    if (!res.ok) {
      res = await fetch(`${API_BASE}/cards/named?fuzzy=${encodeURIComponent(cleanName)}`, {
        headers: { Accept: 'application/json' },
      });
    }

    if (!res.ok) return null;
    const raw = await res.json();
    const card = parseScryfallCard(raw);

    cardCache.set(cacheKey, card);
    cardCache.set(`id:${card.id}`, card);
    return card;
  } catch (err) {
    console.error(`Error fetching card ${name}:`, err);
    return null;
  }
}

/**
 * Fetch a card by set code and collector number (e.g. "CLB", "187").
 */
export async function getCardBySetAndNumber(setCode: string, collectorNumber: string): Promise<Card | null> {
  const cacheKey = `set:${setCode.toLowerCase()}:${collectorNumber}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`${API_BASE}/cards/${setCode.toLowerCase()}/${collectorNumber}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const raw = await res.json();
    const card = parseScryfallCard(raw);
    cardCache.set(cacheKey, card);
    cardCache.set(`id:${card.id}`, card);
    return card;
  } catch (err) {
    console.error(`Error fetching card ${setCode}/${collectorNumber}:`, err);
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value?: string): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

async function fetchPrintsFromUrl(initialUrl: string, maxPages: number = 3): Promise<CardPrint[]> {
  const collected: CardPrint[] = [];
  const seenIds = new Set<string>();
  let nextUrl: string | null = initialUrl;
  let page = 0;

  while (nextUrl && page < maxPages) {
    page++;
    const res: Response = await fetch(nextUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) break;
    const data: any = await res.json();
    if (!data?.data || !Array.isArray(data.data)) break;

    for (const raw of data.data) {
      const parsed = parseScryfallCard(raw);
      if (!parsed.imageUrl || seenIds.has(parsed.id)) continue;
      seenIds.add(parsed.id);
      collected.push({
        id: parsed.id,
        oracleId: parsed.oracleId,
        printsSearchUri: parsed.printsSearchUri,
        setCode: parsed.setCode,
        setName: parsed.setName,
        collectorNumber: parsed.collectorNumber,
        imageUrl: parsed.imageUrl,
        imageUrlLarge: parsed.imageUrlLarge,
        imageUrlArtCrop: parsed.imageUrlArtCrop,
        releasedAt: raw.released_at,
        artist: raw.artist,
        priceUsd: parsed.priceUsd,
      });
    }

    nextUrl = data.has_more && data.next_page ? data.next_page : null;
  }

  return collected;
}

function mergeUniquePrints(primary: CardPrint[], extra: CardPrint[]): CardPrint[] {
  const seen = new Set(primary.map((p) => p.id));
  const merged = [...primary];
  for (const item of extra) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Fetch all prints for a card, token, plane, emblem, or utility card (all art versions, sets, promos).
 * Uses multi-stage fallback (printsSearchUri -> valid UUID oracleId -> exact name with include:extras -> canonical resolution).
 */
export async function getCardPrints(card: Card): Promise<CardPrint[]> {
  try {
    let foundPrints: CardPrint[] = [];

    // 1. Try explicit printsSearchUri if present
    if (card.printsSearchUri && card.printsSearchUri.startsWith(API_BASE)) {
      foundPrints = await fetchPrintsFromUrl(card.printsSearchUri);
    }

    // 2. Try oracleId if it is a valid Scryfall UUID
    if (foundPrints.length === 0 && isValidUuid(card.oracleId)) {
      const oracleUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
        `oracleid:${card.oracleId} include:extras`
      )}&unique=prints`;
      foundPrints = await fetchPrintsFromUrl(oracleUrl);
    }

    // For tokens/emblems with fewer than 20 exact-oracle prints, also gather same-name prints across subtypes/editions
    const isTokenOrExtra =
      card.typeLine?.toLowerCase().includes('token') ||
      card.typeLine?.toLowerCase().includes('emblem');
    if (isTokenOrExtra && foundPrints.length < 20 && card.name) {
      const primaryFaceName = card.name.split('//')[0].trim();
      const extraQuery = card.typeLine?.toLowerCase().includes('emblem')
        ? `t:emblem "${primaryFaceName}" include:extras`
        : `!"${primaryFaceName}" t:token include:extras`;
      const extraUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
        extraQuery
      )}&unique=prints`;
      const extraPrints = await fetchPrintsFromUrl(extraUrl, 2);
      foundPrints = mergeUniquePrints(foundPrints, extraPrints);
    }

    if (foundPrints.length > 0) return foundPrints;

    // 3. Try exact card name search (with include:extras so planes, tokens, dungeons, markers work)
    if (card.name) {
      const exactNameUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
        `!"${card.name}" include:extras`
      )}&unique=prints`;
      const byExactName = await fetchPrintsFromUrl(exactNameUrl);
      if (byExactName.length > 0) return byExactName;

      // 4. Resolve canonical card via /cards/named (handles front-face DFC names or fuzzy matches)
      const canonical = await getCardByName(card.name);
      if (canonical) {
        if (canonical.printsSearchUri) {
          const byCanonicalUri = await fetchPrintsFromUrl(canonical.printsSearchUri);
          if (byCanonicalUri.length > 0) return byCanonicalUri;
        }
        if (isValidUuid(canonical.oracleId)) {
          const canonicalOracleUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
            `oracleid:${canonical.oracleId} include:extras`
          )}&unique=prints`;
          const byCanonicalOracle = await fetchPrintsFromUrl(canonicalOracleUrl);
          if (byCanonicalOracle.length > 0) return byCanonicalOracle;
        }
      }
    }

    return [];
  } catch (err) {
    console.error('Error fetching card prints:', err);
    return [];
  }
}

const POPULAR_TOKEN_ORDER = [
  'Treasure',
  'Food',
  'Clue',
  'Blood',
  'Map',
  'Copy',
  'Zombie',
  'Soldier',
  'Goblin',
  'Spirit',
  'Angel',
  'Dragon',
  'Beast',
  'Thopter',
  'Construct',
  'Elf Warrior',
  'Saproling',
  'Vampire',
  'Faerie',
  'Human',
];

export const POPULAR_TOKENS_QUERY = `(${POPULAR_TOKEN_ORDER.map((n) => `!"${n}"`).join(' or ')})`;

const UTILITY_BASE_QUERIES: Record<UtilityCategory, string> = {
  tokens: 't:token (layout:token or layout:double_faced_token)',
  planes: '(t:plane or t:phenomenon) include:extras',
  emblems: 't:emblem include:extras',
  dungeons: 't:dungeon include:extras',
  markers:
    '(!"The Monarch" or !"City\'s Blessing" or !"Day // Night" or !"The Ring // The Ring Tempts You" or !"Undercity // The Initiative" or !"Start Your Engines! // Max Speed" or !"Foretell" or !"Plot" or !"Poison Counter" or !"Experience" or !"Energy Reserve" or !"A Mysterious Creature" or !"Morph" or !"Manifest" or !"Radiation") include:extras',
  schemes: 't:scheme include:extras',
  conspiracies: 't:conspiracy include:extras',
  attractions: '(t:attraction or t:contraption) include:extras',
};

/**
 * Search or browse MTG Utility cards: Tokens, Planechase Planes/Phenomena, Emblems,
 * Dungeons, Official Markers/Helpers (Monarch, Initiative, Day/Night, Ring, etc.),
 * Archenemy Schemes, Conspiracies, and Attractions/Contraptions.
 */
export async function searchUtilityCards(
  category: UtilityCategory,
  query: string = '',
  color?: string
): Promise<TokenCard[]> {
  try {
    let q = UTILITY_BASE_QUERIES[category];
    const trimmed = query.trim();

    if (trimmed === '__POPULAR_TOKENS__' && category === 'tokens') {
      q = `t:token layout:token ${POPULAR_TOKENS_QUERY}`;
    } else if (trimmed) {
      q += ` ${trimmed}`;
    }

    if (color && color !== 'all') {
      if (color === 'C') {
        q += ' c:c';
      } else if (color === 'M') {
        q += ' c:m';
      } else {
        q += ` c:${color}`;
      }
    }

    const url = `${API_BASE}/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    const mapped = data.data
      .map((raw: any): TokenCard | null => {
        const parsed = parseScryfallCard(raw);
        if (!parsed.imageUrl) return null;
        return {
          id: parsed.id,
          oracleId: parsed.oracleId,
          printsSearchUri: parsed.printsSearchUri,
          name: parsed.name,
          typeLine: parsed.typeLine,
          oracleText: parsed.oracleText,
          colors: parsed.colors,
          power: parsed.power,
          toughness: parsed.toughness,
          imageUrl: parsed.imageUrl,
          imageUrlLarge: parsed.imageUrlLarge,
          setCode: parsed.setCode,
          setName: parsed.setName,
          collectorNumber: parsed.collectorNumber,
        };
      })
      .filter((item: TokenCard | null): item is TokenCard => item !== null);

    if (trimmed === '__POPULAR_TOKENS__' && category === 'tokens') {
      const byName = new Map<string, TokenCard>();
      for (const item of mapped) {
        const key = item.name.toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, item);
        }
      }
      return Array.from(byName.values()).sort((a, b) => {
        const idxA = POPULAR_TOKEN_ORDER.findIndex(
          (n) => n.toLowerCase() === a.name.toLowerCase()
        );
        const idxB = POPULAR_TOKEN_ORDER.findIndex(
          (n) => n.toLowerCase() === b.name.toLowerCase()
        );
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }

    return mapped;
  } catch (err) {
    console.error('Error searching utility cards:', err);
    return [];
  }
}

/**
 * Legacy helper delegating to searchUtilityCards('tokens', ...).
 */
export async function searchTokens(query: string = '', color?: string): Promise<TokenCard[]> {
  return searchUtilityCards('tokens', query, color);
}
