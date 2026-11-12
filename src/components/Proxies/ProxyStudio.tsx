import React, { useState, useRef } from 'react';
import { ProxyItem, Deck, Card, TokenCard } from '../../types';
import { CardImage } from '../Common/CardImage';
import { CardHoverPreview, CardHoverPreviewData } from '../Common/CardHoverPreview';
import {
  generateProxiesPdf,
  ProxyPdfOptions,
} from '../../services/proxyPdfService';
import {
  MpcFillOrder,
  parseMpcFillXml,
  buildProxyItemsFromMpcOrder,
  buildDeckFromMpcOrder,
} from '../../services/mpcFillService';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import {
  Printer,
  Trash2,
  Plus,
  Minus,
  Layers,
  Scissors,
  CheckSquare,
  Image as ImageIcon,
  Palette,
  Sliders,
  Download,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileCode,
  X,
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
  onAddProxies?: (items: ProxyItem[], replace?: boolean) => void;
  onSaveDeckFromMpc?: (deck: Deck) => void;
  onOpenArtSelector?: (card: Card | TokenCard, proxyItemId: string) => void;
  decks: Deck[];
}

export const ProxyStudio: React.FC<ProxyStudioProps> = ({
  proxies,
  onUpdateQuantity,
  onRemoveItem,
  onClearAll,
  onAddDeckToProxies,
  onAddProxies,
  onSaveDeckFromMpc,
  onOpenArtSelector,
  decks,
}) => {
  // Cut lines state
  const [showCutLines, setShowCutLines] = useState<boolean>(false);
  const [cutLinesColor, setCutLinesColor] = useState<string>('#000000');
  const [cutLinesThickness, setCutLinesThickness] = useState<number>(0.25);
  const [cutLinesStyle, setCutLinesStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');

  // Crop marks state
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [cropMarksColor, setCropMarksColor] = useState<string>('#475569');
  const [cropMarksThickness, setCropMarksThickness] = useState<number>(0.2);
  const [cropMarksLength, setCropMarksLength] = useState<number>(12);
  const [showMarginTicks, setShowMarginTicks] = useState<boolean>(true);
  const [showCornerMarks, setShowCornerMarks] = useState<boolean>(true);

  // Card finish & metadata
  const [cardBleedBg, setCardBleedBg] = useState<'black' | 'white' | 'none'>('black');
  const [showSheetMetadata, setShowSheetMetadata] = useState<boolean>(true);
  const [cropMpcBleed, setCropMpcBleed] = useState<boolean>(true);

  // UI state
  const [isAdvancedControlsOpen, setIsAdvancedControlsOpen] = useState<boolean>(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const [hoveredPreview, setHoveredPreview] = useState<CardHoverPreviewData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // MPCFill Import state
  const mpcFileInputRef = useRef<HTMLInputElement>(null);
  const [isMpcModalOpen, setIsMpcModalOpen] = useState<boolean>(false);
  const [mpcParsedOrder, setMpcParsedOrder] = useState<MpcFillOrder | null>(null);
  const [mpcReplaceQueue, setMpcReplaceQueue] = useState<boolean>(true);
  const [mpcIncludeCardback, setMpcIncludeCardback] = useState<boolean>(false);
  const [mpcSaveAsDeck, setMpcSaveAsDeck] = useState<boolean>(true);
  const [mpcDeckName, setMpcDeckName] = useState<string>('');

  useModalOverlay(isMpcModalOpen, () => setIsMpcModalOpen(false));

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
          imageUrl: item.card.imageUrl || faces[0].imageUrl,
          imageUrlLarge: item.card.imageUrlLarge || item.card.imageUrl || faces[0].imageUrlLarge || faces[0].imageUrl,
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
        cropMpcBleed,
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

  const handleMpcFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseMpcFillXml(text, file.name);
        setMpcParsedOrder(parsed);
        const suggestedDeckName = file.name
          .replace(/\.xml$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setMpcDeckName(suggestedDeckName ? `${suggestedDeckName} (MPCFill)` : 'Deck MPCFill');
        setMpcReplaceQueue(proxies.length > 0);
        setMpcIncludeCardback(false);
        setMpcSaveAsDeck(true);
        setIsMpcModalOpen(true);
      } catch (err: any) {
        console.error('Erro ao ler XML do MPCFill:', err);
        alert(err?.message || 'Erro ao processar o arquivo XML do MPCFill.');
      } finally {
        if (mpcFileInputRef.current) {
          mpcFileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo selecionado.');
      if (mpcFileInputRef.current) {
        mpcFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmMpcImport = () => {
    if (!mpcParsedOrder) return;

    try {
      const items = buildProxyItemsFromMpcOrder(mpcParsedOrder, {
        includeDefaultBack: mpcIncludeCardback,
      });

      if (items.length === 0) {
        alert('Nenhuma carta encontrada para importar.');
        return;
      }

      if (mpcSaveAsDeck && onSaveDeckFromMpc) {
        const newDeck = buildDeckFromMpcOrder(mpcParsedOrder, mpcDeckName);
        onSaveDeckFromMpc(newDeck);
      }

      if (onAddProxies) {
        onAddProxies(items, mpcReplaceQueue);
      }

      setIsMpcModalOpen(false);
      setMpcParsedOrder(null);
    } catch (err: any) {
      console.error('Erro ao importar cartas do MPCFill:', err);
      alert(err?.message || 'Erro ao importar as cartas do MPCFill.');
    }
  };

  // 1-Click Presets
  const applyPreset = (preset: 'guillotine' | 'hobbyknife' | 'minimal' | 'economical') => {
    switch (preset) {
      case 'guillotine':
        setShowCutLines(false);
        setCutLinesColor('#000000');
        setCutLinesThickness(0.25);
        setCutLinesStyle('solid');
        setShowCropMarks(true);
        setCropMarksColor('#475569');
        setCropMarksThickness(0.2);
        setCropMarksLength(12);
        setShowMarginTicks(true);
        setShowCornerMarks(true);
        setCardBleedBg('black');
        setShowSheetMetadata(true);
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
            {/* Hidden file input for MPCFill XML */}
            <input
              ref={mpcFileInputRef}
              type="file"
              accept=".xml"
              style={{ display: 'none' }}
              onChange={handleMpcFileSelect}
            />

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

        {/* Quick Add Deck to Proxies & MPCFill import */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Ou importar do MPCFill:
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => mpcFileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(255, 187, 0, 0.35)',
              }}
            >
              <FileCode size={14} className="text-amber-400" />
              Carregar Arquivo XML (.xml)
            </button>
          </div>
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
                title="Sem bordas nas cartas + crop marks 0.2mm cinza escuro + réguas de margem 12mm e cruzes"
              >
                Guilhotina
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('hobbyknife')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Linhas tracejadas cinzas + cruzes nas junções"
              >
                Estilete Manual
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset('minimal')}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                title="Sem bordas, apenas cruzes finas nas junções e marcas de corte"
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

                    <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', color: '#cbd5e1', paddingTop: '2px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showMarginTicks}
                          onChange={(e) => setShowMarginTicks(e.target.checked)}
                          style={{ accentColor: '#ffbb00' }}
                        />
                        <span>Réguas de Margem na Folha</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showCornerMarks}
                          onChange={(e) => setShowCornerMarks(e.target.checked)}
                          style={{ accentColor: '#ffbb00' }}
                        />
                        <span>Cruzes nas Junções das Cartas (Espessura Exata)</span>
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
                      title="Quinas pretas por cima da arte com curvatura no raio original da carta de Magic"
                    >
                      Preto (MTG)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${cardBleedBg === 'white' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCardBleedBg('white')}
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      title="Quinas brancas para economia de tinta/toner"
                    >
                      Branco (Econômico)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${cardBleedBg === 'none' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCardBleedBg('none')}
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      title="Sem sangria nos cantos"
                    >
                      Desativada
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

                {/* Crop MPC Bleed Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cropMpcBleed}
                    onChange={(e) => setCropMpcBleed(e.target.checked)}
                    style={{ accentColor: '#ffbb00' }}
                  />
                  <span>Ajustar sangria de artes MPCFill (Bordas padrão MTG)</span>
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
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setHoveredPreview({
                      url: item.card.imageUrlLarge || item.card.imageUrl,
                      title: item.card.name,
                      subtitle: `${item.card.setName || ''} (${(item.card.setCode || '').toUpperCase()} #${item.card.collectorNumber || ''})`,
                      badge: item.card.faceLabel ? `Lado: ${item.card.faceLabel.toUpperCase()}` : undefined,
                      badgeColor: '#818cf8',
                    });
                  }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredPreview(null)}
                >
                  <CardImage
                    name={item.card.name}
                    imageUrl={item.card.imageUrl}
                    imageUrlLarge={item.card.imageUrlLarge}
                    setCode={item.card.setCode}
                    collectorNumber={item.card.collectorNumber}
                    face={item.card.faceLabel === 'verso' ? 'back' : 'front'}
                    cropMpcBleed={cropMpcBleed}
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
              Adicione cartas da sua coleção, de um deck completo, da aba de Utilitários ou carregue um arquivo XML do MPCFill.
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
                  '--card-bleed-bg': cardBleedBg === 'none' ? 'transparent' : (cardBleedBg === 'white' ? '#ffffff' : '#000000'),
                } as React.CSSProperties}
              >
                {/* Crop marks overlay: Sheet Margin Ruler Ticks & Exact-Thickness Card Junction Crosses */}
                {showCropMarks && (
                  <svg
                    viewBox="0 0 210 297"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '210mm',
                      height: '297mm',
                      pointerEvents: 'none',
                      zIndex: 15,
                    }}
                  >
                    {/* 1. Sheet margin ruler ticks */}
                    {showMarginTicks && (
                      <>
                        {/* Top edge ticks (pointing down) */}
                        {[10.5, 73.5, 136.5, 199.5].map((x, i) => (
                          <line
                            key={`tick-top-${i}`}
                            x1={x}
                            y1={0}
                            x2={x}
                            y2={cropMarksLength}
                            stroke={cropMarksColor}
                            strokeWidth={cropMarksThickness}
                            strokeLinecap="square"
                          />
                        ))}
                        {/* Bottom edge ticks (pointing up) */}
                        {[10.5, 73.5, 136.5, 199.5].map((x, i) => (
                          <line
                            key={`tick-bot-${i}`}
                            x1={x}
                            y1={297 - cropMarksLength}
                            x2={x}
                            y2={297}
                            stroke={cropMarksColor}
                            strokeWidth={cropMarksThickness}
                            strokeLinecap="square"
                          />
                        ))}
                        {/* Left edge ticks (pointing right) */}
                        {[16.5, 104.5, 192.5, 280.5].map((y, i) => (
                          <line
                            key={`tick-left-${i}`}
                            x1={0}
                            y1={y}
                            x2={cropMarksLength}
                            y2={y}
                            stroke={cropMarksColor}
                            strokeWidth={cropMarksThickness}
                            strokeLinecap="square"
                          />
                        ))}
                        {/* Right edge ticks (pointing left) */}
                        {[16.5, 104.5, 192.5, 280.5].map((y, i) => (
                          <line
                            key={`tick-right-${i}`}
                            x1={210 - cropMarksLength}
                            y1={y}
                            x2={210}
                            y2={y}
                            stroke={cropMarksColor}
                            strokeWidth={cropMarksThickness}
                            strokeLinecap="square"
                          />
                        ))}
                      </>
                    )}

                    {/* 2. Grid Junction Crosses (Cruzes nas Junções dos Cards - Espessura Exata de Linha Única) */}
                    {showCornerMarks && (
                      <>
                        {[10.5, 73.5, 136.5, 199.5].flatMap((x, col) =>
                          [16.5, 104.5, 192.5, 280.5].map((y, row) => {
                            const arm = 3.5;
                            const hasLeft = col > 0;
                            const hasRight = col < 3;
                            const hasUp = row > 0;
                            const hasDown = row < 3;

                            const x1 = hasLeft ? x - arm : x;
                            const x2 = hasRight ? x + arm : x;
                            const y1 = hasUp ? y - arm : y;
                            const y2 = hasDown ? y + arm : y;

                            return (
                              <g key={`cross-${col}-${row}`}>
                                {x1 !== x2 && (
                                  <line
                                    x1={x1}
                                    y1={y}
                                    x2={x2}
                                    y2={y}
                                    stroke={cropMarksColor}
                                    strokeWidth={cropMarksThickness}
                                    strokeLinecap="square"
                                  />
                                )}
                                {y1 !== y2 && (
                                  <line
                                    x1={x}
                                    y1={y1}
                                    x2={x}
                                    y2={y2}
                                    stroke={cropMarksColor}
                                    strokeWidth={cropMarksThickness}
                                    strokeLinecap="square"
                                  />
                                )}
                              </g>
                            );
                          })
                        )}
                      </>
                    )}
                  </svg>
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
                    <span>PROLIFERATE • PROXY STUDIO (A4)</span>
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
                    <div
                      key={cardIdx}
                      className="a4-card-slot has-card"
                      onMouseEnter={(e) => {
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setHoveredPreview({
                          url: c.card.imageUrlLarge || c.card.imageUrl,
                          title: c.card.name,
                          subtitle: `${c.card.setName || ''} (${(c.card.setCode || '').toUpperCase()} #${c.card.collectorNumber || ''})`,
                          badge: c.card.faceLabel ? `Lado: ${c.card.faceLabel.toUpperCase()}` : undefined,
                          badgeColor: '#ffbb00',
                        });
                      }}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredPreview(null)}
                    >
                      <CardImage
                        name={c.card.name}
                        imageUrl={c.card.imageUrl}
                        imageUrlLarge={c.card.imageUrlLarge}
                        setCode={c.card.setCode}
                        collectorNumber={c.card.collectorNumber}
                        preferLarge
                        face={c.card.faceLabel === 'verso' ? 'back' : 'front'}
                        cropMpcBleed={cropMpcBleed}
                        loading="eager"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: isPlanar ? 'contain' : 'cover',
                        }}
                      />

                      {/* Quinas de sangria sobrepostas por cima da arte com a curvatura no raio original da carta de Magic (3mm) */}
                      {cardBleedBg !== 'none' && !isPlanar && (
                        <svg
                          viewBox="0 0 63 88"
                          shapeRendering="geometricPrecision"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '63mm',
                            height: '88mm',
                            pointerEvents: 'none',
                            zIndex: 5,
                          }}
                        >
                          <path
                            d="M 0 0 L 3 0 A 3 3 0 0 0 0 3 Z M 63 0 L 60 0 A 3 3 0 0 1 63 3 Z M 63 88 L 63 85 A 3 3 0 0 1 60 88 Z M 0 88 L 0 85 A 3 3 0 0 0 3 88 Z"
                            fill={cardBleedBg === 'white' ? '#ffffff' : '#000000'}
                          />
                        </svg>
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

      {/* MPCFill Import Modal */}
      {isMpcModalOpen && mpcParsedOrder && (
        <div
          className="print-hide"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMpcModalOpen(false);
            }
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#0f172a',
              border: '1px solid rgba(255, 187, 0, 0.35)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 187, 0, 0.12)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(30, 41, 59, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(255, 187, 0, 0.15)',
                    border: '1px solid rgba(255, 187, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={22} className="text-amber-400" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Importar Cartas Alter do MPCFill
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <FileCode size={12} className="text-amber-400" />
                      {mpcParsedOrder.fileName || 'pedido.xml'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                      Google Drive CDN Ativo (Alta Resolução)
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setIsMpcModalOpen(false)}
                style={{ color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div
              style={{
                padding: '24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Order Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total de Cartas Alter</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {mpcParsedOrder.fronts.length}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cartas Dupla-Face</div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: mpcParsedOrder.backs.length > 0 ? '#c084fc' : '#94a3b8',
                      marginTop: '2px',
                    }}
                  >
                    {mpcParsedOrder.backs.length > 0
                      ? `${mpcParsedOrder.backs.length} com verso`
                      : 'Nenhuma'}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Folhas A4 Estimadas</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffbb00', marginTop: '2px' }}>
                    {Math.ceil(
                      (mpcParsedOrder.fronts.length +
                        (mpcIncludeCardback && mpcParsedOrder.cardbackId
                          ? mpcParsedOrder.fronts.length
                          : mpcParsedOrder.backs.length)) /
                        9
                    )}{' '}
                    folhas
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Estoque / Acabamento</div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#cbd5e1',
                      marginTop: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mpcParsedOrder.details.stock || 'Padrão MPC'}
                  </div>
                </div>
              </div>

              {/* Visual Card Gallery Preview */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>
                    Prévia das Artes Selecionadas ({mpcParsedOrder.fronts.length} cartas)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Role para visualizar todas as cartas
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    paddingBottom: '10px',
                    paddingTop: '4px',
                  }}
                >
                  {mpcParsedOrder.fronts.slice(0, 30).map((card, idx) => (
                    <div
                      key={idx}
                      style={{
                        flexShrink: 0,
                        width: '95px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '95px',
                          height: '133px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          background: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        <CardImage
                          name={card.name}
                          imageUrl={card.imageUrl}
                          setCode="MPC"
                          cropMpcBleed
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#f8fafc',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={card.name}
                      >
                        {card.name}
                      </span>
                      {card.alterVariant && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            color: '#94a3b8',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={card.alterVariant}
                        >
                          {card.alterVariant}
                        </span>
                      )}
                    </div>
                  ))}
                  {mpcParsedOrder.fronts.length > 30 && (
                    <div
                      style={{
                        flexShrink: 0,
                        width: '95px',
                        height: '133px',
                        borderRadius: '6px',
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        padding: '10px',
                      }}
                    >
                      +{mpcParsedOrder.fronts.length - 30} cartas
                    </div>
                  )}
                </div>
              </div>

              {/* Import Options */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Queue option (replace vs append) */}
                {proxies.length > 0 && (
                  <div>
                    <label
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        marginBottom: '8px',
                        display: 'block',
                      }}
                    >
                      Destino na Fila de Impressão:
                    </label>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: '#cbd5e1',
                        }}
                      >
                        <input
                          type="radio"
                          name="mpcQueueMode"
                          checked={mpcReplaceQueue}
                          onChange={() => setMpcReplaceQueue(true)}
                        />
                        <span>
                          <strong>Substituir fila atual</strong> (recomendado para imprimir este deck completo)
                        </span>
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: '#cbd5e1',
                        }}
                      >
                        <input
                          type="radio"
                          name="mpcQueueMode"
                          checked={!mpcReplaceQueue}
                          onChange={() => setMpcReplaceQueue(false)}
                        />
                        <span>Adicionar ao final da fila existente</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Cardback Option */}
                {mpcParsedOrder.cardbackId && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: '#cbd5e1',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={mpcIncludeCardback}
                      onChange={(e) => setMpcIncludeCardback(e.target.checked)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Imprimir verso padrão para todas as cartas normais</strong>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        O arquivo inclui um verso padrão de Magic / sleeve ({mpcParsedOrder.cardbackId}).
                        Se desmarcado, apenas as cartas frente (e os versos de cartas dupla-face) serão impressos,
                        economizando papel caso você use sleeves com cartas reais.
                      </div>
                    </div>
                  </label>
                )}

                {/* Save as Deck Option */}
                {onSaveDeckFromMpc && (
                  <div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: '#cbd5e1',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={mpcSaveAsDeck}
                        onChange={(e) => setMpcSaveAsDeck(e.target.checked)}
                      />
                      <span>
                        <strong>Salvar também como um novo Deck na Biblioteca</strong>
                      </span>
                    </label>

                    {mpcSaveAsDeck && (
                      <div style={{ marginTop: '10px', paddingLeft: '24px' }}>
                        <label
                          style={{
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Nome do Deck:
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={mpcDeckName}
                          onChange={(e) => setMpcDeckName(e.target.value)}
                          placeholder="Nome do deck..."
                          style={{ maxWidth: '380px' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(30, 41, 59, 0.6)',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsMpcModalOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmMpcImport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                }}
              >
                <Sparkles size={16} />
                Importar {mpcParsedOrder.fronts.length} Cartas para o Proxy Studio
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Card Zoom Preview */}
      <CardHoverPreview preview={hoveredPreview} mousePos={mousePos} />
    </div>
  );
};
