import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Deck, CardPrint } from '../../types';
import { searchAutocomplete, getCardByName, getCardPrints } from '../../services/scryfall';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';
import { CardImage } from '../Common/CardImage';
import { Search, Plus, X, Loader2, Sparkles, Check, Image as ImageIcon } from 'lucide-react';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Card, quantity: number, isFoil: boolean, targetDeckId?: string) => void;
  decks: Deck[];
  defaultDeckId?: string;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({
  isOpen,
  onClose,
  onAddCard,
  decks,
  defaultDeckId,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [prints, setPrints] = useState<CardPrint[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [printSearch, setPrintSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFoil, setIsFoil] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState<string>(defaultDeckId || '');
  const [addedNotice, setAddedNotice] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSuggestions([]);
      setSelectedCard(null);
      setPrints([]);
      setPrintSearch('');
      setQuantity(1);
      setIsFoil(false);
      setTargetDeckId(defaultDeckId || '');
      setAddedNotice(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultDeckId]);

  // Autocomplete debounce
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await searchAutocomplete(query);
      setSuggestions(results.slice(0, 8));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectCardName = async (name: string) => {
    setLoading(true);
    setSuggestions([]);
    setQuery(name);
    setPrints([]);
    setPrintSearch('');
    try {
      const card = await getCardByName(name);
      if (card) {
        setSelectedCard(card);
        setLoadingPrints(true);
        getCardPrints(card)
          .then((printsList) => {
            setPrints(printsList);
          })
          .catch((err) => {
            console.error('Erro ao buscar edições da carta:', err);
          })
          .finally(() => {
            setLoadingPrints(false);
          });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrint = (p: CardPrint) => {
    if (!selectedCard) return;
    setSelectedCard({
      ...selectedCard,
      id: p.id,
      setCode: p.setCode,
      setName: p.setName,
      collectorNumber: p.collectorNumber,
      imageUrl: p.imageUrl,
      imageUrlLarge: p.imageUrlLarge || p.imageUrl,
      imageUrlArtCrop: p.imageUrlArtCrop,
      priceUsd: p.priceUsd ?? selectedCard.priceUsd,
    });
  };

  const filteredPrints = useMemo(() => {
    const q = printSearch.trim().toLowerCase();
    if (!q) return prints;
    return prints.filter(
      (p) =>
        p.setName.toLowerCase().includes(q) ||
        p.setCode.toLowerCase().includes(q) ||
        p.collectorNumber.toLowerCase().includes(q) ||
        (p.releasedAt && p.releasedAt.includes(q))
    );
  }, [prints, printSearch]);

  const handleAdd = () => {
    if (!selectedCard) return;
    onAddCard(selectedCard, quantity, isFoil, targetDeckId || undefined);
    setAddedNotice(true);
    setTimeout(() => {
      setAddedNotice(false);
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 11, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '750px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Plus className="text-indigo-400" size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
              Adicionar Carta à Coleção ou Deck
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: '12px', color: '#64748b', pointerEvents: 'none' }}
              />
              <input
                ref={inputRef}
                type="text"
                className="input-text"
                placeholder="Digite o nome da carta (ex: Lightning Bolt, Atraxa, Sol Ring, Raio)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    handleSelectCardName(query.trim());
                  }
                }}
                style={{ paddingLeft: '38px', fontSize: '0.95rem' }}
              />
              {loading && (
                <Loader2
                  size={18}
                  className="animate-spin text-indigo-400"
                  style={{ position: 'absolute', right: '12px' }}
                />
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#121722',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                  zIndex: 50,
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectCardName(item)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                      fontSize: '0.875rem',
                      color: '#f8fafc',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f2a3e')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card Preview & Details */}
          {selectedCard && (
            <>
              <div
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                gap: '20px',
                background: 'rgba(18, 23, 34, 0.6)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '5/7' }}>
                <CardImage
                  name={selectedCard.name}
                  imageUrl={selectedCard.imageUrl}
                  imageUrlLarge={selectedCard.imageUrlLarge}
                  setCode={selectedCard.setCode}
                  collectorNumber={selectedCard.collectorNumber}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                    {selectedCard.name}
                  </h3>
                  <ManaCostRenderer manaCost={selectedCard.manaCost} />
                </div>

                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {selectedCard.typeLine}
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '10px',
                    borderRadius: '8px',
                    whiteSpace: 'pre-line',
                    maxHeight: '100px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedCard.oracleText || 'Sem texto de regras.'}
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#64748b', marginTop: 'auto' }}>
                  <span>{selectedCard.setName} ({selectedCard.setCode}) #{selectedCard.collectorNumber}</span>
                  {selectedCard.priceUsd && (
                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                      ${selectedCard.priceUsd.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Escolher Edição / Arte */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'rgba(18, 23, 34, 0.5)',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={16} className="text-primary" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                    Escolher Arte / Edição
                  </span>
                  {!loadingPrints && prints.length > 0 && (
                    <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                      {prints.length} {prints.length === 1 ? 'edição' : 'edições'}
                    </span>
                  )}
                </div>

                {prints.length > 5 && (
                  <div style={{ position: 'relative', width: '180px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Filtrar edições..."
                      value={printSearch}
                      onChange={(e) => setPrintSearch(e.target.value)}
                      style={{ fontSize: '0.75rem', paddingLeft: '26px', height: '28px' }}
                    />
                  </div>
                )}
              </div>

              {loadingPrints ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.8rem', padding: '14px 6px' }}>
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span>Carregando todas as ilustrações e edições disponíveis...</span>
                </div>
              ) : prints.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    paddingTop: '4px',
                  }}
                >
                  {filteredPrints.map((p) => {
                    const isSelected = p.id === selectedCard.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPrint(p)}
                        style={{
                          flex: '0 0 105px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: isSelected ? '2px solid #ffbb00' : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isSelected ? '0 0 12px rgba(255, 187, 0, 0.45)' : undefined,
                          transition: 'all 0.15s ease',
                          background: '#090c13',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        <div style={{ position: 'relative', aspectRatio: '5/7', background: '#05070b', overflow: 'hidden' }}>
                          <CardImage
                            name={selectedCard.name}
                            imageUrl={p.imageUrl}
                            imageUrlLarge={p.imageUrlLarge}
                            setCode={p.setCode}
                            collectorNumber={p.collectorNumber}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: '#ffbb00',
                                color: '#000000',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                              }}
                            >
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '6px', fontSize: '0.68rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: isSelected ? '#ffbb00' : '#f1f5f9',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={p.setName}
                          >
                            {p.setCode.toUpperCase()} #{p.collectorNumber}
                          </div>
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '0.65rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={p.setName}
                          >
                            {p.setName}
                          </div>
                          {p.priceUsd && (
                            <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.68rem' }}>
                              ${p.priceUsd.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '6px' }}>
                  Edição padrão selecionada ({selectedCard.setName}).
                </div>
              )}
            </div>
          </>
        )}

          {/* Form Options: Qty, Foil, Target Destination */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Quantidade
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  className="input-text"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ textAlign: 'center', width: '60px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Destino
              </label>
              <select
                className="select-field"
                value={targetDeckId}
                onChange={(e) => setTargetDeckId(e.target.value)}
              >
                <option value="">Apenas Coleção (Pool)</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    Deck: {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Tratamento
              </label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: '8px',
                  border: isFoil ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isFoil}
                  onChange={(e) => setIsFoil(e.target.checked)}
                />
                <Sparkles size={14} className={isFoil ? 'text-amber-400' : 'text-slate-400'} />
                <span style={{ fontSize: '0.85rem' }}>Carta Foil</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!selectedCard}
            onClick={handleAdd}
          >
            {addedNotice ? (
              <>
                <Check size={16} /> Adicionado!
              </>
            ) : (
              <>
                <Plus size={16} /> Adicionar ({quantity}x)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
