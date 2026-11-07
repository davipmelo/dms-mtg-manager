import { Deck, Card } from '../types';

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
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export interface DeckImageProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Generates an ultra high-resolution A4 (2480 x 3508 px, 300 DPI) composite poster
 * containing all cards of the deck in their selected arts, saved as JPEG with low compression (quality 0.95).
 */
export async function generateDeckPosterA4(
  deck: Deck,
  onProgress?: (progress: DeckImageProgress) => void
): Promise<Blob> {
  // 1. Gather all cards in the deck in exact visual order (Commander first, then alphabetical)
  const commanderCards: Card[] = [];
  const otherCards: Card[] = [];

  const cmdId = deck.commanderCard?.id;
  const cmdName = deck.commanderCard?.name.toLowerCase();
  const partnerId = deck.partnerCard?.id;
  const partnerName = deck.partnerCard?.name.toLowerCase();

  for (const item of deck.cards) {
    const isCmd =
      item.category === 'commander' ||
      (cmdId && item.card.id === cmdId) ||
      (cmdName && item.card.name.toLowerCase() === cmdName);

    const isPartner =
      item.category === 'partner' ||
      (partnerId && item.card.id === partnerId) ||
      (partnerName && item.card.name.toLowerCase() === partnerName);

    for (let q = 0; q < item.quantity; q++) {
      if (isCmd) {
        commanderCards.unshift(item.card);
      } else if (isPartner) {
        commanderCards.push(item.card);
      } else {
        otherCards.push(item.card);
      }
    }
  }

  // Ensure commanderCard is included if omitted from deck.cards
  if (deck.commanderCard && !commanderCards.some((c) => c.name.toLowerCase() === cmdName)) {
    commanderCards.unshift(deck.commanderCard);
  }
  if (deck.partnerCard && !commanderCards.some((c) => c.name.toLowerCase() === partnerName)) {
    commanderCards.push(deck.partnerCard);
  }

  // Sort other cards alphabetically
  otherCards.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const allCards = [...commanderCards, ...otherCards];
  const totalCards = allCards.length;

  if (totalCards === 0) {
    throw new Error('O deck não possui cartas para gerar a imagem.');
  }

  // 2. Setup A4 Canvas (Standard 300 DPI: 2480 x 3508 px)
  const CANVAS_WIDTH = 2480;
  const CANVAS_HEIGHT = 3508;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

  // 3. Draw Background & Aesthetic Framing
  const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGradient.addColorStop(0, '#0c1017');
  bgGradient.addColorStop(0.5, '#111726');
  bgGradient.addColorStop(1, '#090d14');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Decorative inner border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 20, 20, CANVAS_WIDTH - 40, CANVAS_HEIGHT - 40, 16);
  ctx.stroke();

  // 4. Draw Header
  const headerY = 40;
  const headerHeight = 150;

  // Header background badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  drawRoundedRect(ctx, 36, headerY, CANVAS_WIDTH - 72, headerHeight, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Deck Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  const displayTitle = deck.name.length > 40 ? `${deck.name.substring(0, 38)}...` : deck.name;
  ctx.fillText(displayTitle, 64, headerY + 54);

  // Deck Subtitle (Format, card count, metadata)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const commanderText = deck.commanderCard ? ` • Comandante: ${deck.commanderCard.name}` : '';
  ctx.fillText(
    `${deck.format.toUpperCase()} • ${totalCards} CARTAS${commanderText}`,
    64,
    headerY + 104
  );

  // App Logo Tag on top right
  ctx.fillStyle = '#818cf8';
  ctx.font = 'bold 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('DMS MTG MANAGER', CANVAS_WIDTH - 64, headerY + 60);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DECK POSTER (A4)', CANVAS_WIDTH - 64, headerY + 95);
  ctx.textAlign = 'left'; // reset

  // 5. Layout Calculation for Cards
  const gridTop = headerY + headerHeight + 30; // ~220px
  const gridBottom = CANVAS_HEIGHT - 36;
  const availableHeight = gridBottom - gridTop;
  const gridLeft = 36;
  const gridRight = CANVAS_WIDTH - 36;
  const availableWidth = gridRight - gridLeft;

  // Calculate best columns and rows so all cards fit onto single A4 sheet
  // Standard card aspect ratio: 63 / 88 = 0.7159
  const CARD_ASPECT = 63 / 88;
  const cols = Math.min(
    10,
    Math.max(6, Math.ceil(Math.sqrt(totalCards * (availableWidth / availableHeight) * (88 / 63))))
  );
  const rows = Math.ceil(totalCards / cols);

  const colWidth = Math.floor(availableWidth / cols);
  const cardGapX = 4;
  const cardWidth = colWidth - cardGapX;
  const cardHeight = Math.floor(cardWidth / CARD_ASPECT);

  // Calculate vertical step (allowing gentle overlap if necessary to fit A4 height)
  const maxNaturalHeight = rows * cardHeight;
  const rowStep =
    rows > 1 && maxNaturalHeight > availableHeight
      ? (availableHeight - cardHeight) / (rows - 1)
      : Math.min(cardHeight + 4, (availableHeight - cardHeight) / Math.max(1, rows - 1));

  // 6. Pre-load Card Images with Progress Reporting
  let loadedCount = 0;
  if (onProgress) {
    onProgress({ loaded: 0, total: totalCards, percentage: 0 });
  }

  const loadedImages: Array<HTMLImageElement | null> = await Promise.all(
    allCards.map(async (card) => {
      // Pick best resolution image URL
      const urlCandidates: string[] = [];
      if (card.imageUrlLarge && card.imageUrlLarge.startsWith('http')) {
        urlCandidates.push(card.imageUrlLarge);
      }
      if (card.imageUrl && card.imageUrl.startsWith('http') && !urlCandidates.includes(card.imageUrl)) {
        urlCandidates.push(card.imageUrl);
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
              total: totalCards,
              percentage: Math.round((loadedCount / totalCards) * 100),
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
          total: totalCards,
          percentage: Math.round((loadedCount / totalCards) * 100),
        });
      }
      return null;
    })
  );

  // 7. Render All Cards onto Canvas in Ordered Rows
  for (let idx = 0; idx < totalCards; idx++) {
    const card = allCards[idx];
    const img = loadedImages[idx];

    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const x = gridLeft + c * colWidth;
    const y = gridTop + r * rowStep;

    const isCommander = idx === 0 && commanderCards.length > 0;

    // Card drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    // Clip to rounded rectangle
    const cornerRadius = Math.max(4, Math.floor(cardWidth * 0.04));
    drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);

    if (img) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x, y, cardWidth, cardHeight);
      ctx.restore();
    } else {
      // Fallback placeholder card if image failed to load
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `bold ${Math.max(10, Math.floor(cardWidth * 0.08))}px sans-serif`;
      ctx.fillText(card.name, x + 8, y + 24, cardWidth - 16);
    }

    ctx.restore();

    // Highlight Commander with Gold Border & Tag
    if (isCommander) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
      ctx.stroke();

      // Commander small tag
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      drawRoundedRect(ctx, x + 6, y + 6, Math.min(cardWidth - 12, 110), 20, 4);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMANDANTE', x + 6 + Math.min(cardWidth - 12, 110) / 2, y + 20);
      ctx.textAlign = 'left';
    } else {
      // Subtle card border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, cornerRadius);
      ctx.stroke();
    }
  }

  // 8. Export Canvas to JPEG Blob with low compression (quality 0.95)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Erro ao converter Canvas para JPEG.'));
        }
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Triggers browser download of the generated JPEG blob.
 */
export function downloadDeckPoster(blob: Blob, deckName: string) {
  const cleanName = deckName.replace(/[^a-zA-Z0-9_\u00C0-\u017F\s-]/g, '').trim().replace(/\s+/g, '_');
  const fileName = `${cleanName || 'deck'}_A4.jpg`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

