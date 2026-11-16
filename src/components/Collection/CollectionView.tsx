import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CollectionItem, ViewMode, Card, isDoubleFacedCard } from '../../types';
import { resolveCardFaces } from '../../services/scryfall';
import { getUiSettings, saveUiSettings, UiSettings } from '../../services/storage';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';
import { CardImage } from '../Common/CardImage';
import { InteractiveCharts } from '../Analytics/InteractiveCharts';
import { CardHoverPreview, CardHoverPreviewData } from '../Common/CardHoverPreview';
import {
  Grid,
  List,
  Search,
  Plus,
  Minus,
  Sparkles,
  Printer,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Trash2,
  CheckSquare,
  RotateCw,
} from 'lucide-react';

interface CollectionViewProps {
  collection: CollectionItem[];
  onUpdateQuantity: (id: string, newQty: number) => void;
  onOpenArtSelector: (card: Card, collectionItemId: string, face?: 'front' | 'back') => void;
  onAddToProxies: (card: Card, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onRemoveItems?: (itemIds: string[]) => void;
}

export type SortColumn = 'quantity' | 'available' | 'name' | 'cmc' | 'type' | 'set' | 'rarity' | 'price';
export type SortDirection = 'asc' | 'desc';

export const CollectionView: React.FC<CollectionViewProps> = ({
  collection,
  onUpdateQuantity,
  onOpenArtSelector,
  onAddToProxies,
  onRemoveItem,
  onRemoveItems,
}) => {
  // View mode: Grid is now primary, persisted across sessions & synced to cloud
  const [viewMode, setViewMode] = useState<ViewMode>(() => getUiSettings().collectionViewMode);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveUiSettings({ collectionViewMode: mode }, 'local');
  };

  // Renderização progressiva da lista: evita montar centenas de linhas e imagens de uma vez
  const [visibleRows, setVisibleRows] = useState(100);
  const rowsSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowsSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleRows((n) => n + 100);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  });

  // Batch Selection state for quick removal in list/table view
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Última caixa marcada/desmarcada: âncora para seleção em intervalo com Shift
  const lastSelectedIdRef = useRef<string | null>(null);

  const handleToggleSelectItem = (id: string, shiftKey = false) => {
    const anchorId = lastSelectedIdRef.current;
    lastSelectedIdRef.current = id;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const willSelect = !prev.has(id);
      if (shiftKey && anchorId && anchorId !== id) {
        const ids = sortedItems.map((i) => i.id);
        const a = ids.indexOf(anchorId);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a];
          for (let i = from; i <= to; i++) {
            if (willSelect) next.add(ids[i]);
            else next.delete(ids[i]);
          }
          return next;
        }
      }
      if (willSelect) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isMultiOnly, setIsMultiOnly] = useState(false);
  const [isColorlessOnly, setIsColorlessOnly] = useState(false);
  const [colorMatchMode, setColorMatchMode] = useState<'exact' | 'pool'>('exact');
  const [usageFilter, setUsageFilter] = useState<'all' | 'available' | 'in_use'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCharts, setShowCharts] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<CardHoverPreviewData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [gridCardSize, setGridCardSize] = useState<number>(() => getUiSettings().gridCardSize);
  const [showGridDetails, setShowGridDetails] = useState<boolean>(() => getUiSettings().gridShowDetails);

  useEffect(() => {
    const onCloudSettings = (e: Event) => {
      const s = (e as CustomEvent<UiSettings>).detail;
      if (!s) return;
      setViewMode(s.collectionViewMode);
      setGridCardSize(s.gridCardSize);
      setShowGridDetails(s.gridShowDetails);
    };
    window.addEventListener('proliferate:ui-settings-cloud', onCloudSettings);
    return () => window.removeEventListener('proliferate:ui-settings-cloud', onCloudSettings);
  }, []);

  const handleGridCardSizeChange = (val: number) => {
    setGridCardSize(val);
    saveUiSettings({ gridCardSize: val }, 'local');
  };

  const handleToggleGridDetails = () => {
    setShowGridDetails((prev) => {
      const next = !prev;
      saveUiSettings({ gridShowDetails: next }, 'local');
      return next;
    });
  };

  // Flip state for double-faced cards in visual grid
  const [flippedItemIds, setFlippedItemIds] = useState<Set<string>>(new Set());

  const handleToggleFlip = async (itemId: string, card: Card) => {
    if (!card.cardFaces || card.cardFaces.length < 2) {
      await resolveCardFaces(card);
    }
    setFlippedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSort = (field: SortColumn) => {
    if (sortColumn === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(field);
      setSortDirection('asc');
    }
  };

  const handleToggleColor = (col: string) => {
    setIsColorlessOnly(false);
    setSelectedColors((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleToggleMulti = () => {
    setIsColorlessOnly(false);
    setIsMultiOnly((prev) => !prev);
  };

  const handleToggleColorless = () => {
    setSelectedColors([]);
    setIsMultiOnly(false);
    setIsColorlessOnly((prev) => !prev);
  };

  const handleResetColors = () => {
    setSelectedColors([]);
    setIsMultiOnly(false);
    setIsColorlessOnly(false);
  };

  // Filter collection
  const filteredItems = useMemo(() => {
    return collection.filter((item) => {
      // Search (support both primary name and double-faced faces)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName =
          item.card.name.toLowerCase().includes(q) ||
          Boolean(item.card.cardFaces?.some((f) => f.name.toLowerCase().includes(q)));
        const matchesType =
          item.card.typeLine.toLowerCase().includes(q) ||
          Boolean(item.card.cardFaces?.some((f) => f.typeLine?.toLowerCase().includes(q)));
        const matchesText =
          item.card.oracleText?.toLowerCase().includes(q) ||
          Boolean(item.card.cardFaces?.some((f) => f.oracleText?.toLowerCase().includes(q))) ||
          false;
        if (!matchesName && !matchesType && !matchesText) return false;
      }

      // Color filter
      const cardColors = item.card.colors || [];
      if (isColorlessOnly) {
        if (cardColors.length > 0) return false;
      } else if (isMultiOnly) {
        if (cardColors.length <= 1) return false;
        if (selectedColors.length > 0) {
          if (!cardColors.every((c) => selectedColors.includes(c))) return false;
        }
      } else if (selectedColors.length === 1) {
        // Strictly mono-color matching that 1 color
        if (cardColors.length !== 1 || cardColors[0] !== selectedColors[0]) return false;
      } else if (selectedColors.length > 1) {
        if (colorMatchMode === 'exact') {
          // Exactly matching all selected colors and no others
          if (
            cardColors.length !== selectedColors.length ||
            !selectedColors.every((c) => cardColors.includes(c))
          ) {
            return false;
          }
        } else {
          // Pool mode: subset of selected colors
          if (cardColors.length === 0 || !cardColors.every((c) => selectedColors.includes(c))) {
            return false;
          }
        }
      }

      // Usage Filter
      if (usageFilter === 'available') {
        if ((item.availableQuantity ?? item.quantity) <= 0) return false;
      } else if (usageFilter === 'in_use') {
        if ((item.inUseQuantity ?? 0) <= 0) return false;
      }

      return true;
    });
  }, [collection, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode, usageFilter]);

  // Sorted items
  const sortedItems = useMemo(() => {
    if (!sortColumn) return filteredItems;

    const rarityRank: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      mythic: 4,
      special: 5,
    };

    return [...filteredItems].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'available':
          cmp = (a.availableQuantity ?? a.quantity) - (b.availableQuantity ?? b.quantity);
          break;
        case 'name':
          cmp = a.card.name.localeCompare(b.card.name, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'cmc':
          cmp = (a.card.cmc ?? 0) - (b.card.cmc ?? 0);
          break;
        case 'type':
          cmp = (a.card.typeLine || '').localeCompare(b.card.typeLine || '', 'pt-BR');
          break;
        case 'set':
          cmp = (a.card.setName || a.card.setCode || '').localeCompare(
            b.card.setName || b.card.setCode || '',
            'pt-BR'
          );
          break;
        case 'rarity':
          cmp =
            (rarityRank[a.card.rarity.toLowerCase()] || 0) -
            (rarityRank[b.card.rarity.toLowerCase()] || 0);
          break;
        case 'price':
          cmp = (a.card.priceUsd || 0) - (b.card.priceUsd || 0);
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredItems, sortColumn, sortDirection]);

  // Selection states for Table / List view
  const allFilteredSelected =
    sortedItems.length > 0 && sortedItems.every((i) => selectedItemIds.has(i.id));
  const someFilteredSelected = sortedItems.some((i) => selectedItemIds.has(i.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedItemIds(new Set());
    } else {
      const next = new Set(selectedItemIds);
      sortedItems.forEach((i) => next.add(i.id));
      setSelectedItemIds(next);
    }
  };

  const handleBatchDelete = () => {
    if (selectedItemIds.size === 0) return;
    const count = selectedItemIds.size;
    if (
      window.confirm(
        `Deseja realmente remover ${count} ${
          count === 1 ? 'carta selecionada' : 'cartas selecionadas'
        } da coleção?`
      )
    ) {
      const ids = Array.from(selectedItemIds);
      if (onRemoveItems) {
        onRemoveItems(ids);
      } else {
        ids.forEach((id) => {
          onRemoveItem(id);
        });
      }
      setSelectedItemIds(new Set());
    }
  };

  // Aggregate stats
  const totalCardsCount = useMemo(() => collection.reduce((sum, i) => sum + i.quantity, 0), [collection]);
  const totalAvailableCount = useMemo(() => collection.reduce((sum, i) => sum + (i.availableQuantity ?? i.quantity), 0), [collection]);
  const totalInUseCount = useMemo(() => collection.reduce((sum, i) => sum + (i.inUseQuantity ?? 0), 0), [collection]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="glass-panel page-header-panel" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="section-eyebrow">Acervo</span>
            <h1 className="page-title">
              Minha Coleção
            </h1>
            <p className="page-subtitle">
              Gerencie todas as suas cartas físicas, controle cópias em uso nos decks e monitore seu acervo.
            </p>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="stat-tile-label">Total de cartas</span>
            <span className="stat-tile-value">{totalCardsCount}</span>
            <span className="stat-tile-hint">{collection.length} únicas</span>
          </div>
          <div className="stat-tile is-success">
            <span className="stat-tile-label">Disponíveis na pool</span>
            <span className="stat-tile-value">{totalAvailableCount}</span>
            <span className="stat-tile-hint">livres para novos decks</span>
          </div>
          <div className="stat-tile is-primary">
            <span className="stat-tile-label">Em uso nos decks</span>
            <span className="stat-tile-value">{totalInUseCount}</span>
            <span className="stat-tile-hint">
              {totalCardsCount > 0 ? Math.round((totalInUseCount / totalCardsCount) * 100) : 0}% do acervo
            </span>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: showCharts ? '22px' : '0px',
          }}
        >
          <h2
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#f4f4f5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <BarChart3 className="text-primary" size={18} />
            Estatísticas
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCharts(!showCharts)}>
            {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showCharts ? 'Ocultar' : 'Expandir'}
          </button>
        </div>

        {showCharts && (
          <InteractiveCharts
            cards={collection.map((i) => ({ card: i.card, quantity: i.quantity }))}
            showDeckMetrics={false}
          />
        )}
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#71717a' }} />
            <input
              type="text"
              className="input-text"
              placeholder="Filtrar por nome, tipo ou texto da carta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px' }}
            />
          </div>

          {/* Color filter */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${!isColorlessOnly && !isMultiOnly && selectedColors.length === 0 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={handleResetColors}
            >
              Todas
            </button>
            {(['W', 'U', 'B', 'R', 'G'] as const).map((col) => {
              const isSelected = selectedColors.includes(col);
              const colNames: Record<string, string> = {
                W: 'Branco',
                U: 'Azul',
                B: 'Preto',
                R: 'Vermelho',
                G: 'Verde',
              };
              return (
                <button
                  key={col}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleToggleColor(col)}
                  title={colNames[col]}
                >
                  <span className={`mana-pip mana-pip-${col}`}>{col}</span>
                </button>
              );
            })}
            <button
              className={`btn btn-sm ${isMultiOnly ? 'btn-primary' : 'btn-ghost'}`}
              onClick={handleToggleMulti}
              title="Multicolor"
            >
              Multi
            </button>
            <button
              className={`btn btn-sm ${isColorlessOnly ? 'btn-primary' : 'btn-ghost'}`}
              onClick={handleToggleColorless}
              title="Incolor"
            >
              Incolor
            </button>

            {/* Mode switch when 2+ colors are selected */}
            {selectedColors.length > 1 && !isMultiOnly && (
              <button
                className="btn btn-xs btn-secondary"
                style={{ marginLeft: '4px' }}
                onClick={() => setColorMatchMode((m) => (m === 'exact' ? 'pool' : 'exact'))}
                title="Alternar entre modo Exato e modo Pool de Identidade"
              >
                {colorMatchMode === 'exact' ? 'Exato (=)' : 'Identidade (≤)'}
              </button>
            )}
          </div>

          {/* Usage Filter (Requirement 4) */}
          <select
            className="select-field"
            value={usageFilter}
            onChange={(e) => setUsageFilter(e.target.value as any)}
            style={{ width: 'auto', height: '38px' }}
          >
            <option value="all">Todas as Cartas</option>
            <option value="available">🟢 Apenas Disponíveis (Pool)</option>
            <option value="in_use">🟡 Apenas Em Uso nos Decks</option>
          </select>

          {/* Layout View Switcher: Grade Visual (Principal) -> Tabela / Lista (Secundária) */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-darkest)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredPreview(null);
                handleSetViewMode('grid');
              }}
              title="Visualização em Grade Visual (Principal)"
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredPreview(null);
                handleSetViewMode('table');
              }}
              title="Visualização em Lista / Tabela (Secundária)"
            >
              <List size={16} />
            </button>
          </div>

          {/* Grid Scale Zoom Slider & Details Toggle */}
          {viewMode === 'grid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${showGridDetails ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleToggleGridDetails}
                title={showGridDetails ? 'Ocultar detalhes (mostrar apenas artes)' : 'Mostrar detalhes completos das cartas'}
                style={{ height: '32px' }}
              >
                {showGridDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showGridDetails ? 'Só Artes' : 'Com Detalhes'}</span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-darkest)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  height: '32px',
                }}
                title={`Ajustar escala da grade (${gridCardSize}px)`}
              >
                <ZoomOut size={13} style={{ color: '#a1a1aa' }} />
                <input
                  type="range"
                  min={110}
                  max={340}
                  step={10}
                  value={gridCardSize}
                  onChange={(e) => handleGridCardSizeChange(Number(e.target.value))}
                  style={{ width: '85px', accentColor: '#ffbb00', cursor: 'pointer' }}
                />
                <ZoomIn size={13} style={{ color: '#a1a1aa' }} />
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', minWidth: '36px', textAlign: 'right' }}>
                  {gridCardSize}px
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area Based on View Mode */}
      {sortedItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#a1a1aa' }}>
          Nenhuma carta encontrada com os filtros selecionados.
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. VISUAL GRID VIEW */
        <div
          className="cards-grid"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridCardSize}px, 1fr))` }}
        >
          {sortedItems.map((item) => {
            const isDfc = isDoubleFacedCard(item.card);
            const isFlipped = isDfc && flippedItemIds.has(item.id);

            const frontName =
              item.card.cardFaces?.[0]?.name ||
              (item.card.name.includes(' // ') ? item.card.name.split(' // ')[0].trim() : item.card.name);
            const backName =
              item.card.cardFaces?.[1]?.name ||
              (item.card.name.includes(' // ')
                ? item.card.name.split(' // ')[1].trim()
                : `${item.card.name} (Verso)`);
            const displayName = isFlipped ? backName : frontName;

            const displayImageUrl = isFlipped
              ? item.card.cardFaces?.[1]?.imageUrl || item.card.imageUrl
              : item.card.imageUrl;
            const displayImageUrlLarge = isFlipped
              ? item.card.cardFaces?.[1]?.imageUrlLarge || item.card.cardFaces?.[1]?.imageUrl || displayImageUrl
              : item.card.imageUrlLarge || displayImageUrl;

            return (
              <div key={item.id} className={`card-item-container ${item.isFoil ? 'is-foil' : ''}`}>
                {/* Image & Sheen */}
                <div
                  className="card-image-wrapper"
                  onMouseEnter={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setHoveredPreview({
                      url: displayImageUrlLarge,
                      title: displayName,
                      subtitle: `${item.card.setName} (${item.card.setCode.toUpperCase()} #${item.card.collectorNumber})${isFlipped ? ' • [Verso]' : ''}`,
                      badge: item.isFoil ? 'Foil ★' : undefined,
                    });
                  }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredPreview(null)}
                >
                  <CardImage
                    name={displayName}
                    imageUrl={displayImageUrl}
                    imageUrlLarge={displayImageUrlLarge}
                    setCode={item.card.setCode}
                    collectorNumber={item.card.collectorNumber}
                    face={isFlipped ? 'back' : 'front'}
                    className="card-image"
                  />

                  {/* Total Quantity Owned Badge (Bottom-Left) */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(14, 14, 16, 0.88)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#f4f4f5',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    {item.quantity}x
                  </div>

                  {/* Flip Button for Double-Faced Cards (Bottom-Right) */}
                  {isDfc && (
                    <button
                      type="button"
                      className={`btn-flip-card ${isFlipped ? 'is-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredPreview(null);
                        handleToggleFlip(item.id, item.card);
                      }}
                      title={isFlipped ? 'Virar para Frente' : 'Virar para o Verso'}
                    >
                      <RotateCw
                        size={12}
                        style={{
                          transform: isFlipped ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.25s ease',
                        }}
                      />
                      <span>Virar</span>
                    </button>
                  )}

                  {/* In Art-Only mode: Floating quick actions on hover/touch */}
                  {!showGridDetails && (
                    <div className="card-art-actions-overlay">
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ background: 'rgba(14, 14, 16, 0.9)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredPreview(null);
                          onOpenArtSelector(item.card, item.id, isFlipped ? 'back' : 'front');
                        }}
                        title={isFlipped ? 'Mudar Arte do Verso' : 'Mudar Arte / Edição'}
                      >
                        <ImageIcon size={15} />
                      </button>
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ background: 'rgba(14, 14, 16, 0.9)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredPreview(null);
                          onAddToProxies(item.card, 1);
                        }}
                        title="Adicionar à Impressão"
                      >
                        <Printer size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Details & In Use / Available Indicators (Requirement 4) - Hidden in Art-Only mode */}
                {showGridDetails && (
                  <div style={{ padding: '12px', background: '#111113', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                        {isFlipped && (
                          <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#ffcc4d', fontWeight: 600 }}>
                            (Verso)
                          </span>
                        )}
                      </div>
                      <ManaCostRenderer manaCost={item.card.manaCost} />
                    </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a' }}>
                    <span>{item.card.setName} ({item.card.setCode})</span>
                    {item.card.priceUsd && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        ${(item.card.priceUsd * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Requirement 4: Available vs In-Use Indicators */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                        Disponíveis:
                      </span>
                      <strong style={{ color: '#f4f4f5' }}>{item.availableQuantity ?? item.quantity}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#e6a800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e6a800' }} />
                        Em Decks:
                      </span>
                      <strong style={{ color: '#f4f4f5' }}>{item.inUseQuantity ?? 0}</strong>
                    </div>

                    {/* Decks usage breakdown */}
                    {item.usedInDecks && item.usedInDecks.length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#a1a1aa', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '2px' }}>
                        {item.usedInDecks.map((d, i) => (
                          <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            • {d.deckName} ({d.count}x)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Qty control, Change Art, Add to Proxies */}
                  <div className="card-footer-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                    {/* Qty +/- */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon" 
                        onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        className="btn btn-ghost btn-icon" 
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon" 
                        onClick={() => onOpenArtSelector(item.card, item.id, isFlipped ? 'back' : 'front')}
                        title={isFlipped ? 'Mudar Arte do Verso (Scryfall)' : 'Mudar Arte / Edição (Scryfall)'}
                      >
                        <ImageIcon size={15} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon" 
                        onClick={() => onAddToProxies(item.card, 1)}
                        title="Adicionar à Fila de Impressão (Proxy)"
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ color: '#f43f5e' }}
                        onClick={() => onRemoveItem(item.id)}
                        title="Remover carta da coleção"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      ) : (
        /* 2. TABLE / COMPACT LIST VIEW */
        <div>
          {/* Bulk Action Toolbar for List View */}
          {selectedItemIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                padding: '10px 16px',
                marginBottom: '12px',
                animation: 'modal-enter 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#fca5a5' }}>
                <CheckSquare size={17} color="#ef4444" />
                <span>
                  <strong>{selectedItemIds.size}</strong> {selectedItemIds.size === 1 ? 'carta selecionada' : 'cartas selecionadas'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedItemIds(new Set())}
                  style={{ fontSize: '0.8rem', color: '#d4d4d8' }}
                >
                  Limpar Seleção
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={handleBatchDelete}
                >
                  <Trash2 size={14} /> Remover Selecionadas ({selectedItemIds.size})
                </button>
              </div>
            </div>
          )}

          <div className="coll-table-wrap">
            <table className="coll-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      title={allFilteredSelected ? 'Desmarcar todas' : 'Selecionar todas as cartas da lista'}
                    />
                  </th>
                  {(
                    [
                      { key: 'name', label: 'Carta', cls: 'col-name' },
                      { key: 'quantity', label: 'Qtd.', cls: 'col-qty' },
                      { key: 'available', label: 'Disp. / Uso', cls: 'col-avail hide-sm' },
                      { key: 'cmc', label: 'Custo', cls: 'col-cost' },
                      { key: 'set', label: 'Edição', cls: 'col-set hide-sm' },
                      { key: 'rarity', label: 'Raridade', cls: 'col-rarity hide-md' },
                      { key: 'price', label: 'Preço', cls: 'col-price hide-sm' },
                    ] as { key: SortColumn; label: string; cls: string }[]
                  ).map((col) => (
                    <th
                      key={col.key}
                      className={`${col.cls} is-sortable ${sortColumn === col.key ? 'is-sorted' : ''}`}
                      onClick={() => handleSort(col.key)}
                      title={`Ordenar por ${col.label}`}
                    >
                      <span>{col.label}</span>
                      <span className="sort-ind">
                        {sortColumn === col.key ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </th>
                  ))}
                  <th className="col-actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.slice(0, visibleRows).map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <tr key={item.id} className={isSelected ? 'is-selected' : ''}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => undefined}
                          onClick={(e) => handleToggleSelectItem(item.id, e.shiftKey)}
                          title="Segure Shift para selecionar um intervalo"
                        />
                      </td>
                      <td className="col-name">
                        <div className="coll-name-cell">
                          <span className="coll-name-text">
                            <span
                              className="coll-name"
                              onMouseEnter={(e) => {
                                setMousePos({ x: e.clientX, y: e.clientY });
                                setHoveredPreview({
                                  url: item.card.imageUrlLarge || item.card.imageUrl,
                                  title: item.card.name,
                                  subtitle: `${item.card.setName} (${item.card.setCode.toUpperCase()} #${item.card.collectorNumber})`,
                                  badge: item.isFoil ? 'Foil ★' : undefined,
                                });
                              }}
                              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setHoveredPreview(null)}
                            >
                              {item.card.name}
                              {item.isFoil && <Sparkles size={12} className="text-amber-400" />}
                            </span>
                            <span className="coll-type">{item.card.typeLine}</span>
                          </span>
                        </div>
                      </td>
                      <td className="col-qty">
                        <div className="coll-stepper">
                          <button type="button" onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))} aria-label="Diminuir quantidade">
                            <Minus size={12} />
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} aria-label="Aumentar quantidade">
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="col-avail hide-sm">
                        <span className="coll-avail">{item.availableQuantity ?? item.quantity}</span>
                        <span className="coll-sep">/</span>
                        <span className="coll-inuse">{item.inUseQuantity ?? 0}</span>
                      </td>
                      <td className="col-cost">
                        <ManaCostRenderer manaCost={item.card.manaCost} />
                      </td>
                      <td className="col-set hide-sm">
                        <span className="coll-setcode" title={item.card.setName}>
                          {item.card.setCode.toUpperCase()}
                        </span>
                      </td>
                      <td className="col-rarity hide-md">
                        <span className={`badge badge-rarity-${item.card.rarity.toLowerCase()}`}>{item.card.rarity}</span>
                      </td>
                      <td className="col-price hide-sm">
                        {item.card.priceUsd ? `$${(item.card.priceUsd * item.quantity).toFixed(2)}` : '—'}
                      </td>
                      <td className="col-actions">
                        <div className="coll-actions">
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onOpenArtSelector(item.card, item.id)} title="Trocar Arte" aria-label="Trocar Arte">
                            <ImageIcon size={15} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onAddToProxies(item.card, 1)} title="Adicionar à Impressão" aria-label="Adicionar à Impressão">
                            <Printer size={15} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm coll-delete" onClick={() => onRemoveItem(item.id)} title="Remover carta da coleção" aria-label="Remover carta da coleção">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedItems.length > visibleRows && (
              <div ref={rowsSentinelRef} className="coll-more">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVisibleRows((n) => n + 100)}>
                  Mostrar mais ({sortedItems.length - visibleRows})
                </button>
              </div>
            )}
          </div>
      </div>
      )}

      {/* Floating Card Zoom Preview (matching Art Selector Modal hover) */}
      <CardHoverPreview preview={hoveredPreview} mousePos={mousePos} />
    </div>
  );
};
