import React, { useState, useMemo } from 'react';
import { CollectionItem, ViewMode, CardPrint, Card } from '../../types';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';
import { CardImage } from '../Common/CardImage';
import { InteractiveCharts } from '../Analytics/InteractiveCharts';
import {
  Grid,
  Columns,
  List,
  Search,
  Filter,
  Plus,
  Minus,
  Sparkles,
  Printer,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

interface CollectionViewProps {
  collection: CollectionItem[];
  onUpdateQuantity: (id: string, newQty: number) => void;
  onOpenArtSelector: (card: Card, collectionItemId: string) => void;
  onAddToProxies: (card: Card, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onOpenAddModal: () => void;
}

export type SortColumn = 'quantity' | 'available' | 'name' | 'cmc' | 'type' | 'set' | 'rarity' | 'price';
export type SortDirection = 'asc' | 'desc';

export const CollectionView: React.FC<CollectionViewProps> = ({
  collection,
  onUpdateQuantity,
  onOpenArtSelector,
  onAddToProxies,
  onRemoveItem,
  onOpenAddModal,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isMultiOnly, setIsMultiOnly] = useState(false);
  const [isColorlessOnly, setIsColorlessOnly] = useState(false);
  const [colorMatchMode, setColorMatchMode] = useState<'exact' | 'pool'>('exact');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'available' | 'in_use'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCharts, setShowCharts] = useState(false);
  const [hoveredCardImg, setHoveredCardImg] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.card.name.toLowerCase().includes(q);
        const matchesType = item.card.typeLine.toLowerCase().includes(q);
        const matchesText = item.card.oracleText?.toLowerCase().includes(q) || false;
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

      // Rarity
      if (selectedRarity !== 'all' && item.card.rarity !== selectedRarity) {
        return false;
      }

      // Usage Filter (Requirement 4)
      if (usageFilter === 'available') {
        if ((item.availableQuantity ?? item.quantity) <= 0) return false;
      } else if (usageFilter === 'in_use') {
        if ((item.inUseQuantity ?? 0) <= 0) return false;
      }

      return true;
    });
  }, [collection, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode, selectedRarity, usageFilter]);

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

  // Aggregate stats
  const totalCardsCount = useMemo(() => collection.reduce((sum, i) => sum + i.quantity, 0), [collection]);
  const totalAvailableCount = useMemo(() => collection.reduce((sum, i) => sum + (i.availableQuantity ?? i.quantity), 0), [collection]);
  const totalInUseCount = useMemo(() => collection.reduce((sum, i) => sum + (i.inUseQuantity ?? 0), 0), [collection]);

  // Stacked Columns groupings (grouped by Type or CMC)
  const stackedGroups = useMemo(() => {
    const groups: Record<string, CollectionItem[]> = {
      'Criaturas': [],
      'Mágicas Instantâneas': [],
      'Feitiços': [],
      'Artefatos': [],
      'Encantamentos': [],
      'Planeswalkers': [],
      'Terrenos': [],
      'Outros': [],
    };

    sortedItems.forEach((item) => {
      const t = item.card.typeLine.toLowerCase();
      if (t.includes('creature') || t.includes('criatura')) groups['Criaturas'].push(item);
      else if (t.includes('instant') || t.includes('instantânea')) groups['Mágicas Instantâneas'].push(item);
      else if (t.includes('sorcery') || t.includes('feitiço')) groups['Feitiços'].push(item);
      else if (t.includes('artifact') || t.includes('artefato')) groups['Artefatos'].push(item);
      else if (t.includes('enchantment') || t.includes('encantamento')) groups['Encantamentos'].push(item);
      else if (t.includes('planeswalker')) groups['Planeswalkers'].push(item);
      else if (t.includes('land') || t.includes('terreno')) groups['Terrenos'].push(item);
      else groups['Outros'].push(item);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [sortedItems]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
              Minha Coleção de Cartas
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
              Gerencie todas as suas cartas físicas, controle cópias em uso nos decks e monitore seu acervo.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${showCharts ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShowCharts(!showCharts)}
            >
              <BarChart3 size={15} />
              {showCharts ? 'Ocultar Estatísticas' : 'Estatísticas'}
            </button>

            <button className="btn btn-primary btn-sm" onClick={onOpenAddModal}>
              <Plus size={16} /> Adicionar Carta
            </button>
          </div>
        </div>

        {/* Quick Requirement 4 Status Bar */}
        <div
          style={{
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: '#94a3b8' }}>Total de cartas: </span>
            <strong style={{ color: '#f8fafc' }}>{totalCardsCount}</strong> ({collection.length} únicas)
          </div>

          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: '#94a3b8' }}>🟢 Disponíveis na pool: </span>
            <strong style={{ color: '#10b981' }}>{totalAvailableCount}</strong>
          </div>

          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: '#94a3b8' }}>🟡 Em uso nos decks: </span>
            <strong style={{ color: '#ffbb00' }}>{totalInUseCount}</strong>
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
              color: '#f8fafc',
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
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
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
                style={{ fontSize: '0.72rem', padding: '3px 8px', marginLeft: '4px' }}
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

          {/* Layout View Switcher (Reordered: Table/List [principal] -> Grid -> Stacked) */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-darkest)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredCardImg(null);
                setViewMode('table');
              }}
              title="Visualização em Tabela / Lista (Principal)"
            >
              <List size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredCardImg(null);
                setViewMode('grid');
              }}
              title="Visualização em Grade Visual"
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'stacked' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredCardImg(null);
                setViewMode('stacked');
              }}
              title="Visualização em Colunas Stackadas (Moxfield/Archidekt)"
            >
              <Columns size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area Based on View Mode */}
      {sortedItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          Nenhuma carta encontrada com os filtros selecionados.
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. VISUAL GRID VIEW */
        <div className="cards-grid">
          {sortedItems.map((item) => (
            <div key={item.id} className="card-item-container">
              {/* Image & Sheen */}
              <div className={`card-image-wrapper ${item.isFoil ? 'foil-sheen' : ''}`}>
                <CardImage
                  name={item.card.name}
                  imageUrl={item.card.imageUrl}
                  imageUrlLarge={item.card.imageUrlLarge}
                  setCode={item.card.setCode}
                  collectorNumber={item.card.collectorNumber}
                  preferLarge
                  className="card-image"
                />

                {/* Foil Star Badge */}
                {item.isFoil && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(0,0,0,0.7)',
                      borderRadius: '50%',
                      padding: '4px',
                      color: '#facc15',
                      display: 'flex',
                    }}
                    title="Carta Foil"
                  >
                    <Sparkles size={14} />
                  </div>
                )}

                {/* Total Quantity Owned Top Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(12, 15, 23, 0.85)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                  }}
                >
                  {item.quantity}x
                </div>
              </div>

              {/* Card Details & In Use / Available Indicators (Requirement 4) */}
              <div style={{ padding: '12px', background: '#0c0f17', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.card.name}
                  </div>
                  <ManaCostRenderer manaCost={item.card.manaCost} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
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
                    <strong style={{ color: '#f8fafc' }}>{item.availableQuantity ?? item.quantity}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                      Em Decks:
                    </span>
                    <strong style={{ color: '#f8fafc' }}>{item.inUseQuantity ?? 0}</strong>
                  </div>

                  {/* Decks usage breakdown */}
                  {item.usedInDecks && item.usedInDecks.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '2px' }}>
                      {item.usedInDecks.map((d, i) => (
                        <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          • {d.deckName} ({d.count}x)
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons: Qty control, Change Art, Add to Proxies */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  {/* Qty +/- */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '3px' }}
                      onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                    >
                      <Minus size={13} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '3px' }}
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '5px' }}
                      onClick={() => onOpenArtSelector(item.card, item.id)}
                      title="Mudar Arte / Edição (Scryfall)"
                    >
                      <ImageIcon size={15} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '5px' }}
                      onClick={() => onAddToProxies(item.card, 1)}
                      title="Adicionar à Fila de Impressão (Proxy)"
                    >
                      <Printer size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'stacked' ? (
        /* 2. MOXFIELD / ARCHIDEKT STACKED COLUMNS VIEW */
        <div className="stacked-board">
          {stackedGroups.map(([groupName, items]) => (
            <div key={groupName} className="stacked-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{groupName}</span>
                <span className="badge badge-primary">{items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>

              <div className="stacked-cards-list">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="stacked-card-entry"
                    onMouseEnter={(e) => {
                      setMousePos({ x: e.clientX, y: e.clientY });
                      setHoveredCardImg(item.card.imageUrlLarge || item.card.imageUrl);
                    }}
                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCardImg(null)}
                  >
                    <div className="stacked-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ color: '#818cf8', fontWeight: 700 }}>{item.quantity}x</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f8fafc' }}>
                          {item.card.name}
                        </span>
                      </div>
                      <ManaCostRenderer manaCost={item.card.manaCost} />
                    </div>
                    <div style={{ aspectRatio: '5/7', overflow: 'hidden' }}>
                      <CardImage
                        name={item.card.name}
                        imageUrl={item.card.imageUrl}
                        imageUrlLarge={item.card.imageUrlLarge}
                        setCode={item.card.setCode}
                        collectorNumber={item.card.collectorNumber}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 3. TABLE / COMPACT LIST VIEW */
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', color: '#94a3b8' }}>
                <th
                  onClick={() => handleSort('quantity')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'quantity' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Quantidade"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>qtd</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'quantity' ? 1 : 0.25 }}>
                      {sortColumn === 'quantity' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('available')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'available' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Disponível / Uso"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Disponível / Uso</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'available' ? 1 : 0.25 }}>
                      {sortColumn === 'available' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'name' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Nome da Carta"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>nome da carta</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'name' ? 1 : 0.25 }}>
                      {sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('cmc')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'cmc' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Custo (CMC)"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>custo</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'cmc' ? 1 : 0.25 }}>
                      {sortColumn === 'cmc' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('type')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'type' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Tipo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>tipo</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'type' ? 1 : 0.25 }}>
                      {sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('set')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'set' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Edição"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>edição</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'set' ? 1 : 0.25 }}>
                      {sortColumn === 'set' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rarity')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'rarity' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Raridade"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>raridade</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'rarity' ? 1 : 0.25 }}>
                      {sortColumn === 'rarity' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('price')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'price' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Preço"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>preço</span>
                    <span style={{ fontSize: '0.75rem', opacity: sortColumn === 'price' ? 1 : 0.25 }}>
                      {sortColumn === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px' }}
                        onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus size={12} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px' }}
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{item.availableQuantity ?? item.quantity}</span>
                    <span style={{ color: '#64748b' }}> / </span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{item.inUseQuantity ?? 0}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#f8fafc' }}>
                    <span
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px dotted rgba(148, 163, 184, 0.45)',
                        paddingBottom: '1px',
                        transition: 'color 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#a5b4fc';
                        e.currentTarget.style.borderColor = '#818cf8';
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setHoveredCardImg(item.card.imageUrlLarge || item.card.imageUrl);
                      }}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#f8fafc';
                        e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                        setHoveredCardImg(null);
                      }}
                    >
                      {item.card.name}
                    </span>{' '}
                    {item.isFoil && <Sparkles size={12} className="inline text-amber-400" />}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <ManaCostRenderer manaCost={item.card.manaCost} />
                  </td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8' }}>
                    {item.card.typeLine}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>
                    {item.card.setCode}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className={`badge badge-rarity-${item.card.rarity.toLowerCase()}`}>
                      {item.card.rarity}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#10b981' }}>
                    {item.card.priceUsd ? `$${(item.card.priceUsd * item.quantity).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '4px' }}
                        onClick={() => onOpenArtSelector(item.card, item.id)}
                        title="Trocar Arte"
                      >
                        <ImageIcon size={15} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '4px' }}
                        onClick={() => onAddToProxies(item.card, 1)}
                        title="Adicionar à Impressão"
                      >
                        <Printer size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Card Image Tooltip (for Table / Stacked views) */}
      {hoveredCardImg && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 260, mousePos.x + 20)}px`,
            top: `${Math.min(window.innerHeight - 360, mousePos.y - 120)}px`,
            width: '240px',
            pointerEvents: 'none',
            zIndex: 10000,
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(99,102,241,0.3)',
            animation: 'modal-enter 0.15s ease forwards',
          }}
        >
          <img
            src={hoveredCardImg}
            alt="Preview"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      )}
    </div>
  );
};
