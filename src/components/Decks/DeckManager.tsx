import React from 'react';
import { Deck } from '../../types';
import { Shield, Plus, Upload, Trash2, ExternalLink, Calendar, Layers, Printer } from 'lucide-react';

interface DeckManagerProps {
  decks: Deck[];
  onOpenDeck: (deckId: string) => void;
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onDeleteDeck: (deckId: string) => void;
  onSendDeckToProxies: (deck: Deck) => void;
}

export const DeckManager: React.FC<DeckManagerProps> = ({
  decks,
  onOpenDeck,
  onOpenCreateModal,
  onOpenImportModal,
  onDeleteDeck,
  onSendDeckToProxies,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
              Meus Decks de Magic: The Gathering
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
              Construa e gerencie seus decks com regras dinâmicas por formato, análise de curva de mana e exportação para impressão.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={onOpenImportModal}>
              <Upload size={15} /> Importar Deck
            </button>
            <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
              <Plus size={16} /> Novo Deck
            </button>
          </div>
        </div>
      </div>

      {/* Decks Grid */}
      {decks.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <Shield size={48} className="text-slate-600" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
            Você ainda não cadastrou nenhum deck
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '440px' }}>
            Crie seu primeiro deck escolhendo o formato desejado (Commander, Modern, Standard, etc.) ou importe listas de Moxfield, LigaMagic e MTG Arena.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={onOpenCreateModal}>
              <Plus size={16} /> Criar Deck
            </button>
            <button className="btn btn-secondary" onClick={onOpenImportModal}>
              <Upload size={16} /> Importar Lista
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {decks.map((deck) => {
            const cardCount = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
            const targetCount = deck.format === 'commander' ? 100 : 60;
            const coverImage =
              deck.coverImageUrl ||
              deck.commanderCard?.imageUrlArtCrop ||
              deck.cards[0]?.card.imageUrlArtCrop ||
              'https://cards.scryfall.io/art_crop/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591';

            return (
              <div
                key={deck.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                }}
                onClick={() => onOpenDeck(deck.id)}
              >
                {/* Cover Art Banner */}
                <div
                  style={{
                    position: 'relative',
                    height: '140px',
                    backgroundImage: `url(${coverImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, rgba(12,15,23,0.3) 0%, rgba(12,15,23,0.95) 100%)',
                    }}
                  />

                  {/* Format & Card Count Badges */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      right: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="badge badge-primary">{deck.format.toUpperCase()}</span>
                    <span className={`badge ${cardCount === targetCount ? 'badge-success' : 'badge-warning'}`}>
                      {cardCount} / {targetCount} Cartas
                    </span>
                  </div>
                </div>

                {/* Deck Info & Actions */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                    {deck.name}
                  </h3>

                  {deck.commanderCard && (
                    <div style={{ fontSize: '0.8rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} /> Comandante: {deck.commanderCard.name}
                    </div>
                  )}

                  {deck.description && (
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {deck.description}
                    </p>
                  )}

                  {/* Footer & Quick Actions */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onSendDeckToProxies(deck)}
                      title="Enviar cartas deste deck para impressão de proxies A4"
                    >
                      <Printer size={14} /> Imprimir Proxies
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-ghost btn-icon text-red-400"
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o deck "${deck.name}"?`)) {
                            onDeleteDeck(deck.id);
                          }
                        }}
                        title="Excluir Deck"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onOpenDeck(deck.id)}
                      >
                        Abrir Deck
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
