import React, { useState } from 'react';
import { Check, Clipboard, Download, Loader2, Printer, AlertCircle } from 'lucide-react';
import { CustomCard, sanitizeFileName, cardTitle } from '../../services/cardMaker/model';
import { BLEED_3MM, CARD_H, CARD_W, canvasToBlob, renderToCanvas } from '../../services/cardMaker/renderer';
import { Modal, Segmented, Toggle, downloadBlob } from './ui';

type Format = 'png' | 'jpg';
type Quality = 1 | 2 | 3;

export interface ProxySendItem {
  name: string;
  typeLine: string;
  imageUrl: string;
  quantity: number;
  setCode: string;
  rarity: string;
}

interface ExportModalProps {
  card: CustomCard;
  initialFace?: number;
  onClose: () => void;
  onSendToProxies?: (items: ProxySendItem[]) => void;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ card, initialFace = 0, onClose, onSendToProxies, onToast }) => {
  const [format, setFormat] = useState<Format>('png');
  const [quality, setQuality] = useState<Quality>(2);
  const [bleed, setBleed] = useState(false);
  const [rounded, setRounded] = useState(false);
  const [faces, setFaces] = useState<'current' | 'all'>(card.faces.length > 1 ? 'all' : 'current');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<'' | 'download' | 'copy' | 'proxy'>('');
  const [error, setError] = useState('');

  const bleedPx = bleed ? BLEED_3MM : 0;
  const effectiveRounded = rounded && !bleed && format === 'png';
  const outW = Math.round((CARD_W + bleedPx * 2) * quality);
  const outH = Math.round((CARD_H + bleedPx * 2) * quality);
  const faceIndexes = faces === 'all' && card.faces.length > 1 ? card.faces.map((_, i) => i) : [Math.min(initialFace, card.faces.length - 1)];

  const makeBlob = async (faceIndex: number) => {
    const { canvas } = await renderToCanvas(card, faceIndex, { scale: quality, bleed: bleedPx, rounded: effectiveRounded });
    return canvasToBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
  };

  const fileName = (faceIndex: number) => {
    const base = sanitizeFileName(card.faces.length > 1 ? card.faces[faceIndex].name || cardTitle(card) : cardTitle(card));
    const side = card.faces.length > 1 ? (faceIndex === 0 ? '-frente' : '-verso') : '';
    return `${base}${side}${bleed ? '-sangria' : ''}.${format}`;
  };

  const handleDownload = async () => {
    setBusy('download');
    setError('');
    try {
      for (const i of faceIndexes) {
        const blob = await makeBlob(i);
        downloadBlob(blob, fileName(i));
        await new Promise((r) => setTimeout(r, 250));
      }
      onToast(faceIndexes.length > 1 ? 'Imagens baixadas.' : 'Imagem baixada.', 'success');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const handleCopy = async () => {
    setBusy('copy');
    setError('');
    try {
      const { canvas } = await renderToCanvas(card, faceIndexes[0], { scale: Math.min(quality, 2), bleed: bleedPx, rounded: effectiveRounded });
      const blob = await canvasToBlob(canvas, 'image/png');
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('Seu navegador não permite copiar imagens.');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      onToast('Imagem copiada para a área de transferência.', 'success');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const handleProxy = async () => {
    if (!onSendToProxies) return;
    setBusy('proxy');
    setError('');
    try {
      const items: ProxySendItem[] = [];
      for (const i of faceIndexes) {
        const { canvas } = await renderToCanvas(card, i, { scale: 1, bleed: 0, rounded: false });
        const url = canvas.toDataURL('image/jpeg', 0.86);
        items.push({
          name: card.faces[i].name || 'Carta customizada',
          typeLine: card.faces[i].typeLine,
          imageUrl: url,
          quantity: qty,
          setCode: card.meta.setCode,
          rarity: card.meta.rarity,
        });
      }
      onSendToProxies(items);
      onToast(`${items.length > 1 ? 'Faces enviadas' : 'Carta enviada'} ao Proxy Studio.`, 'success');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal title="Exportar carta" subtitle={cardTitle(card)} onClose={onClose} width={620}>
      <div className="cm-export-grid">
        <div className="cm-field">
          <label className="cm-label">Formato</label>
          <Segmented
            value={format}
            onChange={(v) => setFormat(v)}
            options={[
              { id: 'png', label: 'PNG' },
              { id: 'jpg', label: 'JPG' },
            ]}
          />
        </div>
        <div className="cm-field">
          <label className="cm-label">Resolução</label>
          <Segmented
            value={String(quality) as '1' | '2' | '3'}
            onChange={(v) => setQuality(Number(v) as Quality)}
            options={[
              { id: '1', label: 'Padrão', title: '744 × 1039' },
              { id: '2', label: 'Alta', title: '1488 × 2078' },
              { id: '3', label: 'Impressão', title: '2232 × 3117 (≈ 900 dpi em 63 × 88 mm)' },
            ]}
          />
        </div>
      </div>

      <div className="cm-toggle-stack">
        <Toggle checked={bleed} onChange={setBleed} label="Sangria de 3 mm" hint="Estende a borda para corte seguro em gráfica" />
        <Toggle
          checked={effectiveRounded}
          onChange={setRounded}
          disabled={bleed || format === 'jpg'}
          label="Cantos arredondados transparentes"
          hint={bleed || format === 'jpg' ? 'Disponível só em PNG e sem sangria' : 'Sem isso, os cantos saem quadrados (ideal para impressão)'}
        />
        {card.faces.length > 1 && (
          <Toggle checked={faces === 'all'} onChange={(v) => setFaces(v ? 'all' : 'current')} label="Exportar frente e verso" hint="Gera um arquivo por face" />
        )}
      </div>

      <div className="cm-export-summary">
        <span>
          {outW} × {outH} px
        </span>
        <span>{format.toUpperCase()}</span>
        <span>{faceIndexes.length} arquivo{faceIndexes.length > 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="cm-notice cm-notice-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="cm-export-actions">
        <button type="button" className="btn btn-primary" disabled={busy !== ''} onClick={handleDownload}>
          {busy === 'download' ? <Loader2 size={16} className="cm-spin" /> : <Download size={16} />} Baixar
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={handleCopy}>
          {busy === 'copy' ? <Loader2 size={16} className="cm-spin" /> : <Clipboard size={16} />} Copiar imagem
        </button>
      </div>

      {onSendToProxies && (
        <div className="cm-proxy-send">
          <div>
            <strong>
              <Printer size={14} style={{ verticalAlign: '-2px' }} /> Imprimir como proxy
            </strong>
            <p className="cm-hint">Adiciona a carta à fila do Proxy Studio (folha A4, 9 por página).</p>
          </div>
          <div className="cm-proxy-send-controls">
            <div className="cm-qty">
              <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
                −
              </button>
              <span>{qty}</span>
              <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Mais">
                +
              </button>
            </div>
            <button type="button" className="btn btn-highlight" disabled={busy !== ''} onClick={handleProxy}>
              {busy === 'proxy' ? <Loader2 size={16} className="cm-spin" /> : <Check size={16} />} Enviar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
