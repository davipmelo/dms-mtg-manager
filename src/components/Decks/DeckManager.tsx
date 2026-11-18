import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Deck, DeckTag } from '../../types';
import { Thumb, scryfallSmall } from '../Common/Thumb';
import {
  Shield,
  Swords,
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
  MoveVertical,
  LayoutGrid,
  List,
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
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem('dms_deck_list_view') === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });
  const changeViewMode = (mode: 'cards' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('dms_deck_list_view', mode);
    } catch {
      // ignore
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [quickTagMenuDeckId, setQuickTagMenuDeckId] = useState<string | null>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  // Cover image vertical repositioning state
  const [repositioningDeckId, setRepositioningDeckId] = useState<string | null>(null);
  const [tempCoverPosition, setTempCoverPosition] = useState<number>(50);
  const [tempCoverZoom, setTempCoverZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartPosRef = useRef<number>(50);

  // Global pointerup listener to ensure dragging never gets stuck
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalPointerUp = () => setIsDragging(false);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging]);

  const handleStartReposition = (deck: Deck) => {
    setRepositioningDeckId(deck.id);
    setTempCoverPosition(typeof deck.coverPosition === 'number' ? deck.coverPosition : 50);
    setTempCoverZoom(deck.coverZoom && deck.coverZoom > 1 ? deck.coverZoom : 1);
  };

  const handleSaveReposition = (deck: Deck) => {
    if (onUpdateDeck) {
      onUpdateDeck({
        ...deck,
        coverPosition: tempCoverPosition,
        coverZoom: tempCoverZoom > 1 ? tempCoverZoom : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    setRepositioningDeckId(null);
    setIsDragging(false);
  };

  const handleCancelReposition = () => {
    setRepositioningDeckId(null);
    setIsDragging(false);
  };

  const handleBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartPosRef.current = tempCoverPosition;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleBannerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaY = e.clientY - dragStartYRef.current;
    // Drag down (positive deltaY) -> shifts view towards top of image (lower position %)
    // Drag up (negative deltaY) -> shifts view towards bottom of image (higher position %)
    const sensitivity = 0.5;
    const nextPos = Math.round(
      Math.min(100, Math.max(0, dragStartPosRef.current - deltaY * sensitivity))
    );
    setTempCoverPosition(nextPos);
  };

  const handleBannerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

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
      <div className="glass-panel page-header-panel" style={{ padding: '22px 24px' }}>
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
            <span className="section-eyebrow">Biblioteca</span>
            <h1 className="page-title">
              Meus Decks
            </h1>
            <p className="page-subtitle">
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
            <button className="btn btn-primary btn-sm" onClick={onOpenImportModal}>
              <Download size={15} /> Importar Deck
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
                    color: '#71717a',
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
                      color: '#a1a1aa',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    title="Limpar busca"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="view-toggle" role="radiogroup" aria-label="Modo de visualização">
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'cards'}
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
                  onClick={() => changeViewMode('cards')}
                  title="Visualizar em cards"
                  aria-label="Visualizar em cards"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'list'}
                  className={`view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => changeViewMode('list')}
                  title="Visualizar em lista"
                  aria-label="Visualizar em lista"
                >
                  <List size={16} />
                </button>
              </div>

              {(searchQuery || activeTagFilter) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTagFilter(null);
                  }}
                  style={{ fontSize: '0.78rem', color: '#e6a800', gap: '4px' }}
                >
                  <X size={14} /> Limpar Filtros
                </button>
              )}
            </div>

            {/* Tag Filters Bar */}
            {deckTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <SlidersHorizontal size={13} /> Filtrar por Tag:
                </span>

                {/* All decks button */}
                <button
                  type="button"
                  className={`chip ${activeTagFilter === null ? 'is-active' : ''}`}
                  onClick={() => setActiveTagFilter(null)}
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
                      className="chip"
                      style={{
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
                    className={`chip ${activeTagFilter === 'no-tag' ? 'is-active' : ''}`}
                    onClick={() => setActiveTagFilter(activeTagFilter === 'no-tag' ? null : 'no-tag')}
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
          className="glass-card empty-state"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div className="empty-state-icon"><Swords size={34} /></div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f4f4f5' }}>
            Você ainda não cadastrou nenhum deck
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#a1a1aa', maxWidth: '440px' }}>
            Crie seu primeiro deck escolhendo o formato desejado (Commander, Modern, Standard, etc.) ou importe listas de Moxfield, LigaMagic e MTG Arena.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onOpenImportModal}>
              <Download size={16} /> Importar Lista
            </button>
            <button className="btn btn-primary" onClick={onOpenCreateModal}>
              <Plus size={16} /> Criar Deck
            </button>
          </div>
        </div>
      ) : filteredDecks.length === 0 ? (
        <div
          className="glass-card empty-state"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div className="empty-state-icon"><Tag size={30} /></div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f4f4f5' }}>
            Nenhum deck encontrado com os filtros atuais
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#a1a1aa', maxWidth: '400px' }}>
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
      ) : viewMode === 'list' ? (
        <div className="decks-list">
          {filteredDecks.map((deck) => {
            const cardCount = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
            const targetCount = deck.format === 'commander' ? 100 : 60;
            const coverImage =
              deck.coverImageUrl ||
              deck.commanderCard?.imageUrlArtCrop ||
              deck.cards[0]?.card.imageUrlArtCrop ||
              '';
            const appliedTags = getDeckTags(deck);
            return (
              <div key={deck.id} className="deck-row" onClick={() => onOpenDeck(deck.id)}>
                <Thumb
                  className="deck-row-thumb"
                  src={
                    deck.coverImageUrl ||
                    scryfallSmall(deck.commanderCard?.imageUrlSmall || deck.commanderCard?.imageUrl) ||
                    coverImage
                  }
                  fallback={coverImage}
                  position={deck.coverImageUrl ? `50% ${deck.coverPosition ?? 50}%` : '50% 28%'}
                />
                <div className="deck-row-main">
                  <strong className="deck-row-title">{deck.name}</strong>
                  <span className="deck-row-sub">
                    {deck.commanderCard ? `Comandante: ${deck.commanderCard.name}` : deck.description || 'Sem comandante'}
                  </span>
                </div>
                <span className="deck-row-format">{deck.format.toUpperCase()}</span>
                <span className="deck-row-count" title={`${cardCount} de ${targetCount} cartas`}>
                  <span
                    className="deck-row-dot"
                    style={{ background: cardCount === targetCount ? '#22c55e' : '#ffbb00' }}
                  />
                  {cardCount}/{targetCount}
                </span>
                <div className="deck-row-tags">
                  {appliedTags.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className="deck-row-tag"
                      style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}14` }}
                    >
                      {t.name}
                    </span>
                  ))}
                  {appliedTags.length > 3 && <span className="deck-row-tag-more">+{appliedTags.length - 3}</span>}
                </div>
                <div className="deck-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onSendDeckToProxies(deck)}
                    title="Enviar cartas deste deck para impressão de proxies A4"
                  >
                    <Printer size={14} /> <span className="deck-row-btn-label">Imprimir</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => (onEditDeck ? onEditDeck(deck) : onOpenDeck(deck.id))}
                    title="Editar nome, descrição, tags ou lista de cartas"
                  >
                    <Edit3 size={14} /> <span className="deck-row-btn-label">Editar</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-icon btn-sm"
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir o deck "${deck.name}"?`)) {
                        onDeleteDeck(deck.id);
                      }
                    }}
                    title="Excluir Deck"
                    aria-label="Excluir Deck"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenDeck(deck.id)}>
                    Abrir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="decks-grid"
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
            const isRepositioning = repositioningDeckId === deck.id;
            const currentPosition = isRepositioning ? tempCoverPosition : (deck.coverPosition ?? 50);
            const currentZoom = isRepositioning ? tempCoverZoom : (deck.coverZoom ?? 1);

            return (
              <div
                key={deck.id}
                className="glass-card deck-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'visible',
                  cursor: isRepositioning ? 'default' : 'pointer',
                  border: isRepositioning ? '1px solid #e6a800' : '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  position: 'relative',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: isRepositioning ? '0 0 20px rgba(255, 187, 0, 0.2)' : undefined,
                }}
                onClick={() => {
                  if (isRepositioning) return;
                  onOpenDeck(deck.id);
                }}
              >
                {/* Cover Art Banner */}
                <div
                  className="deck-card-banner"
                  style={{
                    position: 'relative',
                    height: isRepositioning ? '200px' : '140px',
                    borderTopLeftRadius: '13px',
                    borderTopRightRadius: '13px',
                    overflow: 'hidden',
                    transition: isDragging ? 'none' : undefined,
                    cursor: isRepositioning ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                    touchAction: isRepositioning ? 'none' : 'auto',
                    userSelect: 'none',
                  }}
                  onPointerDown={isRepositioning ? handleBannerPointerDown : undefined}
                  onPointerMove={isRepositioning ? handleBannerPointerMove : undefined}
                  onPointerUp={isRepositioning ? handleBannerPointerUp : undefined}
                  onPointerCancel={isRepositioning ? handleBannerPointerUp : undefined}
                >
                  <img
                    src={coverImage}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: `center ${currentPosition}%`,
                      transform: currentZoom > 1 ? `scale(${currentZoom})` : undefined,
                      transformOrigin: `center ${currentPosition}%`,
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: isRepositioning
                        ? 'linear-gradient(to bottom, rgba(14, 14, 16,0.15) 0%, rgba(14, 14, 16,0.7) 100%)'
                        : 'linear-gradient(to bottom, rgba(14, 14, 16, 0) 0%, rgba(14, 14, 16, 0) 70%, rgba(14, 14, 16, 0.6) 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Format & Card Count (minimalista) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      right: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pointerEvents: 'none',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      letterSpacing: '0.09em',
                      color: 'rgba(244, 244, 245, 0.9)',
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(9, 9, 11, 0.72)',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      {deck.format.toUpperCase()}
                    </span>
                    <span
                      title={`${cardCount} de ${targetCount} cartas`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(9, 9, 11, 0.72)',
                        backdropFilter: 'blur(6px)',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '0.03em',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: cardCount === targetCount ? '#22c55e' : '#ffbb00',
                        }}
                      />
                      {cardCount}/{targetCount}
                    </span>
                  </div>

                  {/* Hint overlay during repositioning */}
                  {isRepositioning && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 4,
                        pointerEvents: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        background: 'rgba(24, 24, 27, 0.88)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 187, 0, 0.6)',
                        color: '#f4f4f5',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                        userSelect: 'none',
                      }}
                    >
                      <MoveVertical size={13} color="#e6a800" />
                      <span>Arraste para mover</span>
                    </div>
                  )}

                  {/* Idle Reposition Trigger (ícone discreto) */}
                  {!isRepositioning && (
                    <button
                      type="button"
                      className="deck-reposition-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReposition(deck);
                      }}
                      title="Ajustar posição e zoom da capa"
                      aria-label="Ajustar posição e zoom da capa"
                    >
                      <MoveVertical size={14} />
                    </button>
                  )}
                </div>

                {/* Repositioning Control Bar */}
                {isRepositioning && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#111113',
                      borderBottom: '1px solid rgba(255, 187, 0, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      zIndex: 10,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {/* Slider fine-tuning */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 600 }}>
                        Posição:
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={tempCoverPosition}
                        onChange={(e) => setTempCoverPosition(Number(e.target.value))}
                        style={{
                          flex: 1,
                          accentColor: '#e6a800',
                          cursor: 'pointer',
                          height: '4px',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ffcc33',
                          minWidth: '36px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {tempCoverPosition}%
                      </span>
                    </div>

                    {/* Zoom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 600 }}>Zoom:</span>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={tempCoverZoom}
                        onChange={(e) => setTempCoverZoom(Number(e.target.value))}
                        style={{ flex: 1, accentColor: '#e6a800', cursor: 'pointer', height: '4px' }}
                      />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ffcc33',
                          minWidth: '36px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {tempCoverZoom.toFixed(1)}×
                      </span>
                    </div>

                    {/* Presets and Save / Cancel Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: 'Topo', val: 0 },
                          { label: 'Centro', val: 50 },
                          { label: 'Fundo', val: 100 },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setTempCoverPosition(preset.val)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontWeight: tempCoverPosition === preset.val ? 700 : 500,
                              borderRadius: '6px',
                              background:
                                tempCoverPosition === preset.val
                                  ? 'rgba(255, 187, 0, 0.25)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${
                                tempCoverPosition === preset.val
                                  ? '#e6a800'
                                  : 'rgba(255, 255, 255, 0.1)'
                              }`,
                              color: tempCoverPosition === preset.val ? '#ffcc33' : '#a1a1aa',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease',
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleCancelReposition}
                          className="btn btn-secondary btn-sm"
                          style={{
                            height: '24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <X size={12} /> Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveReposition(deck)}
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 10px',
                            height: '24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: '#e6a800',
                            color: '#000',
                            fontWeight: 700,
                          }}
                        >
                          <Check size={12} /> Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                  <h3 className="deck-card-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f4f4f5' }}>
                    {deck.name}
                  </h3>

                  {deck.commanderCard && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#ffbb00',
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
                        color: '#a1a1aa',
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
                        color: isTagMenuOpen ? '#ffbb00' : '#71717a',
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
                          background: '#121214',
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
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f4f4f5' }}>
                            Tags deste deck:
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuickTagMenuDeckId(null)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#a1a1aa',
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
                                  color: isChecked ? '#ffffff' : '#d4d4d8',
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
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => onOpenDeck(deck.id)}
                    >
                      Abrir Deck
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSendDeckToProxies(deck)}
                        title="Enviar cartas deste deck para impressão de proxies A4"
                      >
                        <Printer size={14} /> Imprimir
                      </button>
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
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o deck "${deck.name}"?`)) {
                            onDeleteDeck(deck.id);
                          }
                        }}
                        title="Excluir Deck"
                        aria-label="Excluir Deck"
                      >
                        <Trash2 size={15} />
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
