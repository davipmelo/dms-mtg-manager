import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Deck, DeckTag } from '../../types';
import {
  Shield,
  Plus,
  Download,
  Trash2,
  Printer,
  Edit3,
  Tag,
  Search,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react';

interface DeckManagerProps {
  decks: Deck[];
  deckTags?: DeckTag[];
  onOpenDeck: (deckId: string) => void;
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onDeleteDeck: (deckId: string) => void;
  onSendDeckToProxies: (deck: Deck) => void;
  onEditDeck?: (deck: Deck) => void;
  onUpdateDeck?: (deck: Deck) => void;
  onOpenManageTags?: () => void;
}

export const DeckManager: React.FC<DeckManagerProps> = ({
  decks,
  deckTags = [],
  onOpenDeck,
  onOpenCreateModal,
  onOpenImportModal,
  onDeleteDeck,
  onSendDeckToProxies,
  onEditDeck,
  onUpdateDeck,
  onOpenManageTags,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [quickTagMenuDeckId, setQuickTagMenuDeckId] = useState<string | null>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  // Close quick tag menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setQuickTagMenuDeckId(null);
      }
    };
    if (quickTagMenuDeckId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [quickTagMenuDeckId]);

  // Helper to map deck tag IDs/names to DeckTag objects
  const getDeckTags = (deck: Deck): DeckTag[] => {
    if (!deck.tags || deck.tags.length === 0) return [];
    return deck.tags
      .map((tIdOrName) => {
        const found = deckTags.find(
          (t) => t.id === tIdOrName || t.name.toLowerCase() === tIdOrName.toLowerCase()
        );
        return (
          found || {
            id: tIdOrName,
            name: tIdOrName,
            color: '#3b82f6',
          }
        );
      })
      .filter(Boolean);
  };

  // Toggle tag on a deck
  const handleToggleDeckTag = (deck: Deck, tag: DeckTag) => {
    const currentTags = deck.tags || [];
    const hasTag = currentTags.some(
      (t) => t === tag.id || t.toLowerCase() === tag.name.toLowerCase()
    );
    let nextTags: string[];
    if (hasTag) {
      nextTags = currentTags.filter(
        (t) => t !== tag.id && t.toLowerCase() !== tag.name.toLowerCase()
      );
    } else {
      nextTags = [...currentTags, tag.id];
    }
    if (onUpdateDeck) {
      onUpdateDeck({ ...deck, tags: nextTags, updatedAt: new Date().toISOString() });
    }
  };

  // Filtered decks by search and tag
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = deck.name.toLowerCase().includes(q);
        const matchesCmd = deck.commanderCard?.name.toLowerCase().includes(q);
        const matchesPartner = deck.partnerCard?.name.toLowerCase().includes(q);
        const matchesDesc = deck.description?.toLowerCase().includes(q);
        const matchesTag = deck.tags?.some((t) => {
          const tagObj = deckTags.find(
            (tag) => tag.id === t || tag.name.toLowerCase() === t.toLowerCase()
          );
          return tagObj ? tagObj.name.toLowerCase().includes(q) : t.toLowerCase().includes(q);
        });

        if (!matchesName && !matchesCmd && !matchesPartner && !matchesDesc && !matchesTag) {
          return false;
        }
      }

      // 2. Tag filter
      if (activeTagFilter === 'no-tag') {
        return !deck.tags || deck.tags.length === 0;
      }
      if (activeTagFilter) {
        const hasTag = deck.tags?.some((t) => {
          const tagObj = deckTags.find((tag) => tag.id === activeTagFilter);
          return t === activeTagFilter || (tagObj && t.toLowerCase() === tagObj.name.toLowerCase());
        });
        if (!hasTag) return false;
      }

      return true;
    });
  }, [decks, searchQuery, activeTagFilter, deckTags]);

  const noTagDecksCount = useMemo(() => {
    return decks.filter((d) => !d.tags || d.tags.length === 0).length;
  }, [decks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
              Meus Decks de Magic: The Gathering
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
              Construa e gerencie seus decks com regras dinâmicas por formato, tags personalizadas e exportação para impressão.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onOpenManageTags && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenManageTags}
                title="Criar e gerenciar tags de decks personalizadas"
              >
                <Tag size={15} className="text-amber-400" /> Gerenciar Tags
              </button>
            )}
            <button className="btn btn-highlight btn-sm" onClick={onOpenImportModal}>
              <Download size={15} /> Importar Deck
            </button>
            <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
              <Plus size={16} /> Novo Deck
            </button>
          </div>
        </div>

        {/* Search & Tag Filter Toolbar (When decks exist) */}
        {decks.length > 0 && (
          <div
            style={{
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Search Input Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: '240px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    color: '#64748b',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  className="input-text"
                  placeholder="Buscar decks por nome, comandante, tag ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    title="Limpar busca"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {(searchQuery || activeTagFilter) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTagFilter(null);
                  }}
                  style={{ fontSize: '0.78rem', color: '#f59e0b', gap: '4px' }}
                >
                  <X size={14} /> Limpar Filtros
                </button>
              )}
            </div>

            {/* Tag Filters Bar */}
            {deckTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <SlidersHorizontal size={13} /> Filtrar por Tag:
                </span>

                {/* All decks button */}
                <button
                  type="button"
                  onClick={() => setActiveTagFilter(null)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: activeTagFilter === null ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeTagFilter === null ? '#ffffff' : '#94a3b8',
                    border: `1px solid ${activeTagFilter === null ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                  }}
                >
                  Todos ({decks.length})
                </button>

                {/* Tag Pills */}
                {deckTags.map((tag) => {
                  const count = decks.filter(
                    (d) => d.tags?.includes(tag.id) || d.tags?.includes(tag.name)
                  ).length;
                  const isActive = activeTagFilter === tag.id;

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setActiveTagFilter(isActive ? null : tag.id)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: isActive ? tag.color : `${tag.color}15`,
                        color: isActive ? '#ffffff' : tag.color,
                        border: `1px solid ${isActive ? tag.color : `${tag.color}45`}`,
                        boxShadow: isActive ? `0 0 10px ${tag.color}66` : 'none',
                      }}
                      title={`Filtrar decks com tag "${tag.name}"`}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? '#ffffff' : tag.color,
                        }}
                      />
                      {tag.name}
                      <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({count})</span>
                    </button>
                  );
                })}

                {/* No tags filter pill */}
                {noTagDecksCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTagFilter(activeTagFilter === 'no-tag' ? null : 'no-tag')}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      backgroundColor: activeTagFilter === 'no-tag' ? '#64748b' : 'rgba(255, 255, 255, 0.05)',
                      color: activeTagFilter === 'no-tag' ? '#ffffff' : '#64748b',
                      border: `1px solid ${activeTagFilter === 'no-tag' ? '#94a3b8' : 'rgba(255, 255, 255, 0.1)'}`,
                    }}
                  >
                    Sem Tags ({noTagDecksCount})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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
            <button className="btn btn-highlight" onClick={onOpenImportModal}>
              <Download size={16} /> Importar Lista
            </button>
            <button className="btn btn-primary" onClick={onOpenCreateModal}>
              <Plus size={16} /> Criar Deck
            </button>
          </div>
        </div>
      ) : filteredDecks.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <Tag size={42} className="text-slate-600" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc' }}>
            Nenhum deck encontrado com os filtros atuais
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '400px' }}>
            Tente buscar por outro termo ou desmarque o filtro de tag ativo.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setActiveTagFilter(null);
            }}
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredDecks.map((deck) => {
            const cardCount = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
            const targetCount = deck.format === 'commander' ? 100 : 60;
            const coverImage =
              deck.coverImageUrl ||
              deck.commanderCard?.imageUrlArtCrop ||
              deck.cards[0]?.card.imageUrlArtCrop ||
              'https://cards.scryfall.io/art_crop/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591';

            const appliedTags = getDeckTags(deck);
            const isTagMenuOpen = quickTagMenuDeckId === deck.id;

            return (
              <div
                key={deck.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'visible',
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  position: 'relative',
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
                    borderTopLeftRadius: '13px',
                    borderTopRightRadius: '13px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(to bottom, rgba(12,15,23,0.3) 0%, rgba(12,15,23,0.95) 100%)',
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
                    <span
                      className={`badge ${
                        cardCount === targetCount ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {cardCount} / {targetCount} Cartas
                    </span>
                  </div>
                </div>

                {/* Deck Info & Actions */}
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    gap: '10px',
                  }}
                >
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                    {deck.name}
                  </h3>

                  {deck.commanderCard && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#818cf8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
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

                  {/* Deck Tags Pill Area */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '2px',
                      position: 'relative',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {appliedTags.map((tag) => (
                      <span
                        key={tag.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: tag.color,
                          backgroundColor: `${tag.color}18`,
                          border: `1px solid ${tag.color}50`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                        title={`Filtrar decks com tag "${tag.name}"`}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: tag.color,
                          }}
                        />
                        {tag.name}
                      </span>
                    ))}

                    {/* Quick Add/Edit Tag Button on Card */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setQuickTagMenuDeckId(isTagMenuOpen ? null : deck.id)
                      }
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        height: '22px',
                        borderRadius: '12px',
                        color: isTagMenuOpen ? '#ffbb00' : '#64748b',
                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                      title="Atribuir tags a este deck"
                    >
                      <Plus size={12} /> Tag
                    </button>

                    {/* Quick Tag Selector Popover */}
                    {isTagMenuOpen && (
                      <div
                        ref={tagMenuRef}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          marginBottom: '8px',
                          zIndex: 50,
                          width: '240px',
                          background: '#0f1422',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '12px',
                          padding: '10px',
                          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          animation: 'modal-enter 0.12s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            paddingBottom: '6px',
                            marginBottom: '2px',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
                            Tags deste deck:
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuickTagMenuDeckId(null)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {deckTags.map((t) => {
                            const isChecked = deck.tags?.some(
                              (item) => item === t.id || item.toLowerCase() === t.name.toLowerCase()
                            );
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleToggleDeckTag(deck, t)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: isChecked ? `${t.color}20` : 'transparent',
                                  border: `1px solid ${isChecked ? `${t.color}60` : 'transparent'}`,
                                  cursor: 'pointer',
                                  color: isChecked ? '#ffffff' : '#cbd5e1',
                                  fontSize: '0.78rem',
                                  fontWeight: isChecked ? 700 : 500,
                                  textAlign: 'left',
                                  transition: 'background 0.12s ease',
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      backgroundColor: t.color,
                                    }}
                                  />
                                  {t.name}
                                </span>
                                {isChecked && <Check size={13} color={t.color} />}
                              </button>
                            );
                          })}
                        </div>

                        {onOpenManageTags && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickTagMenuDeckId(null);
                              onOpenManageTags();
                            }}
                            style={{
                              marginTop: '4px',
                              paddingTop: '6px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              background: 'none',
                              border: 'none',
                              color: '#ffbb00',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textAlign: 'center',
                              width: '100%',
                            }}
                          >
                            + Gerenciar todas as tags
                          </button>
                        )}
                      </div>
                    )}
                  </div>

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

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => (onEditDeck ? onEditDeck(deck) : onOpenDeck(deck.id))}
                        title="Editar nome, descrição, tags ou lista de cartas"
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        type="button"
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
                        type="button"
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
