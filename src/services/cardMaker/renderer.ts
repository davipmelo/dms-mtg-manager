/**
 * Card Maker — renderizador em Canvas 2D.
 * Todos os frames são desenhados proceduralmente (sem assets proprietários).
 */
import {
  ArtState,
  BORDER_COLORS,
  CardFaceData,
  CardLayout,
  CardMeta,
  CustomCard,
  CustomIcon,
  FrameColor,
  FrameStyle,
  MakerRarity,
  RARITIES,
  isLegendary,
  parseManaCost,
  resolveFrameColors,
} from './model';
import { LaidBlock, Measurer, layoutParagraphs, tokenizeRules } from './richText';
import { getAsset } from './storage';

export const CARD_W = 744;
export const CARD_H = 1039;
/** 3 mm de sangria em pixels da base 744 (63 mm = 744 px) */
export const BLEED_3MM = Math.round((3 / 63) * CARD_W);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderOptions {
  scale: number;
  bleed: number;
  rounded: boolean;
}

export interface RenderAssets {
  art: HTMLImageElement | null;
  icon: HTMLImageElement | null;
  /** imagem de frame do usuário (sobrepõe o frame procedural) */
  frame: HTMLImageElement | null;
  /** famílias CSS das fontes do usuário (vazio = padrão do estilo) */
  titleFamily: string;
  bodyFamily: string;
}

export interface RenderReport {
  textFits: boolean;
  /** quantos pixels de tela cada pixel da arte ocupa (>1.5 = arte ampliada demais) */
  artUpscale: number;
}

/* ------------------------------------------------------------------ */
/* Fontes                                                               */
/* ------------------------------------------------------------------ */

const SERIF_TITLE = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";
const SERIF_BODY = "'EB Garamond', 'Garamond', 'Georgia', serif";
const SANS_TITLE = "'Space Grotesk', 'Inter', 'Helvetica Neue', Arial, sans-serif";
const SANS_BODY = "'Inter', 'Helvetica Neue', Arial, sans-serif";

interface Theme {
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  bodyWeight: number;
  plateText: string;
  boxText: string;
  boxDark: boolean;
  cornerRadius: number;
  /** multiplicador de tamanho do corpo do texto (fontes sans são mais largas) */
  bodyScale: number;
}

const THEMES: Record<FrameStyle, Theme> = {
  modern: { titleFont: SERIF_TITLE, bodyFont: SERIF_BODY, titleWeight: 700, bodyWeight: 500, plateText: '#0f0d0b', boxText: '#0f0d0b', boxDark: false, cornerRadius: 38, bodyScale: 1 },
  classic: { titleFont: SERIF_TITLE, bodyFont: SERIF_BODY, titleWeight: 700, bodyWeight: 500, plateText: '#0c0a08', boxText: '#0c0a08', boxDark: false, cornerRadius: 36, bodyScale: 1 },
  parchment: { titleFont: SERIF_TITLE, bodyFont: SERIF_BODY, titleWeight: 600, bodyWeight: 500, plateText: '#2b1d0e', boxText: '#2b1d0e', boxDark: false, cornerRadius: 38, bodyScale: 1 },
  showcase: { titleFont: SANS_TITLE, bodyFont: SANS_BODY, titleWeight: 700, bodyWeight: 400, plateText: '#f4f4f5', boxText: '#e7e7ea', boxDark: true, cornerRadius: 38, bodyScale: 0.82 },
  neon: { titleFont: SANS_TITLE, bodyFont: SANS_BODY, titleWeight: 700, bodyWeight: 400, plateText: '#eef4ff', boxText: '#e3ecff', boxDark: true, cornerRadius: 30, bodyScale: 0.82 },
  borderless: { titleFont: SERIF_TITLE, bodyFont: SERIF_BODY, titleWeight: 700, bodyWeight: 500, plateText: '#0f0d0b', boxText: '#f6f3ec', boxDark: true, cornerRadius: 38, bodyScale: 1 },
};

let fontsPromise: Promise<void> | null = null;
export function ensureCardFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const specs = [
    "500 24px 'Cinzel'",
    "600 24px 'Cinzel'",
    "700 24px 'Cinzel'",
    "400 24px 'EB Garamond'",
    "500 24px 'EB Garamond'",
    "italic 400 24px 'EB Garamond'",
    "italic 500 24px 'EB Garamond'",
    "700 24px 'Space Grotesk'",
    "400 24px 'Inter'",
    "600 24px 'Inter'",
  ];
  fontsPromise = Promise.all(specs.map((s) => document.fonts.load(s).catch(() => []))).then(() => undefined);
  return fontsPromise;
}

/* ------------------------------------------------------------------ */
/* Paletas                                                              */
/* ------------------------------------------------------------------ */

interface BasePal {
  frame: string;
  plate: string;
  box: string;
  accent: string;
  neon: string;
}

const BASE_PAL: Record<FrameColor, BasePal> = {
  W: { frame: '#cfc6a9', plate: '#f7f2d5', box: '#f6f1e1', accent: '#fffbe3', neon: '#fff2b8' },
  U: { frame: '#3f84a8', plate: '#bfe0f2', box: '#e3eff6', accent: '#aae0fa', neon: '#27d3ff' },
  B: { frame: '#3a3532', plate: '#c9c1bc', box: '#dcd7d3', accent: '#8b827c', neon: '#b45cff' },
  R: { frame: '#b8553c', plate: '#f5c1ac', box: '#f4dcd2', accent: '#f9aa8f', neon: '#ff3f6c' },
  G: { frame: '#3f8a5c', plate: '#bfe0c8', box: '#dbe9de', accent: '#9bd3ae', neon: '#35ff97' },
  M: { frame: '#a98a3c', plate: '#ecd88f', box: '#efe6c8', accent: '#f0dc9a', neon: '#ffc83d' },
  A: { frame: '#7b8c98', plate: '#cdd7de', box: '#e1e7ea', accent: '#c3d0d8', neon: '#9ec5ff' },
  L: { frame: '#85704d', plate: '#d8c7a4', box: '#e8dfcb', accent: '#c7b28a', neon: '#ff9b3d' },
  C: { frame: '#8c9094', plate: '#d6d8da', box: '#e4e6e7', accent: '#c8cbce', neon: '#ffbb00' },
};

type Pair = [string, string];

interface Pal {
  frame: Pair;
  plate: Pair;
  box: Pair;
  accent: Pair;
  neon: Pair;
  /** cor sólida principal, útil para sombras/brilhos */
  neonSolid: string;
}

function buildPal(colors: FrameColor[]): Pal {
  const a = BASE_PAL[colors[0] || 'C'];
  const b = BASE_PAL[colors[1] || colors[0] || 'C'];
  return {
    frame: [a.frame, b.frame],
    plate: [a.plate, b.plate],
    box: [a.box, b.box],
    accent: [a.accent, b.accent],
    neon: [a.neon, b.neon],
    neonSolid: a.neon,
  };
}

function paintPair(ctx: CanvasRenderingContext2D, pair: Pair, x0 = 0, x1 = CARD_W): string | CanvasGradient {
  if (pair[0] === pair[1]) return pair[0];
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, pair[0]);
  g.addColorStop(0.38, pair[0]);
  g.addColorStop(0.62, pair[1]);
  g.addColorStop(1, pair[1]);
  return g;
}

/* ------------------------------------------------------------------ */
/* Geometria                                                            */
/* ------------------------------------------------------------------ */

interface Geo {
  borderless: boolean;
  layout: CardLayout;
  frame: Rect;
  title: Rect;
  art: Rect;
  type: Rect;
  box: Rect;
  pt: Rect | null;
  /** quando true o painel de texto não existe (só arte) */
  noBox: boolean;
}

function getGeometry(style: FrameStyle, face: CardFaceData): Geo {
  const hasPT = face.layout !== 'planeswalker' && face.layout !== 'saga' && Boolean(face.power.trim() || face.toughness.trim());
  const hasLoyalty = face.layout === 'planeswalker' && Boolean(face.loyalty.trim());
  const ptRect: Rect = { x: 544, y: 912, w: 144, h: 60 };
  const loyaltyRect: Rect = { x: 588, y: 884, w: 100, h: 84 };

  if (style === 'borderless') {
    const full: Rect = { x: 0, y: 0, w: CARD_W, h: CARD_H };
    const title: Rect = { x: 34, y: 32, w: 676, h: 64 };
    const g: Geo = {
      borderless: true,
      layout: face.layout,
      frame: full,
      title,
      art: full,
      type: { x: 34, y: 668, w: 676, h: 52 },
      box: { x: 34, y: 726, w: 676, h: 240 },
      pt: hasPT ? { x: 548, y: 920, w: 148, h: 58 } : null,
      noBox: face.hideTextBox && face.layout !== 'planeswalker' && face.layout !== 'saga',
    };
    if (face.layout === 'token') {
      g.type = { x: 34, y: 700, w: 676, h: 52 };
      g.box = { x: 34, y: 758, w: 676, h: 208 };
    } else if (face.layout === 'planeswalker') {
      g.type = { x: 34, y: 520, w: 676, h: 52 };
      g.box = { x: 34, y: 578, w: 676, h: 388 };
      g.pt = hasLoyalty ? { x: 590, y: 888, w: 104, h: 84 } : null;
    } else if (face.layout === 'saga') {
      g.type = { x: 34, y: 912, w: 676, h: 52 };
      g.box = { x: 34, y: 110, w: 330, h: 792 };
      g.pt = null;
    } else if (g.noBox) {
      g.type = { x: 34, y: 912, w: 676, h: 52 };
      g.box = { x: 34, y: 912, w: 0, h: 0 };
    }
    return g;
  }

  const g: Geo = {
    borderless: false,
    layout: face.layout,
    frame: { x: 26, y: 26, w: 692, h: 956 },
    title: { x: 44, y: 42, w: 656, h: 62 },
    art: { x: 58, y: 112, w: 628, h: 458 },
    type: { x: 44, y: 574, w: 656, h: 56 },
    box: { x: 58, y: 636, w: 628, h: 296 },
    pt: hasPT ? ptRect : null,
    noBox: face.hideTextBox && face.layout !== 'planeswalker' && face.layout !== 'saga',
  };
  if (face.layout === 'token') {
    g.art = { x: 58, y: 112, w: 628, h: 540 };
    g.type = { x: 44, y: 656, w: 656, h: 56 };
    g.box = { x: 58, y: 718, w: 628, h: 214 };
  } else if (face.layout === 'planeswalker') {
    g.art = { x: 58, y: 112, w: 628, h: 400 };
    g.type = { x: 44, y: 516, w: 656, h: 56 };
    g.box = { x: 58, y: 578, w: 628, h: 354 };
    g.pt = hasLoyalty ? loyaltyRect : null;
  } else if (face.layout === 'saga') {
    g.art = { x: 366, y: 112, w: 320, h: 774 };
    g.box = { x: 58, y: 112, w: 296, h: 774 };
    g.type = { x: 44, y: 892, w: 656, h: 54 };
    g.pt = null;
  }
  if (g.noBox) {
    g.art = { x: 58, y: 112, w: 628, h: 760 };
    g.type = { x: 44, y: 878, w: 656, h: 56 };
    g.box = { x: 58, y: 878, w: 0, h: 0 };
  }
  return g;
}

/** Retângulo da arte, exportado para a edição interativa (arrastar/zoom). */
export function getArtRect(card: CustomCard, faceIndex: number): Rect {
  const face = card.faces[faceIndex] || card.faces[0];
  return getGeometry(card.meta.frameStyle, face).art;
}

/* ------------------------------------------------------------------ */
/* Desenho — helpers                                                    */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Array.isArray(r) ? r[0] : r;
  const rr = Math.min(rad, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function chamferPath(ctx: Ctx, x: number, y: number, w: number, h: number, c: number): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - d * 2, h: r.h - d * 2 };
}

function shade(ctx: Ctx, r: Rect, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
}

function clearShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let noiseCanvas: HTMLCanvasElement | null = null;
function getNoisePattern(ctx: Ctx): CanvasPattern | null {
  if (typeof document === 'undefined') return null;
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 160;
    noiseCanvas.height = 160;
    const n = noiseCanvas.getContext('2d');
    if (n) {
      let seed = 1337;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 2600; i++) {
        const v = rnd() > 0.5 ? 255 : 0;
        n.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.1})`;
        n.fillRect(rnd() * 160, rnd() * 160, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
      }
    }
  }
  return ctx.createPattern(noiseCanvas, 'repeat');
}

function applyNoise(ctx: Ctx, alpha: number): void {
  const p = getNoisePattern(ctx);
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p;
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Símbolos de mana                                                     */
/* ------------------------------------------------------------------ */

const SYMBOL_BG: Record<string, string> = {
  W: '#fbf8d6',
  U: '#aadff7',
  B: '#c9c0bc',
  R: '#f7a78c',
  G: '#98d3ac',
  C: '#cfc9c4',
};

const GLYPH_PATHS: Record<string, string> = {
  U: 'M50 10 C50 10 20 46 20 64 A30 30 0 0 0 80 64 C80 46 50 10 50 10 Z',
  B: 'M50 12 C29 12 18 28 18 46 C18 58 25 65 31 69 L31 84 L41 79 L46 87 L50 80 L54 87 L59 79 L69 84 L69 69 C75 65 82 58 82 46 C82 28 71 12 50 12 Z M37 40 a8 8 0 1 0 0.01 0 Z M63 40 a8 8 0 1 0 0.01 0 Z M50 54 L45 64 L55 64 Z',
  R: 'M54 8 C58 28 78 38 78 60 C78 78 65 90 50 90 C34 90 22 78 24 62 C25 53 31 46 36 41 C36 51 40 56 45 56 C40 42 43 22 54 8 Z',
  G: 'M50 12 C62 12 70 22 68 33 C80 34 86 46 80 56 C86 64 80 76 68 76 C66 78 58 80 54 78 L54 92 L46 92 L46 78 C42 80 34 78 32 76 C20 76 14 64 20 56 C14 46 20 34 32 33 C30 22 38 12 50 12 Z',
  BOLT: 'M58 6 L24 54 H46 L38 94 L78 40 H54 Z',
};

function drawGlyph(ctx: Ctx, key: string, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  if (key === 'W') {
    ctx.beginPath();
    ctx.arc(50, 50, 17, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(50, 50);
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(-6, -26);
      ctx.lineTo(0, -44);
      ctx.lineTo(6, -26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (GLYPH_PATHS[key]) {
    ctx.fill(new Path2D(GLYPH_PATHS[key]), 'evenodd');
  }
  ctx.restore();
}

/** Desenha um símbolo de mana/habilidade centrado em (cx, cy) com raio r. */
export function drawManaSymbol(ctx: Ctx, symRaw: string, cx: number, cy: number, r: number, withShadow = true): void {
  const sym = symRaw.toUpperCase();
  const official = symbolImages.get(symbolFileName(sym));
  if (official) {
    ctx.save();
    if (withShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = r * 0.2;
      ctx.shadowOffsetX = -r * 0.1;
      ctx.shadowOffsetY = r * 0.14;
    }
    ctx.drawImage(official, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  ctx.save();
  if (withShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = r * 0.2;
    ctx.shadowOffsetX = -r * 0.1;
    ctx.shadowOffsetY = r * 0.14;
  }
  const circle = (fill: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const glyphColor = '#14110e';
  const label = (txt: string, color = glyphColor, scale = 1.1) => {
    ctx.save();
    clearShadow(ctx);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = r * scale * (txt.length > 1 ? 0.78 : 1);
    ctx.font = `700 ${fs}px ${SANS_TITLE}`;
    ctx.fillText(txt, cx, cy + r * 0.06);
    ctx.restore();
  };

  const ring = () => {
    ctx.save();
    clearShadow(ctx);
    ctx.beginPath();
    ctx.arc(cx, cy, r - r * 0.04, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
    ctx.restore();
  };
  if (sym === 'T' || sym === 'Q') {
    circle('#17130f');
    ring();
    clearShadow(ctx);
    ctx.strokeStyle = '#f4f1e8';
    ctx.fillStyle = '#f4f1e8';
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    const rad = r * 0.52;
    ctx.beginPath();
    if (sym === 'T') ctx.arc(cx, cy, rad, -0.2 * Math.PI, 1.55 * Math.PI);
    else ctx.arc(cx, cy, rad, 1.2 * Math.PI, -0.55 * Math.PI, true);
    ctx.stroke();
    const ang = sym === 'T' ? -0.2 * Math.PI : 1.2 * Math.PI;
    const ax = cx + Math.cos(ang) * rad;
    const ay = cy + Math.sin(ang) * rad;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang + (sym === 'T' ? Math.PI / 2 : -Math.PI / 2) * 1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.lineTo(r * 0.22, 0);
    ctx.lineTo(0, -r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (sym === 'E') {
    circle('#17130f');
    ring();
    clearShadow(ctx);
    drawGlyph(ctx, 'BOLT', cx, cy, r * 1.25, '#f6d54a');
  } else if (sym === 'S') {
    circle('#d6e6ef');
    clearShadow(ctx);
    ctx.strokeStyle = '#1b2a33';
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      ctx.lineTo(cx - Math.cos(a) * r * 0.62, cy - Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
  } else if (SYMBOL_BG[sym] && sym.length === 1) {
    circle(SYMBOL_BG[sym]);
    clearShadow(ctx);
    if (sym === 'C') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.38, cy);
      ctx.lineTo(cx, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.38, cy);
      ctx.closePath();
      ctx.fillStyle = glyphColor;
      ctx.fill();
    } else {
      drawGlyph(ctx, sym, cx, cy, r * 1.22, sym === 'B' ? '#1a1514' : glyphColor);
    }
  } else if (sym.includes('/')) {
    const [a, b] = sym.split('/');
    const bg = (s: string) => (SYMBOL_BG[s] && s.length === 1 ? SYMBOL_BG[s] : '#cfc9c4');
    // metade superior-esquerda e inferior-direita
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = bg(b === 'P' ? a : a);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (b !== 'P') {
      ctx.fillStyle = bg(b);
      ctx.beginPath();
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    clearShadow(ctx);
    if (b === 'P') {
      label('Φ', glyphColor, 1.15);
    } else {
      const small = (s: string, x: number, y: number) => {
        if (SYMBOL_BG[s] && s.length === 1) {
          if (s === 'C') return;
          drawGlyph(ctx, s, x, y, r * 0.78, glyphColor);
        } else {
          ctx.save();
          ctx.fillStyle = glyphColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `700 ${r * 0.78}px ${SANS_TITLE}`;
          ctx.fillText(s, x, y + r * 0.04);
          ctx.restore();
        }
      };
      small(a, cx - r * 0.34, cy - r * 0.34);
      small(b, cx + r * 0.36, cy + r * 0.36);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.7);
      ctx.stroke();
    }
  } else {
    // genérico: número, X, Y, Z, P, etc.
    circle(SYMBOL_BG.C);
    label(sym === 'P' ? 'Φ' : sym, glyphColor, 1.12);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Ícones personalizados de edição                                      */
/* ------------------------------------------------------------------ */

function starPath(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 46 : 19;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r + 3).toFixed(1)}`);
  }
  return 'M' + pts.join(' L') + ' Z';
}

const CUSTOM_ICON_PATHS: Record<CustomIcon, string> = {
  diamond: 'M50 4 L90 50 L50 96 L10 50 Z',
  star: starPath(),
  shield: 'M50 4 L90 18 V50 C90 76 72 90 50 98 C28 90 10 76 10 50 V18 Z',
  flame: GLYPH_PATHS.R,
  moon: 'M62 6 C30 12 12 36 12 58 C12 80 32 96 54 96 C70 96 84 88 94 74 C66 80 40 62 44 34 C46 22 52 14 62 6 Z',
  bolt: GLYPH_PATHS.BOLT,
  leaf: 'M50 96 C50 96 10 74 10 40 C10 20 28 8 50 4 C72 8 90 20 90 40 C90 74 50 96 50 96 Z',
  skull: GLYPH_PATHS.B,
};

function rarityFill(r: MakerRarity, darkPlate: boolean): { fill: string; stroke: string | null } {
  const entry = RARITIES.find((x) => x.id === r) || RARITIES[0];
  if (r === 'common') return darkPlate ? { fill: '#f1f1f2', stroke: '#050505' } : { fill: '#15151a', stroke: null };
  return { fill: entry.color, stroke: '#141414' };
}

function drawCustomIcon(ctx: Ctx, icon: CustomIcon, x: number, y: number, size: number, rarity: MakerRarity, darkPlate: boolean): void {
  const { fill, stroke } = rarityFill(rarity, darkPlate);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  const p = new Path2D(CUSTOM_ICON_PATHS[icon]);
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = stroke;
    ctx.stroke(p);
  }
  ctx.fillStyle = fill;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Carregamento de imagens                                              */
/* ------------------------------------------------------------------ */

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      resolve(null);
    };
    img.src = src;
  });
  imageCache.set(src, p);
  if (imageCache.size > 60) {
    const first = imageCache.keys().next().value;
    if (first !== undefined) imageCache.delete(first);
  }
  return p;
}

const svgIconCache = new Map<string, Promise<HTMLImageElement | null>>();

async function loadTintedSvg(url: string, fill: string, stroke: string | null): Promise<HTMLImageElement | null> {
  const key = `${url}|${fill}|${stroke || ''}`;
  const cached = svgIconCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      let text = await res.text();
      const vb = /viewBox="([\d.\s-]+)"/.exec(text);
      let w = 100;
      let h = 100;
      if (vb) {
        const parts = vb[1].trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
          w = parts[2];
          h = parts[3];
        }
      }
      const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${Math.max(w, h) * 0.05}" stroke-linejoin="round" paint-order="stroke"` : '';
      text = text.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
        const clean = attrs.replace(/\s(width|height)="[^"]*"/g, '');
        return `<svg${clean} width="${w * 2}" height="${h * 2}" fill="${fill}"${strokeAttr}>`;
      });
      const blob = new Blob([text], { type: 'image/svg+xml' });
      const objUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = objUrl;
      });
      return img;
    } catch {
      return null;
    }
  })();
  svgIconCache.set(key, p);
  p.then((img) => {
    if (!img) svgIconCache.delete(key);
  });
  return p;
}

/* ------------------------------------------------------------------ */
/* Ativos do usuário (fontes e frames originais)                        */
/* ------------------------------------------------------------------ */

const userFontPromises = new Map<string, Promise<string>>();

/** Registra a fonte do usuário e devolve o nome da família CSS ('' se falhar). */
async function ensureUserFont(id: string): Promise<string> {
  if (!id) return '';
  const cached = userFontPromises.get(id);
  if (cached) return cached;
  const p = (async () => {
    try {
      const asset = await getAsset(id);
      if (!asset) return '';
      const family = `cm-user-${id}`;
      const face = new FontFace(family, `url(${asset.data})`);
      await face.load();
      document.fonts.add(face);
      return family;
    } catch {
      return '';
    }
  })();
  userFontPromises.set(id, p);
  p.then((f) => {
    if (!f) userFontPromises.delete(id);
  });
  return p;
}

async function loadUserFrame(id: string): Promise<HTMLImageElement | null> {
  if (!id) return null;
  try {
    const asset = await getAsset(id);
    return asset ? await loadImage(asset.data) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Símbolos oficiais (SVGs do Scryfall)                                 */
/* ------------------------------------------------------------------ */

const symbolImages = new Map<string, HTMLImageElement>();
const symbolPending = new Map<string, Promise<void>>();
const symbolFailed = new Set<string>();

function symbolFileName(sym: string): string {
  return sym.toUpperCase().replace(/\//g, '').replace('½', 'HALF');
}

function loadSymbol(sym: string): Promise<void> {
  const key = symbolFileName(sym);
  if (!key || symbolImages.has(key) || symbolFailed.has(key)) return Promise.resolve();
  const pending = symbolPending.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`https://svgs.scryfall.io/card-symbols/${encodeURIComponent(key)}.svg`);
      if (!res.ok) throw new Error('símbolo não encontrado');
      const text = (await res.text()).replace(/<svg([^>]*)>/, (_m, attrs: string) => `<svg${attrs} width="200" height="200">`);
      const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('falha ao decodificar'));
        im.src = url;
      });
      symbolImages.set(key, img);
    } catch {
      symbolFailed.add(key);
    } finally {
      symbolPending.delete(key);
    }
  })();
  symbolPending.set(key, p);
  return p;
}

function collectSymbols(card: CustomCard, face: CardFaceData): string[] {
  const found = new Set<string>(parseManaCost(face.manaCost));
  const texts = [face.rulesText, face.flavorText, ...face.abilities.map((a) => a.text), ...face.chapters.map((c) => c.text)];
  const re = /\{([^}]+)\}/g;
  for (const t of texts) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) found.add(m[1].toUpperCase());
  }
  void card;
  return [...found];
}

/** Pré-carrega símbolos (útil para a paleta do editor e miniaturas). */
export function preloadSymbols(symbols: string[]): Promise<void[]> {
  return Promise.all(symbols.map(loadSymbol));
}

export async function loadRenderAssets(card: CustomCard, faceIndex: number): Promise<RenderAssets> {
  const face = card.faces[faceIndex] || card.faces[0];
  const theme = THEMES[card.meta.frameStyle];
  const artP = loadImage(face.art.src);
  let iconP: Promise<HTMLImageElement | null> = Promise.resolve(null);
  if (card.meta.iconMode === 'set' && card.meta.setIconUri) {
    const { fill, stroke } = rarityFill(card.meta.rarity, theme.boxDark || card.meta.frameStyle === 'showcase' || card.meta.frameStyle === 'neon');
    iconP = loadTintedSvg(card.meta.setIconUri, fill, stroke);
  }
  const [art, icon, frame, titleFamily, bodyFamily] = await Promise.all([
    artP,
    iconP,
    loadUserFrame(card.meta.customFrameId),
    ensureUserFont(card.meta.titleFontId),
    ensureUserFont(card.meta.bodyFontId),
    ensureCardFonts(),
    ...collectSymbols(card, face).map(loadSymbol),
  ]).then((r) => [r[0], r[1], r[2], r[3], r[4]] as const);
  return { art, icon, frame, titleFamily, bodyFamily };
}

/* ------------------------------------------------------------------ */
/* Arte                                                                 */
/* ------------------------------------------------------------------ */

function drawArt(ctx: Ctx, rect: Rect, art: ArtState, img: HTMLImageElement | null, pal: Pal, radius: number, chamfer = 0): number {
  ctx.save();
  if (chamfer > 0) chamferPath(ctx, rect.x, rect.y, rect.w, rect.h, chamfer);
  else rrPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.clip();

  let upscale = 0;
  if (!img) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, pal.frame[0]);
    g.addColorStop(1, pal.frame[1]);
    ctx.fillStyle = '#17171a';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    const base = rect.y + rect.h;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(rect.x, base);
    ctx.lineTo(rect.x + rect.w * 0.22, base - rect.h * 0.42);
    ctx.lineTo(rect.x + rect.w * 0.4, base - rect.h * 0.22);
    ctx.lineTo(rect.x + rect.w * 0.62, base - rect.h * 0.55);
    ctx.lineTo(rect.x + rect.w * 0.86, base - rect.h * 0.2);
    ctx.lineTo(rect.x + rect.w, base - rect.h * 0.32);
    ctx.lineTo(rect.x + rect.w, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * 0.74, rect.y + rect.h * 0.24, Math.min(rect.w, rect.h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s0 = Math.max(rect.w / iw, rect.h / ih);
    const s = s0 * art.zoom;
    const dw = iw * s;
    const dh = ih * s;
    const ox = dw - rect.w;
    const oy = dh - rect.h;
    const dx = rect.x - ox * art.px;
    const dy = rect.y - oy * art.py;
    upscale = s;
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const filters: string[] = [];
    if (art.brightness !== 100) filters.push(`brightness(${art.brightness}%)`);
    if (art.contrast !== 100) filters.push(`contrast(${art.contrast}%)`);
    if (art.saturation !== 100) filters.push(`saturate(${art.saturation}%)`);
    if (filters.length && 'filter' in ctx) ctx.filter = filters.join(' ');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (art.flipX) {
      ctx.translate(rect.x * 2 + rect.w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    if ('filter' in ctx) ctx.filter = 'none';
  }
  ctx.restore();
  return upscale;
}

/* ------------------------------------------------------------------ */
/* Frames                                                               */
/* ------------------------------------------------------------------ */

interface FrameCtx {
  ctx: Ctx;
  g: Geo;
  pal: Pal;
  meta: CardMeta;
  face: CardFaceData;
  border: string;
  legend: boolean;
}

function fillPlate(ctx: Ctx, pal: Pal, r: Rect, radius: number): void {
  rrPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = paintPair(ctx, pal.plate);
  ctx.fill();
  shade(ctx, r, 'rgba(255,255,255,0.38)', 'rgba(0,0,0,0.14)');
}

function drawLegendCrown(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  const t = g.title;
  const band: Rect = { x: t.x - 14, y: t.y - 12, w: t.w + 28, h: t.h + 24 };
  ctx.save();
  rrPath(ctx, band.x, band.y, band.w, band.h, 24);
  const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
  grad.addColorStop(0, '#f3e2a2');
  grad.addColorStop(0.45, '#c9a64a');
  grad.addColorStop(1, '#7d5f1f');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a1f08';
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = paintPair(ctx, pal.frame);
  rrPath(ctx, band.x, band.y, band.w, band.h, 24);
  ctx.fill();
  ctx.globalAlpha = 1;
  // pontas ornamentais
  ctx.fillStyle = '#f3e2a2';
  ctx.strokeStyle = '#2a1f08';
  ctx.lineWidth = 2;
  [band.x + 70, band.x + band.w / 2, band.x + band.w - 70].forEach((px, i) => {
    const h = i === 1 ? 22 : 15;
    ctx.beginPath();
    ctx.moveTo(px - 18, band.y + 3);
    ctx.lineTo(px, band.y - h);
    ctx.lineTo(px + 18, band.y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function baseModern(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  ctx.fillStyle = f.border;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  rrPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 22);
  ctx.fillStyle = paintPair(ctx, pal.frame);
  ctx.fill();
  shade(ctx, g.frame, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.22)');
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  const i = inset(g.frame, 4);
  rrPath(ctx, i.x, i.y, i.w, i.h, 18);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();
  if (f.legend) drawLegendCrown(f);
}

function platesModern(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  [g.title, g.type].forEach((r) => {
    fillPlate(ctx, pal, r, 16);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#151210';
    ctx.stroke();
    const i = inset(r, 3);
    rrPath(ctx, i.x, i.y, i.w, i.h, 13);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
  });
  rrPath(ctx, g.art.x - 1, g.art.y - 1, g.art.w + 2, g.art.h + 2, 4);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#151210';
  ctx.stroke();
  if (!g.noBox) {
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 6);
    ctx.fillStyle = paintPair(ctx, pal.box);
    ctx.fill();
    shade(ctx, g.box, 'rgba(0,0,0,0.09)', 'rgba(0,0,0,0)');
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#151210';
    ctx.stroke();
  }
  if (g.pt) {
    fillPlate(ctx, pal, g.pt, 14);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#151210';
    ctx.stroke();
  }
}

function baseClassic(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  ctx.fillStyle = f.border;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const fr: Rect = { x: 18, y: 18, w: 708, h: 970 };
  rrPath(ctx, fr.x, fr.y, fr.w, fr.h, 20);
  ctx.fillStyle = paintPair(ctx, pal.frame);
  ctx.fill();
  shade(ctx, fr, 'rgba(255,255,255,0.18)', 'rgba(0,0,0,0.28)');
  applyNoise(ctx, 0.9);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  const i = inset(fr, 5);
  rrPath(ctx, i.x, i.y, i.w, i.h, 16);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.stroke();
  void g;
}

function platesClassic(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  [g.title, g.type].forEach((r) => {
    rrPath(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = paintPair(ctx, pal.plate);
    ctx.fill();
    shade(ctx, r, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.2)');
    applyNoise(ctx, 0.7);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    const i = inset(r, 4);
    rrPath(ctx, i.x, i.y, i.w, i.h, 5);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.stroke();
  });
  rrPath(ctx, g.art.x - 2, g.art.y - 2, g.art.w + 4, g.art.h + 4, 3);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  rrPath(ctx, g.art.x - 7, g.art.y - 7, g.art.w + 14, g.art.h + 14, 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.stroke();
  if (!g.noBox) {
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 4);
    ctx.fillStyle = paintPair(ctx, pal.box);
    ctx.fill();
    applyNoise(ctx, 0.8);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    const i = inset(g.box, 5);
    rrPath(ctx, i.x, i.y, i.w, i.h, 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
  }
  if (g.pt) {
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 8);
    ctx.fillStyle = paintPair(ctx, pal.plate);
    ctx.fill();
    shade(ctx, g.pt, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.2)');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
}

function inkCorner(ctx: Ctx, x: number, y: number, dx: number, dy: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + dy * 26);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dx * 26, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx * 7, y + dy * 7);
  ctx.lineTo(x + dx * 15, y + dy * 7);
  ctx.lineTo(x + dx * 7, y + dy * 15);
  ctx.closePath();
  ctx.fill();
}

function baseParchment(f: FrameCtx): void {
  const { ctx, g } = f;
  ctx.fillStyle = f.border;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  rrPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 20);
  const grad = ctx.createLinearGradient(0, g.frame.y, 0, g.frame.y + g.frame.h);
  grad.addColorStop(0, '#f1e6c9');
  grad.addColorStop(0.5, '#e8dbb8');
  grad.addColorStop(1, '#dccb9f');
  ctx.fillStyle = grad;
  ctx.fill();
  applyNoise(ctx, 1);
  // mancha vinheta
  const v = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 200, CARD_W / 2, CARD_H / 2, 700);
  v.addColorStop(0, 'rgba(120,80,20,0)');
  v.addColorStop(1, 'rgba(120,80,20,0.22)');
  ctx.fillStyle = v;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4a3520';
  ctx.stroke();
  const i = inset(g.frame, 9);
  rrPath(ctx, i.x, i.y, i.w, i.h, 14);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(74,53,32,0.75)';
  ctx.stroke();
  ctx.strokeStyle = '#4a3520';
  ctx.fillStyle = '#4a3520';
  ctx.lineWidth = 2;
  inkCorner(ctx, i.x + 6, i.y + 6, 1, 1);
  inkCorner(ctx, i.x + i.w - 6, i.y + 6, -1, 1);
  inkCorner(ctx, i.x + 6, i.y + i.h - 6, 1, -1);
  inkCorner(ctx, i.x + i.w - 6, i.y + i.h - 6, -1, -1);
}

function platesParchment(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  const ink = '#4a3520';
  [g.title, g.type].forEach((r) => {
    rrPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = 'rgba(250,242,218,0.85)';
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = paintPair(ctx, pal.plate);
    rrPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.restore();
    rrPath(ctx, r.x, r.y, r.w, r.h, 12);
    applyNoise(ctx, 0.6);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ink;
    ctx.stroke();
    const i = inset(r, 4);
    rrPath(ctx, i.x, i.y, i.w, i.h, 9);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(74,53,32,0.6)';
    ctx.stroke();
  });
  rrPath(ctx, g.art.x - 1, g.art.y - 1, g.art.w + 2, g.art.h + 2, 3);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ink;
  ctx.stroke();
  rrPath(ctx, g.art.x - 7, g.art.y - 7, g.art.w + 14, g.art.h + 14, 6);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(74,53,32,0.7)';
  ctx.stroke();
  if (!g.noBox) {
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 6);
    ctx.fillStyle = 'rgba(248,240,216,0.92)';
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = paintPair(ctx, pal.box);
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 6);
    ctx.fill();
    ctx.restore();
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 6);
    applyNoise(ctx, 0.6);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
  if (g.pt) {
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 14);
    ctx.fillStyle = 'rgba(250,242,218,0.95)';
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = paintPair(ctx, pal.plate);
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 14);
    ctx.fill();
    ctx.restore();
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 14);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

function baseShowcase(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  ctx.fillStyle = f.border;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  rrPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 22);
  const grad = ctx.createLinearGradient(0, g.frame.y, 0, g.frame.y + g.frame.h);
  grad.addColorStop(0, '#26262b');
  grad.addColorStop(1, '#0f0f11');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  const i = inset(g.frame, 7);
  rrPath(ctx, i.x, i.y, i.w, i.h, 16);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = paintPair(ctx, pal.neon);
  ctx.stroke();
  // brilho de canto
  const glow = ctx.createRadialGradient(g.frame.x + g.frame.w, g.frame.y, 10, g.frame.x + g.frame.w, g.frame.y, 380);
  glow.addColorStop(0, hexToRgba(pal.neonSolid, 0.16));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  rrPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 22);
  ctx.clip();
  ctx.fillStyle = glow;
  ctx.fillRect(g.frame.x, g.frame.y, g.frame.w, g.frame.h);
  ctx.restore();
}

function platesShowcase(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  [g.title, g.type].forEach((r) => {
    rrPath(ctx, r.x, r.y, r.w, r.h, 14);
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, '#2c2c32');
    gr.addColorStop(1, '#19191c');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.save();
    rrPath(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.clip();
    ctx.fillStyle = paintPair(ctx, pal.neon);
    ctx.fillRect(r.x, r.y, 7, r.h);
    ctx.restore();
    rrPath(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
  });
  rrPath(ctx, g.art.x - 1, g.art.y - 1, g.art.w + 2, g.art.h + 2, 6);
  ctx.lineWidth = 4;
  ctx.strokeStyle = paintPair(ctx, pal.neon);
  ctx.stroke();
  if (!g.noBox) {
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 8);
    ctx.fillStyle = '#121214';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#34343a';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.box.x + 14, g.box.y + 1.5);
    ctx.lineTo(g.box.x + g.box.w - 14, g.box.y + 1.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = paintPair(ctx, pal.neon);
    ctx.stroke();
  }
  if (g.pt) {
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 14);
    ctx.fillStyle = '#17171a';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffbb00';
    ctx.stroke();
  }
}

function baseNeon(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  ctx.fillStyle = f.border;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  chamferPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 28);
  ctx.fillStyle = '#05060b';
  ctx.fill();
  ctx.save();
  chamferPath(ctx, g.frame.x, g.frame.y, g.frame.w, g.frame.h, 28);
  ctx.clip();
  ctx.strokeStyle = hexToRgba(pal.neonSolid, 0.07);
  ctx.lineWidth = 1;
  for (let x = g.frame.x; x < g.frame.x + g.frame.w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, g.frame.y);
    ctx.lineTo(x, g.frame.y + g.frame.h);
    ctx.stroke();
  }
  for (let y = g.frame.y; y < g.frame.y + g.frame.h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(g.frame.x, y);
    ctx.lineTo(g.frame.x + g.frame.w, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H, 40, CARD_W / 2, CARD_H, 520);
  glow.addColorStop(0, hexToRgba(pal.neonSolid, 0.28));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(g.frame.x, g.frame.y, g.frame.w, g.frame.h);
  ctx.restore();
  ctx.save();
  chamferPath(ctx, g.frame.x + 3, g.frame.y + 3, g.frame.w - 6, g.frame.h - 6, 25);
  ctx.shadowColor = pal.neonSolid;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 3;
  ctx.strokeStyle = paintPair(ctx, pal.neon);
  ctx.stroke();
  ctx.restore();
}

function platesNeon(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  const glowStroke = (blur: number, lw: number) => {
    ctx.save();
    ctx.shadowColor = pal.neonSolid;
    ctx.shadowBlur = blur;
    ctx.lineWidth = lw;
    ctx.strokeStyle = paintPair(ctx, pal.neon);
    ctx.stroke();
    ctx.restore();
  };
  [g.title, g.type].forEach((r) => {
    chamferPath(ctx, r.x, r.y, r.w, r.h, 16);
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, 'rgba(18,22,38,0.96)');
    gr.addColorStop(1, 'rgba(8,10,20,0.96)');
    ctx.fillStyle = gr;
    ctx.fill();
    glowStroke(10, 2);
  });
  chamferPath(ctx, g.art.x - 1, g.art.y - 1, g.art.w + 2, g.art.h + 2, 18);
  glowStroke(12, 3.5);
  if (!g.noBox) {
    chamferPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 14);
    ctx.fillStyle = 'rgba(8,10,20,0.93)';
    ctx.fill();
    glowStroke(6, 1.8);
  }
  if (g.pt) {
    chamferPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 14);
    ctx.fillStyle = '#080a14';
    ctx.fill();
    glowStroke(12, 3.5);
  }
}

function baseBorderless(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  ctx.fillStyle = '#070708';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  void pal;
  void g;
}

function platesBorderless(f: FrameCtx): void {
  const { ctx, g, pal } = f;
  // escurece o topo e a base para dar legibilidade
  const top = ctx.createLinearGradient(0, 0, 0, 200);
  top.addColorStop(0, 'rgba(0,0,0,0.55)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, CARD_W, 200);
  if (g.layout === 'saga') {
    const side = ctx.createLinearGradient(0, 0, 420, 0);
    side.addColorStop(0, 'rgba(6,6,8,0.88)');
    side.addColorStop(1, 'rgba(6,6,8,0)');
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, 420, CARD_H);
  }
  const startY = Math.max(0, g.type.y - 150);
  const bot = ctx.createLinearGradient(0, startY, 0, CARD_H);
  bot.addColorStop(0, 'rgba(6,6,8,0)');
  bot.addColorStop(0.35, 'rgba(6,6,8,0.78)');
  bot.addColorStop(1, 'rgba(6,6,8,0.96)');
  if (g.layout !== 'saga') {
    ctx.fillStyle = bot;
    ctx.fillRect(0, startY, CARD_W, CARD_H - startY);
  }
  [g.title, g.type].forEach((r) => {
    rrPath(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = paintPair(ctx, pal.plate);
    ctx.fill();
    ctx.restore();
    shade(ctx, r, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.12)');
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.stroke();
  });
  if (!g.noBox) {
    rrPath(ctx, g.box.x, g.box.y, g.box.w, g.box.h, 16);
    ctx.fillStyle = 'rgba(8,8,10,0.62)';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.box.x + 20, g.box.y + 1);
    ctx.lineTo(g.box.x + g.box.w - 20, g.box.y + 1);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = paintPair(ctx, pal.accent);
    ctx.stroke();
  }
  if (g.pt) {
    rrPath(ctx, g.pt.x, g.pt.y, g.pt.w, g.pt.h, 16);
    ctx.fillStyle = paintPair(ctx, pal.plate);
    ctx.fill();
    shade(ctx, g.pt, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.12)');
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }
}

const FRAME_DRAWERS: Record<FrameStyle, { base: (f: FrameCtx) => void; plates: (f: FrameCtx) => void }> = {
  modern: { base: baseModern, plates: platesModern },
  classic: { base: baseClassic, plates: platesClassic },
  parchment: { base: baseParchment, plates: platesParchment },
  showcase: { base: baseShowcase, plates: platesShowcase },
  neon: { base: baseNeon, plates: platesNeon },
  borderless: { base: baseBorderless, plates: platesBorderless },
};

/* ------------------------------------------------------------------ */
/* Conteúdo                                                             */
/* ------------------------------------------------------------------ */

function fontStr(theme: Theme, italic: boolean, size: number): string {
  return `${italic ? 'italic ' : ''}${theme.bodyWeight} ${size}px ${theme.bodyFont}`;
}

function makeMeasurer(ctx: Ctx, theme: Theme): Measurer {
  return {
    text(text, italic, size) {
      ctx.font = fontStr(theme, italic, size);
      return ctx.measureText(text).width;
    },
    sym(size) {
      return size * 0.92;
    },
  };
}

function drawLaidBlock(
  ctx: Ctx,
  theme: Theme,
  block: LaidBlock,
  x: number,
  y: number,
  areaW: number,
  align: 'left' | 'center',
  color: string
): void {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  for (const line of block.lines) {
    const off = align === 'center' ? (areaW - line.width) / 2 : 0;
    const cy = y + line.y + block.lineHeight / 2;
    for (const it of line.items) {
      if (it.kind === 'text') {
        ctx.font = fontStr(theme, it.italic, block.size);
        ctx.fillStyle = color;
        ctx.fillText(it.text, x + off + it.x, cy);
      } else {
        drawManaSymbol(ctx, it.sym, x + off + it.x + it.w / 2, cy + block.size * 0.02, block.size * 0.43);
      }
    }
  }
}

function drawManaCost(ctx: Ctx, manaCost: string, rightX: number, cy: number, r: number): number {
  const syms = parseManaCost(manaCost);
  if (syms.length === 0) return 0;
  const gap = r * 0.18;
  const step = r * 2 + gap;
  const total = syms.length * step - gap;
  let x = rightX - total + r;
  syms.forEach((s) => {
    drawManaSymbol(ctx, s, x, cy, r);
    x += step;
  });
  return total;
}

function fitSingleLine(ctx: Ctx, text: string, fontBuilder: (size: number) => string, maxW: number, maxSize: number, minSize: number): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = fontBuilder(size);
    if (ctx.measureText(text).width <= maxW) return size;
    size -= 0.5;
  }
  return minSize;
}

function drawTextOnPlate(f: FrameCtx, theme: Theme): void {
  const { ctx, g, face, meta } = f;
  const style = meta.frameStyle;
  const nameRect = g.title;
  const midY = nameRect.y + nameRect.h / 2;
  const showCost = face.layout !== 'token' && parseManaCost(face.manaCost).length > 0;
  let costW = 0;
  if (showCost) {
    const r = Math.min(17, nameRect.h * 0.3);
    costW = drawManaCost(ctx, face.manaCost, nameRect.x + nameRect.w - 18, midY + 1, r);
  }
  const maxNameW = nameRect.w - 44 - (costW ? costW + 18 : 0);
  const name = face.name.trim();
  const display = name || 'Nome da carta';
  const nameFont = (s: number) => `${theme.titleWeight} ${s}px ${theme.titleFont}`;
  const size = fitSingleLine(ctx, display, nameFont, maxNameW, style === 'classic' ? 34 : 36, 16);
  ctx.save();
  ctx.font = nameFont(size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.plateText;
  if (!name) ctx.globalAlpha = 0.32;
  if (style === 'neon') {
    ctx.shadowColor = f.pal.neonSolid;
    ctx.shadowBlur = 8;
  }
  ctx.fillText(display, nameRect.x + 22, midY + 2, maxNameW);
  ctx.restore();

  // linha de tipo
  const tr = g.type;
  const tMid = tr.y + tr.h / 2;
  const iconSpace = meta.iconMode !== 'none' ? 44 : 0;
  const typeText = face.typeLine.trim();
  const typeDisplay = typeText || 'Tipo — Subtipo';
  const maxTypeW = tr.w - 44 - iconSpace;
  const typeFont = (s: number) => `${theme.titleWeight - 100 >= 400 ? theme.titleWeight - 100 : 600} ${s}px ${theme.titleFont}`;
  const tSize = fitSingleLine(ctx, typeDisplay, typeFont, maxTypeW, 29, 14);
  ctx.save();
  ctx.font = typeFont(tSize);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.plateText;
  if (!typeText) ctx.globalAlpha = 0.32;
  ctx.fillText(typeDisplay, tr.x + 22, tMid + 2, maxTypeW);
  ctx.restore();
}

function drawSetIcon(f: FrameCtx, assets: RenderAssets, theme: Theme): void {
  const { ctx, g, meta } = f;
  if (meta.iconMode === 'none') return;
  const tr = g.type;
  const size = 32;
  const x = tr.x + tr.w - 20 - size;
  const y = tr.y + (tr.h - size) / 2;
  const darkPlate = meta.frameStyle === 'showcase' || meta.frameStyle === 'neon';
  if (meta.iconMode === 'custom') {
    drawCustomIcon(ctx, meta.customIcon, x, y, size, meta.rarity, darkPlate);
    return;
  }
  if (assets.icon) {
    const iw = assets.icon.naturalWidth || assets.icon.width || 1;
    const ih = assets.icon.naturalHeight || assets.icon.height || 1;
    const s = Math.min(size / iw, size / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(assets.icon, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    ctx.save();
    ctx.fillStyle = theme.plateText;
    ctx.globalAlpha = 0.7;
    ctx.font = `700 14px ${SANS_BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.setCode.slice(0, 4), x + size / 2, y + size / 2);
    ctx.restore();
  }
}

/** Texto de regras + sabor (layout "padrão" e "ficha") */
function drawRulesBox(f: FrameCtx, theme: Theme): boolean {
  const { ctx, g, face } = f;
  if (g.noBox) return true;
  const padX = 24;
  const padTop = 16;
  const padBottom = g.pt ? Math.max(28, g.box.y + g.box.h - (g.pt.y - 8)) : 14;
  const area: Rect = { x: g.box.x + padX, y: g.box.y + padTop, w: g.box.w - padX * 2, h: g.box.h - padTop - padBottom };
  const rules = tokenizeRules(face.rulesText, false);
  const flavor = tokenizeRules(face.flavorText, true);
  if (rules.length === 0 && flavor.length === 0) return true;
  const m = makeMeasurer(ctx, theme);
  const maxSize = 33 * theme.bodyScale * Math.min(1.3, Math.max(0.5, face.textScale));
  const minSize = 12;
  let size = maxSize;
  let rBlock: LaidBlock | null = null;
  let fBlock: LaidBlock | null = null;
  let gap = 0;
  let fits = false;
  while (size >= minSize) {
    const common = { width: area.w, size, lineHeightRatio: 1.16, paragraphGap: size * 0.32 };
    rBlock = rules.length ? layoutParagraphs(rules, m, common) : null;
    fBlock = flavor.length ? layoutParagraphs(flavor, m, common) : null;
    gap = rBlock && fBlock ? size * 0.7 : 0;
    const total = (rBlock?.height || 0) + gap + (fBlock?.height || 0);
    if (total <= area.h) {
      fits = true;
      break;
    }
    size -= 0.5;
  }
  if (!fits) {
    size = minSize;
    const common = { width: area.w, size, lineHeightRatio: 1.12, paragraphGap: size * 0.25 };
    rBlock = rules.length ? layoutParagraphs(rules, m, common) : null;
    fBlock = flavor.length ? layoutParagraphs(flavor, m, common) : null;
    gap = rBlock && fBlock ? size * 0.7 : 0;
  }
  const total = (rBlock?.height || 0) + gap + (fBlock?.height || 0);
  let y = area.y + Math.max(0, (area.h - total) / 2);
  ctx.save();
  if (rBlock) {
    drawLaidBlock(ctx, theme, rBlock, area.x, y, area.w, face.textAlign, theme.boxText);
    y += rBlock.height;
  }
  if (rBlock && fBlock) {
    const sepY = y + gap / 2;
    ctx.beginPath();
    ctx.moveTo(area.x + area.w * 0.28, sepY);
    ctx.lineTo(area.x + area.w * 0.72, sepY);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = theme.boxDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)';
    ctx.stroke();
  }
  y += gap;
  if (fBlock) {
    ctx.globalAlpha = 0.92;
    drawLaidBlock(ctx, theme, fBlock, area.x, y, area.w, face.textAlign === 'center' ? 'center' : 'left', theme.boxText);
  }
  ctx.restore();
  return fits;
}

function drawCostBadge(ctx: Ctx, cost: string, cx: number, cy: number, theme: Theme, f: FrameCtx): void {
  const w = 66;
  const h = 46;
  const neg = /^[−\-–]/.test(cost);
  const pos = /^\+/.test(cost);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  if (pos) {
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h * 0.05);
    ctx.lineTo(0, -h / 2 - 2);
    ctx.lineTo(w / 2, -h * 0.05);
    ctx.lineTo(w / 2, h / 2);
  } else if (neg) {
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h * 0.05);
    ctx.lineTo(0, h / 2 + 2);
    ctx.lineTo(-w / 2, h * 0.05);
  } else {
    rrPath(ctx, -w / 2, -h / 2, w, h, 10);
  }
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  gr.addColorStop(0, '#3a3a40');
  gr.addColorStop(1, '#141416');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = f.meta.frameStyle === 'neon' ? f.pal.neonSolid : '#e9e4d3';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${cost.length > 3 ? 21 : 27}px ${theme.titleFont}`;
  ctx.fillText(cost || '', 0, pos ? 4 : neg ? -3 : 0);
  ctx.restore();
}

function drawPlaneswalkerBox(f: FrameCtx, theme: Theme): boolean {
  const { ctx, g, face } = f;
  const abilities = face.abilities.filter((a) => a.text.trim() || a.cost.trim());
  if (abilities.length === 0) return true;
  const area: Rect = { x: g.box.x + 8, y: g.box.y + 8, w: g.box.w - 16, h: g.box.h - 16 };
  const m = makeMeasurer(ctx, theme);
  const paragraphsFor = abilities.map((a) => tokenizeRules(a.text, false));
  const costColW = 92;
  const minBand = 66;
  const padV = 10;
  const maxSize = 31 * theme.bodyScale * Math.min(1.3, Math.max(0.5, face.textScale));
  let size = maxSize;
  let blocks: LaidBlock[] = [];
  let heights: number[] = [];
  let fits = false;
  while (size >= 12) {
    blocks = paragraphsFor.map((p, i) => {
      const hasCost = abilities[i].cost.trim().length > 0;
      const reserve = i === abilities.length - 1 && g.pt ? 92 : 0;
      const w = area.w - (hasCost ? costColW : 28) - reserve;
      return layoutParagraphs(p, m, { width: w, size, lineHeightRatio: 1.15, paragraphGap: size * 0.3 });
    });
    heights = blocks.map((b) => Math.max(minBand, b.height + padV * 2));
    if (heights.reduce((a, b) => a + b, 0) <= area.h) {
      fits = true;
      break;
    }
    size -= 0.5;
  }
  if (!fits) {
    heights = blocks.map((b) => Math.max(40, b.height + 8));
  }
  const used = heights.reduce((a, b) => a + b, 0);
  const extra = Math.max(0, area.h - used) / abilities.length;
  let y = area.y;
  abilities.forEach((a, i) => {
    const h = heights[i] + extra;
    if (i % 2 === 0) {
      rrPath(ctx, area.x, y, area.w, h, 4);
      ctx.fillStyle = theme.boxDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      ctx.fill();
    }
    const hasCost = a.cost.trim().length > 0;
    if (hasCost) drawCostBadge(ctx, a.cost.trim(), area.x + 44, y + h / 2, theme, f);
    const tx = area.x + (hasCost ? costColW : 16);
    const block = blocks[i];
    const ty = y + (h - block.height) / 2;
    drawLaidBlock(ctx, theme, block, tx, ty, area.w - (hasCost ? costColW : 28), 'left', theme.boxText);
    y += h;
  });
  return fits;
}

function drawSagaBox(f: FrameCtx, theme: Theme): boolean {
  const { ctx, g, face } = f;
  const chapters = face.chapters.filter((c) => c.text.trim() || c.marks.trim());
  const reminder = tokenizeRules(face.rulesText, false);
  if (chapters.length === 0 && reminder.length === 0) return true;
  const area: Rect = { x: g.box.x + 10, y: g.box.y + 10, w: g.box.w - 20, h: g.box.h - 20 };
  const m = makeMeasurer(ctx, theme);
  const marksW = 64;
  const padV = 12;
  const minRow = 78;
  const maxSize = 29 * theme.bodyScale * Math.min(1.3, Math.max(0.5, face.textScale));
  const chapParas = chapters.map((c) => tokenizeRules(c.text, false));
  let size = maxSize;
  let rBlock: LaidBlock | null = null;
  let blocks: LaidBlock[] = [];
  let heights: number[] = [];
  let fits = false;
  while (size >= 12) {
    rBlock = reminder.length ? layoutParagraphs(reminder, m, { width: area.w, size: size * 0.92, lineHeightRatio: 1.15, paragraphGap: size * 0.25 }) : null;
    blocks = chapParas.map((p) => layoutParagraphs(p, m, { width: area.w - marksW - 18, size, lineHeightRatio: 1.15, paragraphGap: size * 0.3 }));
    heights = blocks.map((b) => Math.max(minRow, b.height + padV * 2));
    const total = (rBlock ? rBlock.height + 14 : 0) + heights.reduce((a, b) => a + b, 0);
    if (total <= area.h) {
      fits = true;
      break;
    }
    size -= 0.5;
  }
  if (!fits) heights = blocks.map((b) => Math.max(40, b.height + 10));
  const remindH = rBlock ? rBlock.height + 14 : 0;
  const used = remindH + heights.reduce((a, b) => a + b, 0);
  const extra = chapters.length ? Math.max(0, area.h - used) / chapters.length : 0;
  let y = area.y;
  if (rBlock) {
    drawLaidBlock(ctx, theme, rBlock, area.x + 4, y + 4, area.w - 8, 'left', theme.boxText);
    y += remindH;
  }
  chapters.forEach((c, i) => {
    const h = heights[i] + extra;
    // linha divisória
    if (i > 0 || rBlock) {
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = theme.boxDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }
    rrPath(ctx, area.x, y + 6, marksW, h - 12, 12);
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(30,26,22,0.88)');
    gr.addColorStop(1, 'rgba(12,10,8,0.92)');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.save();
    ctx.fillStyle = '#f3efe3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const marks = c.marks.trim();
    const ms = marks.length > 6 ? 17 : marks.length > 3 ? 22 : 28;
    ctx.font = `700 ${ms}px ${theme.titleFont}`;
    // empilha em várias linhas quando há vírgula (ex.: "II, III")
    const parts = marks.split(/\s*,\s*/);
    const lh = ms * 1.1;
    parts.forEach((p, pi) => {
      ctx.fillText(p, area.x + marksW / 2, y + h / 2 + (pi - (parts.length - 1) / 2) * lh);
    });
    ctx.restore();
    const b = blocks[i];
    drawLaidBlock(ctx, theme, b, area.x + marksW + 18, y + (h - b.height) / 2, area.w - marksW - 18, 'left', theme.boxText);
    y += h;
  });
  return fits;
}

function drawPtBox(f: FrameCtx, theme: Theme): void {
  const { ctx, g, face } = f;
  if (!g.pt) return;
  const r = g.pt;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (face.layout === 'planeswalker') {
    // escudo de lealdade
    const { x, y, w, h } = r;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y);
    ctx.lineTo(x + w * 0.88, y);
    ctx.lineTo(x + w, y + h * 0.22);
    ctx.lineTo(x + w, y + h * 0.68);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h * 0.68);
    ctx.lineTo(x, y + h * 0.22);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#3a3a40');
    gr.addColorStop(1, '#101012');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = f.meta.frameStyle === 'neon' ? f.pal.neonSolid : '#e9e4d3';
    if (f.meta.frameStyle === 'neon') {
      ctx.shadowColor = f.pal.neonSolid;
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    clearShadow(ctx);
    ctx.fillStyle = '#fff';
    const txt = face.loyalty.trim();
    ctx.font = `700 ${txt.length > 2 ? 34 : 46}px ${theme.titleFont}`;
    ctx.fillText(txt, x + w / 2, y + h * 0.44);
  } else {
    const pt = `${face.power.trim() || '*'}/${face.toughness.trim() || '*'}`;
    ctx.fillStyle = f.meta.frameStyle === 'showcase' ? '#ffbb00' : theme.plateText;
    if (f.meta.frameStyle === 'borderless') ctx.fillStyle = '#0f0d0b';
    const size = fitSingleLine(ctx, pt, (s) => `${theme.titleWeight} ${s}px ${theme.titleFont}`, r.w - 24, 40, 18);
    ctx.font = `${theme.titleWeight} ${size}px ${theme.titleFont}`;
    if (f.meta.frameStyle === 'neon') {
      ctx.shadowColor = f.pal.neonSolid;
      ctx.shadowBlur = 8;
    }
    ctx.fillText(pt, r.x + r.w / 2, r.y + r.h / 2 + 2);
  }
  ctx.restore();
}

const RARITY_LETTER: Record<MakerRarity, string> = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M', special: 'S' };

function drawFooter(f: FrameCtx): void {
  const { ctx, meta, face, g } = f;
  if (!meta.showFooter) return;
  const borderless = g.borderless;
  const bc = BORDER_COLORS.find((b) => b.id === meta.borderColor);
  const lightBorder = !borderless && (meta.borderColor === 'white' || meta.borderColor === 'silver' || meta.borderColor === 'gold');
  const color = lightBorder ? '#1b1b1d' : '#efefef';
  void bc;
  const y1 = borderless ? 994 : 1000;
  const y2 = borderless ? 1013 : 1019;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  if (borderless) {
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
  }
  const num = meta.collectorNumber.trim();
  const total = meta.collectorTotal.trim();
  const numTxt = num ? `${num}${total ? '/' + total : ''}` : '';
  const left = 44;
  ctx.font = `600 13px ${SANS_BODY}`;
  ctx.textAlign = 'left';
  const l1 = [numTxt, RARITY_LETTER[meta.rarity]].filter(Boolean).join('  ');
  ctx.fillText(l1, left, y1);
  const lang = meta.language === 'pt' ? 'PT' : 'EN';
  const artistLabel = meta.language === 'pt' ? 'Ilus.' : 'Illus.';
  const l2 = `${meta.setCode.toUpperCase()} • ${lang}` + (face.artist.trim() ? `   ${artistLabel} ${face.artist.trim()}` : '');
  ctx.fillText(l2, left, y2, 420);
  const cp = meta.copyright.trim();
  if (cp) {
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.85;
    ctx.font = `500 11.5px ${SANS_BODY}`;
    ctx.fillText(cp, CARD_W - 44, y2, 330);
  }
  ctx.restore();
}

function drawHoloStamp(f: FrameCtx): void {
  const { ctx, meta, g } = f;
  if (!meta.holoStamp || !(meta.rarity === 'rare' || meta.rarity === 'mythic' || meta.rarity === 'special')) return;
  const cx = CARD_W / 2;
  const cy = g.borderless ? 986 : g.layout === 'saga' ? 965 : 958;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 30, 14, 0, 0, Math.PI * 2);
  const gr = ctx.createLinearGradient(cx - 30, cy - 14, cx + 30, cy + 14);
  if (meta.rarity === 'mythic') {
    gr.addColorStop(0, '#e86a2c');
    gr.addColorStop(0.5, '#ffd27a');
    gr.addColorStop(1, '#c4491a');
  } else if (meta.rarity === 'special') {
    gr.addColorStop(0, '#7d4aa8');
    gr.addColorStop(0.5, '#e2b8ff');
    gr.addColorStop(1, '#6a3a92');
  } else {
    gr.addColorStop(0, '#9c7a24');
    gr.addColorStop(0.5, '#f4de97');
    gr.addColorStop(1, '#8a6a1c');
  }
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 21, 8, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.restore();
}

function drawFoil(ctx: Ctx, foil: CardMeta['foil'], clip: () => void): void {
  if (foil === 'none') return;
  ctx.save();
  clip();
  ctx.clip();
  if (foil === 'foil') {
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    const stops = ['#ff5f6d', '#ffc371', '#fff07a', '#7dffa8', '#6ad7ff', '#a98bff', '#ff7ad9'];
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  } else {
    ctx.globalCompositeOperation = 'overlay';
    for (let i = -6; i < 14; i++) {
      const g = ctx.createLinearGradient(i * 90, 0, i * 90 + 60, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(CARD_W / 2, CARD_H / 2);
      ctx.rotate(-0.5);
      ctx.translate(-CARD_W / 2, -CARD_H / 2);
      ctx.fillStyle = g;
      ctx.fillRect(i * 90, -400, 60, CARD_H + 800);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(190,200,215,0.35)';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                             */
/* ------------------------------------------------------------------ */

export function drawCard(
  ctx: Ctx,
  card: CustomCard,
  faceIndex: number,
  assets: RenderAssets,
  opts: RenderOptions
): RenderReport {
  const face = card.faces[faceIndex] || card.faces[0];
  const meta = card.meta;
  const baseTheme = THEMES[meta.frameStyle];
  const customFrame = assets.frame && face.layout !== 'saga' && face.layout !== 'planeswalker' ? assets.frame : null;
  const geoStyle: FrameStyle = customFrame ? 'modern' : meta.frameStyle;
  const theme: Theme = {
    ...baseTheme,
    titleFont: assets.titleFamily ? `'${assets.titleFamily}', ${baseTheme.titleFont}` : baseTheme.titleFont,
    bodyFont: assets.bodyFamily ? `'${assets.bodyFamily}', ${baseTheme.bodyFont}` : baseTheme.bodyFont,
    ...(customFrame
      ? meta.frameTextLight
        ? { plateText: '#f4f1e8', boxText: '#f4f1e8', boxDark: true }
        : { plateText: '#0f0d0b', boxText: '#0f0d0b', boxDark: false }
      : {}),
  };
  const g = getGeometry(geoStyle, face);
  const colors = resolveFrameColors(face, meta);
  const pal = buildPal(colors);
  const borderHex = BORDER_COLORS.find((b) => b.id === meta.borderColor)?.hex || '#0b0b0c';
  const border = meta.frameStyle === 'borderless' ? '#070708' : borderHex;
  const legend =
    meta.legendCrown &&
    isLegendary(face.typeLine) &&
    meta.frameStyle === 'modern' &&
    !customFrame &&
    face.layout !== 'saga';

  const totalW = CARD_W + opts.bleed * 2;
  const totalH = CARD_H + opts.bleed * 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, totalW * opts.scale, totalH * opts.scale);
  ctx.setTransform(opts.scale, 0, 0, opts.scale, opts.bleed * opts.scale, opts.bleed * opts.scale);

  const f: FrameCtx = { ctx, g, pal, meta: customFrame ? { ...meta, frameStyle: 'modern' } : meta, face, border, legend };
  const radius = theme.cornerRadius;

  if (opts.bleed > 0) {
    ctx.fillStyle = border;
    ctx.fillRect(-opts.bleed, -opts.bleed, totalW, totalH);
  }

  ctx.save();
  if (opts.rounded && opts.bleed === 0) {
    rrPath(ctx, 0, 0, CARD_W, CARD_H, radius);
    ctx.clip();
  }

  const drawers = FRAME_DRAWERS[geoStyle];
  if (customFrame) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  } else {
    drawers.base(f);
  }

  // Arte
  const chamfer = geoStyle === 'neon' ? 18 : 0;
  const artRadius = g.borderless ? 0 : geoStyle === 'showcase' ? 6 : geoStyle === 'parchment' ? 3 : 4;
  const upscale = drawArt(ctx, g.art, face.art, assets.art, pal, artRadius, chamfer);

  if (customFrame) {
    ctx.drawImage(customFrame, 0, 0, CARD_W, CARD_H);
  } else {
    drawers.plates(f);
  }

  // Textos
  drawTextOnPlate(f, theme);
  drawSetIcon(f, assets, theme);
  let textFits = true;
  if (!g.noBox) {
    if (face.layout === 'planeswalker') textFits = drawPlaneswalkerBox(f, theme);
    else if (face.layout === 'saga') textFits = drawSagaBox(f, theme);
    else textFits = drawRulesBox(f, theme);
  }
  drawPtBox(f, theme);
  drawHoloStamp(f);
  drawFooter(f);

  drawFoil(ctx, meta.foil, () => {
    rrPath(ctx, 0, 0, CARD_W, CARD_H, radius);
  });

  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { textFits, artUpscale: upscale };
}

export function canvasSizeFor(opts: RenderOptions): { width: number; height: number } {
  return {
    width: Math.round((CARD_W + opts.bleed * 2) * opts.scale),
    height: Math.round((CARD_H + opts.bleed * 2) * opts.scale),
  };
}

/** Renderiza em um canvas novo (export / miniaturas). */
export async function renderToCanvas(card: CustomCard, faceIndex: number, opts: RenderOptions): Promise<{ canvas: HTMLCanvasElement; report: RenderReport }> {
  const assets = await loadRenderAssets(card, faceIndex);
  const canvas = document.createElement('canvas');
  const { width, height } = canvasSizeFor(opts);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  const report = drawCard(ctx, card, faceIndex, assets, opts);
  return { canvas, report };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem (arte de origem sem permissão CORS?).'))),
      type,
      quality
    );
  });
}

export async function renderThumb(card: CustomCard, width = 280): Promise<string> {
  const scale = width / CARD_W;
  const { canvas } = await renderToCanvas(card, 0, { scale, bleed: 0, rounded: false });
  try {
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return '';
  }
}

export async function renderToDataUrl(
  card: CustomCard,
  faceIndex: number,
  opts: RenderOptions,
  type: 'image/png' | 'image/jpeg' = 'image/jpeg',
  quality = 0.88
): Promise<string> {
  const { canvas } = await renderToCanvas(card, faceIndex, opts);
  return canvas.toDataURL(type, quality);
}
