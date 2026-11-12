import { Card, CardPrint, TokenCard, UtilityCategory, CardFace } from '../types';

const API_BASE = 'https://api.scryfall.com';
const cardCache = new Map<string, Card>();

/**
 * Standardizes a raw Scryfall API JSON object into our application Card model.
 * Handles double-faced cards (MDFC / Transform), split cards, planar cards, and normal cards.
 */
export function parseScryfallCard(raw: any): Card {
  // A true multi-faced card in Scryfall has card_faces without root image_uris,
  // or has an explicit double-faced layout (transform, modal_dfc, battle, reversible_card, etc.)
  const isDfcLayout = [
    'transform',
    'modal_dfc',
    'battle',
    'reversible_card',
    'double_faced_token',
    'double_sided',
    'art_series',
  ].includes(raw.layout);

  const isSingleFacedLayout = [
    'split',
    'adventure',
    'flip',
    'aftermath',
    'normal',
    'leveler',
    'saga',
    'class',
    'case',
    'prototype',
  ].includes(raw.layout);

  const isMultiFace =
    (Boolean(raw.card_faces && raw.card_faces.length > 1 && !raw.image_uris) || isDfcLayout) &&
    !isSingleFacedLayout;

  const primaryFace = isMultiFace ? raw.card_faces[0] : raw;

  const imageUris = raw.image_uris || (primaryFace && primaryFace.image_uris) || {};
  const normalImg = imageUris.normal || imageUris.large || imageUris.small || '';
  const largeImg = imageUris.large || imageUris.png || normalImg;
  const smallImg = imageUris.small || normalImg;
  const artCropImg = imageUris.art_crop || normalImg;

  // Extract distinct card faces ONLY if this is a true double-faced card (Transform, MDFC, Battle, etc.)
  // Split cards, Adventure cards, Flip cards, and Aftermath cards are single-faced cards printed on one side!
  let cardFaces: CardFace[] | undefined = undefined;
  if (isMultiFace && Array.isArray(raw.card_faces) && raw.card_faces.length > 1) {
    const parsedFaces = raw.card_faces.map((f: any, idx: number) => {
      const fUris = f.image_uris || {};
      let fNorm = fUris.normal || fUris.large || fUris.small || '';
      let fLarge = fUris.large || fUris.png || fNorm;
      let fSmall = fUris.small || fNorm;
      let fArtCrop = fUris.art_crop || fNorm;

      // Resilient fallback if face image_uris is missing on multi-faced prints
      if (!fNorm && raw.set && raw.collector_number && isDfcLayout) {
        const faceParam = idx === 1 ? '&face=back' : '';
        fNorm = `https://api.scryfall.com/cards/${raw.set.toLowerCase()}/${encodeURIComponent(raw.collector_number)}?format=image&version=normal${faceParam}`;
        fLarge = `https://api.scryfall.com/cards/${raw.set.toLowerCase()}/${encodeURIComponent(raw.collector_number)}?format=image&version=large${faceParam}`;
        fSmall = `https://api.scryfall.com/cards/${raw.set.toLowerCase()}/${encodeURIComponent(raw.collector_number)}?format=image&version=small${faceParam}`;
        fArtCrop = fNorm;
      }

      return {
        name: f.name || '',
        manaCost: f.mana_cost || '',
        typeLine: f.type_line || '',
        oracleText: f.oracle_text || '',
        colors: f.colors || [],
        power: f.power,
        toughness: f.toughness,
        imageUrl: fNorm,
        imageUrlLarge: fLarge,
        imageUrlSmall: fSmall,
        imageUrlArtCrop: fArtCrop,
        artist: f.artist,
      };
    });

    // Only set cardFaces if both/all faces have their own individual artwork image
    if (parsedFaces.every((f: CardFace) => Boolean(f.imageUrl))) {
      cardFaces = parsedFaces;
    }
  }

  // Detect Meld cards (e.g. Gisela, Bruna, Urza, Mishra, Titania, Hanweir, etc.)
  let meldResultName: string | undefined = undefined;
  let meldResultUri: string | undefined = undefined;
  if (raw.layout === 'meld' && Array.isArray(raw.all_parts)) {
    const meldPart = raw.all_parts.find((p: any) => p.component === 'meld_result');
    if (meldPart && meldPart.name !== raw.name) {
      meldResultName = meldPart.name;
      meldResultUri = meldPart.uri;
    }
  }

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
    priceUsd: raw.prices?.usd
      ? parseFloat(raw.prices.usd)
      : raw.prices?.usd_foil
      ? parseFloat(raw.prices.usd_foil)
      : raw.prices?.usd_etched
      ? parseFloat(raw.prices.usd_etched)
      : undefined,
    isFoil: raw.foil === true || (Array.isArray(raw.finishes) && raw.finishes.includes('foil') && !raw.finishes.includes('nonfoil')),
    printsSearchUri: raw.prints_search_uri,
    cardFaces,
    layout: raw.layout,
    meldResultName,
    meldResultUri,
    artist: raw.artist,
    frame: raw.frame,
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
  const cleanNumber = collectorNumber.replace(/^#/, '').trim();
  const cacheKey = `set:${setCode.toLowerCase()}:${cleanNumber.toLowerCase()}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`${API_BASE}/cards/${setCode.toLowerCase()}/${encodeURIComponent(cleanNumber)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const raw = await res.json();
    const card = parseScryfallCard(raw);
    cardCache.set(cacheKey, card);
    cardCache.set(`id:${card.id}`, card);
    return card;
  } catch (err) {
    console.error(`Error fetching card ${setCode}/${cleanNumber}:`, err);
    return null;
  }
}

/**
 * Fetch a card by exact card name and set code (e.g. "Krenko, Mob Boss", "SLD").
 */
export async function getCardByNameAndSet(name: string, setCode: string): Promise<Card | null> {
  const cacheKey = `nameset:${name.toLowerCase().trim()}:${setCode.toLowerCase().trim()}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey)!;
  }

  try {
    const url = `${API_BASE}/cards/search?q=${encodeURIComponent(`!"${name.trim()}" set:${setCode.toLowerCase().trim()} include:extras`)}&unique=prints`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const card = parseScryfallCard(data.data[0]);
      cardCache.set(cacheKey, card);
      cardCache.set(`id:${card.id}`, card);
      return card;
    }
    return null;
  } catch (err) {
    console.error(`Error fetching card ${name} in set ${setCode}:`, err);
    return null;
  }
}

/**
 * Fetch a card by set code and name (e.g. set "CLB", name "Lightning Bolt").
 */
export async function getCardBySetAndName(setCode: string, name: string): Promise<Card | null> {
  const cleanName = name.trim();
  const cleanSet = setCode.trim().toLowerCase();
  const cacheKey = `setname:${cleanSet}:${cleanName.toLowerCase()}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey)!;
  }

  try {
    const url = `${API_BASE}/cards/search?q=${encodeURIComponent(`!"${cleanName}" set:${cleanSet}`)}&unique=prints`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return null;

    const card = parseScryfallCard(data.data[0]);
    cardCache.set(cacheKey, card);
    cardCache.set(`id:${card.id}`, card);
    return card;
  } catch (err) {
    console.error(`Error fetching card ${name} in set ${setCode}:`, err);
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value?: string): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

const printsCache = new Map<string, CardPrint[]>();

export function clearPrintsCache(): void {
  printsCache.clear();
}

async function fetchPrintsFromUrl(initialUrl: string, maxPages: number = 10): Promise<CardPrint[]> {
  const collected: CardPrint[] = [];
  const seenIds = new Set<string>();
  let nextUrl: string | null = initialUrl;
  let page = 0;

  while (nextUrl && page < maxPages) {
    page++;
    try {
      let res: Response = await fetch(nextUrl, { headers: { Accept: 'application/json' } });
      if (res.status === 429) {
        // Scryfall rate limit hit - back off briefly and retry once
        await new Promise((resolve) => setTimeout(resolve, 350));
        res = await fetch(nextUrl, { headers: { Accept: 'application/json' } });
      }
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
          cardFaces: parsed.cardFaces,
          releasedAt: raw.released_at,
          artist: raw.artist,
          priceUsd: parsed.priceUsd,
          frame: raw.frame,
        });
      }

      nextUrl = data.has_more && data.next_page ? data.next_page : null;
      if (nextUrl) {
        // Polite delay between paginated Scryfall API calls
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (err) {
      console.warn('Network error fetching prints from URL:', nextUrl, err);
      break;
    }
  }

  return collected;
}

/**
 * Checks if a card print has an old/classic MTG frame (pre-8th Edition / 1993-2003 or modern retro reprints).
 */
export function isOldFramePrint(p: CardPrint): boolean {
  if (p.frame === '1993' || p.frame === '1997') return true;
  if (p.releasedAt && p.releasedAt < '2003-07-28') return true;
  const oldFrameSets = new Set([
    'lea', 'leb', '2ed', 'ced', 'cei', 'arn', 'atq', '3ed', 'leg', 'drk', 'fem', '4ed',
    'ice', 'chr', 'hml', 'all', 'mir', 'vis', '5ed', 'wth', 'tmp', 'sth', 'exo', 'usg',
    'ulg', 'uds', 'mmq', 'nem', 'pcy', 'inv', 'pls', '7ed', 'apc', 'ody', 'tor', 'jud',
    'ons', 'lgn', 'scg', 'por', 'p02', 'ptk', 's99', 's00', 'ugl', 'tsb', 'tsr', 'dmr', 'rvr', 'brr'
  ]);
  if (p.setCode && oldFrameSets.has(p.setCode.toLowerCase())) return true;
  return false;
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
export async function getCardPrints(card: Card, bypassCache: boolean = false): Promise<CardPrint[]> {
  const cacheKey = (card.name || card.id).toLowerCase().trim();
  if (!bypassCache && printsCache.has(cacheKey) && printsCache.get(cacheKey)!.length > 0) {
    return printsCache.get(cacheKey)!;
  }

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
      const primaryFaceName = card.name.split('//')[0].replace(/"/g, '').trim();
      const extraQuery = card.typeLine?.toLowerCase().includes('emblem')
        ? `t:emblem "${primaryFaceName}" include:extras`
        : `!"${primaryFaceName}" t:token include:extras`;
      const extraUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
        extraQuery
      )}&unique=prints`;
      const extraPrints = await fetchPrintsFromUrl(extraUrl, 2);
      foundPrints = mergeUniquePrints(foundPrints, extraPrints);
    }

    if (foundPrints.length > 0) {
      printsCache.set(cacheKey, foundPrints);
      return foundPrints;
    }

    // 3. Try exact card name search (with inner quotes removed so e.g. Kongming, "Sleeping Dragon" works)
    if (card.name) {
      const cleanName = card.name.replace(/"/g, '').trim();
      const exactNameUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
        `!"${cleanName}" include:extras`
      )}&unique=prints`;
      const byExactName = await fetchPrintsFromUrl(exactNameUrl);
      if (byExactName.length > 0) {
        printsCache.set(cacheKey, byExactName);
        return byExactName;
      }

      // If DFC card name has '//', also try querying just the primary/front face name
      if (card.name.includes('//')) {
        const primaryFaceName = card.name.split('//')[0].replace(/"/g, '').trim();
        const primaryExactUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
          `!"${primaryFaceName}" include:extras`
        )}&unique=prints`;
        const byPrimary = await fetchPrintsFromUrl(primaryExactUrl);
        if (byPrimary.length > 0) {
          printsCache.set(cacheKey, byPrimary);
          return byPrimary;
        }
      }

      // If card name has trailing numbers or parenthetical suffixes (e.g. "Arcane Signet 2" or "Sol Ring (Retro)")
      const strippedName = cleanName.replace(/\s*\([^)]*\)/g, '').replace(/\s+\d+$/g, '').trim();
      if (strippedName !== cleanName && strippedName.length > 1) {
        const strippedUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
          `!"${strippedName}" include:extras`
        )}&unique=prints`;
        const byStripped = await fetchPrintsFromUrl(strippedUrl);
        if (byStripped.length > 0) {
          printsCache.set(cacheKey, byStripped);
          return byStripped;
        }
      }

      // 4. Resolve canonical card via /cards/named (handles front-face DFC names or fuzzy matches)
      const canonical = await getCardByName(cleanName.includes('//') ? cleanName.split('//')[0].trim() : cleanName);
      if (canonical) {
        if (canonical.printsSearchUri) {
          const byCanonicalUri = await fetchPrintsFromUrl(canonical.printsSearchUri);
          if (byCanonicalUri.length > 0) {
            printsCache.set(cacheKey, byCanonicalUri);
            return byCanonicalUri;
          }
        }
        if (isValidUuid(canonical.oracleId)) {
          const canonicalOracleUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
            `oracleid:${canonical.oracleId} include:extras`
          )}&unique=prints`;
          const byCanonicalOracle = await fetchPrintsFromUrl(canonicalOracleUrl);
          if (byCanonicalOracle.length > 0) {
            printsCache.set(cacheKey, byCanonicalOracle);
            return byCanonicalOracle;
          }
        }
      }

      // 5. Try Scryfall lookup by setCode and collectorNumber if valid
      if (
        card.setCode &&
        card.collectorNumber &&
        card.collectorNumber !== '★' &&
        card.setCode !== 'MPC' &&
        card.setCode !== 'CUSTOM'
      ) {
        const bySetAndNumber = await getCardBySetAndNumber(card.setCode, card.collectorNumber);
        if (bySetAndNumber) {
          if (bySetAndNumber.printsSearchUri) {
            const bySetUri = await fetchPrintsFromUrl(bySetAndNumber.printsSearchUri);
            if (bySetUri.length > 0) {
              printsCache.set(cacheKey, bySetUri);
              return bySetUri;
            }
          }
          if (isValidUuid(bySetAndNumber.oracleId)) {
            const setOracleUrl = `${API_BASE}/cards/search?order=released&q=${encodeURIComponent(
              `oracleid:${bySetAndNumber.oracleId} include:extras`
            )}&unique=prints`;
            const bySetOracle = await fetchPrintsFromUrl(setOracleUrl);
            if (bySetOracle.length > 0) {
              printsCache.set(cacheKey, bySetOracle);
              return bySetOracle;
            }
          }
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
      if (color.startsWith('c:') || color.startsWith('c=') || color.startsWith('c<=') || color.startsWith('id=')) {
        q += ` ${color}`;
      } else if (color === 'C') {
        q += ' c:c';
      } else if (color === 'M') {
        q += ' c:m';
      } else {
        q += ` c:${color.toLowerCase()}`;
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
          cardFaces: parsed.cardFaces,
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

export const MELD_PAIRS_MAP: Record<string, string> = {
  'gisela, the broken blade': 'Brisela, Voice of Nightmares',
  'bruna, the fading light': 'Brisela, Voice of Nightmares',
  'urza, lord protector': 'Urza, Planeswalker',
  'the mightstone and weakstone': 'Urza, Planeswalker',
  'mishra, claimed by gix': 'Mishra, Lost to Phyrexia',
  'phyrexian dragon engine': 'Mishra, Lost to Phyrexia',
  'titania, voice of gaea': 'Titania, Gaea Incarnate',
  'argoth, sanctum of nature': 'Titania, Gaea Incarnate',
  'hanweir battlements': 'Hanweir, the Writhing Township',
  'hanweir garrison': 'Hanweir, the Writhing Township',
  'graf rats': 'Chittering Host',
  'midnight scavengers': 'Chittering Host',
  "fang, fearless l'cie": 'Ragnarok, Divine Deliverance',
  "vanille, cheerful l'cie": 'Ragnarok, Divine Deliverance',
};

const singleFacedCache = new Set<string>();

/**
 * Resolves both faces for a double-faced card (DFCs / MDFCs / Transform / Battles / Meld).
 * Returns an array of [frontFace, backFace] or null if single-faced.
 */
export async function resolveCardFaces(card: Card | TokenCard): Promise<CardFace[] | null> {
  const currentLayout = card.layout?.toLowerCase();

  // Explicitly single-faced cards (split, adventure, flip, aftermath, normal, etc.) never have dual faces
  if (
    currentLayout &&
    ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
      currentLayout
    )
  ) {
    if (card.cardFaces) {
      delete card.cardFaces;
    }
    return null;
  }

  if (card.typeLine?.toLowerCase().includes('adventure') && !currentLayout?.includes('transform')) {
    if (card.cardFaces) {
      delete card.cardFaces;
    }
    return null;
  }

  // If faces are already resolved and cached on a genuine DFC card, return them
  if (card.cardFaces && card.cardFaces.length > 1) {
    return card.cardFaces;
  }

  // If card is already a specific designated face ('frente' or 'verso'), don't re-resolve
  if (card.faceLabel) {
    return null;
  }

  const normalizedName = card.name.toLowerCase().trim();

  // 1. Check if it's a known Meld card
  const knownMeldResult =
    card.meldResultName ||
    MELD_PAIRS_MAP[normalizedName] ||
    (card.layout === 'meld' && card.meldResultName);

  if (knownMeldResult) {
    try {
      const meldResultCard = await getCardByName(knownMeldResult);
      if (meldResultCard && meldResultCard.imageUrl) {
        const faces: CardFace[] = [
          {
            name: card.name,
            typeLine: card.typeLine,
            imageUrl: card.imageUrl,
            imageUrlLarge: card.imageUrlLarge || card.imageUrl,
          },
          {
            name: meldResultCard.name,
            typeLine: meldResultCard.typeLine,
            imageUrl: meldResultCard.imageUrl,
            imageUrlLarge: meldResultCard.imageUrlLarge || meldResultCard.imageUrl,
          },
        ];
        card.cardFaces = faces;
        return faces;
      }
    } catch (err) {
      console.error('Error resolving meld result card for', card.name, err);
    }
  }

  // 2. If already marked as single-faced in cache and doesn't contain dual face slashes, skip network
  if (
    singleFacedCache.has(normalizedName) &&
    !card.name.includes(' // ') &&
    !card.name.includes(' / ') &&
    !card.name.includes('//')
  ) {
    return null;
  }

  // 3. Query Scryfall to resolve potential DFC (transform, modal_dfc, battle, meld, reversible)
  try {
    let resolved: Card | null = null;
    const isAlter =
      card.setCode === 'MPC' ||
      card.setCode === 'CUSTOM' ||
      card.collectorNumber === '★';

    if (card.setCode && card.collectorNumber && !isAlter) {
      resolved = await getCardBySetAndNumber(card.setCode, card.collectorNumber);
    }
    if (!resolved) {
      const queryName = card.name.includes(' // ')
        ? card.name.split(' // ')[0].trim()
        : card.name.includes(' / ')
        ? card.name.split(' / ')[0].trim()
        : card.name.includes('//')
        ? card.name.split('//')[0].trim()
        : card.name;
      resolved = await getCardByName(queryName);
    }

    if (resolved) {
      const resLayout = resolved.layout?.toLowerCase();
      const isResolvedSingleFaced =
        (resLayout &&
          ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
            resLayout
          )) ||
        (resolved.typeLine?.toLowerCase().includes('adventure') && !resLayout?.includes('transform'));

      if (isResolvedSingleFaced) {
        if (resolved.layout) card.layout = resolved.layout;
        delete card.cardFaces;
        singleFacedCache.add(normalizedName);
        return null;
      }

      // Check standard DFC / MDFC / Battles / Reversible
      if (resolved.cardFaces && resolved.cardFaces.length > 1) {
        card.cardFaces = resolved.cardFaces;
        if (resolved.layout) card.layout = resolved.layout;
        if (resolved.name && (resolved.name.includes(' // ') || resolved.name.includes(' / ') || resolved.name.includes('//'))) {
          card.name = resolved.name;
        }
        return resolved.cardFaces;
      }

      // Check meld detected on resolved card
      const meldResult =
        resolved.meldResultName || MELD_PAIRS_MAP[resolved.name.toLowerCase().trim()];
      if ((resolved.layout === 'meld' || meldResult) && meldResult) {
        const meldResultCard = await getCardByName(meldResult);
        if (meldResultCard && meldResultCard.imageUrl) {
          const faces: CardFace[] = [
            {
              name: card.name,
              typeLine: card.typeLine,
              imageUrl: card.imageUrl,
              imageUrlLarge: card.imageUrlLarge || card.imageUrl,
            },
            {
              name: meldResultCard.name,
              typeLine: meldResultCard.typeLine,
              imageUrl: meldResultCard.imageUrl,
              imageUrlLarge: meldResultCard.imageUrlLarge || meldResultCard.imageUrl,
            },
          ];
          card.cardFaces = faces;
          if (resolved.layout) card.layout = resolved.layout;
          return faces;
        }
      }
    }

    // Truly single-faced card
    singleFacedCache.add(normalizedName);
  } catch (err) {
    console.error('Error resolving card faces for', card.name, err);
  }

  return null;
}
