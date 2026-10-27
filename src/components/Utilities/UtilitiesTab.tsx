import React, { useState, useEffect, useRef } from 'react';
import { TokenCard, UtilityCategory, Card, CardPrint } from '../../types';
import { searchUtilityCards } from '../../services/scryfall';
import { CardImage } from '../Common/CardImage';
import { ArtSelectorModal } from '../Modals/ArtSelectorModal';
import {
  Search,
  Loader2,
  Sparkles,
  Printer,
  Check,
  Image as ImageIcon,
  Coins,
  Compass,
  Shield,
  Map,
  Crown,
  Flame,
  Eye,
  Cog,
} from 'lucide-react';

interface UtilitiesTabProps {
  onAddUtilityToProxies: (item: TokenCard, quantity: number) => void;
}

interface CategoryOption {
  id: UtilityCategory;
  label: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
}

const UTILITY_CATEGORIES: CategoryOption[] = [
  {
    id: 'tokens',
    label: 'Fichas / Tokens',
    description: 'Fichas de criaturas e artefatos (Tesouro, Comida, Pista, Zumbi, Soldado, Cópia, etc.)',
    placeholder: 'Buscar ficha em inglês (ex: Treasure, Zombie, Soldier, Angel, Copy, Dragon)...',
    icon: <Coins size={15} />,
  },
  {
    id: 'planes',
    label: 'Planos (Planechase)',
    description: 'Cartas de Plano (t:plane) e Fenômenos (t:phenomenon) para partidas de Planechase',
    placeholder: 'Buscar plano ou plano-alvo (ex: Dominaria, Ravnica, Zendikar, Bolas, Phenomenon)...',
    icon: <Compass size={15} />,
  },
  {
    id: 'emblems',
    label: 'Emblemas',
    description: 'Emblemas oficiais gerados por Planeswalkers e outras cartas (t:emblem)',
    placeholder: 'Buscar emblema por Planeswalker (ex: Teferi, Chandra, Liliana, Elspeth, Wrenn)...',
    icon: <Shield size={15} />,
  },
  {
    id: 'markers',
    label: 'Marcadores & Auxiliares',
    description: 'Monarca, Iniciativa, Dia/Noite, O Anel, Bênção da Cidade, Veneno, Energia, Foretell, Plot e Morph',
    placeholder: 'Filtrar marcador (ex: Monarch, Ring, Initiative, Day, Poison, Foretell)...',
    icon: <Crown size={15} />,
  },
  {
    id: 'dungeons',
    label: 'Masmorras (Dungeons)',
    description: 'Masmorras oficiais de Forgotten Realms, Baldur’s Gate e Undercity (t:dungeon)',
    placeholder: 'Buscar masmorra (ex: Undercity, Tomb of Annihilation, Phandelver)...',
    icon: <Map size={15} />,
  },
  {
    id: 'schemes',
    label: 'Archenemy (Schemes)',
    description: 'Cartas de Esquema para partidas de Archenemy / Nicol Bolas / Duskmourn (t:scheme)',
    placeholder: 'Buscar scheme (ex: Ongoing, Bolas, Behold, Evil)...',
    icon: <Flame size={15} />,
  },
  {
    id: 'conspiracies',
    label: 'Conspirações',
    description: 'Cartas especiais da zona de comando para formatos Conspiracy / Cube (t:conspiracy)',
    placeholder: 'Buscar conspiração (ex: Sovereign, Hymn, Power Play)...',
    icon: <Eye size={15} />,
  },
  {
    id: 'attractions',
    label: 'Atrações & Engenhocas',
    description: 'Decks extras de Atrações (Unfinity) e Contraptions (Unstable)',
    placeholder: 'Buscar atração ou engenhoca (ex: Ferris, Bumper, Roller)...',
    icon: <Cog size={15} />,
  },
];

const POPULAR_TOKEN_CHIPS = [
  { label: 'Populares', query: '__POPULAR_TOKENS__' },
  { label: 'Todos (A–Z)', query: '' },
  { label: 'Tesouro', query: '!"Treasure"' },
  { label: 'Comida', query: '!"Food"' },
  { label: 'Pista', query: '!"Clue"' },
  { label: 'Sangue', query: '!"Blood"' },
  { label: 'Mapa', query: '!"Map"' },
  { label: 'Zumbi', query: '!"Zombie"' },
  { label: 'Soldado', query: '!"Soldier"' },
  { label: 'Goblin', query: '!"Goblin"' },
  { label: 'Espírito', query: '!"Spirit"' },
  { label: 'Anjo', query: '!"Angel"' },
  { label: 'Dragão', query: '!"Dragon"' },
  { label: 'Fera', query: '!"Beast"' },
  { label: 'Tóptero', query: '!"Thopter"' },
  { label: 'Cópia', query: '!"Copy"' },
];

export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({ onAddUtilityToProxies }) => {
  const [category, setCategory] = useState<UtilityCategory>('tokens');
  const [items, setItems] = useState<TokenCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChipQuery, setSelectedChipQuery] = useState('__POPULAR_TOKENS__');
  const [selectedColor, setSelectedColor] = useState('all');
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  // Alternative Art Selector state for utility cards
  const [artTargetIndex, setArtTargetIndex] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const activeCategoryMeta =
    UTILITY_CATEGORIES.find((c) => c.id === category) || UTILITY_CATEGORIES[0];

  useEffect(() => {
    const effectiveQuery =
      searchQuery.trim() !== ''
        ? searchQuery
        : category === 'tokens'
          ? selectedChipQuery
          : '';
    fetchUtilityData(category, effectiveQuery, category === 'tokens' ? selectedColor : 'all');
  }, [category, selectedChipQuery, selectedColor]);

  const fetchUtilityData = async (cat: UtilityCategory, query: string, color: string) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const results = await searchUtilityCards(cat, query, color);
      if (reqId === requestIdRef.current) {
        setItems(results);
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleCategoryChange = (nextCategory: UtilityCategory) => {
    setCategory(nextCategory);
    setSearchQuery('');
    setSelectedColor('all');
    if (nextCategory === 'tokens') {
      setSelectedChipQuery('__POPULAR_TOKENS__');
    } else {
      setSelectedChipQuery('');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category === 'tokens' && searchQuery.trim()) {
      setSelectedChipQuery('');
    }
    const effectiveQuery =
      searchQuery.trim() !== ''
        ? searchQuery
        : category === 'tokens'
          ? selectedChipQuery
          : '';
    fetchUtilityData(category, effectiveQuery, category === 'tokens' ? selectedColor : 'all');
  };

  const handleAdd = (item: TokenCard, qty: number = 1) => {
    onAddUtilityToProxies(item, qty);
    setAddedMap((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [item.id]: false }));
    }, 1200);
  };

  const artModalCard: Card | null =
    artTargetIndex !== null && items[artTargetIndex]
      ? {
          id: items[artTargetIndex].id,
          oracleId: items[artTargetIndex].oracleId,
          printsSearchUri: items[artTargetIndex].printsSearchUri,
          name: items[artTargetIndex].name,
          cmc: 0,
          typeLine: items[artTargetIndex].typeLine,
          oracleText: items[artTargetIndex].oracleText,
          colors: items[artTargetIndex].colors,
          colorIdentity: items[artTargetIndex].colors,
          power: items[artTargetIndex].power,
          toughness: items[artTargetIndex].toughness,
          rarity: 'common',
          setName: items[artTargetIndex].setName,
          setCode: items[artTargetIndex].setCode,
          collectorNumber: items[artTargetIndex].collectorNumber,
          imageUrl: items[artTargetIndex].imageUrl,
          imageUrlLarge: items[artTargetIndex].imageUrlLarge,
        }
      : null;

  const handleSelectUtilityPrint = (selectedPrint: CardPrint) => {
    if (artTargetIndex === null) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === artTargetIndex
          ? {
              ...item,
              id: selectedPrint.id,
              oracleId: selectedPrint.oracleId || item.oracleId,
              printsSearchUri: selectedPrint.printsSearchUri || item.printsSearchUri,
              setCode: selectedPrint.setCode,
              setName: selectedPrint.setName,
              collectorNumber: selectedPrint.collectorNumber,
              imageUrl: selectedPrint.imageUrl,
              imageUrlLarge: selectedPrint.imageUrlLarge || selectedPrint.imageUrl,
            }
          : item
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header, Category Tabs, and Search Filters */}
      <div className="glass-panel" style={{ padding: '22px' }}>
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
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Sparkles className="text-amber-400" size={24} />
              Central de Utilitários de Magic: The Gathering
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Explore fichas (tokens), planos de Planechase, emblemas, masmorras, marcadores oficiais e escolha artes alternativas para imprimir proxies A4.
            </p>
          </div>
        </div>

        {/* Utility Category Tabs */}
        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {UTILITY_CATEGORIES.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleCategoryChange(cat.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {cat.icon}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Active Category Description + Search Bar */}
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 500 }}>
            {activeCategoryMeta.description}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flex: '1 1 320px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={17}
                  style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }}
                />
                <input
                  type="text"
                  className="input-text"
                  placeholder={activeCategoryMeta.placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                <Search size={16} /> Buscar
              </button>
            </form>

            {/* Color Filter for Tokens */}
            {category === 'tokens' && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedColor === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedColor('all')}
                >
                  Todas
                </button>
                {(['W', 'U', 'B', 'R', 'G'] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`btn btn-sm ${selectedColor === col ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedColor(col)}
                    title={`Filtrar cor ${col}`}
                  >
                    <span className={`mana-pip mana-pip-${col}`}>{col}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn btn-sm ${selectedColor === 'C' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedColor('C')}
                >
                  Incolor
                </button>
              </div>
            )}
          </div>

          {/* Quick Token Chips when in Tokens category */}
          {category === 'tokens' && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {POPULAR_TOKEN_CHIPS.map((chip) => {
                const isActive = !searchQuery.trim() && selectedChipQuery === chip.query;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedChipQuery(chip.query);
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Loader2 className="animate-spin text-indigo-400" size={36} />
          <span>Carregando utilitários oficiais do Scryfall...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          Nenhum item encontrado para esta busca. Experimente termos em inglês (ex: "Treasure", "Dominaria", "Teferi", "Monarch").
        </div>
      ) : (
        <div className="cards-grid">
          {items.map((item, idx) => {
            const isAdded = !!addedMap[item.id];
            return (
              <div key={`${item.id}-${idx}`} className="card-item-container">
                <div className="card-image-wrapper">
                  <CardImage
                    name={item.name}
                    imageUrl={item.imageUrl}
                    imageUrlLarge={item.imageUrlLarge}
                    setCode={item.setCode}
                    collectorNumber={item.collectorNumber}
                    preferLarge
                    className="card-image"
                  />
                </div>

                <div
                  style={{
                    padding: '12px',
                    background: '#0e131d',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.typeLine}
                    >
                      {item.typeLine}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={`${item.setName} (${item.setCode}) #${item.collectorNumber}`}
                    >
                      {item.setCode} • #{item.collectorNumber}
                    </span>
                    {item.power && item.toughness && (
                      <span style={{ fontWeight: 700, color: '#f8fafc', flexShrink: 0 }}>
                        {item.power}/{item.toughness}
                      </span>
                    )}
                  </div>

                  {/* Alternative Art Selector + Add to Proxies Buttons */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '6px',
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setArtTargetIndex(idx)}
                      title="Escolher arte alternativa / edição desta ficha ou utilitário"
                      style={{ padding: '6px 10px', flexShrink: 0 }}
                    >
                      <ImageIcon size={14} /> Artes
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ flex: 1 }}
                      onClick={() => handleAdd(item, 1)}
                    >
                      {isAdded ? (
                        <>
                          <Check size={14} className="text-emerald-400" /> Na Fila!
                        </>
                      ) : (
                        <>
                          <Printer size={14} /> + Proxy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alternative Art Selector Modal for Utilities & Tokens */}
      <ArtSelectorModal
        isOpen={artTargetIndex !== null}
        card={artModalCard}
        onClose={() => setArtTargetIndex(null)}
        onSelectPrint={handleSelectUtilityPrint}
      />
    </div>
  );
};
