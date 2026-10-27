import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardPrint } from '../../types';
import { getCardPrints } from '../../services/scryfall';
import { CardImage } from '../Common/CardImage';
import { X, Check, Loader2, Image as ImageIcon, Search } from 'lucide-react';

interface ArtSelectorModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPrint: (selectedPrint: CardPrint) => void;
}

export const ArtSelectorModal: React.FC<ArtSelectorModalProps> = ({
  card,
  isOpen,
  onClose,
  onSelectPrint,
}) => {
  const [prints, setPrints] = useState<CardPrint[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePrintId, setActivePrintId] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (isOpen && card) {
      setActivePrintId(card.id);
      setFilterQuery('');
      setLoading(true);
      getCardPrints(card)
        .then((data) => {
          if (!cancelled) setPrints(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setPrints([]);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, card]);

  const filteredPrints = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return prints;
    return prints.filter(
      (p) =>
        p.setName.toLowerCase().includes(q) ||
        p.setCode.toLowerCase().includes(q) ||
        p.collectorNumber.toLowerCase().includes(q) ||
        (p.artist && p.artist.toLowerCase().includes(q)) ||
        (p.releasedAt && p.releasedAt.includes(q))
    );
  }, [prints, filterQuery]);

  if (!isOpen || !card) return null;

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
          width: '960px',
          maxWidth: '95vw',
          maxHeight: '88vh',
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
            gap: '16px',
            flexWrap: 'wrap',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ImageIcon className="text-indigo-400" size={20} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                  Selecionar Arte — {card.name}
                </h2>
                {!loading && prints.length > 0 && (
                  <span className="badge badge-primary">{prints.length} edições</span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Clique em qualquer edição abaixo para aplicar a ilustração na carta
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {prints.length > 6 && (
              <div style={{ position: 'relative', width: '240px' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
                />
                <input
                  type="text"
                  className="input-text"
                  placeholder="Filtrar edição, sigla, ano..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8rem' }}
                />
              </div>
            )}
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ borderRadius: '50%', padding: '6px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content / Prints Grid */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '260px',
                gap: '12px',
                color: '#94a3b8',
              }}
            >
              <Loader2 className="animate-spin text-indigo-400" size={32} />
              <span>Buscando todas as edições e ilustrações no Scryfall...</span>
            </div>
          ) : filteredPrints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              {prints.length > 0
                ? 'Nenhuma edição corresponde ao filtro digitado.'
                : 'Nenhuma outra arte encontrada para esta carta. Verifique sua conexão com a internet.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredPrints.map((p) => {
                const isSelected = p.id === activePrintId;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActivePrintId(p.id);
                      onSelectPrint(p);
                      onClose();
                    }}
                    className="glass-card"
                    style={{
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                      boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.4)' : undefined,
                      transform: isSelected ? 'scale(1.02)' : undefined,
                    }}
                  >
                    <div style={{ position: 'relative', aspectRatio: '5/7', background: '#05070b' }}>
                      <CardImage
                        name={card.name}
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
                            top: '8px',
                            right: '8px',
                            background: 'var(--primary)',
                            borderRadius: '50%',
                            padding: '4px',
                            color: 'white',
                            display: 'flex',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                          }}
                        >
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px', fontSize: '0.75rem', background: '#0f141d' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: '#f1f5f9',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={p.setName}
                      >
                        {p.setName}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: '#64748b',
                          marginTop: '2px',
                        }}
                      >
                        <span>
                          {p.setCode} #{p.collectorNumber}
                          {p.releasedAt ? ` • ${p.releasedAt.slice(0, 4)}` : ''}
                        </span>
                        {p.priceUsd !== undefined && (
                          <span style={{ color: '#10b981' }}>${p.priceUsd.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
