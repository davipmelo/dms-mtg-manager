import { jsPDF } from 'jspdf';
import { Card, TokenCard, ProxyItem } from '../types';
import { isMpcCardImage } from './mpcFillService';

export interface ProxyPdfOptions {
  showCutLines: boolean;
  cutLinesColor: string;
  cutLinesThickness: number; // in mm
  cutLinesStyle: 'solid' | 'dashed' | 'dotted';
  showCropMarks: boolean;
  cropMarksColor: string;
  cropMarksThickness: number; // in mm
  cropMarksLength: number; // in mm
  showMarginTicks: boolean;
  showCornerMarks: boolean;
  cardBleedBg: 'black' | 'white';
  showSheetMetadata: boolean;
  cropMpcBleed?: boolean;
}

export const DEFAULT_PROXY_PDF_OPTIONS: ProxyPdfOptions = {
  showCutLines: false,
  cutLinesColor: '#000000',
  cutLinesThickness: 0.25,
  cutLinesStyle: 'solid',
  showCropMarks: true,
  cropMarksColor: '#475569',
  cropMarksThickness: 0.2,
  cropMarksLength: 12,
  showMarginTicks: true,
  showCornerMarks: true,
  cardBleedBg: 'black',
  showSheetMetadata: true,
  cropMpcBleed: true,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

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
 * Generates an exact multi-page A4 PDF containing 9 MTG cards per page (63mm x 88mm)
 * with millimeter-precise cut lines, crop marks, and zero empty pages.
 */
export async function generateProxiesPdf(
  pages: Array<Array<{ item: ProxyItem; card: Card | TokenCard }>>,
  options: ProxyPdfOptions = DEFAULT_PROXY_PDF_OPTIONS,
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void
): Promise<Blob> {
  const totalPages = pages.length;
  if (totalPages === 0) {
    throw new Error('A lista de proxies está vazia.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [210, 297],
  });

  pdf.setProperties({
    title: 'Proliferate Proxies (A4 210x297mm)',
    subject: 'Magic: The Gathering Proxies (63x88mm)',
    creator: 'Proliferate',
  });

  // Exact 12 px per mm = 304.8 DPI (crisp high-res print)
  // Ensures integer coordinates and 100% exact 63.00mm x 88.00mm card dimensions
  const SCALE = 12;
  const CANVAS_WIDTH = 2520; // 210 * 12
  const CANVAS_HEIGHT = 3564; // 297 * 12

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível inicializar Canvas 2D.');

  // Pre-fetch all images across all pages
  const totalCards = pages.reduce((sum, p) => sum + p.length, 0);
  let loadedCards = 0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageCards = pages[pageIdx];

    // Clear canvas to pure white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Sheet Margin Ruler Ticks (pointing inward from sheet edges)
    if (options.showCropMarks && options.showMarginTicks) {
      ctx.fillStyle = options.cropMarksColor;
      const tickW = Math.max(1, Math.round(options.cropMarksThickness * SCALE));
      const tickL = Math.max(4, Math.round(options.cropMarksLength * SCALE));

      // Vertical line cut marks at X = 10.5mm, 73.5mm, 136.5mm, 199.5mm
      const vCutPositions = [10.5, 73.5, 136.5, 199.5];
      for (const xMm of vCutPositions) {
        const xPx = Math.round(xMm * SCALE);
        // Top tick (pointing down)
        ctx.fillRect(xPx - Math.floor(tickW / 2), 0, tickW, tickL);
        // Bottom tick (pointing up)
        ctx.fillRect(xPx - Math.floor(tickW / 2), CANVAS_HEIGHT - tickL, tickW, tickL);
      }

      // Horizontal line cut marks at Y = 16.5mm, 104.5mm, 192.5mm, 280.5mm
      const hCutPositions = [16.5, 104.5, 192.5, 280.5];
      for (const yMm of hCutPositions) {
        const yPx = Math.round(yMm * SCALE);
        // Left tick (pointing right)
        ctx.fillRect(0, yPx - Math.floor(tickW / 2), tickL, tickW);
        // Right tick (pointing left)
        ctx.fillRect(CANVAS_WIDTH - tickL, yPx - Math.floor(tickW / 2), tickL, tickW);
      }
    }

    // 2. Sheet Metadata (in margin, outside card cutting area)
    if (options.showSheetMetadata) {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 24px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';

      // Left metadata
      ctx.textAlign = 'left';
      ctx.fillText(
        `PROLIFERATE • PROXY STUDIO (A4 210×297mm)`,
        126, // 10.5mm * 12
        96 // 8mm * 12
      );

      // Right metadata
      ctx.textAlign = 'right';
      ctx.fillText(
        `FOLHA ${pageIdx + 1} DE ${totalPages} • 9 CARTAS (63.0mm × 88.0mm)`,
        CANVAS_WIDTH - 126,
        96
      );
      ctx.textAlign = 'left';
    }

    // 3. Render 9 Cards in 3x3 Grid (Exactly 63mm x 88mm)
    const startX = 126; // 10.5mm * 12
    const startY = 198; // 16.5mm * 12
    const cardWPx = 756; // 63mm * 12
    const cardHPx = 1056; // 88mm * 12

    for (let cIdx = 0; cIdx < pageCards.length; cIdx++) {
      const { card } = pageCards[cIdx];
      const col = cIdx % 3;
      const row = Math.floor(cIdx / 3);

      const cardX = Math.round(startX + col * cardWPx);
      const cardY = Math.round(startY + row * cardHPx);
      const wPx = Math.round(cardWPx);
      const hPx = Math.round(cardHPx);

      // Card Background (Black or White bleed fill)
      ctx.fillStyle = options.cardBleedBg === 'white' ? '#ffffff' : '#000000';
      ctx.fillRect(cardX, cardY, wPx, hPx);

      // Attempt to load image
      const isCustomOrAlter = card.setCode === 'CUSTOM' || card.setCode === 'MPC';
      const isValidSrc = (src?: string) =>
        Boolean(
          src &&
            (src.startsWith('http://') ||
              src.startsWith('https://') ||
              src.startsWith('data:image/') ||
              src.startsWith('blob:'))
        );

      const candidates: string[] = [];
      if (isValidSrc(card.imageUrlLarge)) candidates.push(card.imageUrlLarge!);
      if (isValidSrc(card.imageUrl) && !candidates.includes(card.imageUrl!)) {
        candidates.push(card.imageUrl!);
      }
      if (!isCustomOrAlter && card.setCode && card.collectorNumber && card.collectorNumber !== '★') {
        candidates.push(
          `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=large`
        );
      }

      let img: HTMLImageElement | null = null;
      for (const url of candidates) {
        try {
          img = await loadImage(url);
          break;
        } catch {
          // Try next candidate
        }
      }

      if (img) {
        const shouldCropBleed =
          options.cropMpcBleed !== false &&
          isMpcCardImage(card.setCode, card.imageUrl, card.imageUrlLarge, card.id);

        if (shouldCropBleed) {
          // MPCFill uses 1/8" (3.175mm) bleed on standard 63mm x 88mm card:
          // Bleed width ratio: 3.175 / (63 + 2*3.175) ≈ 0.0458
          // Bleed height ratio: 3.175 / (88 + 2*3.175) ≈ 0.0336
          const cropX = img.width * 0.0458;
          const cropY = img.height * 0.0336;
          const srcW = img.width - 2 * cropX;
          const srcH = img.height - 2 * cropY;
          ctx.drawImage(img, cropX, cropY, srcW, srcH, cardX, cardY, wPx, hPx);
        } else {
          ctx.drawImage(img, cardX, cardY, wPx, hPx);
        }
      } else {
        // Fallback placeholder card
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cardX, cardY, wPx, hPx);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(card.name, cardX + 20, cardY + 60, wPx - 40);
      }

      // Draw Cut Lines (Outer border)
      if (options.showCutLines) {
        ctx.save();
        ctx.strokeStyle = options.cutLinesColor;
        ctx.lineWidth = Math.max(1, Math.round(options.cutLinesThickness * SCALE));

        if (options.cutLinesStyle === 'dashed') {
          ctx.setLineDash([12, 8]);
        } else if (options.cutLinesStyle === 'dotted') {
          ctx.setLineDash([4, 6]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.strokeRect(cardX, cardY, wPx, hPx);
        ctx.restore();
      }

      loadedCards++;
      if (onProgress) {
        onProgress({
          current: loadedCards,
          total: totalCards,
          percentage: Math.round((loadedCards / totalCards) * 100),
        });
      }
    }

    // 4. Draw Junction Crosses at Card Intersections (Single-stroke exact thickness, no doubling)
    if (options.showCropMarks && options.showCornerMarks) {
      ctx.save();
      ctx.strokeStyle = options.cropMarksColor;
      ctx.lineWidth = Math.max(1, Math.round(options.cropMarksThickness * SCALE));
      const armPx = Math.round(3.5 * SCALE); // 3.5mm cross arm

      const vCols = [startX, startX + cardWPx, startX + 2 * cardWPx, startX + 3 * cardWPx];
      const hRows = [startY, startY + cardHPx, startY + 2 * cardHPx, startY + 3 * cardHPx];

      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          const jX = Math.round(vCols[c]);
          const jY = Math.round(hRows[r]);

          const hasLeft = c > 0;
          const hasRight = c < 3;
          const hasUp = r > 0;
          const hasDown = r < 3;

          // Horizontal segment
          const x1 = hasLeft ? jX - armPx : jX;
          const x2 = hasRight ? jX + armPx : jX;
          if (x1 !== x2) {
            ctx.beginPath();
            ctx.moveTo(x1, jY);
            ctx.lineTo(x2, jY);
            ctx.stroke();
          }

          // Vertical segment
          const y1 = hasUp ? jY - armPx : jY;
          const y2 = hasDown ? jY + armPx : jY;
          if (y1 !== y2) {
            ctx.beginPath();
            ctx.moveTo(jX, y1);
            ctx.lineTo(jX, y2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // Add page to PDF (exact 210 x 297 mm)
    if (pageIdx > 0) {
      pdf.addPage([210, 297], 'portrait');
    }

    const pageImgData = canvas.toDataURL('image/jpeg', 0.96);
    pdf.addImage(pageImgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  return pdf.output('blob');
}

