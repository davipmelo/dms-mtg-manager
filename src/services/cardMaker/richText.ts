/**
 * Card Maker — tokenização e diagramação de texto de regras.
 * A medição é injetada (measure) para que a lógica possa ser testada sem DOM.
 */

export type RichToken =
  | { kind: 'word'; text: string; italic: boolean }
  | { kind: 'sym'; sym: string; italic: boolean }
  | { kind: 'space'; italic: boolean };

export interface Paragraph {
  tokens: RichToken[];
  /** true quando o parágrafo todo é uma linha em itálico (ex.: texto de sabor) */
  italic: boolean;
}

/**
 * Quebra o texto em parágrafos (linhas) e tokens.
 * - {X} vira símbolo de mana;
 * - texto entre parênteses (texto lembrete) vira itálico;
 * - `forceItalic` força todo o texto em itálico (sabor).
 */
export function tokenizeRules(text: string, forceItalic = false): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = (text || '').replace(/\r/g, '').split('\n');
  let reminderDepth = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const tokens: RichToken[] = [];
    let word = '';
    const italicNow = () => forceItalic || reminderDepth > 0;

    const flushWord = () => {
      if (word) {
        tokens.push({ kind: 'word', text: word, italic: italicNow() });
        word = '';
      }
    };

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '{') {
        const end = line.indexOf('}', i);
        if (end > i) {
          flushWord();
          tokens.push({ kind: 'sym', sym: line.slice(i + 1, end).toUpperCase(), italic: italicNow() });
          i = end;
          continue;
        }
      }
      if (ch === ' ' || ch === '\t') {
        flushWord();
        if (tokens.length > 0 && tokens[tokens.length - 1].kind !== 'space') {
          tokens.push({ kind: 'space', italic: italicNow() });
        }
        continue;
      }
      if (ch === '(') {
        flushWord();
        reminderDepth += 1;
        word = '(';
        continue;
      }
      word += ch;
      if (ch === ')') {
        flushWord();
        reminderDepth = Math.max(0, reminderDepth - 1);
      }
    }
    flushWord();
    // parênteses não fechados não "vazam" para a próxima linha
    reminderDepth = 0;
    while (tokens.length > 0 && tokens[tokens.length - 1].kind === 'space') tokens.pop();
    paragraphs.push({ tokens, italic: forceItalic });
  }
  return paragraphs;
}

export interface Measurer {
  /** largura de texto na fonte/itálico atuais */
  text(text: string, italic: boolean, size: number): number;
  /** largura de um símbolo */
  sym(size: number): number;
}

export interface LaidItem {
  kind: 'text' | 'sym';
  text: string;
  sym: string;
  italic: boolean;
  x: number;
  w: number;
}

export interface LaidLine {
  items: LaidItem[];
  width: number;
  /** y do topo da linha relativo ao topo do bloco */
  y: number;
  paragraphEnd: boolean;
}

export interface LaidBlock {
  lines: LaidLine[];
  height: number;
  lineHeight: number;
  size: number;
}

export interface LayoutOptions {
  width: number;
  size: number;
  lineHeightRatio: number;
  paragraphGap: number;
}

/** Faz quebra de linha gulosa respeitando símbolos como "palavras" atômicas. */
export function layoutParagraphs(paragraphs: Paragraph[], m: Measurer, opts: LayoutOptions): LaidBlock {
  const lineHeight = opts.size * opts.lineHeightRatio;
  const lines: LaidLine[] = [];
  let y = 0;

  paragraphs.forEach((p, pIndex) => {
    // Agrupa tokens em "átomos" (sem espaço entre eles) para quebrar apenas em espaços.
    const atoms: { items: LaidItem[]; w: number }[] = [];
    let current: LaidItem[] = [];
    let currentW = 0;
    const pushAtom = () => {
      if (current.length) atoms.push({ items: current, w: currentW });
      current = [];
      currentW = 0;
    };

    for (const t of p.tokens) {
      if (t.kind === 'space') {
        pushAtom();
        continue;
      }
      if (t.kind === 'sym') {
        const w = m.sym(opts.size);
        current.push({ kind: 'sym', text: '', sym: t.sym, italic: t.italic, x: currentW, w });
        currentW += w;
      } else {
        const w = m.text(t.text, t.italic, opts.size);
        current.push({ kind: 'text', text: t.text, sym: '', italic: t.italic, x: currentW, w });
        currentW += w;
      }
    }
    pushAtom();

    const spaceW = m.text(' ', false, opts.size);
    let line: LaidItem[] = [];
    let lineW = 0;

    const commit = (end: boolean) => {
      lines.push({ items: line, width: lineW, y, paragraphEnd: end });
      y += lineHeight;
      line = [];
      lineW = 0;
    };

    atoms.forEach((atom) => {
      const extra = line.length > 0 ? spaceW : 0;
      if (line.length > 0 && lineW + extra + atom.w > opts.width) {
        commit(false);
      }
      const gap = line.length > 0 ? spaceW : 0;
      const baseX = lineW + gap;
      atom.items.forEach((it) => line.push({ ...it, x: baseX + it.x }));
      lineW = baseX + atom.w;
    });
    if (line.length > 0 || atoms.length === 0) commit(true);
    else if (lines.length > 0) lines[lines.length - 1].paragraphEnd = true;

    if (pIndex < paragraphs.length - 1) y += opts.paragraphGap;
  });

  return { lines, height: Math.max(0, y), lineHeight, size: opts.size };
}

export interface FitOptions {
  width: number;
  height: number;
  maxSize: number;
  minSize: number;
  lineHeightRatio: number;
  paragraphGapRatio: number;
  /** altura extra reservada (ex.: separador + sabor), calculada por quem chama */
  step?: number;
}

/** Busca o maior tamanho de fonte cujo bloco cabe na área. */
export function fitParagraphs(
  paragraphs: Paragraph[],
  m: Measurer,
  opts: FitOptions
): { block: LaidBlock; fits: boolean } {
  const step = opts.step ?? 0.5;
  let size = opts.maxSize;
  let last: LaidBlock | null = null;
  while (size >= opts.minSize) {
    const block = layoutParagraphs(paragraphs, m, {
      width: opts.width,
      size,
      lineHeightRatio: opts.lineHeightRatio,
      paragraphGap: size * opts.paragraphGapRatio,
    });
    last = block;
    if (block.height <= opts.height) return { block, fits: true };
    size -= step;
  }
  return {
    block:
      last ||
      layoutParagraphs(paragraphs, m, {
        width: opts.width,
        size: opts.minSize,
        lineHeightRatio: opts.lineHeightRatio,
        paragraphGap: opts.minSize * opts.paragraphGapRatio,
      }),
    fits: false,
  };
}
