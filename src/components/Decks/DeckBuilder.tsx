import React, { useState, useMemo } from 'react';
import { Deck, DeckCard, ViewMode, Card, CollectionItem } from '../../types';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';
import { CardImage } from '../Common/CardImage';
import { InteractiveCharts } from '../Analytics/InteractiveCharts';
import {
  ArrowLeft,
  Grid,
  Columns,
  List,
  Plus,
  Minus,
  Trash2,
  Printer,
  Download,
  BarChart3,
  Sparkles,
  Shield,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

interface DeckBuilderProps {
  deck: Deck;
  collection?: CollectionItem[];
  onBack: () => void;
  onUpdateDeck: (updated: Deck) => void;
  onOpenArtSelector: (card: Card, cardIndex: number) => void;
  onAddToProxies?: (card: Card, quantity: number) => void;
  onSendDeckToProxies: (deck: Deck) => void;
  onOpenExportModal: (deckId: string) => void;
  onOpenAddCardModal: (deckId: string) => void;
}

type SortColumn =
  | 'quantity'
  | 'available'
  | 'name'
  | 'cmc'
  | 'type'
  | 'set'
  | 'rarity'
  | 'price'
  | null;

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  deck,
  collection = [],
  onBack,
  onUpdateDeck,
  onOpenArtSelector,
  onAddToProxies,
  onSendDeckToProxies,
  onOpenExportModal,
  onOpenAddCardModal,
}) => {
  // View mode: Table/List is default/primary
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showCharts, setShowCharts] = useState(true);
  const [hoveredCardImg, setHoveredCardImg] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter & Search states (matches Collection)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isMultiOnly, setIsMultiOnly] = useState(false);
  const [isColorlessOnly, setIsColorlessOnly] = useState(false);
  const [colorMatchMode, setColorMatchMode] = useState<'exact' | 'pool'>('pool');

  // Sorting state (matches Collection)
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Counts
  const totalCardsCount = useMemo(() => {
    return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
  }, [deck.cards]);

  const targetCardsCount = useMemo(() => {
    if (deck.format === 'commander') return 100;
    if (deck.format === 'brawl') return 60;
    return 60;
  }, [deck.format]);

  // Sections: Commander, Mainboard, Sideboard
  const commanders = useMemo(
    () => deck.cards.filter((c) => c.category === 'commander' || c.category === 'partner'),
    [deck.cards]
  );
  const mainCards = useMemo(
    () => deck.cards.filter((c) => c.category === 'main'),
    [deck.cards]
  );
  const sideCards = useMemo(
    () => deck.cards.filter((c) => c.category === 'sideboard'),
    [deck.cards]
  );

  // Link card to collection item to get availability & in-use breakdown
  const getCollectionItemForCard = (c: DeckCard): CollectionItem | undefined => {
    if (!collection || collection.length === 0) return undefined;
    if (c.collectionItemId) {
      const match = collection.find((item) => item.id === c.collectionItemId);
      if (match) return match;
    }
    const byId = collection.find((item) => item.card.id === c.card.id);
    if (byId) return byId;
    const bySetAndNumber = collection.find(
      (item) =>
        item.card.setCode.toLowerCase() === c.card.setCode.toLowerCase() &&
        item.card.collectorNumber === c.card.collectorNumber
    );
    if (bySetAndNumber) return bySetAndNumber;
    return collection.find(
      (item) => item.card.name.toLowerCase() === c.card.name.toLowerCase()
    );
  };

  // Card update handlers
  const handleUpdateCardQuantity = (cardId: string, newQty: number) => {
    let updatedCards: DeckCard[];
    if (newQty <= 0) {
      updatedCards = deck.cards.filter((c) => c.card.id !== cardId);
    } else {
      updatedCards = deck.cards.map((c) => (c.card.id === cardId ? { ...c, quantity: newQty } : c));
    }
    onUpdateDeck({ ...deck, cards: updatedCards, updatedAt: new Date().toISOString() });
  };

  const handleRemoveCard = (cardId: string) => {
    const updatedCards = deck.cards.filter((c) => c.card.id !== cardId);
    onUpdateDeck({ ...deck, cards: updatedCards, updatedAt: new Date().toISOString() });
  };

  // Color Filter toggles
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

  // Sorting toggle
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

  // Card filtering predicate
  const filterCardItem = (item: DeckCard) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = item.card.name.toLowerCase().includes(q);
      const matchesType = item.card.typeLine.toLowerCase().includes(q);
      const matchesText = item.card.oracleText?.toLowerCase().includes(q) || false;
      if (!matchesName && !matchesType && !matchesText) return false;
    }

    const cardColors = item.card.colors || [];
    if (isColorlessOnly) {
      if (cardColors.length > 0) return false;
    } else if (isMultiOnly) {
      if (cardColors.length <= 1) return false;
      if (selectedColors.length > 0) {
        if (!cardColors.every((c) => selectedColors.includes(c))) return false;
      }
    } else if (selectedColors.length === 1) {
      if (cardColors.length !== 1 || cardColors[0] !== selectedColors[0]) return false;
    } else if (selectedColors.length > 1) {
      if (colorMatchMode === 'exact') {
        if (
          cardColors.length !== selectedColors.length ||
          !selectedColors.every((c) => cardColors.includes(c))
        ) {
          return false;
        }
      } else {
        if (cardColors.length === 0 || !cardColors.every((c) => selectedColors.includes(c))) {
          return false;
        }
      }
    }

    return true;
  };

  // Card sorting function
  const sortCardItems = (items: DeckCard[]) => {
    if (!sortColumn) return items;

    const rarityRank: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      mythic: 4,
      special: 5,
    };

    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'available': {
          const aLinked = getCollectionItemForCard(a);
          const bLinked = getCollectionItemForCard(b);
          const aAvail = aLinked?.availableQuantity ?? 0;
          const bAvail = bLinked?.availableQuantity ?? 0;
          cmp = aAvail - bAvail;
          break;
        }
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
  };

  const filteredMainCards = useMemo(
    () => mainCards.filter(filterCardItem),
    [mainCards, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode]
  );
  const sortedMainCards = useMemo(
    () => sortCardItems(filteredMainCards),
    [filteredMainCards, sortColumn, sortDirection, collection]
  );

  const filteredSideCards = useMemo(
    () => sideCards.filter(filterCardItem),
    [sideCards, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode]
  );
  const sortedSideCards = useMemo(
    () => sortCardItems(filteredSideCards),
    [filteredSideCards, sortColumn, sortDirection, collection]
  );

  // Stacked Columns groupings
  const stackedGroups = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {
      Criaturas: [],
      'Mágicas Instantâneas': [],
      Feitiços: [],
      Artefatos: [],
      Encantamentos: [],
      Planeswalkers: [],
      Terrenos: [],
      Outros: [],
    };

    filteredMainCards.forEach((item) => {
      const t = item.card.typeLine.toLowerCase();
      if (t.includes('creature') || t.includes('criatura')) groups['Criaturas'].push(item);
      else if (t.includes('instant') || t.includes('instantânea'))
        groups['Mágicas Instantâneas'].push(item);
      else if (t.includes('sorcery') || t.includes('feitiço')) groups['Feitiços'].push(item);
      else if (t.includes('artifact') || t.includes('artefato')) groups['Artefatos'].push(item);
      else if (t.includes('enchantment') || t.includes('encantamento'))
        groups['Encantamentos'].push(item);
      else if (t.includes('planeswalker')) groups['Planeswalkers'].push(item);
      else if (t.includes('land') || t.includes('terreno')) groups['Terrenos'].push(item);
      else groups['Outros'].push(item);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filteredMainCards]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Navigation & Deck Header */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> Voltar aos Decks
          </button>
          <span className="badge badge-primary">{deck.format.toUpperCase()}</span>
          <span
            className={`badge ${
              totalCardsCount === targetCardsCount ? 'badge-success' : 'badge-warning'
            }`}
          >
            {totalCardsCount} / {targetCardsCount} Cartas
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
              {deck.name}
            </h1>
            {deck.description && (
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#94a3b8',
                  marginTop: '4px',
                  maxWidth: '640px',
                }}
              >
                {deck.description}
              </p>
            )}
          </div>

          {/* Quick Deck Actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onSendDeckToProxies(deck)}
              title="Diagramar 9 cartas por folha A4 e imprimir"
            >
              <Printer size={15} /> Imprimir Proxies (A4)
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenExportModal(deck.id)}
            >
              <Download size={15} /> Exportar Deck
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenAddCardModal(deck.id)}
            >
              <Plus size={16} /> Adicionar Carta
            </button>
          </div>
        </div>
      </div>

      {/* Commander Showcase Banner if Commander Deck */}
      {commanders.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(255, 187, 0, 0.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
              color: '#ffbb00',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Shield size={16} />
            <span>COMANDANTE(S) DO DECK</span>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {commanders.map((cmd) => (
              <div
                key={cmd.card.id}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  background: 'rgba(12, 15, 23, 0.8)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '90px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <CardImage
                    name={cmd.card.name}
                    imageUrl={cmd.card.imageUrl}
                    imageUrlLarge={cmd.card.imageUrlLarge}
                    setCode={cmd.card.setCode}
                    collectorNumber={cmd.card.collectorNumber}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                      {cmd.card.name}
                    </h3>
                    <ManaCostRenderer manaCost={cmd.card.manaCost} />
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '4px' }}
                      onClick={() => onOpenArtSelector(cmd.card, deck.cards.indexOf(cmd))}
                      title="Mudar Arte do Comandante"
                    >
                      <ImageIcon size={15} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    {cmd.card.typeLine}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      marginTop: '6px',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <span>
                      {cmd.card.setName} ({cmd.card.setCode})
                    </span>
                    {cmd.card.power && cmd.card.toughness && (
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {cmd.card.power}/{cmd.card.toughness}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Deck Analytics / Charts */}
      <div className="glass-panel" style={{ padding: '26px' }}>
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
            Estatísticas & Curva de Mana do Deck
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCharts(!showCharts)}>
            {showCharts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showCharts ? 'Ocultar' : 'Expandir'}
          </button>
        </div>

        {showCharts && (
          <InteractiveCharts
            cards={deck.cards.map((c) => ({ card: c.card, quantity: c.quantity }))}
            showDeckMetrics={true}
          />
        )}
      </div>

      {/* Filter & View Switcher Bar (Identical to Collection) */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }}
            />
            <input
              type="text"
              className="input-text"
              placeholder="Filtrar por nome, tipo ou texto da carta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px' }}
            />
          </div>

          {/* Color Filter */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${
                !isColorlessOnly && !isMultiOnly && selectedColors.length === 0
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
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

          {/* Layout View Switcher: Table/List (principal) -> Grid -> Stacked */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'var(--bg-darkest)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
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

      {/* Main Cards Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
          Baralho Principal ({sortedMainCards.reduce((s, c) => s + c.quantity, 0)} cartas)
        </h3>
      </div>

      {/* Main Cards Display Based on View Mode */}
      {sortedMainCards.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          {mainCards.length === 0
            ? 'Este deck ainda não possui cartas. Clique em "Adicionar Carta" acima ou importe uma lista!'
            : 'Nenhuma carta encontrada com os filtros selecionados.'}
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. VISUAL GRID VIEW */
        <div className="cards-grid">
          {sortedMainCards.map((c, idx) => {
            const isFoil = c.isFoil || c.card.isFoil;
            const linked = getCollectionItemForCard(c);
            const availQty = linked?.availableQuantity ?? 0;
            const inUseQty = linked?.inUseQuantity ?? c.quantity;

            return (
              <div key={`${c.card.id}-${idx}`} className="card-item-container">
                <div className={`card-image-wrapper ${isFoil ? 'foil-sheen' : ''}`}>
                  <CardImage
                    name={c.card.name}
                    imageUrl={c.card.imageUrl}
                    imageUrlLarge={c.card.imageUrlLarge}
                    setCode={c.card.setCode}
                    collectorNumber={c.card.collectorNumber}
                    preferLarge
                    className="card-image"
                  />

                  {/* Foil Star Badge */}
                  {isFoil && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'linear-gradient(135deg, rgba(255,187,0,0.9), rgba(217,119,6,0.9))',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      }}
                    >
                      <Sparkles size={11} /> FOIL
                    </div>
                  )}

                  {/* Quantity badge */}
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
                    {c.quantity}x
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    background: '#0c0f17',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.card.name}
                    </div>
                    <ManaCostRenderer manaCost={c.card.manaCost} />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <span>{c.card.typeLine.split('—')[0]}</span>
                    {c.card.priceUsd ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        ${(c.card.priceUsd * c.quantity).toFixed(2)}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>

                  {/* Available / In-Use breakdown pill */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: '#10b981' }}>
                      Disp: <strong>{availQty}</strong>
                    </span>
                    <span style={{ color: '#f59e0b' }}>
                      Uso: <strong>{inUseQty}</strong>
                    </span>
                  </div>

                  {/* Qty +/- & Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 'auto',
                      paddingTop: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '3px' }}
                        onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity - 1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          minWidth: '18px',
                          textAlign: 'center',
                        }}
                      >
                        {c.quantity}
                      </span>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '3px' }}
                        onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity + 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '5px' }}
                        onClick={() => onOpenArtSelector(c.card, deck.cards.indexOf(c))}
                        title="Trocar Arte / Edição"
                      >
                        <ImageIcon size={15} />
                      </button>
                      {onAddToProxies && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '5px' }}
                          onClick={() => onAddToProxies(c.card, c.quantity)}
                          title="Imprimir Proxies desta Carta"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-icon text-red-400"
                        style={{ padding: '5px' }}
                        onClick={() => handleRemoveCard(c.card.id)}
                        title="Remover do Deck"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'stacked' ? (
        /* 2. MOXFIELD STACKED COLUMNS VIEW */
        <div className="stacked-board">
          {stackedGroups.map(([groupName, items]) => (
            <div key={groupName} className="stacked-column">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                  {groupName}
                </span>
                <span className="badge badge-primary">
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>

              <div className="stacked-cards-list">
                {items.map((item, idx) => (
                  <div
                    key={`${item.card.id}-${idx}`}
                    className="stacked-card-entry"
                    onMouseEnter={(e) => {
                      setMousePos({ x: e.clientX, y: e.clientY });
                      setHoveredCardImg(item.card.imageUrlLarge || item.card.imageUrl);
                    }}
                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredCardImg(null)}
                  >
                    <div className="stacked-card-header">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          minWidth: 0,
                        }}
                      >
                        <span style={{ color: '#ffbb00', fontWeight: 700 }}>
                          {item.quantity}x
                        </span>
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: '#f8fafc',
                          }}
                        >
                          {item.card.name}
                        </span>
                        {(item.isFoil || item.card.isFoil) && (
                          <Sparkles size={11} className="text-amber-400 inline" />
                        )}
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
        /* 3. TABLE / LIST VIEW (PRINCIPAL) */
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.85rem',
            }}
          >
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
                    <span>Qtd.</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'quantity' ? 1 : 0.25,
                      }}
                    >
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
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'available' ? 1 : 0.25,
                      }}
                    >
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
                  title="Ordenar por Nome"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Nome</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'name' ? 1 : 0.25,
                      }}
                    >
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
                  title="Ordenar por Custo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Custo</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'cmc' ? 1 : 0.25,
                      }}
                    >
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
                    <span>Tipo</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'type' ? 1 : 0.25,
                      }}
                    >
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
                    <span>Edição</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'set' ? 1 : 0.25,
                      }}
                    >
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
                    <span>Raridade</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'rarity' ? 1 : 0.25,
                      }}
                    >
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
                    <span>Preço</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'price' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedMainCards.map((c, idx) => {
                const linked = getCollectionItemForCard(c);
                const availQty = linked?.availableQuantity ?? 0;
                const inUseQty = linked?.inUseQuantity ?? c.quantity;
                const isFoil = c.isFoil || c.card.isFoil;

                return (
                  <tr
                    key={`${c.card.id}-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
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
                          onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{c.quantity}</span>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '2px' }}
                          onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{availQty}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{inUseQty}</span>
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
                          setHoveredCardImg(c.card.imageUrlLarge || c.card.imageUrl);
                        }}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#f8fafc';
                          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                          setHoveredCardImg(null);
                        }}
                      >
                        {c.card.name}
                      </span>{' '}
                      {isFoil && <Sparkles size={12} className="inline text-amber-400" />}
                    </td>

                    <td style={{ padding: '10px 16px' }}>
                      <ManaCostRenderer manaCost={c.card.manaCost} />
                    </td>

                    <td style={{ padding: '10px 16px', color: '#94a3b8' }}>
                      {c.card.typeLine}
                    </td>

                    <td style={{ padding: '10px 16px', color: '#64748b' }}>
                      {c.card.setCode}
                    </td>

                    <td style={{ padding: '10px 16px' }}>
                      <span className={`badge badge-rarity-${c.card.rarity.toLowerCase()}`}>
                        {c.card.rarity}
                      </span>
                    </td>

                    <td style={{ padding: '10px 16px', color: '#10b981' }}>
                      {c.card.priceUsd ? `$${(c.card.priceUsd * c.quantity).toFixed(2)}` : '—'}
                    </td>

                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '4px' }}
                          onClick={() => onOpenArtSelector(c.card, deck.cards.indexOf(c))}
                          title="Trocar Arte"
                        >
                          <ImageIcon size={15} />
                        </button>
                        {onAddToProxies && (
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ padding: '4px' }}
                            onClick={() => onAddToProxies(c.card, c.quantity)}
                            title="Imprimir Proxies desta Carta"
                          >
                            <Printer size={15} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon text-red-400"
                          style={{ padding: '4px' }}
                          onClick={() => handleRemoveCard(c.card.id)}
                          title="Remover do Deck"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sideboard Section (if exists) */}
      {sideCards.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Sideboard ({sortedSideCards.reduce((s, c) => s + c.quantity, 0)} cartas)
            </h3>
          </div>

          {viewMode === 'table' ? (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: '#94a3b8' }}>
                    <th style={{ padding: '12px 16px' }}>Qtd.</th>
                    <th style={{ padding: '12px 16px' }}>Disponível / Uso</th>
                    <th style={{ padding: '12px 16px' }}>Nome</th>
                    <th style={{ padding: '12px 16px' }}>Custo</th>
                    <th style={{ padding: '12px 16px' }}>Tipo</th>
                    <th style={{ padding: '12px 16px' }}>Edição</th>
                    <th style={{ padding: '12px 16px' }}>Raridade</th>
                    <th style={{ padding: '12px 16px' }}>Preço</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSideCards.map((c, idx) => {
                    const linked = getCollectionItemForCard(c);
                    const availQty = linked?.availableQuantity ?? 0;
                    const inUseQty = linked?.inUseQuantity ?? c.quantity;
                    const isFoil = c.isFoil || c.card.isFoil;

                    return (
                      <tr
                        key={`side-${c.card.id}-${idx}`}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.15s ease',
                        }}
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
                              onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity - 1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span>{c.quantity}</span>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ padding: '2px' }}
                              onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>{availQty}</span>
                          <span style={{ color: '#64748b' }}> / </span>
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{inUseQty}</span>
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
                              setHoveredCardImg(c.card.imageUrlLarge || c.card.imageUrl);
                            }}
                            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#f8fafc';
                              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                              setHoveredCardImg(null);
                            }}
                          >
                            {c.card.name}
                          </span>{' '}
                          {isFoil && <Sparkles size={12} className="inline text-amber-400" />}
                        </td>

                        <td style={{ padding: '10px 16px' }}>
                          <ManaCostRenderer manaCost={c.card.manaCost} />
                        </td>

                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>
                          {c.card.typeLine}
                        </td>

                        <td style={{ padding: '10px 16px', color: '#64748b' }}>
                          {c.card.setCode}
                        </td>

                        <td style={{ padding: '10px 16px' }}>
                          <span className={`badge badge-rarity-${c.card.rarity.toLowerCase()}`}>
                            {c.card.rarity}
                          </span>
                        </td>

                        <td style={{ padding: '10px 16px', color: '#10b981' }}>
                          {c.card.priceUsd ? `$${(c.card.priceUsd * c.quantity).toFixed(2)}` : '—'}
                        </td>

                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ padding: '4px' }}
                              onClick={() => onOpenArtSelector(c.card, deck.cards.indexOf(c))}
                              title="Trocar Arte"
                            >
                              <ImageIcon size={15} />
                            </button>
                            {onAddToProxies && (
                              <button
                                className="btn btn-ghost btn-icon"
                                style={{ padding: '4px' }}
                                onClick={() => onAddToProxies(c.card, c.quantity)}
                                title="Imprimir Proxies desta Carta"
                              >
                                <Printer size={15} />
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-icon text-red-400"
                              style={{ padding: '4px' }}
                              onClick={() => handleRemoveCard(c.card.id)}
                              title="Remover do Deck"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cards-grid">
              {sortedSideCards.map((c, idx) => {
                const isFoil = c.isFoil || c.card.isFoil;
                return (
                  <div key={`side-grid-${c.card.id}-${idx}`} className="card-item-container">
                    <div className={`card-image-wrapper ${isFoil ? 'foil-sheen' : ''}`}>
                      <CardImage
                        name={c.card.name}
                        imageUrl={c.card.imageUrl}
                        imageUrlLarge={c.card.imageUrlLarge}
                        setCode={c.card.setCode}
                        collectorNumber={c.card.collectorNumber}
                        preferLarge
                        className="card-image"
                      />
                      {isFoil && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            background: 'linear-gradient(135deg, rgba(255,187,0,0.9), rgba(217,119,6,0.9))',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          }}
                        >
                          <Sparkles size={11} /> FOIL
                        </div>
                      )}
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
                        {c.quantity}x
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Card Image Tooltip (Triggered strictly on card name hover) */}
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
