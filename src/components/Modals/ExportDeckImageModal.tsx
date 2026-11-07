import React, { useState, useEffect, useMemo } from 'react';
import { Deck } from '../../types';
import {
  DeckImageOptions,
  PosterResolution,
  PosterAspectRatio,
  PosterFormat,
  PosterTheme,
  PosterSort,
  DEFAULT_DECK_IMAGE_OPTIONS,
  generateDeckPoster,
  downloadDeckPosterBlob,
  DeckImageProgress,
} from '../../services/deckImageGenerator';
import {
  X,
  Image as ImageIcon,
  FileText,
  Sliders,
  Layers,
  Sparkles,
  Download,
  Loader2,
  Check,
  Shield,
  Palette,
  Layout,
  Maximize2,
  Info,
  Type,
  FileDown,
} from 'lucide-react';

interface ExportDeckImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck;
}

export const ExportDeckImageModal: React.FC<ExportDeckImageModalProps> = ({
  isOpen,
  onClose,
  deck,
}) => {
  const [options, setOptions] = useState<DeckImageOptions>({
    ...DEFAULT_DECK_IMAGE_OPTIONS,
    customTitle: deck.name,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<DeckImageProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setOptions({
        ...DEFAULT_DECK_IMAGE_OPTIONS,
        customTitle: deck.name,
      });
      setErrorMessage('');
      setIsGenerating(false);
      setProgress(null);
    }
  }, [isOpen, deck]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isGenerating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  // Calculate live counts
  const totalCardsCount = useMemo(() => {
    return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
  }, [deck.cards]);

  const uniqueArtsCount = useMemo(() => {
    const set = new Set<string>();
    deck.cards.forEach((c) => {
      const key = `${c.card.name.toLowerCase()}_${(c.card.setCode || '').toLowerCase()}_${c.card.collectorNumber || ''}_${c.card.imageUrl || ''}`;
      set.add(key);
    });
    return set.size;
  }, [deck.cards]);

  const hasSideboard = useMemo(() => {
    return deck.cards.some((c) => c.category === 'sideboard');
  }, [deck.cards]);

  if (!isOpen) return null;

  // Approximate pixel dimensions for summary preview
  const getDimensionLabel = () => {
    const scaleMap: Record<PosterResolution, number> = {
      ultra: 1.0,
      high: 0.67,
      standard: 0.5,
      compact: 0.32,
    };
    const s = scaleMap[options.resolution] || 1.0;

    switch (options.aspectRatio) {
      case 'a4-landscape':
        return `${Math.round(3508 * s)} × ${Math.round(2480 * s)} px`;
      case 'wallpaper-16-9':
        return `${Math.round(3840 * s)} × ${Math.round(2160 * s)} px`;
      case 'square-1-1':
        return `${Math.round(2400 * s)} × ${Math.round(2400 * s)} px`;
      case 'a4-portrait':
      default:
        return `${Math.round(2480 * s)} × ${Math.round(3508 * s)} px`;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    setProgress({ loaded: 0, total: options.groupByArt ? uniqueArtsCount : totalCardsCount, percentage: 0 });

    try {
      const { blob, fileName } = await generateDeckPoster(deck, options, (prog) => {
        setProgress(prog);
      });
      downloadDeckPosterBlob(blob, fileName);
      onClose();
    } catch (err: any) {
      console.error('Error generating poster:', err);
      setErrorMessage(err?.message || 'Falha ao gerar o pôster. Verifique sua conexão com o Scryfall.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 11, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onClose();
      }}
    >
      <div
        className="modal-container glass-panel"
        style={{
          width: '840px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(18, 23, 34, 0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc',
              }}
            >
              <ImageIcon size={22} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Exportar Imagem / Pôster do Deck
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  {deck.format.toUpperCase()}
                </span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                Personalize a resolução, formato, agrupamento e layout do pôster visual.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            disabled={isGenerating}
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            flex: 1,
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Info size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Formato & Qualidade */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileDown size={16} className="text-indigo-400" /> Formato de Exportação
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                {
                  id: 'jpeg' as PosterFormat,
                  label: 'JPEG (.jpg)',
                  desc: 'Alta fidelidade com compressão otimizada',
                },
                {
                  id: 'png' as PosterFormat,
                  label: 'PNG (.png)',
                  desc: 'Sem perda de qualidade, suporta transparência',
                },
                {
                  id: 'pdf' as PosterFormat,
                  label: 'PDF (.pdf)',
                  desc: 'Documento A4 pronto para visualização e impressão',
                },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, format: fmt.id }))}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: options.format === fmt.id ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                    border:
                      options.format === fmt.id
                        ? '1.5px solid #818cf8'
                        : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: options.format === fmt.id ? '#a5b4fc' : '#f8fafc' }}>
                      {fmt.label}
                    </span>
                    {options.format === fmt.id && <Check size={16} className="text-indigo-400" />}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {fmt.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* JPEG Quality Selector */}
            {options.format === 'jpeg' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  marginTop: '4px',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ color: '#94a3b8' }}>Qualidade do JPEG:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: 'Máxima (100%)', val: 1.0 },
                    { label: 'Alta (95%)', val: 0.95 },
                    { label: 'Média (85%)', val: 0.85 },
                  ].map((q) => (
                    <button
                      key={q.val}
                      type="button"
                      className={`btn btn-sm ${options.jpegQuality === q.val ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setOptions((prev) => ({ ...prev, jpegQuality: q.val }))}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Proporção & Orientação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layout size={16} className="text-indigo-400" /> Proporção & Layout da Folha
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              {[
                {
                  id: 'a4-portrait' as PosterAspectRatio,
                  label: 'A4 Retrato',
                  sub: 'Vertical (Padrão de Pôster)',
                },
                {
                  id: 'a4-landscape' as PosterAspectRatio,
                  label: 'A4 Paisagem',
                  sub: 'Horizontal Panorâmico',
                },
                {
                  id: 'wallpaper-16-9' as PosterAspectRatio,
                  label: 'Wallpaper 16:9',
                  sub: 'Fundo de tela de PC / Banner',
                },
                {
                  id: 'square-1-1' as PosterAspectRatio,
                  label: 'Quadrado 1:1',
                  sub: 'Redes Sociais / Instagram',
                },
              ].map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, aspectRatio: layout.id }))}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: options.aspectRatio === layout.id ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                    border:
                      options.aspectRatio === layout.id
                        ? '1.5px solid #818cf8'
                        : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: options.aspectRatio === layout.id ? '#a5b4fc' : '#f8fafc' }}>
                      {layout.label}
                    </span>
                    {options.aspectRatio === layout.id && <Check size={16} className="text-indigo-400" />}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {layout.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Resolução & Qualidade de Impressão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Maximize2 size={16} className="text-indigo-400" /> Resolução de Saída
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              {[
                {
                  id: 'ultra' as PosterResolution,
                  label: 'Ultra HD (300 DPI / 4K)',
                  desc: 'Impressão profissional e máxima nitidez',
                },
                {
                  id: 'high' as PosterResolution,
                  label: 'Alta Definição (200 DPI / 2K)',
                  desc: 'Equilíbrio perfeito de nitidez e leveza',
                },
                {
                  id: 'standard' as PosterResolution,
                  label: 'Padrão (150 DPI / 1080p)',
                  desc: 'Visualização em telas e compartilhamento',
                },
                {
                  id: 'compact' as PosterResolution,
                  label: 'Compacta (72 DPI / Web)',
                  desc: 'Arquivo super leve para envio rápido',
                },
              ].map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, resolution: res.id }))}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: options.resolution === res.id ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                    border:
                      options.resolution === res.id
                        ? '1.5px solid #818cf8'
                        : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: options.resolution === res.id ? '#a5b4fc' : '#f8fafc' }}>
                      {res.label}
                    </span>
                    {options.resolution === res.id && <Check size={16} className="text-indigo-400" />}
                  </div>
                  <span style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '4px' }}>
                    {res.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Agrupamento de Artes Iguais (Destaque Principal) */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: options.groupByArt
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.15))'
                : 'rgba(255, 255, 255, 0.02)',
              border: options.groupByArt ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers className={options.groupByArt ? 'text-emerald-400' : 'text-slate-400'} size={20} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                    Agrupar Artes Idênticas (Recomendado)
                  </span>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                    Condensa cópias com a mesma arte (ex: 20 Ilhas viram 1 carta com badge "20x"), ampliando o tamanho e a visibilidade de todas as mágicas do deck.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={options.groupByArt}
                onChange={(e) => setOptions((prev) => ({ ...prev, groupByArt: e.target.checked }))}
                style={{
                  width: '20px',
                  height: '20px',
                  accentColor: '#10b981',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                paddingTop: '4px',
                borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              }}
            >
              {options.groupByArt ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>
                  ✓ Modo Agrupado: ~{uniqueArtsCount} artes únicas renderizadas em tamanho maior.
                </span>
              ) : (
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  ⚡ Modo Desagrupado: Todas as {totalCardsCount} cartas serão desenhadas individualmente.
                </span>
              )}
            </div>
          </div>

          {/* 5. Ordenação & Estilo Visual */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {/* Card Sort */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={16} className="text-indigo-400" /> Ordenação das Cartas
              </label>

              <select
                className="select-field"
                value={options.cardSort}
                onChange={(e) => setOptions((prev) => ({ ...prev, cardSort: e.target.value as PosterSort }))}
                style={{ padding: '10px 14px', borderRadius: '8px', width: '100%', fontSize: '0.85rem' }}
              >
                <option value="default">Comandante primeiro + Ordem Alfabética (A-Z)</option>
                <option value="cmc">Comandante primeiro + Por Custo de Mana (CMC)</option>
                <option value="type">Comandante primeiro + Por Tipo de Carta (Criaturas, Feitiços...)</option>
                <option value="color">Comandante primeiro + Por Identidade de Cor</option>
                <option value="name">Alfabética pura (A-Z)</option>
              </select>
            </div>

            {/* Background Theme */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={16} className="text-indigo-400" /> Tema e Cor de Fundo
              </label>

              <select
                className="select-field"
                value={options.backgroundTheme}
                onChange={(e) => setOptions((prev) => ({ ...prev, backgroundTheme: e.target.value as PosterTheme }))}
                style={{ padding: '10px 14px', borderRadius: '8px', width: '100%', fontSize: '0.85rem' }}
              >
                <option value="dark-gradient">Dark Gradient (Padrão Sofisticado)</option>
                <option value="black-minimal">Preto Minimalista (Onyx Profundo)</option>
                <option value="playmat">Playmat Escuro (Textura de Tapete)</option>
                <option value="light-clean">Claro / Studio (Econômico para Impressão)</option>
                {options.format === 'png' && (
                  <option value="transparent">Fundo Transparente (Apenas PNG)</option>
                )}
              </select>
            </div>
          </div>

          {/* 6. Opções Visuais Extras & Personalização */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="text-amber-400" /> Detalhes Visuais e Personalização
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={options.highlightCommander}
                  onChange={(e) => setOptions((prev) => ({ ...prev, highlightCommander: e.target.checked }))}
                  style={{ accentColor: '#f59e0b', width: '16px', height: '16px' }}
                />
                <span style={{ color: '#f8fafc' }}>Destacar Comandante (Moldura Dourada)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={options.showQuantityBadges}
                  onChange={(e) => setOptions((prev) => ({ ...prev, showQuantityBadges: e.target.checked }))}
                  style={{ accentColor: '#818cf8', width: '16px', height: '16px' }}
                />
                <span style={{ color: '#f8fafc' }}>Exibir Badges de Quantidade (4x, 15x...)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={options.showHeader}
                  onChange={(e) => setOptions((prev) => ({ ...prev, showHeader: e.target.checked }))}
                  style={{ accentColor: '#818cf8', width: '16px', height: '16px' }}
                />
                <span style={{ color: '#f8fafc' }}>Exibir Cabeçalho com Nome e Dados</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={options.showCardNames}
                  onChange={(e) => setOptions((prev) => ({ ...prev, showCardNames: e.target.checked }))}
                  style={{ accentColor: '#818cf8', width: '16px', height: '16px' }}
                />
                <span style={{ color: '#f8fafc' }}>Legenda com Nome no Rodapé das Cartas</span>
              </label>

              {hasSideboard && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={options.includeSideboard}
                    onChange={(e) => setOptions((prev) => ({ ...prev, includeSideboard: e.target.checked }))}
                    style={{ accentColor: '#818cf8', width: '16px', height: '16px' }}
                  />
                  <span style={{ color: '#f8fafc' }}>Incluir cartas do Sideboard</span>
                </label>
              )}
            </div>

            {/* Optional Title & Author inputs */}
            {options.showHeader && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '4px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
                    Título personalizado (opcional):
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    value={options.customTitle || ''}
                    onChange={(e) => setOptions((prev) => ({ ...prev, customTitle: e.target.value }))}
                    placeholder={deck.name}
                    style={{ padding: '8px 12px', borderRadius: '8px', width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
                    Nome do Autor / Criador (opcional):
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    value={options.authorName || ''}
                    onChange={(e) => setOptions((prev) => ({ ...prev, authorName: e.target.value }))}
                    placeholder="Ex: Davi M."
                    style={{ padding: '8px 12px', borderRadius: '8px', width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 7. Live Summary Pill */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.82rem',
              color: '#c7d2fe',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} className="text-indigo-400" />
              <span>
                Dimensões: <strong>{getDimensionLabel()}</strong> • Formato: <strong>{options.format.toUpperCase()}</strong> • Total:{' '}
                <strong>{options.groupByArt ? `${uniqueArtsCount} artes agrupadas` : `${totalCardsCount} cartas individuais`}</strong>
              </span>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              Orientação: {options.aspectRatio.replace('-', ' ').toUpperCase()}
            </span>
          </div>

          {/* Progress bar during generation */}
          {isGenerating && progress && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px 18px',
                background: 'rgba(12, 17, 28, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin text-indigo-400" />
                  Carregando artes do Scryfall ({progress.loaded} de {progress.total})...
                </span>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>{progress.percentage}%</span>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress.percentage}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '999px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                As imagens são carregadas nas artes exatas escolhidas no seu deck. Aguarde a finalização...
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(18, 23, 34, 0.95)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || totalCardsCount === 0}
            style={{ minWidth: '180px' }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Gerando Pôster ({progress?.percentage || 0}%)...
              </>
            ) : (
              <>
                <Download size={16} /> Gerar e Baixar Pôster
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
