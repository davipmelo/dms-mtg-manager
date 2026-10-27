import { CardCategory, DeckCard, CollectionItem } from '../types';

export interface ParsedCardLine {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  category: CardCategory;
  isFoil?: boolean;
}

// Common Portuguese -> English card names for LigaMagic instant matching
const PT_BR_CARD_NAMES: Record<string, string> = {
  'raio': 'Lightning Bolt',
  'contramagica': 'Counterspell',
  'contramágica': 'Counterspell',
  'anel solar': 'Sol Ring',
  'cripta de mana': 'Mana Crypt',
  'estudo ristico': 'Rhystic Study',
  'estudo rístico': 'Rhystic Study',
  'forca da vontade': 'Force of Will',
  'força da vontade': 'Force of Will',
  'passaros do paraiso': 'Birds of Paradise',
  'pássaros do paraíso': 'Birds of Paradise',
  'tutor demoniaco': 'Demonic Tutor',
  'tutor demoníaco': 'Demonic Tutor',
  'tutor vampirico': 'Vampiric Tutor',
  'tutor vampírico': 'Vampiric Tutor',
  'tutor esclarecido': 'Enlightened Tutor',
  'tutor mistico': 'Mystical Tutor',
  'tutor místico': 'Mystical Tutor',
  'espadas em arados': 'Swords to Plowshares',
  'caminho para o exilio': 'Path to Exile',
  'caminho para o exílio': 'Path to Exile',
  'copa silvestre': 'Sylvan Library',
  'petala de lotus': 'Lotus Petal',
  'pétala de lótus': 'Lotus Petal',
  'monolito de basalto': 'Basalt Monolith',
  'monólito de basalto': 'Basalt Monolith',
  'ilha': 'Island',
  'pantano': 'Swamp',
  'pântano': 'Swamp',
  'floresta': 'Forest',
  'montanha': 'Mountain',
  'planicie': 'Plains',
  'planície': 'Plains',
};

/**
 * Normalizes text for Portuguese lookup
 */
function normalizePt(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Translate Portuguese card name to English if matched, or return original
 */
export function translatePtCardName(name: string): string {
  const norm = normalizePt(name);
  if (PT_BR_CARD_NAMES[norm]) {
    return PT_BR_CARD_NAMES[norm];
  }
  return name.trim();
}

/**
 * Parses raw text input from MTG Arena, Moxfield, EDHREC, LigaMagic, or generic lists.
 */
export function parseCardList(rawText: string): ParsedCardLine[] {
  const lines = rawText.split(/\r?\n/);
  const results: ParsedCardLine[] = [];
  let currentCategory: CardCategory = 'main';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) {
      continue;
    }

    // Check category headers
    const lower = line.toLowerCase();
    if (lower === 'commander' || lower === 'comandante') {
      currentCategory = 'commander';
      continue;
    }
    if (lower === 'partner' || lower === 'parceiro') {
      currentCategory = 'partner';
      continue;
    }
    if (lower === 'companion' || lower === 'companheiro') {
      currentCategory = 'companion';
      continue;
    }
    if (lower === 'deck' || lower === 'mainboard' || lower === 'principal' || lower === 'main') {
      currentCategory = 'main';
      continue;
    }
    if (lower === 'sideboard' || lower === 'reserva' || lower === 'side') {
      currentCategory = 'sideboard';
      continue;
    }
    if (lower === 'maybeboard' || lower === 'maybe' || lower === 'considerações') {
      currentCategory = 'maybeboard';
      continue;
    }

    // 1. Detect and strip Foil markers (e.g. *F*, *Foil*, *E*, [Foil], (Foil), or trailing foil)
    let isFoil = false;
    const foilRegex = /(\s+\*F\*|\s+\*foil\*|\s+\*E\*|\s+\[foil\]|\s+\(foil\)|\s+foil$)/i;
    if (foilRegex.test(line)) {
      isFoil = true;
      line = line.replace(foilRegex, '').trim();
    }

    // 2. Extract Quantity (e.g. "1x", "4", default 1)
    let quantity = 1;
    const qtyMatch = line.match(/^(\d+)x?\s+/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      line = line.slice(qtyMatch[0].length).trim();
    }

    // 3. Extract Set Code and Collector Number
    let setCode: string | undefined;
    let collectorNumber: string | undefined;

    // Pattern A: Parenthesized set with collector number: "(SLD) 2407" or "(SLD) #2407" or "(SLD:2407)"
    const parenSetNumMatch =
      line.match(/\(([A-Za-z0-9_]{3,6})(?::|\s+#?|\s+)([A-Za-z0-9★\-]+)\)/i) ||
      line.match(/\(([A-Za-z0-9_]{3,6})\)\s+#?([A-Za-z0-9★\-]+)/i);

    // Pattern B: Bracketed set with collector number: "[SLD:2407]" or "[SLD] 2407" or "[SLD] #2407"
    const bracketSetNumMatch =
      line.match(/\[([A-Za-z0-9_]{3,6})(?::|\s+#?|\s+)([A-Za-z0-9★\-]+)\]/i) ||
      line.match(/\[([A-Za-z0-9_]{3,6})\]\s+#?([A-Za-z0-9★\-]+)/i);

    // Pattern C: Parenthesized set only: "(SLD)"
    const parenSetOnlyMatch = line.match(/\(([A-Za-z0-9_]{3,6})\)/i);

    // Pattern D: Bracketed set only: "[SLD]"
    const bracketSetOnlyMatch = line.match(/\[([A-Za-z0-9_]{3,6})\]/i);

    if (parenSetNumMatch) {
      setCode = parenSetNumMatch[1].toUpperCase();
      collectorNumber = parenSetNumMatch[2];
      line = line.replace(parenSetNumMatch[0], '').trim();
    } else if (bracketSetNumMatch) {
      setCode = bracketSetNumMatch[1].toUpperCase();
      collectorNumber = bracketSetNumMatch[2];
      line = line.replace(bracketSetNumMatch[0], '').trim();
    } else if (parenSetOnlyMatch) {
      setCode = parenSetOnlyMatch[1].toUpperCase();
      line = line.replace(parenSetOnlyMatch[0], '').trim();
    } else if (bracketSetOnlyMatch) {
      setCode = bracketSetOnlyMatch[1].toUpperCase();
      line = line.replace(bracketSetOnlyMatch[0], '').trim();
    }

    // Clean remaining line as card name
    let cardName = line.trim();
    if (!cardName) continue;
    cardName = translatePtCardName(cardName);

    results.push({
      quantity,
      name: cardName,
      setCode,
      collectorNumber,
      category: currentCategory,
      isFoil,
    });
  }

  return results;
}

/**
 * Format cards for MTG Arena export
 */
export function exportToMtgArena(cards: DeckCard[], commander?: DeckCard): string {
  const lines: string[] = [];
  if (commander) {
    lines.push('Commander');
    lines.push(`1 ${commander.card.name} (${commander.card.setCode}) ${commander.card.collectorNumber}`);
    lines.push('');
  }

  const main = cards.filter((c) => c.category === 'main' || c.category === 'commander');
  if (main.length > 0) {
    lines.push('Deck');
    for (const c of main) {
      lines.push(`${c.quantity} ${c.card.name} (${c.card.setCode}) ${c.card.collectorNumber}`);
    }
  }

  const side = cards.filter((c) => c.category === 'sideboard');
  if (side.length > 0) {
    lines.push('');
    lines.push('Sideboard');
    for (const c of side) {
      lines.push(`${c.quantity} ${c.card.name} (${c.card.setCode}) ${c.card.collectorNumber}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format cards for Moxfield / EDHREC plain text export
 */
export function exportToMoxfield(cards: DeckCard[]): string {
  const lines: string[] = [];
  const commanders = cards.filter((c) => c.category === 'commander');
  if (commanders.length > 0) {
    lines.push('// Commander');
    commanders.forEach((c) => lines.push(`${c.quantity} ${c.card.name}`));
    lines.push('');
  }

  const main = cards.filter((c) => c.category === 'main');
  lines.push('// Main');
  main.forEach((c) => lines.push(`${c.quantity} ${c.card.name}`));

  const side = cards.filter((c) => c.category === 'sideboard');
  if (side.length > 0) {
    lines.push('');
    lines.push('// Sideboard');
    side.forEach((c) => lines.push(`${c.quantity} ${c.card.name}`));
  }

  return lines.join('\n');
}

/**
 * Format cards for LigaMagic export
 */
export function exportToLigaMagic(cards: DeckCard[]): string {
  return cards
    .map((c) => `${c.quantity}x ${c.card.name} [${c.card.setCode}]`)
    .join('\n');
}

/**
 * Format collection for CSV export
 */
export function exportCollectionToCsv(items: CollectionItem[]): string {
  const headers = ['Quantidade', 'Em Uso', 'Disponível', 'Nome', 'Edição', 'Código', 'Número', 'Raridade', 'Custo', 'Foil', 'Preço USD'];
  const rows = items.map((i) => [
    i.quantity,
    i.inUseQuantity ?? 0,
    i.availableQuantity ?? i.quantity,
    `"${i.card.name.replace(/"/g, '""')}"`,
    `"${i.card.setName.replace(/"/g, '""')}"`,
    i.card.setCode,
    i.card.collectorNumber,
    i.card.rarity,
    `"${i.card.manaCost || ''}"`,
    i.isFoil ? 'Sim' : 'Não',
    i.card.priceUsd ?? 0,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
