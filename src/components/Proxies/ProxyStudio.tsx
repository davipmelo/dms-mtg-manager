import React, { useState } from 'react';
import { ProxyItem, Deck, Card, TokenCard } from '../../types';
import { CardImage } from '../Common/CardImage';
import {
  Printer,
  Trash2,
  Plus,
  Minus,
  Layers,
  Scissors,
  CheckSquare,
  Square,
  Image as ImageIcon,
} from 'lucide-react';

interface ProxyStudioProps {
  proxies: ProxyItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onAddDeckToProxies: (deck: Deck) => void;
  onOpenArtSelector?: (card: Card | TokenCard, proxyItemId: string) => void;
  decks: Deck[];
}

export const ProxyStudio: React.FC<ProxyStudioProps> = ({
  proxies,
  onUpdateQuantity,
  onRemoveItem,
  onClearAll,
  onAddDeckToProxies,
  onOpenArtSelector,
  decks,
}) => {
  const [showCutLines, setShowCutLines] = useState(true);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState('');

  // Flatten proxies into individual card instances for exact 9-card page chunks
  const expandedCards: Array<{ item: ProxyItem; card: Card | TokenCard }> = [];
  proxies.forEach((item) => {
    for (let i = 0; i < item.quantity; i++) {
      expandedCards.push({ item, card: item.card });
    }
  });

  const totalPages = Math.ceil(expandedCards.length / 9) || 1;
  const pages: Array<Array<{ item: ProxyItem; card: Card | TokenCard }>> = [];
  for (let p = 0; p < totalPages; p++) {
    pages.push(expandedCards.slice(p * 9, (p + 1) * 9));
  }

  const handlePrint = () => {
    window.print();
  };

  const handleAddDeck = () => {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (deck) {
      onAddDeckToProxies(deck);
      setSelectedDeckId('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Control Panel (Hidden during Print) */}
      <div className="glass-panel print-hide" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Printer className="text-indigo-400" size={24} />
              Estúdio de Impressão de Proxies (A4 — 9 cartas por folha)
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Diagramação exata de 63mm × 88mm com guias de corte. Total:{' '}
              <strong>{expandedCards.length} cartas</strong> em{' '}
              <strong>{totalPages} página(s) A4</strong>. Dica: na janela de impressão, escolha{' '}
              <em>"Salvar como PDF"</em>, escala <em>100%</em> e margens <em>Nenhuma</em>.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCutLines(!showCutLines)}
            >
              <Scissors size={14} />
              {showCutLines ? 'Bordas de Corte: Ativas' : 'Bordas de Corte: Desativadas'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCropMarks(!showCropMarks)}
            >
              {showCropMarks ? <CheckSquare size={14} /> : <Square size={14} />}
              Marcas de Enquadramento
            </button>

            {proxies.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-red-400"
                onClick={onClearAll}
              >
                <Trash2 size={14} /> Limpar Fila
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={expandedCards.length === 0}
            >
              <Printer size={16} /> Imprimir / Salvar PDF (A4)
            </button>
          </div>
        </div>

        {/* Quick Add Deck to Proxies */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
            Adicionar Deck Inteiro à Impressão:
          </span>
          <select
            className="select-field"
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            style={{ width: 'auto', minWidth: '220px' }}
          >
            <option value="">Selecione um deck...</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.cards.length} cartas)
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddDeck}
            disabled={!selectedDeckId}
          >
            <Plus size={14} /> Adicionar Deck à Fila
          </button>
        </div>
      </div>

      {/* Queue items manager strip (Hidden during print) */}
      {proxies.length > 0 && (
        <div className="glass-panel print-hide" style={{ padding: '16px' }}>
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: '12px',
            }}
          >
            Cartas na Fila de Impressão ({proxies.length} itens distintos)
          </h3>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {proxies.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'var(--bg-surface)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  minWidth: '215px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '44px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <CardImage
                    name={item.card.name}
                    imageUrl={item.card.imageUrl}
                    imageUrlLarge={item.card.imageUrlLarge}
                    setCode={item.card.setCode}
                    collectorNumber={item.card.collectorNumber}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.card.name}
                  >
                    {item.card.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '4px',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '2px' }}
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.quantity}x</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '2px' }}
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </button>

                    {onOpenArtSelector && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px', marginLeft: 'auto' }}
                        onClick={() => onOpenArtSelector(item.card, item.id)}
                        title="Trocar Arte desta Proxy"
                      >
                        <ImageIcon size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{
                        padding: '2px',
                        marginLeft: onOpenArtSelector ? undefined : 'auto',
                        color: '#ef4444',
                      }}
                      onClick={() => onRemoveItem(item.id)}
                      title="Remover da Fila"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A4 Sheet Container (This is what prints and renders visually!) */}
      <div className="a4-print-container">
        {expandedCards.length === 0 ? (
          <div
            className="glass-card print-hide"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <Layers size={48} className="text-slate-600" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
              Sua fila de proxies está vazia
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '460px' }}>
              Adicione cartas da sua coleção, de um deck completo ou da aba de Utilitários (Fichas, Planos, Emblemas, Masmorras) para gerar suas folhas prontas para impressão A4.
            </p>
          </div>
        ) : (
          pages.map((pageCards, pageIdx) => (
            <div key={pageIdx} style={{ marginBottom: '30px' }}>
              <div
                className="print-hide"
                style={{
                  textAlign: 'center',
                  marginBottom: '8px',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                }}
              >
                Página {pageIdx + 1} de {totalPages} ({pageCards.length} cartas)
              </div>

              {/* The exact A4 Sheet element */}
              <div
                className={`a4-page-sheet ${showCutLines ? 'show-cut-lines' : ''} ${
                  showCropMarks ? 'show-crop-marks' : ''
                }`}
              >
                {pageCards.map((c, cardIdx) => (
                  <div key={cardIdx} className="a4-card-slot">
                    <CardImage
                      name={c.card.name}
                      imageUrl={c.card.imageUrl}
                      imageUrlLarge={c.card.imageUrlLarge}
                      setCode={c.card.setCode}
                      collectorNumber={c.card.collectorNumber}
                      preferLarge
                      loading="eager"
                    />
                  </div>
                ))}

                {/* Fill remaining empty slots on the last page up to 9 cards */}
                {Array.from({ length: 9 - pageCards.length }).map((_, emptyIdx) => (
                  <div
                    key={`empty-${emptyIdx}`}
                    className="a4-card-slot"
                    style={{
                      background: '#fafafa',
                      border: showCutLines ? '0.15mm dashed #ddd' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
