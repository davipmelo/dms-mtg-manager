import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Deck, DeckToken, TokenCard, Card, CardPrint } from '../../types';
import { searchUtilityCards } from '../../services/scryfall';
import { CardImage } from '../Common/CardImage';
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
} from 'lucide-react';

const ArtSelectorModal = lazy(() =>
  import('../Modals/ArtSelectorModal').then((m) => ({ default: m.ArtSelectorModal }))
);

interface DeckTokensPanelProps {
  deck: Deck;
  onUpdateDeck: (updated: Deck) => void;
}

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
  layout: 'token',
});

export const DeckTokensPanel: React.FC<DeckTokensPanelProps> = ({ deck, onUpdateDeck }) => {
  const tokens = deck.tokens || [];
  const totalQty = tokens.reduce((s, t) => s + t.quantity, 0);

  const [collapsed, setCollapsed] = useState(tokens.length === 0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [artTokenId, setArtTokenId] = useState<string | null>(null);

  // Estado do seletor de fichas
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [results, setResults] = useState<TokenCard[]>([]);
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

  const runSearch = async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++reqRef.current;
    setLoading(true);
    try {
      const res = await searchUtilityCards('tokens', q, 'all', {
        signal: controller.signal,
        maxPages: 40,
        onProgress: (partial) => {
          if (reqId !== reqRef.current || controller.signal.aborted) return;
          setResults(partial);
          setLoading(false);
        },
      });
      if (reqId === reqRef.current && !controller.signal.aborted) setResults(res);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
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
      if (e.key === 'Escape' && !artTokenId) setIsPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPickerOpen, artTokenId]);

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

  const handleRemove = (id: string) => save(tokens.filter((t) => t.id !== id));

  const artTarget = useMemo(
    () => tokens.find((t) => t.id === artTokenId) || null,
    [tokens, artTokenId]
  );

  const handleSelectPrint = (print: CardPrint, targetFace: 'front' | 'back' = 'front') => {
    if (!artTokenId) return;
    save(
      tokens.map((dt) => {
        if (dt.id !== artTokenId) return dt;
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
      const hay = `${r.name} ${r.typeLine || ''} ${r.setName || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [results, query, serverQuery]);

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
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPickerOpen(true)}>
          <Plus size={14} /> Adicionar ficha
        </button>
      </div>

      {!collapsed &&
        (tokens.length === 0 ? (
          <p className="deck-tokens-empty">
            Nenhuma ficha neste deck. Elas serão impressas junto com as cartas quando você enviar o
            deck para os Proxies.
          </p>
        ) : (
          <div className="deck-tokens-grid">
            {tokens.map((dt) => (
              <div key={dt.id} className="deck-token">
                <div className="deck-token-img">
                  <CardImage
                    name={dt.token.name}
                    imageUrl={dt.token.imageUrl}
                    imageUrlLarge={dt.token.imageUrlLarge}
                    setCode={dt.token.setCode}
                    collectorNumber={dt.token.collectorNumber}
                    className="card-image"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon deck-token-art"
                    onClick={() => setArtTokenId(dt.id)}
                    title="Trocar arte (alters, personalizadas ou upload)"
                    aria-label={`Trocar arte de ${dt.token.name}`}
                  >
                    <ImageIcon size={14} />
                  </button>
                </div>
                <div className="deck-token-name" title={dt.token.name}>
                  {dt.token.name}
                </div>
                <div className="deck-token-controls">
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleQty(dt.id, -1)} aria-label="Diminuir">
                    <Minus size={14} />
                  </button>
                  <strong>{dt.quantity}</strong>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleQty(dt.id, 1)} aria-label="Aumentar">
                    <Plus size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleRemove(dt.id)} title="Remover ficha" aria-label="Remover ficha">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {isPickerOpen && (
        <div className="deck-token-picker-overlay" onClick={() => setIsPickerOpen(false)}>
          <div
            className="deck-token-picker"
            role="dialog"
            aria-label="Adicionar ficha ao deck"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="deck-token-picker-head">
              <strong>Adicionar ficha a “{deck.name}”</strong>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setIsPickerOpen(false)} aria-label="Fechar">
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
                placeholder="Buscar ficha (ex: Treasure, Zombie, Angel)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (serverQuery) setServerQuery('');
                }}
                autoFocus
              />
            </form>
            <div className="deck-token-picker-body">
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
                <div className="deck-token-picker-grid">
                  {filteredResults.slice(0, 400).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="deck-token-pick"
                      onClick={() => handleAdd(r)}
                      title={`${r.name} — ${r.typeLine}`}
                    >
                      <CardImage
                        name={r.name}
                        imageUrl={r.imageUrl}
                        imageUrlLarge={r.imageUrlLarge}
                        setCode={r.setCode}
                        collectorNumber={r.collectorNumber}
                        className="card-image"
                      />
                      <span className="deck-token-pick-name">
                        {justAdded[r.id] ? <Check size={12} /> : null} {r.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {artTarget && (
        <Suspense fallback={null}>
          <ArtSelectorModal
            isOpen
            card={toArtCard(artTarget.token)}
            onClose={() => setArtTokenId(null)}
            onSelectPrint={handleSelectPrint}
          />
        </Suspense>
      )}
    </div>
  );
};
