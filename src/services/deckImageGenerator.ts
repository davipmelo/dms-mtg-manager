import { Deck, Card, DeckCard } from '../types';
import { jsPDF } from 'jspdf';

export interface DeckImageProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type PosterResolution = 'ultra' | 'high' | 'standard' | 'compact';
export type PosterAspectRatio = 'a4-portrait' | 'a4-landscape' | 'wallpaper-16-9' | 'square-1-1';
export type PosterFormat = 'jpeg' | 'png' | 'pdf';
export type PosterTheme = 'dark-gradient' | 'black-minimal' | 'playmat' | 'light-clean' | 'transparent';
export type PosterSort = 'default' | 'cmc' | 'type' | 'color' | 'name';

export interface DeckImageOptions {
  resolution: PosterResolution;
  aspectRatio: PosterAspectRatio;
  groupByArt: boolean;
  format: PosterFormat;
  jpegQuality: number; // 0.80 - 1.0
  backgroundTheme: PosterTheme;
  cardSort: PosterSort;
  highlightCommander: boolean;
  showQuantityBadges: boolean;
  showCardNames: boolean;
  showHeader: boolean;
  includeSideboard: boolean;
  customTitle?: string;
  authorName?: string;
}

export const DEFAULT_DECK_IMAGE_OPTIONS: DeckImageOptions = {
  resolution: 'ultra',
  aspectRatio: 'a4-portrait',
  groupByArt: true,
  format: 'jpeg',
  jpegQuality: 0.95,
  backgroundTheme: 'dark-gradient',
  cardSort: 'default',
  highlightCommander: true,
  showQuantityBadges: true,
  showCardNames: false,
  showHeader: true,
  includeSideboard: false,
  customTitle: '',
  authorName: '',
};

/**
 * Loads an image with CORS anonymous attribute and handles fallback gracefully.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/**
 * Draws rounded rectangle on a 2D canvas context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Computes canvas pixel width & height from aspect ratio and resolution.
 */
function getCanvasDimensions(
  aspectRatio: PosterAspectRatio,
  resolution: PosterResolution
): { width: number; height: number } {
  const scaleMap: Record<PosterResolution, number> = {
    ultra: 1.0,     // 300 DPI / 4K UHD
    high: 0.67,     // 200 DPI / 2K
    standard: 0.5,  // 150 DPI / 1080p
    compact: 0.32,  // 72 DPI (Web)
  };
  const scale = scaleMap[resolution] || 1.0;

  switch (aspectRatio) {
    case 'a4-landscape':
      return { width: Math.round(3508 * scale), height: Math.round(2480 * scale) };
    case 'wallpaper-16-9':
      return { width: Math.round(3840 * scale), height: Math.round(2160 * scale) };
    case 'square-1-1':
      return { width: Math.round(2400 * scale), height: Math.round(2400 * scale) };
    case 'a4-portrait':
    default:
      return { width: Math.round(2480 * scale), height: Math.round(3508 * scale) };
  }
}

interface PreparedCardItem {
  card: Card;
  quantity: number;
  isCommander: boolean;
  isPartner: boolean;
  category: string;
}

/**
 * Primary card type ranking for cardSort: 'type'
 */
function getPrimaryTypeRank(typeLine: string): number {
  const tl = typeLine.toLowerCase();
  if (tl.includes('planeswalker')) return 1;
  if (tl.includes('creature') || tl.includes('criatura')) return 2;
  if (tl.includes('instant') || tl.includes('mágica instantânea')) return 3;
  if (tl.includes('sorcery') || tl.includes('feitiço')) return 4;
  if (tl.includes('artifact') || tl.includes('artefato')) return 5;
  if (tl.includes('enchantment') || tl.includes('encantamento')) return 6;
  if (tl.includes('battle') || tl.includes('batalha')) return 7;
  if (tl.includes('land') || tl.includes('terreno')) return 8;
  return 9;
}

/**
 * Color rank for cardSort: 'color'
 */
function getColorRank(card: Card): number {
  if (card.typeLine.toLowerCase().includes('land') || card.typeLine.toLowerCase().includes('terreno')) {
    return 8; // Lands at the end
  }
  const colors = card.colors || [];
  if (colors.length === 0) return 7; // Colorless
  if (colors.length > 1) return 6; // Multicolored
  switch (colors[0]) {
    case 'W': return 1;
    case 'U': return 2;
    case 'B': return 3;
    case 'R': return 4;
    case 'G': return 5;
    default: return 7;
  }
}

/**
 * Generates a customizable composite deck poster image (or PDF)
 * supporting custom resolutions, grouping identical arts, color/layout themes, and formats.
 */
export async function generateDeckPoster(
  deck: Deck,
  options: DeckImageOptions = DEFAULT_DECK_IMAGE_OPTIONS,
  onProgress?: (progress: DeckImageProgress) => void
): Promise<{ blob: Blob; fileName: string }> {
  // 1. Filter deck cards
  const candidateCards: DeckCard[] = deck.cards.filter((c) => {
    if (!options.includeSideboard && c.category === 'sideboard') {
      return false;
    }
    return true;
  });

  const cmdId = deck.commanderCard?.id;
  const cmdName = deck.commanderCard?.name.toLowerCase();
  const partnerId = deck.partnerCard?.id;
  const partnerName = deck.partnerCard?.name.toLowerCase();

  // 2. Group or expand cards
  let cardItems: PreparedCardItem[] = [];

  if (options.groupByArt) {
    // Group identical card editions/arts together
    const groupMap = new Map<string, PreparedCardItem>();

    for (const item of candidateCards) {
      const isCmd =
        item.category === 'commander' ||
        (cmdId && item.card.id === cmdId) ||
        (cmdName && item.card.name.toLowerCase() === cmdName);

      const isPartner =
        item.category === 'partner' ||
        (partnerId && item.card.id === partnerId) ||
        (partnerName && item.card.name.toLowerCase() === partnerName);

      // Unique art key based on name, set, collectorNumber and imageUrl
      const artKey = `${item.card.name.toLowerCase()}_${(item.card.setCode || '').toLowerCase()}_${item.card.collectorNumber || ''}_${item.card.imageUrl || ''}`;

      if (groupMap.has(artKey)) {
        const existing = groupMap.get(artKey)!;
        existing.quantity += item.quantity;
        if (isCmd) existing.isCommander = true;
        if (isPartner) existing.isPartner = true;
      } else {
        groupMap.set(artKey, {
          card: item.card,
          quantity: item.quantity,
          isCommander: !!isCmd,
          isPartner: !!isPartner,
          category: item.category,
        });
      }
    }

    cardItems = Array.from(groupMap.values());
  } else {
    // Un-grouped: Expand each copy into individual item
    for (const item of candidateCards) {
      const isCmd =
        item.category === 'commander' ||
        (cmdId && item.card.id === cmdId) ||
        (cmdName && item.card.name.toLowerCase() === cmdName);

      const isPartner =
        item.category === 'partner' ||
        (partnerId && item.card.id === partnerId) ||
        (partnerName && item.card.name.toLowerCase() === partnerName);

      for (let q = 0; q < item.quantity; q++) {
        cardItems.push({
          card: item.card,
          quantity: 1,
          isCommander: !!isCmd,
          isPartner: !!isPartner,
          category: item.category,
        });
      }
    }
  }

  // Ensure standalone commanderCard is included if missing
  if (deck.commanderCard) {
    const hasCmd = cardItems.some(
      (c) => c.card.name.toLowerCase() === cmdName || c.card.id === cmdId
    );
    if (!hasCmd) {
      cardItems.unshift({
        card: deck.commanderCard,
        quantity: 1,
        isCommander: true,
        isPartner: false,
        category: 'commander',
      });
    }
  }

  if (deck.partnerCard) {
    const hasPartner = cardItems.some(
      (c) => c.card.name.toLowerCase() === partnerName || c.card.id === partnerId
    );
    if (!hasPartner) {
      cardItems.push({
        card: deck.partnerCard,
        quantity: 1,
        isCommander: false,
        isPartner: true,
        category: 'partner',
      });
    }
  }

  if (cardItems.length === 0) {
    throw new Error('O deck não possui cartas para gerar o pôster.');
  }

  // 3. Sort cards according to cardSort option
  const commanders = cardItems.filter((c) => c.isCommander || c.isPartner);
  const nonCommanders = cardItems.filter((c) => !c.isCommander && !c.isPartner);

  nonCommanders.sort((a, b) => {
    switch (options.cardSort) {
      case 'cmc': {
        const cmcDiff = (a.card.cmc ?? 0) - (b.card.cmc ?? 0);
        if (cmcDiff !== 0) return cmcDiff;
        return a.card.name.localeCompare(b.card.name, 'pt-BR');
      }
      case 'type': {
        const rankDiff = getPrimaryTypeRank(a.card.typeLine) - getPrimaryTypeRank(b.card.typeLine);
        if (rankDiff !== 0) return rankDiff;
        return a.card.name.localeCompare(b.card.name, 'pt-BR');
      }
      case 'color': {
        const colDiff = getColorRank(a.card) - getColorRank(b.card);
        if (colDiff !== 0) return colDiff;
        return a.card.name.localeCompare(b.card.name, 'pt-BR');
      }
      case 'name':
      case 'default':
      default:
        return a.card.name.localeCompare(b.card.name, 'pt-BR', { sensitivity: 'base' });
    }
  });

  const finalCards = [...commanders, ...nonCommanders];
  const totalCardsToRender = finalCards.length;
  const totalActualCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

  // 4. Setup Canvas
  const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasDimensions(
    options.aspectRatio,
    options.resolution
  );

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

  // 5. Draw Background Theme
  const isTransparent = options.backgroundTheme === 'transparent' && options.format === 'png';

  if (!isTransparent) {
    switch (options.backgroundTheme) {
      case 'black-minimal':
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        break;

      case 'light-clean': {
        const lg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        lg.addColorStop(0, '#f8fafc');
        lg.addColorStop(0.5, '#f1f5f9');
        lg.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        break;
      }

      case 'playmat': {
        const pg = ctx.createRadialGradient(
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          100,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.8
        );
        pg.addColorStop(0, '#101d24');
        pg.addColorStop(0.6, '#0b1318');
        pg.addColorStop(1, '#05080a');
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Elegant decorative inner border
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth = Math.max(2, Math.round(CANVAS_WIDTH * 0.0015));
        drawRoundedRect(ctx, 24, 24, CANVAS_WIDTH - 48, CANVAS_HEIGHT - 48, 18);
        ctx.stroke();
        break;
      }

      case 'dark-gradient':
      default: {
        const dg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        dg.addColorStop(0, '#0c1017');
        dg.addColorStop(0.4, '#111726');
        dg.addColorStop(1, '#090d14');
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Subtle modern outer border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = Math.max(2, Math.round(CANVAS_WIDTH * 0.0012));
        drawRoundedRect(ctx, 20, 20, CANVAS_WIDTH - 40, CANVAS_HEIGHT - 40, 16);
        ctx.stroke();
        break;
      }
    }
  } else {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 6. Draw Header (if enabled)
  let gridTop = Math.round(CANVAS_HEIGHT * 0.015);
  const marginX = Math.round(CANVAS_WIDTH * 0.015);
  const marginBottom = Math.round(CANVAS_HEIGHT * 0.015);

  const isLight = options.backgroundTheme === 'light-clean';
  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#94a3b8';
  const textMuted = isLight ? '#64748b' : '#64748b';
  const badgeBg = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.03)';
  const badgeBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.09)';

  if (options.showHeader) {
    const headerHeight = Math.max(90, Math.round(CANVAS_HEIGHT * 0.045));
    const headerY = Math.round(CANVAS_HEIGHT * 0.012);

    // Header container badge
    ctx.fillStyle = badgeBg;
    drawRoundedRect(ctx, marginX, headerY, CANVAS_WIDTH - marginX * 2, headerHeight, 14);
    ctx.fill();
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Deck Title
    const titleText = options.customTitle?.trim() || deck.name;
    const titleFontSize = Math.max(20, Math.round(headerHeight * 0.38));
    ctx.fillStyle = textPrimary;
    ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle';

    const maxTitleChars = Math.max(28, Math.round(CANVAS_WIDTH / (titleFontSize * 0.65)));
    const displayTitle =
      titleText.length > maxTitleChars ? `${titleText.substring(0, maxTitleChars - 3)}...` : titleText;
    ctx.fillText(displayTitle, marginX + 28, headerY + headerHeight * 0.38);

    // Deck Subtitle
    const subFontSize = Math.max(12, Math.round(titleFontSize * 0.48));
    ctx.fillStyle = textSecondary;
    ctx.font = `600 ${subFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    const groupNote = options.groupByArt
      ? ` • ${totalCardsToRender} ARTES AGRUPADAS`
      : ` • ${totalCardsToRender} CARTAS INDIVIDUAIS`;
    const commanderText = deck.commanderCard ? ` • Cmd: ${deck.commanderCard.name}` : '';
    const authorText = options.authorName?.trim() ? ` • Autor: ${options.authorName.trim()}` : '';

    ctx.fillText(
      `${deck.format.toUpperCase()} • ${totalActualCards} CARTAS TOTAIS${groupNote}${commanderText}${authorText}`,
      marginX + 28,
      headerY + headerHeight * 0.72
    );

    // Right-aligned branding / poster tag
    ctx.textAlign = 'right';
    const tagFontSize = Math.max(12, Math.round(titleFontSize * 0.45));
    ctx.fillStyle = isLight ? '#4f46e5' : '#818cf8';
    ctx.font = `bold ${tagFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('DMS MTG MANAGER', CANVAS_WIDTH - marginX - 28, headerY + headerHeight * 0.4);

    ctx.fillStyle = textMuted;
    ctx.font = `${Math.max(10, Math.round(tagFontSize * 0.8))}px system-ui, sans-serif`;
    const ratioLabel =
      options.aspectRatio === 'a4-portrait'
        ? 'A4 RETRATO'
        : options.aspectRatio === 'a4-landscape'
        ? 'A4 PAISAGEM'
        : options.aspectRatio === 'wallpaper-16-9'
        ? 'WALLPAPER 16:9'
        : 'QUADRADO 1:1';
    ctx.fillText(`PÔSTER DECK (${ratioLabel})`, CANVAS_WIDTH - marginX - 28, headerY + headerHeight * 0.72);
    ctx.textAlign = 'left'; // reset

    gridTop = headerY + headerHeight + Math.round(CANVAS_HEIGHT * 0.008);
  }

  // 7. Optimal Grid Calculation
  const CARD_ASPECT = 63 / 88; // ~0.7159
  const gridBottom = CANVAS_HEIGHT - marginBottom;
  const availableHeight = gridBottom - gridTop;
  const gridLeft = marginX;
  const availableWidth = CANVAS_WIDTH - marginX * 2;

  // Find optimal number of columns: test column counts from 4 to 18
  let bestCols = 8;
  let bestScore = -1;
  let bestCardWidth = 100;
  let bestCardHeight = 140;
  let bestRowStep = 140;
  let bestRows = 10;

  const minCols = options.aspectRatio === 'a4-landscape' || options.aspectRatio === 'wallpaper-16-9' ? 7 : 5;
  const maxCols = options.aspectRatio === 'a4-landscape' || options.aspectRatio === 'wallpaper-16-9' ? 18 : 12;

  for (let c = minCols; c <= maxCols; c++) {
    const r = Math.ceil(totalCardsToRender / c);
    const gapX = Math.max(3, Math.round(availableWidth / (c * 30)));
    const cWidth = (availableWidth - (c - 1) * gapX) / c;
    const cHeight = cWidth / CARD_ASPECT;

    // Check row step
    let rStep = cHeight + gapX;
    const naturalHeight = (r - 1) * rStep + cHeight;

    if (naturalHeight > availableHeight) {
      if (r <= 1) continue;
      rStep = (availableHeight - cHeight) / (r - 1);
    }

    // Visible height proportion of overlapping cards
    const visibleRatio = rStep / cHeight;
    // We prefer higher visible proportion, with penalty if cards are too squished
    if (visibleRatio < 0.25) continue; // At least 25% of card must be visible

    const visibleArea = cWidth * Math.min(cHeight, rStep);
    const score = visibleArea * Math.min(1.0, visibleRatio);

    if (score > bestScore) {
      bestScore = score;
      bestCols = c;
      bestRows = r;
      bestCardWidth = Math.floor(cWidth);
      bestCardHeight = Math.floor(cHeight);
      bestRowStep = rStep;
    }
  }

  const cols = bestCols;
  const rows = bestRows;
  const cardWidth = bestCardWidth;
  const cardHeight = bestCardHeight;
  const gapX = Math.floor((availableWidth - cols * cardWidth) / Math.max(1, cols - 1));
  const rowStep = bestRowStep;

  // 8. Pre-load Images with Progress Reporting
  let loadedCount = 0;
  if (onProgress) {
    onProgress({ loaded: 0, total: totalCardsToRender, percentage: 0 });
  }

  const loadedImages: Array<HTMLImageElement | null> = await Promise.all(
    finalCards.map(async (item) => {
      const card = item.card;
      const urlCandidates: string[] = [];

      // If high or ultra, prefer large image
      if (
        (options.resolution === 'ultra' || options.resolution === 'high') &&
        card.imageUrlLarge &&
        card.imageUrlLarge.startsWith('http')
      ) {
        urlCandidates.push(card.imageUrlLarge);
      }
      if (card.imageUrl && card.imageUrl.startsWith('http') && !urlCandidates.includes(card.imageUrl)) {
        urlCandidates.push(card.imageUrl);
      }
      if (card.imageUrlLarge && card.imageUrlLarge.startsWith('http') && !urlCandidates.includes(card.imageUrlLarge)) {
        urlCandidates.push(card.imageUrlLarge);
      }
      if (card.setCode && card.collectorNumber) {
        urlCandidates.push(
          `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=normal`
        );
      }

      for (const url of urlCandidates) {
        try {
          const img = await loadImage(url);
          loadedCount++;
          if (onProgress) {
            onProgress({
              loaded: loadedCount,
              total: totalCardsToRender,
              percentage: Math.round((loadedCount / totalCardsToRender) * 100),
            });
          }
          return img;
        } catch {
          // Try next candidate
        }
      }

      loadedCount++;
      if (onProgress) {
        onProgress({
          loaded: loadedCount,
          total: totalCardsToRender,
          percentage: Math.round((loadedCount / totalCardsToRender) * 100),
        });
      }
      return null;
    })
  );

  // 9. Draw Cards onto Canvas
  const cornerRadius = Math.max(3, Math.floor(cardWidth * 0.04));

  for (let idx = 0; idx < totalCardsToRender; idx++) {
    const item = finalCards[idx];
    const img = loadedImages[idx];

    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const x = gridLeft + c * (cardWidth + gapX);
    const y = gridTop + r * rowStep;

    const isCommander = (item.isCommander || item.isPartner) && options.highlightCommander;

    // Drop Shadow
    if (!isTransparent) {
      ctx.save();
      ctx.shadowColor = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = Math.max(4, Math.round(cardWidth * 0.05));
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 3;

      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    }

    // Clip & Draw Image
    ctx.save();
    drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
    ctx.clip();

    if (img) {
      ctx.drawImage(img, x, y, cardWidth, cardHeight);
    } else {
      // Fallback
      ctx.fillStyle = isLight ? '#cbd5e1' : '#1e293b';
      ctx.fillRect(x, y, cardWidth, cardHeight);

      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      ctx.font = `bold ${Math.max(9, Math.floor(cardWidth * 0.08))}px sans-serif`;
      ctx.fillText(item.card.name, x + 6, y + 20, cardWidth - 12);
    }

    // Optional Bottom Card Name Banner
    if (options.showCardNames) {
      const bannerHeight = Math.max(16, Math.round(cardHeight * 0.1));
      ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
      ctx.fillRect(x, y + cardHeight - bannerHeight, cardWidth, bannerHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.max(9, Math.round(bannerHeight * 0.55))}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(item.card.name, x + 6, y + cardHeight - bannerHeight / 2, cardWidth - 12);
    }

    ctx.restore();

    // Commander Highlight Styling
    if (isCommander) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(2.5, Math.round(cardWidth * 0.025));
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
      ctx.stroke();

      // Gold Commander Tag Badge
      const badgeW = Math.min(cardWidth - 12, Math.max(60, Math.round(cardWidth * 0.55)));
      const badgeH = Math.max(14, Math.round(cardHeight * 0.07));
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      drawRoundedRect(ctx, x + 5, y + 5, badgeW, badgeH, 4);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.max(8, Math.round(badgeH * 0.6))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.isPartner ? 'PARCEIRO' : 'COMANDANTE', x + 5 + badgeW / 2, y + 5 + badgeH / 2);
      ctx.restore();
    } else {
      // Subtle regular border
      ctx.save();
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
      ctx.stroke();
      ctx.restore();
    }

    // Quantity Badge (e.g. 4x, 15x)
    if (options.showQuantityBadges && item.quantity > 1) {
      ctx.save();
      const qText = `${item.quantity}x`;
      const qFontSize = Math.max(10, Math.round(cardWidth * 0.09));
      ctx.font = `bold ${qFontSize}px system-ui, sans-serif`;
      const textWidth = ctx.measureText(qText).width;

      const qBadgeW = textWidth + Math.max(10, Math.round(qFontSize * 0.8));
      const qBadgeH = Math.max(16, Math.round(qFontSize * 1.4));
      const qX = x + cardWidth - qBadgeW - 5;
      const qY = y + 5;

      ctx.fillStyle = 'rgba(12, 17, 28, 0.92)';
      drawRoundedRect(ctx, qX, qY, qBadgeW, qBadgeH, 6);
      ctx.fill();

      ctx.strokeStyle = isCommander ? '#f59e0b' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.2;
      drawRoundedRect(ctx, qX, qY, qBadgeW, qBadgeH, 6);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qText, qX + qBadgeW / 2, qY + qBadgeH / 2);
      ctx.restore();
    }
  }

  // 10. Generate Output Blob & File Name
  const cleanDeckName = (options.customTitle?.trim() || deck.name)
    .replace(/[^a-zA-Z0-9_\u00C0-\u017F\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const extMap: Record<PosterFormat, string> = {
    jpeg: 'jpg',
    png: 'png',
    pdf: 'pdf',
  };
  const extension = extMap[options.format] || 'jpg';
  const fileName = `${cleanDeckName || 'deck'}_poster_${options.aspectRatio}_${options.resolution}.${extension}`;

  if (options.format === 'pdf') {
    // Generate PDF using jsPDF
    const isLandscape = CANVAS_WIDTH > CANVAS_HEIGHT;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: isLandscape ? [297, 210] : [210, 297],
    });

    const imgData = canvas.toDataURL('image/jpeg', Math.min(0.96, Math.max(0.7, options.jpegQuality)));
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    const pdfBlob = pdf.output('blob');
    return { blob: pdfBlob, fileName };
  }

  if (options.format === 'png') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, fileName });
        } else {
          reject(new Error('Erro ao converter Canvas para PNG.'));
        }
      }, 'image/png');
    });
  }

  // Default JPEG
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, fileName });
        } else {
          reject(new Error('Erro ao converter Canvas para JPEG.'));
        }
      },
      'image/jpeg',
      Math.min(1.0, Math.max(0.75, options.jpegQuality))
    );
  });
}

/**
 * Download a generated deck poster blob with the provided file name.
 */
export function downloadDeckPosterBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Backward-compatibility wrapper for generateDeckPosterA4.
 */
export async function generateDeckPosterA4(
  deck: Deck,
  onProgress?: (progress: DeckImageProgress) => void
): Promise<Blob> {
  const result = await generateDeckPoster(deck, DEFAULT_DECK_IMAGE_OPTIONS, onProgress);
  return result.blob;
}

/**
 * Backward-compatibility wrapper for downloadDeckPoster.
 */
export function downloadDeckPoster(blob: Blob, deckName: string) {
  const cleanName = deckName.replace(/[^a-zA-Z0-9_\u00C0-\u017F\s-]/g, '').trim().replace(/\s+/g, '_');
  downloadDeckPosterBlob(blob, `${cleanName || 'deck'}_A4.jpg`);
}
