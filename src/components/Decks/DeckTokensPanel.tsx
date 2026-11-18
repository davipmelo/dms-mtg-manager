import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Deck, DeckToken, TokenCard, Card, CardPrint, ViewMode, UtilityCategory, isDoubleFacedCard } from '../../types';
import { searchUtilityCards } from '../../services/scryfall';
import { CardImage } from '../Common/CardImage';
import { CardHoverPreview, CardHoverPreviewData } from '../Common/CardHoverPreview';
import {
  Coins,
  Plus,
  Minus,
  Trash2,
  Image as ImageIcon,
  Search,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Printer,
  RotateCw,
} from 'lucide-react';

const ArtSelectorModal = lazy(() =>
  import('../Modals/ArtSelectorModal').then((m) => ({ default: m.ArtSelectorModal }))
);

interface DeckTokensPanelProps {
  deck: Deck;
  onUpdateDeck: (updated: Deck) => void;
  onAddToProxies?: (card: TokenCard, quantity: number) => void;
  /** Segue o modo de visualização das cartas do deck (grade ou lista). */
  viewMode?: ViewMode;
  gridCardSize?: number;
  showGridDetails?: boolean;
}

/** Todas as categorias do menu Utilitários entram na busca do deck. */
const SEARCH_CATEGORIES: Array<{ id: UtilityCategory; label: string }> = [
  { id: 'tokens', label: 'Ficha' },
  { id: 'markers', label: 'Marcador' },
  { id: 'emblems', label: 'Emblema' },
  { id: 'dungeons', label: 'Masmorra' },
  { id: 'planes', label: 'Plano' },
  { id: 'schemes', label: 'Esquema' },
  { id: 'conspiracies', label: 'Conspiração' },
  { id: 'attractions', label: 'Atração' },
];

const toArtCard = (t: TokenCard): Card => ({
  id: t.id,
  oracleId: t.oracleId,
  printsSearchUri: t.printsSearchUri,
  name: t.name,
  cmc: 0,
  typeLine: t.typeLine,
  oracleText: t.oracleText,
  colors: t.colors,
  colorIdentity: t.colors,
  power: t.power,
  toughness: t.toughness,
  rarity: 'common',
  setName: t.setName,
  setCode: t.setCode,
  collectorNumber: t.collectorNumber,
  imageUrl: t.imageUrl,
  imageUrlLarge: t.imageUrlLarge,
  cardFaces: t.cardFaces,
  layout: t.layout || 'token',
});

/** Nome, imagens e legenda da face visível de uma ficha (frente ou verso). */
function tokenFace(t: TokenCard, flipped: boolean) {
  const frontName = t.cardFaces?.[0]?.name || t.name.split(' // ')[0].trim();
  const backName =
    t.cardFaces?.[1]?.name ||
    (t.name.includes(' // ') ? t.name.split(' // ')[1].trim() : `${t.name} (Verso)`);
  const imageUrl = flipped ? t.cardFaces?.[1]?.imageUrl || t.imageUrl : t.imageUrl;
  const imageUrlLarge = flipped
    ? t.cardFaces?.[1]?.imageUrlLarge || t.cardFaces?.[1]?.imageUrl || imageUrl
    : t.imageUrlLarge || imageUrl;
  return {
    name: flipped ? backName : frontName,
    typeLine: (flipped ? t.cardFaces?.[1]?.typeLine : t.cardFaces?.[0]?.typeLine) || t.typeLine,
    imageUrl,
    imageUrlLarge,
  };
}

function tokenSubtitle(t: TokenCard, flipped = false) {
  const set = t.setCode ? `${t.setName || ''} (${t.setCode.toUpperCase()} #${t.collectorNumber})` : t.setName;
  return `${t.typeLine || ''}${set ? ` • ${set}` : ''}${flipped ? ' • [Verso]' : ''}`;
}

export const DeckTokensPanel: React.FC<DeckTokensPanelProps> = ({
  deck,
  onUpdateDeck,
  onAddToProxies,
  viewMode = 'grid',
  gridCardSize = 180,
  showGridDetails = true,
}) => {
  const tokens = deck.tokens || [];
  const totalQty = tokens.reduce((s, t) => s + t.quantity, 0);

  const [collapsed, setCollapsed] = useState(tokens.length === 0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [artTarget, setArtTarget] = useState<{ id: string; face: 'front' | 'back' } | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [printedFlash, setPrintedFlash] = useState<Record<string, boolean>>({});

  // Preview ampliado ao passar o mouse (igual às demais áreas de cartas)
  const [hoveredPreview, setHoveredPreview] = useState<CardHoverPreviewData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const showPreview = useCallback((e: React.MouseEvent, t: TokenCard, isFlipped = false, badge?: string) => {
    const face = tokenFace(t, isFlipped);
    setMousePos({ x: e.clientX, y: e.clientY });
    setHoveredPreview({
      url: face.imageUrlLarge,
      title: face.name,
      subtitle: tokenSubtitle(t, isFlipped),
      badge,
      badgeColor: '#ffbb00',
    });
  }, []);
  const movePreview = useCallback((e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY }), []);
  const hidePreview = useCallback(() => setHoveredPreview(null), []);

  // Estado do seletor de fichas
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [results, setResults] = useState<TokenCard[]>([]);
  const [categoryById, setCategoryById] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({});
  const reqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const save = (next: DeckToken[]) => {
    onUpdateDeck({
      ...deck,
      tokens: next.length > 0 ? next : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  // Busca em todas as categorias: fichas (maior, em fluxo) e as demais em paralelo, uma de cada vez
  const runSearch = async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++reqRef.current;
    const isCurrent = () => reqId === reqRef.current && !controller.signal.aborted;

    const byCategory = new Map<UtilityCategory, TokenCard[]>();
    const publish = () => {
      if (!isCurrent()) return;
      const seen = new Set<string>();
      const merged: TokenCard[] = [];
      const cats: Record<string, string> = {};
      for (const { id, label } of SEARCH_CATEGORIES) {
        for (const item of byCategory.get(id) || []) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
          cats[item.id] = label;
        }
      }
      setResults(merged);
      setCategoryById(cats);
      if (merged.length > 0) setLoading(false);
    };

    setLoading(true);
    setLoadingMore(true);
    setResults([]);

    const fetchCategory = (cat: UtilityCategory) =>
      searchUtilityCards(cat, q, 'all', {
        signal: controller.signal,
        maxPages: 40,
        onProgress: (partial) => {
          byCategory.set(cat, partial);
          publish();
        },
      }).then((res) => {
        byCategory.set(cat, res);
        publish();
      });

    const others = SEARCH_CATEGORIES.filter((c) => c.id !== 'tokens');
    try {
      await Promise.all([
        fetchCategory('tokens'),
        (async () => {
          for (const c of others) {
            if (controller.signal.aborted) return;
            await fetchCategory(c.id);
          }
        })(),
      ]);
    } finally {
      if (reqId === reqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!isPickerOpen) return;
    runSearch(serverQuery);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPickerOpen, serverQuery]);

  useEffect(() => {
    if (!isPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !artTarget) setIsPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPickerOpen, artTarget]);

  const closePicker = () => {
    hidePreview();
    setIsPickerOpen(false);
  };

  const handleAdd = (token: TokenCard) => {
    const existing = tokens.find((t) => t.token.id === token.id);
    if (existing) {
      save(tokens.map((t) => (t.id === existing.id ? { ...t, quantity: t.quantity + 1 } : t)));
    } else {
      save([
        ...tokens,
        { id: `dt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, token, quantity: 1 },
      ]);
    }
    setCollapsed(false);
    setJustAdded((p) => ({ ...p, [token.id]: true }));
    setTimeout(() => setJustAdded((p) => ({ ...p, [token.id]: false })), 1200);
  };

  const handleQty = (id: string, delta: number) => {
    const next = tokens
      .map((t) => (t.id === id ? { ...t, quantity: t.quantity + delta } : t))
      .filter((t) => t.quantity > 0);
    save(next);
  };

  const handleRemove = (id: string) => {
    hidePreview();
    save(tokens.filter((t) => t.id !== id));
  };

  const handlePrint = (dt: DeckToken) => {
    if (!onAddToProxies) return;
    hidePreview();
    onAddToProxies(dt.token, dt.quantity);
    setPrintedFlash((p) => ({ ...p, [dt.id]: true }));
    setTimeout(() => setPrintedFlash((p) => ({ ...p, [dt.id]: false })), 1200);
  };

  const handlePrintAll = () => tokens.forEach(handlePrint);

  const toggleFlip = (id: string) => {
    hidePreview();
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openArt = (dt: DeckToken) => {
    hidePreview();
    setArtTarget({ id: dt.id, face: flipped.has(dt.id) ? 'back' : 'front' });
  };

  const artToken = useMemo(
    () => (artTarget ? tokens.find((t) => t.id === artTarget.id) || null : null),
    [tokens, artTarget]
  );

  const handleSelectPrint = (print: CardPrint, targetFace: 'front' | 'back' = 'front') => {
    if (!artTarget) return;
    save(
      tokens.map((dt) => {
        if (dt.id !== artTarget.id) return dt;
        const item = dt.token;
        const isDfc = Boolean(
          (item.cardFaces && item.cardFaces.length >= 2) || item.name.includes(' // ')
        );
        if (isDfc && targetFace === 'back') {
          const baseFaces = item.cardFaces || [
            { name: item.name.split(' // ')[0].trim(), imageUrl: item.imageUrl },
            {
              name: item.name.includes(' // ')
                ? item.name.split(' // ')[1].trim()
                : `${item.name} (Verso)`,
              imageUrl: item.imageUrl,
            },
          ];
          return {
            ...dt,
            token: {
              ...item,
              cardFaces: [
                baseFaces[0],
                {
                  ...baseFaces[1],
                  imageUrl: print.imageUrl,
                  imageUrlLarge: print.imageUrlLarge || print.imageUrl,
                  artist: print.artist,
                },
              ],
            },
          };
        }
        return {
          ...dt,
          token: {
            ...item,
            id: print.id,
            oracleId: print.oracleId || item.oracleId,
            printsSearchUri: print.printsSearchUri || item.printsSearchUri,
            setCode: print.setCode,
            setName: print.setName,
            collectorNumber: print.collectorNumber,
            imageUrl: print.imageUrl,
            imageUrlLarge: print.imageUrlLarge || print.imageUrl,
            artist: print.artist || item.artist,
            cardFaces: print.cardFaces || item.cardFaces,
          },
        };
      })
    );
  };

  const filteredResults = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0 || serverQuery) return results;
    return results.filter((r) => {
      const hay = `${r.name} ${r.typeLine || ''} ${r.setName || ''} ${categoryById[r.id] || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [results, query, serverQuery, categoryById]);

  const qtyInDeck = useMemo(() => {
    const map = new Map<string, number>();
    tokens.forEach((t) => map.set(t.token.id, (map.get(t.token.id) || 0) + t.quantity));
    return map;
  }, [tokens]);

  const renderQtyStepper = (dt: DeckToken) => (
    <span className="deck-token-stepper">
      <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => handleQty(dt.id, -1)} aria-label={`Diminuir ${dt.token.name}`}>
        <Minus size={13} />
      </button>
      <strong>{dt.quantity}</strong>
      <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => handleQty(dt.id, 1)} aria-label={`Aumentar ${dt.token.name}`}>
        <Plus size={13} />
      </button>
    </span>
  );

  const renderGrid = () => (
    <div className="cards-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridCardSize}px, 1fr))` }}>
      {tokens.map((dt) => {
        const t = dt.token;
        const isDfc = isDoubleFacedCard(t);
        const isFlipped = isDfc && flipped.has(dt.id);
        const face = tokenFace(t, isFlipped);
        const printed = !!printedFlash[dt.id];
        return (
          <div key={dt.id} className="card-item-container">
            <div
              className="card-image-wrapper"
              onMouseEnter={(e) => showPreview(e, t, isFlipped, 'Ficha')}
              onMouseMove={movePreview}
              onMouseLeave={hidePreview}
            >
              <CardImage
                name={face.name}
                imageUrl={face.imageUrl}
                imageUrlLarge={face.imageUrlLarge}
                setCode={t.setCode}
                collectorNumber={t.collectorNumber}
                face={isFlipped ? 'back' : 'front'}
                className="card-image"
              />
              <div className="deck-token-qty-badge">{dt.quantity}x</div>

              {isDfc && (
                <button
                  type="button"
                  className={`btn-flip-card ${isFlipped ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFlip(dt.id);
                  }}
                  title={isFlipped ? 'Virar para Frente' : 'Virar para o Verso'}
                >
                  <RotateCw size={12} style={{ transform: isFlipped ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                  <span>Virar</span>
                </button>
              )}

              {!showGridDetails && (
                <div className="card-art-actions-overlay">
                  <button type="button" className="btn btn-secondary btn-icon" onClick={(e) => { e.stopPropagation(); openArt(dt); }} title={isFlipped ? 'Trocar Arte do Verso' : 'Trocar Arte / Edição'}>
                    <ImageIcon size={15} />
                  </button>
                  {onAddToProxies && (
                    <button type="button" className="btn btn-secondary btn-icon" onClick={(e) => { e.stopPropagation(); handlePrint(dt); }} title="Imprimir Proxies">
                      {printed ? <Check size={15} /> : <Printer size={15} />}
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn-icon text-red-400" onClick={(e) => { e.stopPropagation(); handleRemove(dt.id); }} title="Remover do Deck">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>

            {showGridDetails && (
              <div className="deck-token-details">
                <div>
                  <div className="deck-token-name" title={face.name}>{face.name}</div>
                  <div className="deck-token-type" title={face.typeLine}>{face.typeLine}</div>
                </div>
                <div className="deck-token-meta">
                  <span title={`${t.setName} (${t.setCode}) #${t.collectorNumber}`}>
                    {t.setCode?.toUpperCase()} • #{t.collectorNumber}
                  </span>
                  {t.power && t.toughness && <strong>{t.power}/{t.toughness}</strong>}
                </div>
                <div className="deck-token-actions">
                  {renderQtyStepper(dt)}
                  <span className="deck-token-actions-right">
                    <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => openArt(dt)} title={isFlipped ? 'Trocar Arte do Verso' : 'Trocar arte (alters, personalizadas ou upload)'} aria-label={`Trocar arte de ${t.name}`}>
                      <ImageIcon size={13} />
                    </button>
                    {onAddToProxies && (
                      <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => handlePrint(dt)} title="Imprimir Proxies" aria-label={`Imprimir ${t.name}`}>
                        {printed ? <Check size={13} className="text-emerald-400" /> : <Printer size={13} />}
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-icon btn-xs" onClick={() => handleRemove(dt.id)} title="Remover do Deck" aria-label={`Remover ${t.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderList = () => (
    <div className="util-list">
      <div className="util-list-head deck-token-row">
        <span>Nome</span>
        <span className="hide-sm">Tipo</span>
        <span className="hide-sm">Edição</span>
        <span>Qtd.</span>
        <span />
      </div>
      {tokens.map((dt) => {
        const t = dt.token;
        const isDfc = isDoubleFacedCard(t);
        const isFlipped = isDfc && flipped.has(dt.id);
        const face = tokenFace(t, isFlipped);
        const printed = !!printedFlash[dt.id];
        return (
          <div key={dt.id} className="util-row deck-token-row">
            <span className="util-row-namecell">
              <span
                className="util-row-name"
                onMouseEnter={(e) => showPreview(e, t, isFlipped, 'Ficha')}
                onMouseMove={movePreview}
                onMouseLeave={hidePreview}
                title={face.name}
              >
                {face.name}
                <span className="util-row-type-sm">{face.typeLine}</span>
              </span>
              <button type="button" className="row-art-btn" onClick={() => openArt(dt)} title="Trocar arte" aria-label={`Trocar arte de ${t.name}`}>
                <ImageIcon size={13} />
              </button>
              {isDfc && (
                <button type="button" className="row-art-btn" onClick={() => toggleFlip(dt.id)} title={isFlipped ? 'Mostrar frente' : 'Mostrar verso'} aria-label="Virar ficha">
                  <RotateCw size={13} />
                </button>
              )}
            </span>
            <span className="util-row-type hide-sm" title={face.typeLine}>{face.typeLine}</span>
            <span className="util-row-set hide-sm" title={`${t.setName} #${t.collectorNumber}`}>
              <span className="coll-setcode">{t.setCode?.toUpperCase()}</span>
              <span className="util-row-num">#{t.collectorNumber}</span>
            </span>
            {renderQtyStepper(dt)}
            <span className="util-row-actions">
              {onAddToProxies && (
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => handlePrint(dt)} title="Imprimir Proxies" aria-label={`Imprimir ${t.name}`}>
                  {printed ? <Check size={14} className="text-emerald-400" /> : <Printer size={14} />}
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => handleRemove(dt.id)} title="Remover do Deck" aria-label={`Remover ${t.name}`}>
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="glass-panel deck-tokens-panel">
      <div className="deck-tokens-head">
        <button
          type="button"
          className="deck-tokens-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <Coins size={16} />
          <span className="deck-tokens-title">Fichas do deck</span>
          <span className="deck-tokens-count">{totalQty}</span>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <div className="deck-tokens-head-actions">
          {onAddToProxies && tokens.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrintAll} title="Adicionar todas as fichas à fila de impressão">
              <Printer size={14} /> <span className="hide-sm">Imprimir fichas</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPickerOpen(true)}>
            <Plus size={14} /> Adicionar ficha
          </button>
        </div>
      </div>

      {!collapsed &&
        (tokens.length === 0 ? (
          <p className="deck-tokens-empty">
            Nenhuma ficha neste deck. Elas serão impressas junto com as cartas quando você enviar o
            deck para os Proxies.
          </p>
        ) : viewMode === 'table' ? (
          renderList()
        ) : (
          renderGrid()
        ))}

      {isPickerOpen && (
        <div className="deck-token-picker-overlay" onClick={closePicker}>
          <div
            className="deck-token-picker"
            role="dialog"
            aria-label="Adicionar ficha ao deck"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="deck-token-picker-head">
              <strong>Adicionar ficha ou utilitário a “{deck.name}”</strong>
              <button type="button" className="btn btn-ghost btn-icon" onClick={closePicker} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <form
              className="util-search"
              onSubmit={(e) => {
                e.preventDefault();
                setServerQuery(query.trim());
              }}
            >
              <Search size={16} className="util-search-icon" />
              <input
                type="text"
                className="input-text"
                placeholder="Buscar fichas, marcadores, emblemas, planos, esquemas... (ex: Morph, Poison)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (serverQuery) setServerQuery('');
                }}
                autoFocus
              />
              {query && (
                <button type="button" className="util-search-clear" onClick={() => { setQuery(''); setServerQuery(''); }} title="Limpar busca" aria-label="Limpar busca">
                  <X size={15} />
                </button>
              )}
            </form>
            <div className="deck-token-picker-body" onScroll={hidePreview}>
              {loading ? (
                <div className="util-empty">
                  <Loader2 className="animate-spin" size={28} style={{ color: 'var(--primary)' }} />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="util-empty">
                  <strong>Nada encontrado</strong>
                  <span>Tente termos em inglês (ex.: “Treasure”, “Soldier”).</span>
                </div>
              ) : (
                <>
                  <div className="deck-token-picker-status">
                    {filteredResults.length > 400
                      ? `Mostrando 400 de ${filteredResults.length} resultados — refine a busca`
                      : `${filteredResults.length} ${filteredResults.length === 1 ? 'resultado' : 'resultados'}`}
                    {loadingMore && (
                      <span className="deck-token-picker-loading">
                        <Loader2 size={12} className="animate-spin" /> carregando mais categorias…
                      </span>
                    )}
                  </div>
                  <div className="deck-token-picker-grid">
                    {filteredResults.slice(0, 400).map((r) => {
                      const inDeck = qtyInDeck.get(r.id) || 0;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="deck-token-pick"
                          onClick={() => handleAdd(r)}
                          onMouseEnter={(e) =>
                            showPreview(e, r, false, inDeck ? `${inDeck}x no deck` : categoryById[r.id])
                          }
                          onMouseMove={movePreview}
                          onMouseLeave={hidePreview}
                          aria-label={`Adicionar ${r.name} ao deck`}
                        >
                          <span className="deck-token-pick-img">
                            <CardImage
                              name={r.name}
                              imageUrl={r.imageUrl}
                              imageUrlLarge={r.imageUrlLarge}
                              setCode={r.setCode}
                              collectorNumber={r.collectorNumber}
                              className="card-image"
                            />
                            {inDeck > 0 && <span className="deck-token-qty-badge">{inDeck}x</span>}
                          </span>
                          <span className="deck-token-pick-name">
                            {justAdded[r.id] ? <Check size={12} className="text-emerald-400" /> : null} {r.name}
                          </span>
                          {categoryById[r.id] && categoryById[r.id] !== 'Ficha' && (
                            <span className="deck-token-pick-cat">{categoryById[r.id]}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <CardHoverPreview preview={hoveredPreview} mousePos={mousePos} />

      {artToken && artTarget && (
        <Suspense fallback={null}>
          <ArtSelectorModal
            isOpen
            card={toArtCard(artToken.token)}
            initialFace={artTarget.face}
            onClose={() => setArtTarget(null)}
            onSelectPrint={handleSelectPrint}
          />
        </Suspense>
      )}
    </div>
  );
};
