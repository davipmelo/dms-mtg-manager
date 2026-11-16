import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { TokenCard, UtilityCategory, Card, CardPrint } from '../../types';
import { searchUtilityCards } from '../../services/scryfall';
import { getUiSettings, saveUiSettings } from '../../services/storage';
import { CardImage } from '../Common/CardImage';
import { CardHoverPreview, CardHoverPreviewData } from '../Common/CardHoverPreview';
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
  EyeOff,
  Cog,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  List,
  X,
  Check as CheckIcon,
} from 'lucide-react';

const ArtSelectorModal = lazy(() => import('../Modals/ArtSelectorModal').then((m) => ({ default: m.ArtSelectorModal })));

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
    label: 'Fichas',
    description: 'Fichas de criaturas e artefatos (Tesouro, Comida, Pista, Zumbi, Soldado, etc.)',
    placeholder: 'Buscar ficha (ex: Treasure, Zombie, Soldier, Angel, Copy, Dragon)...',
    icon: <Coins size={15} />,
  },
  {
    id: 'planes',
    label: 'Planos',
    description: 'Cartas de Planos e Fenômenos para partidas de Planechase',
    placeholder: 'Buscar plano (ex: Dominaria, Ravnica, Zendikar, Bolas, Phenomenon)...',
    icon: <Compass size={15} />,
  },
  {
    id: 'emblems',
    label: 'Emblemas',
    description: 'Emblemas oficiais gerados por Planeswalkers e outras fontes',
    placeholder: 'Buscar emblema por Planeswalker (ex: Teferi, Chandra, Liliana, Elspeth, Wrenn)...',
    icon: <Shield size={15} />,
  },
  {
    id: 'markers',
    label: 'Marcadores',
    description: 'Monarca, Iniciativa, Dia/Noite, O Anel, Bênção da Cidade, Veneno, Energia e Marcadores',
    placeholder: 'Filtrar marcador (ex: Monarch, Ring, Initiative, Day, Poison, Foretell)...',
    icon: <Crown size={15} />,
  },
  {
    id: 'dungeons',
    label: 'Masmorras',
    description: 'Masmorras oficiais (Undercity, Tumba da Aniquilação, Mina de Phandelver, etc.)',
    placeholder: 'Buscar masmorra (ex: Undercity, Tomb of Annihilation, Phandelver)...',
    icon: <Map size={15} />,
  },
  {
    id: 'schemes',
    label: 'Esquemas',
    description: 'Cartas de Esquemas para partidas de Archenemy',
    placeholder: 'Buscar esquema (ex: Ongoing, Bolas, Behold, Evil)...',
    icon: <Flame size={15} />,
  },
  {
    id: 'conspiracies',
    label: 'Conspirações',
    description: 'Cartas especiais da zona de comando para Conspiração e Cubo',
    placeholder: 'Buscar conspiração (ex: Sovereign, Hymn, Power Play)...',
    icon: <Eye size={15} />,
  },
  {
    id: 'attractions',
    label: 'Atrações',
    description: 'Atrações de Unfinity e Engenhocas de Unstable',
    placeholder: 'Buscar atração ou engenhoca (ex: Ferris, Bumper, Roller)...',
    icon: <Cog size={15} />,
  },
];

const POPULAR_TOKEN_CHIPS = [
  { label: 'Todos (A–Z)', query: '' },
  { label: 'Populares', query: '__POPULAR_TOKENS__' },
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
  { label: 'Encantamento', query: 't:enchantment' },
];

interface UtilityCardItemProps {
  item: TokenCard;
  isAdded: boolean;
  showGridDetails: boolean;
  gridCardSize: number;
  onHoverStart: (e: React.MouseEvent, item: TokenCard) => void;
  onHoverMove: (e: React.MouseEvent) => void;
  onHoverEnd: () => void;
  onSelectArt: (itemId: string) => void;
  onAddProxy: (item: TokenCard) => void;
}

const UtilityCardItem = React.memo<UtilityCardItemProps>(({
  item,
  isAdded,
  showGridDetails,
  gridCardSize,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  onSelectArt,
  onAddProxy,
}) => {
  return (
    <div
      className="card-item-container"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `${gridCardSize}px ${Math.round(gridCardSize * 1.45)}px`,
      }}
    >
      <div
        className="card-image-wrapper"
        onMouseEnter={(e) => onHoverStart(e, item)}
        onMouseMove={onHoverMove}
        onMouseLeave={onHoverEnd}
      >
        <CardImage
          name={item.name}
          imageUrl={item.imageUrl}
          imageUrlLarge={item.imageUrlLarge}
          setCode={item.setCode}
          collectorNumber={item.collectorNumber}
          className="card-image"
        />

        {/* Floating quick actions on Art-Only mode */}
        {!showGridDetails && (
          <div className="card-art-actions-overlay">
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              style={{ background: 'rgba(14, 14, 16, 0.9)' }}
              onClick={(e) => {
                e.stopPropagation();
                onHoverEnd();
                onSelectArt(item.id);
              }}
              title="Escolher Arte Alternativa"
            >
              <ImageIcon size={15} />
            </button>
            <button
              type="button"
              className={`btn btn-icon ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
              style={{ background: isAdded ? 'rgba(16, 185, 129, 0.9)' : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                onHoverEnd();
                onAddProxy(item);
              }}
              title="Adicionar à Fila de Impressão"
            >
              {isAdded ? <Check size={15} /> : <Printer size={15} />}
            </button>
          </div>
        )}
      </div>

      {/* Card Details Footer (Hidden in Art-Only mode) */}
      {showGridDetails && (
        <div
          style={{
            padding: '12px',
            background: '#111113',
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
                color: '#f4f4f5',
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
                color: '#a1a1aa',
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
              color: '#71717a',
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
              <span style={{ fontWeight: 700, color: '#f4f4f5', flexShrink: 0 }}>
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
              onClick={() => onSelectArt(item.id)}
              title="Escolher arte alternativa / edição desta ficha ou utilitário"
              style={{ padding: '6px 10px', flexShrink: 0 }}
            >
              <ImageIcon size={14} /> Artes
            </button>

            <button
              type="button"
              className={`btn btn-sm ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
              style={{ flex: 1 }}
              onClick={() => onAddProxy(item)}
            >
              {isAdded ? (
                <>
                  <Check size={14} className="text-emerald-400" /> Na fila
                </>
              ) : (
                <>
                  <Printer size={14} /> Imprimir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({ onAddUtilityToProxies }) => {
  const [category, setCategory] = useState<UtilityCategory>('tokens');
  const [items, setItems] = useState<TokenCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreamingMore, setIsStreamingMore] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChipQuery, setSelectedChipQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isMultiOnly, setIsMultiOnly] = useState(false);
  const [isColorlessOnly, setIsColorlessOnly] = useState(false);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const [hoveredPreview, setHoveredPreview] = useState<CardHoverPreviewData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Alternative Art Selector state for utility cards
  const [artTargetIndex, setArtTargetIndex] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('dms_utilities_view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('dms_utilities_view', mode);
    } catch {
      // ignore
    }
  };

  // Seleção em lote na lista (Shift seleciona intervalo)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);

  const [gridCardSize, setGridCardSize] = useState<number>(() => getUiSettings().gridCardSize);
  const [showGridDetails, setShowGridDetails] = useState<boolean>(() => getUiSettings().gridShowDetails);

  useEffect(() => {
    const handleCloudUiSync = () => {
      const next = getUiSettings();
      setGridCardSize(next.gridCardSize);
      setShowGridDetails(next.gridShowDetails);
    };
    window.addEventListener('proliferate:ui-settings-cloud', handleCloudUiSync);
    return () => window.removeEventListener('proliferate:ui-settings-cloud', handleCloudUiSync);
  }, []);

  const handleGridCardSizeChange = (val: number) => {
    const clamped = Math.min(340, Math.max(110, val));
    setGridCardSize(clamped);
    saveUiSettings({ gridCardSize: clamped });
  };

  const handleToggleGridDetails = () => {
    setShowGridDetails((prev) => {
      const next = !prev;
      saveUiSettings({ gridShowDetails: next });
      return next;
    });
  };

  const activeCategoryMeta =
    UTILITY_CATEGORIES.find((c) => c.id === category) || UTILITY_CATEGORIES[0];

  const getColorQuery = () => {
    if (isColorlessOnly) return 'c:c';
    if (isMultiOnly) {
      if (selectedColors.length > 0) {
        return `c:m c<=${selectedColors.map((c) => c.toLowerCase()).join('')}`;
      }
      return 'c:m';
    }
    if (selectedColors.length === 1) {
      return `c=${selectedColors[0].toLowerCase()}`;
    }
    if (selectedColors.length > 1) {
      return `c<=${selectedColors.map((c) => c.toLowerCase()).join('')} c>=${selectedColors.map((c) => c.toLowerCase()).join('')}`;
    }
    return 'all';
  };

  useEffect(() => {
    const effectiveQuery =
      searchQuery.trim() !== ''
        ? searchQuery
        : category === 'tokens'
          ? selectedChipQuery
          : '';
    fetchUtilityData(category, effectiveQuery, category === 'tokens' ? getColorQuery() : 'all');

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [category, selectedChipQuery, selectedColors, isMultiOnly, isColorlessOnly]);

  const fetchUtilityData = async (cat: UtilityCategory, query: string, color: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setIsStreamingMore(false);
    setVisibleLimit(60);

    try {
      const results = await searchUtilityCards(cat, query, color, {
        signal: controller.signal,
        onProgress: (partialItems, isComplete) => {
          if (reqId !== requestIdRef.current || controller.signal.aborted) return;
          setItems(partialItems);
          setLoading(false);
          setIsStreamingMore(!isComplete);
        },
      });
      if (reqId === requestIdRef.current && !controller.signal.aborted) {
        setItems(results);
        setIsStreamingMore(false);
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setIsStreamingMore(false);
      }
    }
  };

  // Instant client-side filtering when typing in the search bar (while Enter submits full Scryfall search)
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    // If user typed Scryfall syntax (like t:, o:, c:, !), don't filter client-side with literal substring
    if (q.includes(':') || q.startsWith('!')) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.typeLine && item.typeLine.toLowerCase().includes(q)) ||
        (item.setName && item.setName.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  // Automatic infinite scroll for remaining chunks
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || visibleLimit >= filteredItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleLimit((prev) => Math.min(prev + 60, filteredItems.length));
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleLimit, filteredItems.length]);

  const handleCategoryChange = (nextCategory: UtilityCategory) => {
    setCategory(nextCategory);
    setSelectedIds(new Set());
    setSearchQuery('');
    setSelectedColors([]);
    setIsMultiOnly(false);
    setIsColorlessOnly(false);
    setSelectedChipQuery('');
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
    fetchUtilityData(category, effectiveQuery, category === 'tokens' ? getColorQuery() : 'all');
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

  const handleAdd = useCallback((item: TokenCard, qty: number = 1) => {
    onAddUtilityToProxies(item, qty);
    setAddedMap((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [item.id]: false }));
    }, 1200);
  }, [onAddUtilityToProxies]);

  const handleHoverStart = useCallback((e: React.MouseEvent, item: TokenCard) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setHoveredPreview({
      url: item.imageUrlLarge || item.imageUrl,
      title: item.name,
      subtitle: `${item.typeLine || ''}${item.setName ? ` (${item.setName})` : ''}`,
    });
  }, []);

  const handleHoverMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredPreview(null);
  }, []);

  const handleToggleSelect = (id: string, shiftKey: boolean) => {
    const anchor = lastSelectedRef.current;
    lastSelectedRef.current = id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const willSelect = !prev.has(id);
      if (shiftKey && anchor && anchor !== id) {
        const ids = visibleItems.map((i) => i.id);
        const a = ids.indexOf(anchor);
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

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));
  const someVisibleSelected = visibleItems.some((i) => selectedIds.has(i.id));

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleItems.forEach((i) => next.delete(i.id));
      else visibleItems.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const handleAddSelected = () => {
    const chosen = items.filter((i) => selectedIds.has(i.id));
    chosen.forEach((item) => onAddUtilityToProxies(item, 1));
    setAddedMap((prev) => {
      const next = { ...prev };
      chosen.forEach((i) => (next[i.id] = true));
      return next;
    });
    setTimeout(() => {
      setAddedMap((prev) => {
        const next = { ...prev };
        chosen.forEach((i) => (next[i.id] = false));
        return next;
      });
    }, 1200);
    setSelectedIds(new Set());
  };

  const handleSelectArt = useCallback((itemId: string) => {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      setArtTargetIndex(idx);
    }
  }, [items]);

  const handleAddProxySingle = useCallback((item: TokenCard) => {
    handleAdd(item, 1);
  }, [handleAdd]);

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
          layout: 'token',
        }
      : null;

  const handleSelectUtilityPrint = (selectedPrint: CardPrint, targetFace: 'front' | 'back' = 'front') => {
    if (artTargetIndex === null) return;
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== artTargetIndex) return item;
        const isDfc = Boolean((item.cardFaces && item.cardFaces.length >= 2) || item.name.includes(' // '));
        if (isDfc && targetFace === 'back') {
          const baseFaces = item.cardFaces || [
            { name: item.name.split(' // ')[0].trim(), imageUrl: item.imageUrl },
            { name: item.name.includes(' // ') ? item.name.split(' // ')[1].trim() : `${item.name} (Verso)`, imageUrl: item.imageUrl },
          ];
          const updatedFaces = [
            baseFaces[0],
            {
              ...baseFaces[1],
              imageUrl: selectedPrint.imageUrl,
              imageUrlLarge: selectedPrint.imageUrlLarge || selectedPrint.imageUrl,
              artist: selectedPrint.artist,
            },
          ];
          return {
            ...item,
            cardFaces: updatedFaces,
          };
        } else {
          return {
            ...item,
            id: selectedPrint.id,
            oracleId: selectedPrint.oracleId || item.oracleId,
            printsSearchUri: selectedPrint.printsSearchUri || item.printsSearchUri,
            setCode: selectedPrint.setCode,
            setName: selectedPrint.setName,
            collectorNumber: selectedPrint.collectorNumber,
            imageUrl: selectedPrint.imageUrl,
            imageUrlLarge: selectedPrint.imageUrlLarge || selectedPrint.imageUrl,
            cardFaces: selectedPrint.cardFaces || item.cardFaces,
          };
        }
      })
    );
  };

  const noColorFilter = !isColorlessOnly && !isMultiOnly && selectedColors.length === 0;
  const hasActiveFilters = !noColorFilter || searchQuery.trim() !== '' || (category === 'tokens' && selectedChipQuery !== '');

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedChipQuery('');
    handleResetColors();
  };

  return (
    <div className="util-page">
      {/* Cabeçalho + categorias */}
      <div className="glass-panel page-header-panel util-header">
        <span className="section-eyebrow"><Sparkles size={12} /> Tokens, emblemas & mais</span>
        <h2 className="page-title">Utilitários</h2>
        <p className="page-subtitle">{activeCategoryMeta.description}</p>

        <div className="util-cats" role="tablist" aria-label="Categorias de utilitários">
          {UTILITY_CATEGORIES.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`util-cat ${isActive ? 'is-active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Busca, cores e visualização */}
      <div className="util-toolbar">
        <form onSubmit={handleSearchSubmit} className="util-search">
          <Search size={16} className="util-search-icon" />
          <input
            type="text"
            className="input-text"
            placeholder={activeCategoryMeta.placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar utilitários"
          />
          {searchQuery && (
            <button type="button" className="util-search-clear" onClick={() => setSearchQuery('')} title="Limpar busca" aria-label="Limpar busca">
              <X size={15} />
            </button>
          )}
        </form>

        {category === 'tokens' && (
          <div className="util-colors" role="group" aria-label="Filtrar por cor">
            {(['W', 'U', 'B', 'R', 'G'] as const).map((col) => {
              const isSelected = selectedColors.includes(col);
              return (
                <button
                  key={col}
                  type="button"
                  className={`util-color ${isSelected ? 'is-active' : ''}`}
                  onClick={() => handleToggleColor(col)}
                  title={`Filtrar cor ${col}`}
                  aria-pressed={isSelected}
                >
                  <span className={`mana-pip mana-pip-${col}`}>{col}</span>
                </button>
              );
            })}
            <button type="button" className={`util-color-text ${isMultiOnly ? 'is-active' : ''}`} onClick={handleToggleMulti} aria-pressed={isMultiOnly}>
              Multi
            </button>
            <button type="button" className={`util-color-text ${isColorlessOnly ? 'is-active' : ''}`} onClick={handleToggleColorless} aria-pressed={isColorlessOnly}>
              Incolor
            </button>
          </div>
        )}

        <div className="util-view-controls">
          {viewMode === 'grid' && (
            <>
              <button
                type="button"
                className={`util-icon-toggle ${!showGridDetails ? 'is-active' : ''}`}
                onClick={handleToggleGridDetails}
                title={showGridDetails ? 'Mostrar apenas as artes' : 'Mostrar detalhes'}
                aria-pressed={!showGridDetails}
              >
                {showGridDetails ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <div className="util-zoom" title={`Escala da grade (${gridCardSize}px)`}>
                <ZoomOut size={13} />
                <input
                  type="range"
                  min={110}
                  max={340}
                  step={10}
                  value={gridCardSize}
                  onChange={(e) => handleGridCardSizeChange(Number(e.target.value))}
                  aria-label="Tamanho dos cards"
                />
                <ZoomIn size={13} />
              </div>
            </>
          )}
          <div className="view-toggle" role="radiogroup" aria-label="Modo de visualização">
            <button type="button" role="radio" aria-checked={viewMode === 'grid'} className={`view-toggle-btn ${viewMode === 'grid' ? 'is-active' : ''}`} onClick={() => changeViewMode('grid')} title="Visualizar em grade" aria-label="Visualizar em grade">
              <LayoutGrid size={16} />
            </button>
            <button type="button" role="radio" aria-checked={viewMode === 'list'} className={`view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`} onClick={() => changeViewMode('list')} title="Visualizar em lista" aria-label="Visualizar em lista">
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Atalhos de fichas */}
      {category === 'tokens' && (
        <div className="util-chips" role="group" aria-label="Atalhos de fichas">
          {POPULAR_TOKEN_CHIPS.map((chip) => {
            const isActive = !searchQuery.trim() && selectedChipQuery === chip.query;
            return (
              <button
                key={chip.label}
                type="button"
                className={`chip ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setSearchQuery('');
                  setSelectedChipQuery(chip.query);
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Status */}
      <div className="util-status">
        {!loading && filteredItems.length > 0 && (
          <span>
            Exibindo <strong>{visibleItems.length}</strong> de <strong>{filteredItems.length}</strong>{' '}
            {filteredItems.length === 1 ? 'item' : 'itens'}
          </span>
        )}
        {isStreamingMore && (
          <span className="util-streaming">
            <Loader2 size={12} className="animate-spin" /> Carregando o restante…
          </span>
        )}
        {hasActiveFilters && (
          <button type="button" className="util-clear" onClick={clearAllFilters}>
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="util-empty">
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
          <span>Carregando do Scryfall…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="util-empty">
          <Search size={28} />
          <strong>Nada encontrado</strong>
          <span>Tente termos em inglês (ex.: “Treasure”, “Dominaria”, “Teferi”, “Monarch”).</span>
          {hasActiveFilters && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="cards-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridCardSize}px, 1fr))` }}>
              {visibleItems.map((item) => (
                <UtilityCardItem
                  key={item.id}
                  item={item}
                  isAdded={!!addedMap[item.id]}
                  showGridDetails={showGridDetails}
                  gridCardSize={gridCardSize}
                  onHoverStart={handleHoverStart}
                  onHoverMove={handleHoverMove}
                  onHoverEnd={handleHoverEnd}
                  onSelectArt={handleSelectArt}
                  onAddProxy={handleAddProxySingle}
                />
              ))}
            </div>
          ) : (
            <>
            {selectedIds.size > 0 && (
              <div className="select-bar">
                <span>
                  <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'selecionado' : 'selecionados'}
                </span>
                <span className="select-bar-spacer" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddSelected}>
                  <Printer size={14} /> Imprimir selecionados
                </button>
              </div>
            )}
            <div className="util-list">
              <div className="util-list-head">
                <span className="util-check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    title={allVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos os itens da lista'}
                  />
                </span>
                <span>Nome</span>
                <span className="hide-sm">Tipo</span>
                <span className="hide-sm">Edição</span>
                <span className="util-pt-col hide-sm">P/R</span>
                <span />
              </div>
              {visibleItems.map((item) => {
                const isAdded = !!addedMap[item.id];
                return (
                  <div key={item.id} className={`util-row ${selectedIds.has(item.id) ? 'is-selected' : ''}`}>
                    <span className="util-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => undefined}
                        onClick={(e) => handleToggleSelect(item.id, e.shiftKey)}
                        title="Segure Shift para selecionar um intervalo"
                      />
                    </span>
                    <span className="util-row-namecell">
                      <span
                        className="util-row-name"
                        onMouseEnter={(e) => handleHoverStart(e, item)}
                        onMouseMove={handleHoverMove}
                        onMouseLeave={handleHoverEnd}
                        title={item.name}
                      >
                        {item.name}
                        <span className="util-row-type-sm">{item.typeLine}</span>
                      </span>
                      <button
                        type="button"
                        className="row-art-btn"
                        onClick={() => {
                          handleHoverEnd();
                          handleSelectArt(item.id);
                        }}
                        title="Escolher arte alternativa"
                        aria-label={`Escolher arte alternativa de ${item.name}`}
                      >
                        <ImageIcon size={13} />
                      </button>
                    </span>
                    <span className="util-row-type hide-sm" title={item.typeLine}>{item.typeLine}</span>
                    <span className="util-row-set hide-sm" title={`${item.setName} #${item.collectorNumber}`}>
                      <span className="coll-setcode">{item.setCode.toUpperCase()}</span>
                      <span className="util-row-num">#{item.collectorNumber}</span>
                    </span>
                    <span className="util-pt-col util-row-pt hide-sm">{item.power && item.toughness ? `${item.power}/${item.toughness}` : ''}</span>
                    <span className="util-row-actions">
                      <button
                        type="button"
                        className={`btn btn-sm ${isAdded ? 'btn-ghost' : 'btn-secondary'}`}
                        onClick={() => {
                          handleHoverEnd();
                          handleAddProxySingle(item);
                        }}
                      >
                        {isAdded ? <CheckIcon size={14} className="text-emerald-400" /> : <Printer size={14} />}
                        <span className="util-add-label">{isAdded ? 'Na fila' : 'Imprimir'}</span>
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            </>
          )}

          {visibleLimit < filteredItems.length && (
            <div ref={loadMoreRef} className="util-more">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVisibleLimit((prev) => Math.min(prev + 60, filteredItems.length))}>
                Carregar mais ({filteredItems.length - visibleLimit} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating Card Zoom Preview */}
      <CardHoverPreview preview={hoveredPreview} mousePos={mousePos} />

      {/* Alternative Art Selector Modal for Utilities & Tokens */}
      {artTargetIndex !== null && (
        <Suspense fallback={null}>
          <ArtSelectorModal
            isOpen={artTargetIndex !== null}
            card={artModalCard}
            onClose={() => setArtTargetIndex(null)}
            onSelectPrint={handleSelectUtilityPrint}
          />
        </Suspense>
      )}
    </div>
  );
};
