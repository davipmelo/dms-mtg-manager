import { jsPDF } from 'jspdf';
import { Card, TokenCard, ProxyItem } from '../types';

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
}

export const DEFAULT_PROXY_PDF_OPTIONS: ProxyPdfOptions = {
  showCutLines: true,
  cutLinesColor: '#000000',
  cutLinesThickness: 0.25,
  cutLinesStyle: 'solid',
  showCropMarks: true,
  cropMarksColor: '#000000',
  cropMarksThickness: 0.35,
  cropMarksLength: 8,
  showMarginTicks: true,
  showCornerMarks: true,
  cardBleedBg: 'black',
  showSheetMetadata: true,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
    format: 'a4',
  });

  // A4 dimensions at 300 DPI: 2480 x 3508 px
  // 1 mm = 2480 / 210 = 11.809523 px
  const SCALE = 2480 / 210;
  const CANVAS_WIDTH = 2480;
  const CANVAS_HEIGHT = 3508;

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
      ctx.font = '600 22px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';

      // Left metadata
      ctx.textAlign = 'left';
      ctx.fillText(
        `DMS MTG MANAGER • PROXY STUDIO (A4)`,
        Math.round(10.5 * SCALE),
        Math.round(8 * SCALE)
      );

      // Right metadata
      ctx.textAlign = 'right';
      ctx.fillText(
        `FOLHA ${pageIdx + 1} DE ${totalPages} • 9 CARTAS (63mm × 88mm)`,
        CANVAS_WIDTH - Math.round(10.5 * SCALE),
        Math.round(8 * SCALE)
      );
      ctx.textAlign = 'left';
    }

    // 3. Render 9 Cards in 3x3 Grid
    const startX = 10.5 * SCALE;
    const startY = 16.5 * SCALE;
    const cardWPx = 63 * SCALE;
    const cardHPx = 88 * SCALE;

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
      const candidates: string[] = [];
      if (card.imageUrlLarge && card.imageUrlLarge.startsWith('http')) candidates.push(card.imageUrlLarge);
      if (card.imageUrl && card.imageUrl.startsWith('http')) candidates.push(card.imageUrl);
      if (card.setCode && card.collectorNumber) {
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
        ctx.drawImage(img, cardX, cardY, wPx, hPx);
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

      // Draw Corner Marks on card
      if (options.showCropMarks && options.showCornerMarks) {
        ctx.save();
        ctx.strokeStyle = options.cropMarksColor;
        ctx.lineWidth = Math.max(1, Math.round(options.cropMarksThickness * SCALE));
        const cLen = Math.round(4 * SCALE); // 4mm corner arm

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(cardX, cardY + cLen);
        ctx.lineTo(cardX, cardY);
        ctx.lineTo(cardX + cLen, cardY);
        ctx.stroke();

        // Top-Right
        ctx.beginPath();
        ctx.moveTo(cardX + wPx - cLen, cardY);
        ctx.lineTo(cardX + wPx, cardY);
        ctx.lineTo(cardX + wPx, cardY + cLen);
        ctx.stroke();

        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(cardX, cardY + hPx - cLen);
        ctx.lineTo(cardX, cardY + hPx);
        ctx.lineTo(cardX + cLen, cardY + hPx);
        ctx.stroke();

        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(cardX + wPx - cLen, cardY + hPx);
        ctx.lineTo(cardX + wPx, cardY + hPx);
        ctx.lineTo(cardX + wPx, cardY + hPx - cLen);
        ctx.stroke();

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

    // Add page to PDF
    if (pageIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const pageImgData = canvas.toDataURL('image/jpeg', 0.96);
    pdf.addImage(pageImgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  return pdf.output('blob');
}
