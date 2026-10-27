import React, { useState, useMemo } from 'react';
import { Deck, DeckCard, ViewMode, Card, CardPrint } from '../../types';
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
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DeckBuilderProps {
  deck: Deck;
  onBack: () => void;
  onUpdateDeck: (updated: Deck) => void;
  onOpenArtSelector: (card: Card, cardIndex: number) => void;
  onSendDeckToProxies: (deck: Deck) => void;
  onOpenExportModal: (deckId: string) => void;
  onOpenAddCardModal: (deckId: string) => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  deck,
  onBack,
  onUpdateDeck,
  onOpenArtSelector,
  onSendDeckToProxies,
  onOpenExportModal,
  onOpenAddCardModal,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showCharts, setShowCharts] = useState(true);
  const [hoveredCardImg, setHoveredCardImg] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
  const commanders = useMemo(() => deck.cards.filter((c) => c.category === 'commander' || c.category === 'partner'), [deck.cards]);
  const mainCards = useMemo(() => deck.cards.filter((c) => c.category === 'main'), [deck.cards]);
  const sideCards = useMemo(() => deck.cards.filter((c) => c.category === 'sideboard'), [deck.cards]);

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

  // Stacked Columns groupings
  const stackedGroups = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {
      'Criaturas': [],
      'Mágicas Instantâneas': [],
      'Feitiços': [],
      'Artefatos': [],
      'Encantamentos': [],
      'Planeswalkers': [],
      'Terrenos': [],
      'Outros': [],
    };

    mainCards.forEach((item) => {
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
  }, [mainCards]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Navigation & Deck Header */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> Voltar aos Decks
          </button>
          <span className="badge badge-primary">{deck.format.toUpperCase()}</span>
          <span className={`badge ${totalCardsCount === targetCardsCount ? 'badge-success' : 'badge-warning'}`}>
            {totalCardsCount} / {targetCardsCount} Cartas
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
              {deck.name}
            </h1>
            {deck.description && (
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px', maxWidth: '640px' }}>
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
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(18, 23, 34, 0.7) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
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
                <div style={{ width: '64px', height: '90px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden' }}>
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
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>{cmd.card.setName} ({cmd.card.setCode})</span>
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

      {/* Interactive Deck Analytics / Charts (Requirement 6) */}
      <div className="glass-panel" style={{ padding: '26px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: showCharts ? '22px' : '0px',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 className="text-indigo-400" size={18} />
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

      {/* Layout Switcher & Deck Sections */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
            Baralho Principal ({mainCards.reduce((s, c) => s + c.quantity, 0)} cartas)
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-darkest)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('grid')}
              title="Grade Visual"
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'stacked' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('stacked')}
              title="Colunas Stackadas (Moxfield)"
            >
              <Columns size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              title="Lista / Tabela"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Display Based on View Mode */}
      {mainCards.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          Este deck ainda não possui cartas. Clique em <strong>"Adicionar Carta"</strong> acima ou importe uma lista!
        </div>
      ) : viewMode === 'grid' ? (
        /* Visual Grid */
        <div className="cards-grid">
          {mainCards.map((c, idx) => (
            <div key={`${c.card.id}-${idx}`} className="card-item-container">
              <div className="card-image-wrapper">
                <CardImage
                  name={c.card.name}
                  imageUrl={c.card.imageUrl}
                  imageUrlLarge={c.card.imageUrlLarge}
                  setCode={c.card.setCode}
                  collectorNumber={c.card.collectorNumber}
                  preferLarge
                  className="card-image"
                />
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

              <div style={{ padding: '12px', background: '#0c0f17', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.card.name}
                  </div>
                  <ManaCostRenderer manaCost={c.card.manaCost} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>{c.card.typeLine.split('—')[0]}</span>
                  {c.card.priceUsd && (
                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                      ${(c.card.priceUsd * c.quantity).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Qty +/- & Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: '3px' }}
                      onClick={() => handleUpdateCardQuantity(c.card.id, c.quantity - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '18px', textAlign: 'center' }}>
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
                      title="Mudar Arte da Carta"
                    >
                      <ImageIcon size={15} />
                    </button>
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
          ))}
        </div>
      ) : viewMode === 'stacked' ? (
        /* Moxfield Stacked Columns View */
        <div className="stacked-board">
          {stackedGroups.map(([groupName, items]) => (
            <div key={groupName} className="stacked-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{groupName}</span>
                <span className="badge badge-primary">{items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>

              <div className="stacked-cards-list">
                {items.map((item, idx) => (
                  <div
                    key={`${item.card.id}-${idx}`}
                    className="stacked-card-entry"
                    onMouseEnter={() => setHoveredCardImg(item.card.imageUrlLarge || item.card.imageUrl)}
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
        /* Table View */
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Qtd</th>
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
              {mainCards.map((c, idx) => (
                <tr
                  key={`${c.card.id}-${idx}`}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                    setHoveredCardImg(c.card.imageUrlLarge || c.card.imageUrl);
                  }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    setHoveredCardImg(null);
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
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#f8fafc' }}>
                    {c.card.name}
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
                      <button
                        className="btn btn-ghost btn-icon text-red-400"
                        style={{ padding: '4px' }}
                        onClick={() => handleRemoveCard(c.card.id)}
                        title="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Card Image Tooltip */}
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
