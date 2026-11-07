import React, { useState } from 'react';
import { ProxyItem, Deck, Card, TokenCard } from '../../types';
import { CardImage } from '../Common/CardImage';
import {
  generateProxiesPdf,
  ProxyPdfOptions,
  DEFAULT_PROXY_PDF_OPTIONS,
} from '../../services/proxyPdfService';
import {
  Printer,
  Trash2,
  Plus,
  Minus,
  Layers,
  Scissors,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Palette,
  Sliders,
  Download,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
} from 'lucide-react';

const COLOR_PRESETS = [
  { label: 'Preto', color: '#000000' },
  { label: 'Cinza Escuro', color: '#475569' },
  { label: 'Cinza Claro', color: '#cbd5e1' },
  { label: 'Branco', color: '#ffffff' },
  { label: 'Vermelho', color: '#ef4444' },
  { label: 'Azul', color: '#3b82f6' },
  { label: 'Amarelo', color: '#eab308' },
];

interface ProxyStudioProps {
  proxies: ProxyItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onAddDeckToProxies: (deck: Deck) => void;
  onOpenArtSelector?: (card: Card | TokenCard, proxyItemId: string) => void;
  decks: Deck[];
}

export const ProxyStudio: React.FC<ProxyStudioProps> = ({
  proxies,
  onUpdateQuantity,
  onRemoveItem,
  onClearAll,
  onAddDeckToProxies,
  onOpenArtSelector,
  decks,
}) => {
  // Cut lines state
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [cutLinesColor, setCutLinesColor] = useState<string>('#000000');
  const [cutLinesThickness, setCutLinesThickness] = useState<number>(0.25);
  const [cutLinesStyle, setCutLinesStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');

  // Crop marks state
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [cropMarksColor, setCropMarksColor] = useState<string>('#000000');
  const [cropMarksThickness, setCropMarksThickness] = useState<number>(0.35);
  const [cropMarksLength, setCropMarksLength] = useState<number>(8);
  const [showMarginTicks, setShowMarginTicks] = useState<boolean>(true);
  const [showCornerMarks, setShowCornerMarks] = useState<boolean>(true);

  // Card finish & metadata
  const [cardBleedBg, setCardBleedBg] = useState<'black' | 'white'>('black');
  const [showSheetMetadata, setShowSheetMetadata] = useState<boolean>(true);

  // UI state
  const [isAdvancedControlsOpen, setIsAdvancedControlsOpen] = useState<boolean>(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);

  // Flatten proxies into individual card instances for exact 9-card page chunks
  // If an un-split double-faced card is present in the queue, expand each copy to Front then Back
  const expandedCards: Array<{ item: ProxyItem; card: Card | TokenCard }> = [];
  proxies.forEach((item) => {
    const faces = item.card.cardFaces;
    const isUnsplitDfc = !item.card.faceLabel && faces && faces.length >= 2;

    for (let i = 0; i < item.quantity; i++) {
      if (isUnsplitDfc && faces) {
        const frontCard: Card | TokenCard = {
          ...item.card,
          name: faces[0].name || item.card.name.split(' // ')[0].trim(),
          typeLine: faces[0].typeLine || item.card.typeLine,
          imageUrl: faces[0].imageUrl || item.card.imageUrl,
          imageUrlLarge: faces[0].imageUrlLarge || item.card.imageUrlLarge || item.card.imageUrl,
          faceLabel: 'frente',
        };
        const backCard: Card | TokenCard = {
          ...item.card,
          id: `${item.card.id}-back`,
          name: faces[1].name || (item.card.name.includes(' // ') ? item.card.name.split(' // ')[1].trim() : `${item.card.name} (Verso)`),
          typeLine: faces[1].typeLine || item.card.typeLine,
          imageUrl: faces[1].imageUrl,
          imageUrlLarge: faces[1].imageUrlLarge || faces[1].imageUrl,
          faceLabel: 'verso',
        };
        expandedCards.push({ item, card: frontCard });
        expandedCards.push({ item, card: backCard });
      } else {
        expandedCards.push({ item, card: item.card });
      }
    }
  });

  const totalPages = Math.ceil(expandedCards.length / 9) || 1;
  const pages: Array<Array<{ item: ProxyItem; card: Card | TokenCard }>> = [];
  for (let p = 0; p < totalPages; p++) {
    pages.push(expandedCards.slice(p * 9, (p + 1) * 9));
  }

  // Print using clean native print dialog (no blank pages)
  const handlePrint = () => {
    window.print();
  };

  // Direct PDF download using jsPDF
  const handleDownloadPdf = async () => {
    if (pages.length === 0 || expandedCards.length === 0) return;
    setIsDownloadingPdf(true);
    setPdfProgress({ current: 0, total: expandedCards.length, percentage: 0 });

    try {
      const pdfOptions: ProxyPdfOptions = {
        showCutLines,
        cutLinesColor,
        cutLinesThickness,
        cutLinesStyle,
        showCropMarks,
        cropMarksColor,
        cropMarksThickness,
        cropMarksLength,
        showMarginTicks,
        showCornerMarks,
        cardBleedBg,
        showSheetMetadata,
      };

      const blob = await generateProxiesPdf(pages, pdfOptions, (prog) => {
        setPdfProgress(prog);
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxies_mtg_A4_${expandedCards.length}_cartas.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err: any) {
      console.error('Error generating proxy PDF:', err);
      alert(err?.message || 'Erro ao gerar o PDF de proxies.');
    } finally {
      setIsDownloadingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleAddDeck = () => {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (deck) {
      onAddDeckToProxies(deck);
      setSelectedDeckId('');
    }
  };

  // 1-Click Presets
  const applyPreset = (preset: 'guillotine' | 'hobbyknife' | 'minimal' | 'economical') => {
    switch (preset) {
      case 'guillotine':
        setShowCutLines(true);
        setCutLinesColor('#000000');
        setCutLinesThickness(0.25);
        setCutLinesStyle('solid');
        setShowCropMarks(true);
        setCropMarksColor('#000000');
        setCropMarksThickness(0.35);
        setCropMarksLength(12);
        setShowMarginTicks(true);
        setShowCornerMarks(true);
        setCardBleedBg('black');
        break;

      case 'hobbyknife':
        setShowCutLines(true);
        setCutLinesColor('#475569');
        setCutLinesThickness(0.2);
        setCutLinesStyle('dashed');
        setShowCropMarks(true);
        setCropMarksColor('#000000');
        setCropMarksThickness(0.35);
        setCropMarksLength(8);
        setShowMarginTicks(true);
        setShowCornerMarks(true);
        setCardBleedBg('black');
        break;

      case 'minimal':
        setShowCutLines(false);
        setShowCropMarks(true);
        setCropMarksColor('#000000');
        setCropMarksThickness(0.3);
        setCropMarksLength(8);
        setShowMarginTicks(true);
        setShowCornerMarks(false);
        setCardBleedBg('black');
        break;

      case 'economical':
        setShowCutLines(true);
        setCutLinesColor('#cbd5e1');
        setCutLinesThickness(0.2);
        setCutLinesStyle('solid');
        setShowCropMarks(true);
        setCropMarksColor('#94a3b8');
        setCropMarksThickness(0.25);
        setCropMarksLength(6);
        setShowMarginTicks(true);
        setShowCornerMarks(true);
        setCardBleedBg('white');
        break;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Control Panel (Hidden during Print) */}
      <div className="glass-panel print-hide" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Printer className="text-amber-400" size={24} />
              Estúdio de Impressão de Proxies (A4 — 9 cartas por folha)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Diagramação exata de 63mm × 88mm com guias de corte e sem páginas em branco. Total:{' '}
              <strong style={{ color: '#f8fafc' }}>{expandedCards.length} cartas</strong> em{' '}
              <strong style={{ color: '#ffbb00' }}>{totalPages} folha(s) A4</strong>.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {proxies.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-red-400"
                onClick={onClearAll}
                disabled={isDownloadingPdf}
              >
                <Trash2 size={14} /> Limpar Fila
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadPdf}
              disabled={expandedCards.length === 0 || isDownloadingPdf}
              title="Baixar arquivo PDF A4 compilado pronto para impressão"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Gerando PDF ({pdfProgress?.percentage || 0}%)...
                </>
              ) : (
                <>
                  <Download size={14} /> Baixar PDF Direto (A4)
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={expandedCards.length === 0 || isDownloadingPdf}
              title="Abrir diálogo de impressão do navegador ou salvar PDF com escala 100%"
            >
              <Printer size={16} /> Imprimir / Salvar PDF (A4)
            </button>
          </div>
        </div>

        {/* Quick Add Deck to Proxies */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
            Adicionar Deck Inteiro à Impressão:
          </span>
          <select
            className="select-field"
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            style={{ width: 'auto', minWidth: '220px' }}
          >
            <option value="">Selecione um deck...</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.cards.length} cartas)
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddDeck}
            disabled={!selectedDeckId}
          >
            <Plus size={14} /> Adicionar Deck à Fila
          </button>
        </div>

        {/* Customizable Cut Lines & Crop Marks Controls Bar */}
        <div
          style={{
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsAdvancedControlsOpen(!isAdvancedControlsOpen)}
              style={{ padding: '4px 8px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={15} className="text-amber-400" />
              <span style={{ fontWeight: 600 }}>Controles Avançados de Corte e Enquadramento</span>
              {isAdvancedControlsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Quick 1-Click Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Presets:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('guillotine')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Linhas contínuas pretas + réguas de margem longas"
              >
                Guilhotina / Régua
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('hobbyknife')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Linhas tracejadas cinzas + cantoneiras nos cards"
              >
                Estilete Manual
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('minimal')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Sem bordas, apenas marcas de corte"
              >
                Minimalista
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('economical')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Linhas cinza claro + cantos brancos para economia de tinta"
              >
                Econômico
              </button>
            </div>
          </div>

          {isAdvancedControlsOpen && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* 1. Bordas de Corte */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scissors size={15} className="text-amber-400" /> Bordas de Corte das Cartas
                  </label>
                  <button
                    type="button"
                    className={`btn btn-sm ${showCutLines ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowCutLines(!showCutLines)}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    {showCutLines ? 'Ativadas' : 'Desativadas'}
                  </button>
                </div>

                {showCutLines && (
                  <>
                    {/* Cut lines color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Cor da linha:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {COLOR_PRESETS.map((p) => (
                          <button
                            key={p.color}
                            type="button"
                            onClick={() => setCutLinesColor(p.color)}
                            title={`Cor: ${p.label}`}
                            style={{
                              width: '15px',
                              height: '15px',
                              borderRadius: '50%',
                              backgroundColor: p.color,
                              border: cutLinesColor === p.color ? '2px solid #ffbb00' : '1px solid rgba(255,255,255,0.3)',
                              cursor: 'pointer',
                              padding: 0,
                              transform: cutLinesColor === p.color ? 'scale(1.2)' : 'scale(1)',
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={cutLinesColor}
                          onChange={(e) => setCutLinesColor(e.target.value)}
                          title="Cor personalizada"
                          style={{ width: '18px', height: '18px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    {/* Cut lines thickness */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Espessura:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: '0.15mm (Fina)', val: 0.15 },
                          { label: '0.25mm (Padrão)', val: 0.25 },
                          { label: '0.40mm (Média)', val: 0.4 },
                          { label: '0.60mm (Grossa)', val: 0.6 },
                        ].map((th) => (
                          <button
                            key={th.val}
                            type="button"
                            className={`btn btn-sm ${cutLinesThickness === th.val ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCutLinesThickness(th.val)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {th.val}mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cut lines style */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Estilo de linha:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: 'Sólida', val: 'solid' as const },
                          { label: 'Tracejada', val: 'dashed' as const },
                          { label: 'Pontilhada', val: 'dotted' as const },
                        ].map((st) => (
                          <button
                            key={st.val}
                            type="button"
                            className={`btn btn-sm ${cutLinesStyle === st.val ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCutLinesStyle(st.val)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 2. Marcas de Enquadramento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckSquare size={15} className="text-amber-400" /> Marcas de Enquadramento (Crop Marks)
                  </label>
                  <button
                    type="button"
                    className={`btn btn-sm ${showCropMarks ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowCropMarks(!showCropMarks)}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    {showCropMarks ? 'Ativadas' : 'Desativadas'}
                  </button>
                </div>

                {showCropMarks && (
                  <>
                    {/* Crop marks color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Cor das marcas:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {COLOR_PRESETS.map((p) => (
                          <button
                            key={`crop-${p.color}`}
                            type="button"
                            onClick={() => setCropMarksColor(p.color)}
                            title={`Cor: ${p.label}`}
                            style={{
                              width: '15px',
                              height: '15px',
                              borderRadius: '50%',
                              backgroundColor: p.color,
                              border: cropMarksColor === p.color ? '2px solid #ffbb00' : '1px solid rgba(255,255,255,0.3)',
                              cursor: 'pointer',
                              padding: 0,
                              transform: cropMarksColor === p.color ? 'scale(1.2)' : 'scale(1)',
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={cropMarksColor}
                          onChange={(e) => setCropMarksColor(e.target.value)}
                          title="Cor personalizada"
                          style={{ width: '18px', height: '18px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    {/* Crop marks thickness */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Espessura:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: '0.20mm', val: 0.2 },
                          { label: '0.35mm', val: 0.35 },
                          { label: '0.50mm', val: 0.5 },
                          { label: '0.75mm', val: 0.75 },
                        ].map((th) => (
                          <button
                            key={th.val}
                            type="button"
                            className={`btn btn-sm ${cropMarksThickness === th.val ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCropMarksThickness(th.val)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {th.val}mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Crop marks length & toggles */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94a3b8' }}>Comprimento:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: '5mm', val: 5 },
                          { label: '8mm', val: 8 },
                          { label: '12mm', val: 12 },
                          { label: '16mm', val: 16 },
                        ].map((len) => (
                          <button
                            key={len.val}
                            type="button"
                            className={`btn btn-sm ${cropMarksLength === len.val ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setCropMarksLength(len.val)}
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {len.val}mm
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.76rem', color: '#cbd5e1', paddingTop: '2px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showMarginTicks}
                          onChange={(e) => setShowMarginTicks(e.target.checked)}
                          style={{ accentColor: '#ffbb00' }}
                        />
                        <span>Réguas de Margem</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showCornerMarks}
                          onChange={(e) => setShowCornerMarks(e.target.checked)}
                          style={{ accentColor: '#ffbb00' }}
                        />
                        <span>Cantoneiras nos Cards</span>
                      </label>
                    </div>
                  </>
                )}
              </div>

              {/* 3. Acabamento & Sangria */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={15} className="text-amber-400" /> Acabamento & Sangria
                </label>

                {/* Card Bleed Background */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <span style={{ color: '#94a3b8' }}>Sangria dos cantos:</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${cardBleedBg === 'black' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCardBleedBg('black')}
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      title="Preenchimento preto em volta dos cantos arredondados (padrão MTG)"
                    >
                      Preto (MTG)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${cardBleedBg === 'white' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCardBleedBg('white')}
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      title="Preenchimento branco para economia de toner/tinta"
                    >
                      Branco (Econômico)
                    </button>
                  </div>
                </div>

                {/* Sheet Metadata Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={showSheetMetadata}
                    onChange={(e) => setShowSheetMetadata(e.target.checked)}
                    style={{ accentColor: '#ffbb00' }}
                  />
                  <span>Exibir rodapé de identificação (Folha X de Y) na margem externa</span>
                </label>

                {/* Printing Tip */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 187, 0, 0.08)',
                    border: '1px solid rgba(255, 187, 0, 0.25)',
                    fontSize: '0.72rem',
                    color: '#ffdd66',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    marginTop: 'auto',
                  }}
                >
                  <HelpCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    No diálogo de impressão: selecione <strong>Escala: 100% (Padrão)</strong> e <strong>Margens: Nenhuma</strong> para cartas exatamente em 63mm × 88mm sem páginas em branco.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Queue items manager strip (Hidden during print) */}
      {proxies.length > 0 && (
        <div className="glass-panel print-hide" style={{ padding: '16px' }}>
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: '12px',
            }}
          >
            Cartas na Fila de Impressão ({proxies.length} itens distintos)
          </h3>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {proxies.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'var(--bg-surface)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  minWidth: '215px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '44px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <CardImage
                    name={item.card.name}
                    imageUrl={item.card.imageUrl}
                    imageUrlLarge={item.card.imageUrlLarge}
                    setCode={item.card.setCode}
                    collectorNumber={item.card.collectorNumber}
                    face={item.card.faceLabel === 'verso' ? 'back' : 'front'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title={item.card.name}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.card.name}
                    </span>
                    {item.card.faceLabel && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background:
                            item.card.faceLabel === 'verso'
                              ? 'rgba(168, 85, 247, 0.25)'
                              : 'rgba(59, 130, 246, 0.25)',
                          color: item.card.faceLabel === 'verso' ? '#c084fc' : '#93c5fd',
                          border: `1px solid ${
                            item.card.faceLabel === 'verso'
                              ? 'rgba(168, 85, 247, 0.4)'
                              : 'rgba(59, 130, 246, 0.4)'
                          }`,
                        }}
                      >
                        {item.card.faceLabel}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '4px',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '2px' }}
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.quantity}x</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '2px' }}
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </button>

                    {onOpenArtSelector && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px', marginLeft: 'auto' }}
                        onClick={() => onOpenArtSelector(item.card, item.id)}
                        title="Trocar Arte desta Proxy"
                      >
                        <ImageIcon size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{
                        padding: '2px',
                        marginLeft: onOpenArtSelector ? undefined : 'auto',
                        color: '#ef4444',
                      }}
                      onClick={() => onRemoveItem(item.id)}
                      title="Remover da Fila"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A4 Sheet Container (This is what prints and renders visually!) */}
      <div className="a4-print-container">
        {expandedCards.length === 0 ? (
          <div
            className="glass-card print-hide"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <Layers size={48} className="text-slate-600" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
              Sua fila de proxies está vazia
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '460px' }}>
              Adicione cartas da sua coleção, de um deck completo ou da aba de Utilitários (Fichas, Planos, Emblemas, Masmorras) para gerar suas folhas prontas para impressão A4.
            </p>
          </div>
        ) : (
          pages.map((pageCards, pageIdx) => (
            <div key={pageIdx} className="a4-page-wrapper">
              <div
                className="print-hide"
                style={{
                  textAlign: 'center',
                  marginBottom: '8px',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                }}
              >
                Folha {pageIdx + 1} de {totalPages} ({pageCards.length} cartas)
              </div>

              {/* The exact A4 Sheet element */}
              <div
                className={`a4-page-sheet ${showCutLines ? 'show-cut-lines' : ''}`}
                style={{
                  '--cut-line-color': cutLinesColor,
                  '--cut-line-width': `${cutLinesThickness}mm`,
                  '--cut-line-style': cutLinesStyle,
                  '--crop-mark-color': cropMarksColor,
                  '--crop-mark-width': `${cropMarksThickness}mm`,
                  '--card-bleed-bg': cardBleedBg === 'white' ? '#ffffff' : '#000000',
                } as React.CSSProperties}
              >
                {/* Margin crop marks for sheet cutters */}
                {showCropMarks && showMarginTicks && (
                  <>
                    {/* Top edge margin ticks (pointing down) */}
                    {[10.5, 73.5, 136.5, 199.5].map((x, i) => (
                      <span
                        key={`tick-top-${i}`}
                        className="sheet-margin-mark"
                        style={{
                          top: 0,
                          left: `${x}mm`,
                          width: `${cropMarksThickness}mm`,
                          height: `${cropMarksLength}mm`,
                          backgroundColor: cropMarksColor,
                        }}
                      />
                    ))}
                    {/* Bottom edge margin ticks (pointing up) */}
                    {[10.5, 73.5, 136.5, 199.5].map((x, i) => (
                      <span
                        key={`tick-bottom-${i}`}
                        className="sheet-margin-mark"
                        style={{
                          bottom: 0,
                          left: `${x}mm`,
                          width: `${cropMarksThickness}mm`,
                          height: `${cropMarksLength}mm`,
                          backgroundColor: cropMarksColor,
                        }}
                      />
                    ))}
                    {/* Left edge margin ticks (pointing right) */}
                    {[16.5, 104.5, 192.5, 280.5].map((y, i) => (
                      <span
                        key={`tick-left-${i}`}
                        className="sheet-margin-mark"
                        style={{
                          left: 0,
                          top: `${y}mm`,
                          height: `${cropMarksThickness}mm`,
                          width: `${cropMarksLength}mm`,
                          backgroundColor: cropMarksColor,
                        }}
                      />
                    ))}
                    {/* Right edge margin ticks (pointing left) */}
                    {[16.5, 104.5, 192.5, 280.5].map((y, i) => (
                      <span
                        key={`tick-right-${i}`}
                        className="sheet-margin-mark"
                        style={{
                          right: 0,
                          top: `${y}mm`,
                          height: `${cropMarksThickness}mm`,
                          width: `${cropMarksLength}mm`,
                          backgroundColor: cropMarksColor,
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Sheet Metadata Header outside of cutting area */}
                {showSheetMetadata && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '6mm',
                      left: '10.5mm',
                      right: '10.5mm',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '8px',
                      color: '#64748b',
                      pointerEvents: 'none',
                      zIndex: 12,
                      letterSpacing: '0.4px',
                    }}
                  >
                    <span>DMS MTG MANAGER • PROXY STUDIO (A4)</span>
                    <span style={{ fontWeight: 700 }}>FOLHA {pageIdx + 1} DE {totalPages}</span>
                    <span>{pageCards.length} CARTAS (63mm × 88mm)</span>
                  </div>
                )}

                {/* The 9 Card Slots */}
                {pageCards.map((c, cardIdx) => {
                  const typeLine = (c.card.typeLine || '').toLowerCase();
                  const isPlanar =
                    typeLine.includes('plane') ||
                    typeLine.includes('phenomenon');

                  return (
                    <div key={cardIdx} className="a4-card-slot has-card">
                      <CardImage
                        name={c.card.name}
                        imageUrl={c.card.imageUrl}
                        imageUrlLarge={c.card.imageUrlLarge}
                        setCode={c.card.setCode}
                        collectorNumber={c.card.collectorNumber}
                        preferLarge
                        face={c.card.faceLabel === 'verso' ? 'back' : 'front'}
                        loading="eager"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: isPlanar ? 'contain' : 'cover',
                        }}
                      />

                      {/* Corner crop marks */}
                      {showCropMarks && showCornerMarks && (
                        <>
                          <span className="crop-corner crop-corner-tl" />
                          <span className="crop-corner crop-corner-tr" />
                          <span className="crop-corner crop-corner-bl" />
                          <span className="crop-corner crop-corner-br" />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Fill remaining empty slots on the last page up to 9 cards */}
                {Array.from({ length: 9 - pageCards.length }).map((_, emptyIdx) => (
                  <div
                    key={`empty-${emptyIdx}`}
                    className="a4-card-slot is-empty"
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
