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

    // Pattern 1: Arena Format: "4 Lightning Bolt (CLB) 187" or "1 Sol Ring (C21) 263 *F*"
    const arenaMatch = line.match(/^(\d+)x?\s+([^(]+?)\s+\(([A-Za-z0-9]{3,5})\)\s+([A-Za-z0-9]+)(\s+\*F\*)?/i);
    if (arenaMatch) {
      const qty = parseInt(arenaMatch[1], 10);
      const name = translatePtCardName(arenaMatch[2].trim());
      const setCode = arenaMatch[3].toUpperCase();
      const colNum = arenaMatch[4];
      const isFoil = !!arenaMatch[5];
      results.push({
        quantity: qty,
        name,
        setCode,
        collectorNumber: colNum,
        category: currentCategory,
        isFoil,
      });
      continue;
    }

    // Pattern 2: Bracketed set (LigaMagic or Cockatrice): "4x Raio [M10]" or "1 Sol Ring [C21:263]"
    const bracketMatch = line.match(/^(\d+)x?\s+(.+?)\s+\[([A-Za-z0-9]{3,5})(?::([A-Za-z0-9]+))?\]/i);
    if (bracketMatch) {
      const qty = parseInt(bracketMatch[1], 10);
      const name = translatePtCardName(bracketMatch[2].trim());
      const setCode = bracketMatch[3].toUpperCase();
      const colNum = bracketMatch[4] || undefined;
      results.push({
        quantity: qty,
        name,
        setCode,
        collectorNumber: colNum,
        category: currentCategory,
      });
      continue;
    }

    // Pattern 3: Standard Qty + Card Name: "4x Lightning Bolt" or "4 Lightning Bolt" or "1 Sol Ring"
    const standardMatch = line.match(/^(\d+)x?\s+(.+)$/);
    if (standardMatch) {
      const qty = parseInt(standardMatch[1], 10);
      let name = standardMatch[2].trim();
      let isFoil = false;
      if (name.endsWith('*F*') || name.toLowerCase().endsWith('*foil*')) {
        isFoil = true;
        name = name.replace(/\*F\*|\*foil\*/gi, '').trim();
      }
      name = translatePtCardName(name);
      results.push({
        quantity: qty,
        name,
        category: currentCategory,
        isFoil,
      });
      continue;
    }

    // Pattern 4: Just card name (default qty 1)
    let cardName = line;
    let isFoil = false;
    if (cardName.endsWith('*F*') || cardName.toLowerCase().endsWith('*foil*')) {
      isFoil = true;
      cardName = cardName.replace(/\*F\*|\*foil\*/gi, '').trim();
    }
    cardName = translatePtCardName(cardName);
    results.push({
      quantity: 1,
      name: cardName,
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
