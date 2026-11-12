import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Deck, DeckCard, ViewMode, Card, CollectionItem, CardCategory, isDoubleFacedCard, isSameCardPrint, isCardNameMatch, DeckTag } from '../../types';
import { resolveCardFaces } from '../../services/scryfall';
import { normalizeDeck } from '../../services/storage';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';
import { CardImage } from '../Common/CardImage';
import { InteractiveCharts } from '../Analytics/InteractiveCharts';
import { CardHoverPreview, CardHoverPreviewData } from '../Common/CardHoverPreview';
import { EditDeckModal } from '../Modals/EditDeckModal';
import { ExportDeckImageModal } from '../Modals/ExportDeckImageModal';
import {
  ArrowLeft,
  Grid,
  List,
  Plus,
  Minus,
  Trash2,
  Printer,
  Upload,
  Download,
  BarChart3,
  Sparkles,
  Shield,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Search,
  Edit3,
  Loader2,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  CheckSquare,
  RotateCw,
} from 'lucide-react';

interface DeckBuilderProps {
  deck: Deck;
  collection?: CollectionItem[];
  deckTags?: DeckTag[];
  onBack: () => void;
  onUpdateDeck: (updated: Deck) => void;
  onOpenArtSelector: (
    card: Card,
    cardIndex: number,
    face?: 'front' | 'back',
    instanceId?: string,
    category?: CardCategory | 'commander' | 'partner'
  ) => void;
  onAddToProxies?: (card: Card, quantity: number) => void;
  onSendDeckToProxies: (deck: Deck) => void;
  onOpenExportModal: (deckId: string) => void;
  onOpenImportModal?: (deckId: string) => void;
  onOpenManageTags?: () => void;
}

type SortColumn =
  | 'quantity'
  | 'available'
  | 'name'
  | 'cmc'
  | 'type'
  | 'set'
  | 'rarity'
  | 'price'
  | null;

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  deck,
  collection = [],
  deckTags = [],
  onBack,
  onUpdateDeck,
  onOpenArtSelector,
  onAddToProxies,
  onSendDeckToProxies,
  onOpenExportModal,
  onOpenImportModal,
  onOpenManageTags,
}) => {
  // View mode: Grid is default/primary, persisted across sessions
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('dms_deck_view_mode');
    return (saved as ViewMode) || 'grid';
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dms_deck_view_mode', mode);
  };

  // Selection state for quick removal in list/table view
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  const handleToggleSelectCard = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [showCharts, setShowCharts] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<CardHoverPreviewData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter & Search states (matches Collection)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isMultiOnly, setIsMultiOnly] = useState(false);
  const [isColorlessOnly, setIsColorlessOnly] = useState(false);
  const [colorMatchMode, setColorMatchMode] = useState<'exact' | 'pool'>('pool');

  // Sorting state (matches Collection)
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Edit Deck Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Export Deck Poster / Image Modal state
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);

  // Grid Scale & Details state (persisted across sessions)
  const [gridCardSize, setGridCardSize] = useState<number>(() => {
    const saved = localStorage.getItem('dms_grid_card_size');
    return saved ? Math.min(340, Math.max(110, Number(saved))) : 200;
  });
  const [showGridDetails, setShowGridDetails] = useState<boolean>(() => {
    return localStorage.getItem('dms_grid_show_details') !== 'false';
  });

  const handleGridCardSizeChange = (val: number) => {
    setGridCardSize(val);
    localStorage.setItem('dms_grid_card_size', String(val));
  };

  const handleToggleGridDetails = () => {
    setShowGridDetails((prev) => {
      const next = !prev;
      localStorage.setItem('dms_grid_show_details', String(next));
      return next;
    });
  };

  // Flip state for double-faced cards in visual grid
  const [flippedCardKeys, setFlippedCardKeys] = useState<Set<string>>(new Set());

  // Auto-upgrade legacy double-faced cards and sanitize single-faced cards (e.g. split/adventure)
  useEffect(() => {
    if (!deck || !onUpdateDeck) return;

    // 1. Sanitize any cards that were wrongly marked with cardFaces or layout modal_dfc (split, adventure, flip, normal)
    const cardsNeedingCleanup = deck.cards.filter((c) => {
      const layout = c.card.layout?.toLowerCase();
      const isSingleFaced =
        (layout &&
          ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
            layout
          )) ||
        (c.card.typeLine?.toLowerCase().includes('adventure') && !layout?.includes('transform'));

      return isSingleFaced && Boolean(c.card.cardFaces && c.card.cardFaces.length > 0);
    });

    if (cardsNeedingCleanup.length > 0) {
      const cleanedCards = deck.cards.map((dc) => {
        const needsClean = cardsNeedingCleanup.some((cl) =>
          cl.instanceId && dc.instanceId ? cl.instanceId === dc.instanceId : cl.card.id === dc.card.id
        );
        if (needsClean) {
          const { cardFaces, ...restCard } = dc.card;
          const trueLayout = dc.card.typeLine?.toLowerCase().includes('adventure')
            ? 'adventure'
            : dc.card.name.includes('//')
            ? 'split'
            : 'normal';
          return {
            ...dc,
            card: {
              ...restCard,
              layout: trueLayout,
            },
          };
        }
        return dc;
      });
      onUpdateDeck({ ...deck, cards: cleanedCards });
      return;
    }

    // 2. Resolve true double-faced cards that lack cardFaces
    const cardsNeedingResolution = deck.cards.filter((c) => {
      if (c.card.cardFaces && c.card.cardFaces.length >= 2) return false;
      const layout = c.card.layout?.toLowerCase();
      if (
        layout &&
        ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
          layout
        )
      ) {
        return false;
      }
      if (c.card.typeLine?.toLowerCase().includes('adventure') && !layout?.includes('transform')) {
        return false;
      }

      return (
        isDoubleFacedCard(c.card) ||
        c.card.name.includes('//') ||
        c.card.name.includes(' / ')
      );
    });

    if (cardsNeedingResolution.length === 0) return;

    let cancelled = false;
    Promise.all(
      cardsNeedingResolution.map(async (c) => {
        const faces = await resolveCardFaces(c.card);
        return { cardId: c.card.id, instanceId: c.instanceId, name: c.card.name, faces };
      })
    ).then((resolved) => {
      if (cancelled) return;
      let hasUpdates = false;
      const nextCards = deck.cards.map((dc) => {
        const match = resolved.find(
          (r) =>
            (r.instanceId && dc.instanceId && r.instanceId === dc.instanceId) ||
            r.cardId === dc.card.id ||
            isCardNameMatch(r.name, dc.card.name)
        );
        if (match && match.faces && match.faces.length >= 2) {
          hasUpdates = true;
          const fullDfcName =
            match.faces[0].name && match.faces[1].name
              ? `${match.faces[0].name.trim()} // ${match.faces[1].name.trim()}`
              : dc.card.name;

          return {
            ...dc,
            card: {
              ...dc.card,
              name: fullDfcName,
              cardFaces: match.faces,
              layout: dc.card.layout && ['transform', 'modal_dfc', 'battle', 'meld'].includes(dc.card.layout)
                ? dc.card.layout
                : 'modal_dfc',
            },
          };
        }
        return dc;
      });

      if (hasUpdates) {
        onUpdateDeck({ ...deck, cards: nextCards });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deck?.id]);

  const handleToggleFlip = async (cardKey: string, card: Card) => {
    if (!card.cardFaces || card.cardFaces.length < 2) {
      const faces = await resolveCardFaces(card);
      if (faces && faces.length >= 2 && onUpdateDeck) {
        const nextCards = deck.cards.map((c) =>
          c.card.id === card.id || c.instanceId === cardKey || isCardNameMatch(c.card.name, card.name)
            ? { ...c, card: { ...c.card, cardFaces: faces } }
            : c
        );
        onUpdateDeck({ ...deck, cards: nextCards });
      }
    }
    setFlippedCardKeys((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) {
        next.delete(cardKey);
      } else {
        next.add(cardKey);
      }
      return next;
    });
  };

  // Counts
  const totalCardsCount = useMemo(() => {
    return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
  }, [deck.cards]);

  const targetCardsCount = useMemo(() => {
    if (deck.format === 'commander') return 100;
    if (deck.format === 'brawl') return 60;
    return 60;
  }, [deck.format]);

  // Check if a card is a Commander or Partner
  const isCommanderCard = useCallback(
    (c: DeckCard) => {
      if (c.category === 'commander' || c.category === 'partner') return true;
      if (
        deck.commanderCard &&
        (c.card.id === deck.commanderCard.id ||
          c.card.name.toLowerCase() === deck.commanderCard.name.toLowerCase())
      ) {
        return true;
      }
      if (
        deck.partnerCard &&
        (c.card.id === deck.partnerCard.id ||
          c.card.name.toLowerCase() === deck.partnerCard.name.toLowerCase())
      ) {
        return true;
      }
      return false;
    },
    [deck.commanderCard, deck.partnerCard]
  );

  // Unique key helper for selection and individual card identity
  const getCardKey = useCallback((c: DeckCard): string => {
    return c.instanceId || `${c.card.id}-${c.collectionItemId || ''}`;
  }, []);

  // Sections: Mainboard (including Commander(s) pinned first), Sideboard
  // Guarantee each individual copy is expanded (never grouped inside a deck)
  const mainCards = useMemo(() => {
    const list: DeckCard[] = [];
    for (const c of deck.cards) {
      if (c.category === 'sideboard') continue;
      const qty = Math.max(1, Number(c.quantity) || 1);
      for (let q = 0; q < qty; q++) {
        list.push({
          ...c,
          card: { ...c.card },
          quantity: 1,
          instanceId: c.instanceId && qty === 1
            ? c.instanceId
            : (c.instanceId ? `${c.instanceId}-${q}` : `dc-${c.card.id}-${q}`),
        });
      }
    }
    if (
      deck.commanderCard &&
      !list.some(
        (c) =>
          c.card.id === deck.commanderCard!.id ||
          c.card.name.toLowerCase() === deck.commanderCard!.name.toLowerCase()
      )
    ) {
      list.unshift({
        card: deck.commanderCard,
        quantity: 1,
        category: 'commander',
        instanceId: `dc-${deck.commanderCard.id}-cmd`,
      });
    }
    if (
      deck.partnerCard &&
      !list.some(
        (c) =>
          c.card.id === deck.partnerCard!.id ||
          c.card.name.toLowerCase() === deck.partnerCard!.name.toLowerCase()
      )
    ) {
      list.push({
        card: deck.partnerCard,
        quantity: 1,
        category: 'partner',
        instanceId: `dc-${deck.partnerCard.id}-ptn`,
      });
    }
    return list;
  }, [deck.cards, deck.commanderCard, deck.partnerCard]);

  const sideCards = useMemo(() => {
    const list: DeckCard[] = [];
    for (const c of deck.cards) {
      if (c.category !== 'sideboard') continue;
      const qty = Math.max(1, Number(c.quantity) || 1);
      for (let q = 0; q < qty; q++) {
        list.push({
          ...c,
          card: { ...c.card },
          quantity: 1,
          instanceId: c.instanceId && qty === 1
            ? c.instanceId
            : (c.instanceId ? `${c.instanceId}-${q}` : `dc-${c.card.id}-${q}`),
        });
      }
    }
    return list;
  }, [deck.cards]);

  // Link card to collection item to get availability & in-use breakdown
  const getCollectionItemForCard = (c: DeckCard): CollectionItem | undefined => {
    if (!collection || collection.length === 0) return undefined;
    if (c.collectionItemId) {
      const match = collection.find(
        (item) => item.id === c.collectionItemId && item.card.name.toLowerCase() === c.card.name.toLowerCase()
      );
      if (match) return match;
    }
    const byId = collection.find((item) => item.card.id === c.card.id);
    if (byId) return byId;
    const byPrint = collection.find((item) => isSameCardPrint(item.card, c.card));
    if (byPrint) return byPrint;
    return collection.find(
      (item) => item.card.name.toLowerCase() === c.card.name.toLowerCase()
    );
  };

  // Auto-normalize deck on mount/update if needed (missing instanceId, qty > 1, or duplicate non-partner commanders)
  useEffect(() => {
    const hasMultipleCommanders =
      (deck.format === 'commander' || deck.format === 'brawl') &&
      deck.cards.filter((c) => c.category === 'commander').length > 1;
    const hasOrphanCommander =
      deck.commanderCard &&
      !deck.cards.some((c) => c.card.name.toLowerCase() === deck.commanderCard!.name.toLowerCase()) &&
      deck.cards.length >= 100;
    const needsNorm =
      hasMultipleCommanders ||
      hasOrphanCommander ||
      (deck.cards || []).some((c) => !c.instanceId || (c.quantity && c.quantity > 1));

    if (needsNorm) {
      onUpdateDeck(normalizeDeck(deck));
    }
  }, [deck, onUpdateDeck]);

  // Helper to find index of a card copy in deck.cards with multi-tier fallback
  const findDeckCardIndex = useCallback(
    (c: DeckCard): number => {
      // 1. Direct object equality or exact instanceId match
      let idx = deck.cards.findIndex(
        (item) => item === c || (Boolean(item.instanceId) && Boolean(c.instanceId) && item.instanceId === c.instanceId)
      );
      if (idx !== -1) return idx;

      // 2. Base instanceId match (if c.instanceId was appended with '-0', '-1')
      if (c.instanceId) {
        const baseId = c.instanceId.replace(/-\d+$/, '');
        idx = deck.cards.findIndex((item) => item.instanceId === baseId);
        if (idx !== -1) return idx;
      }

      // 3. Match by card id and category
      idx = deck.cards.findIndex(
        (item) => item.card.id === c.card.id && item.category === c.category
      );
      if (idx !== -1) return idx;

      // 4. Match by card name and category
      idx = deck.cards.findIndex(
        (item) =>
          isCardNameMatch(item.card.name, c.card.name) &&
          item.category === c.category
      );
      if (idx !== -1) return idx;

      // 5. Match by card id anywhere in deck
      idx = deck.cards.findIndex((item) => item.card.id === c.card.id);
      if (idx !== -1) return idx;

      // 6. Match by card name anywhere in deck
      idx = deck.cards.findIndex(
        (item) => isCardNameMatch(item.card.name, c.card.name)
      );
      if (idx !== -1) return idx;

      // 7. Fallback indexOf
      return deck.cards.indexOf(c);
    },
    [deck.cards]
  );

  // Card update handlers (individual copies)
  const handleAddCardCopy = (c: DeckCard) => {
    const newCopy: DeckCard = {
      ...c,
      card: { ...c.card },
      quantity: 1,
      instanceId: `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    const cardIdx = findDeckCardIndex(c);
    const nextCards = [...deck.cards];
    if (cardIdx >= 0) {
      nextCards.splice(cardIdx + 1, 0, newCopy);
    } else {
      nextCards.push(newCopy);
    }
    onUpdateDeck({ ...deck, cards: nextCards, updatedAt: new Date().toISOString() });
  };

  const handleRemoveCard = (c: DeckCard) => {
    const cardIdx = findDeckCardIndex(c);
    let nextCards: DeckCard[];
    if (cardIdx >= 0) {
      nextCards = deck.cards.filter((_, i) => i !== cardIdx);
    } else {
      const targetKey = getCardKey(c);
      nextCards = deck.cards.filter((item) => getCardKey(item) !== targetKey);
    }
    const isCommander = isCommanderCard(c);
    const updatedCommander = isCommander && deck.commanderCard?.id === c.card.id ? undefined : deck.commanderCard;
    const updatedPartner = isCommander && deck.partnerCard?.id === c.card.id ? undefined : deck.partnerCard;
    onUpdateDeck({
      ...deck,
      cards: nextCards,
      commanderCard: updatedCommander,
      partnerCard: updatedPartner,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateCardQuantity = (c: DeckCard, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCard(c);
    } else if (newQty > c.quantity) {
      handleAddCardCopy(c);
    } else {
      const cardIdx = findDeckCardIndex(c);
      if (cardIdx >= 0) {
        const nextCards = [...deck.cards];
        nextCards[cardIdx] = { ...c, quantity: newQty };
        onUpdateDeck({ ...deck, cards: nextCards, updatedAt: new Date().toISOString() });
      }
    }
  };

  // Color Filter toggles
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

  // Sorting toggle
  const handleSort = (field: SortColumn) => {
    if (sortColumn === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(field);
      setSortDirection('asc');
    }
  };

  // Card filtering predicate (support both primary name and double-faced faces)
  const filterCardItem = (item: DeckCard) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName =
        item.card.name.toLowerCase().includes(q) ||
        Boolean(item.card.cardFaces?.some((f) => f.name.toLowerCase().includes(q)));
      const matchesType =
        item.card.typeLine.toLowerCase().includes(q) ||
        Boolean(item.card.cardFaces?.some((f) => f.typeLine?.toLowerCase().includes(q)));
      const matchesText =
        item.card.oracleText?.toLowerCase().includes(q) ||
        Boolean(item.card.cardFaces?.some((f) => f.oracleText?.toLowerCase().includes(q))) ||
        false;
      if (!matchesName && !matchesType && !matchesText) return false;
    }

    const cardColors = item.card.colors || [];
    if (isColorlessOnly) {
      if (cardColors.length > 0) return false;
    } else if (isMultiOnly) {
      if (cardColors.length <= 1) return false;
      if (selectedColors.length > 0) {
        if (!cardColors.every((c) => selectedColors.includes(c))) return false;
      }
    } else if (selectedColors.length === 1) {
      if (cardColors.length !== 1 || cardColors[0] !== selectedColors[0]) return false;
    } else if (selectedColors.length > 1) {
      if (colorMatchMode === 'exact') {
        if (
          cardColors.length !== selectedColors.length ||
          !selectedColors.every((c) => cardColors.includes(c))
        ) {
          return false;
        }
      } else {
        if (cardColors.length === 0 || !cardColors.every((c) => selectedColors.includes(c))) {
          return false;
        }
      }
    }

    return true;
  };

  // Card sorting function
  const sortCardItems = (items: DeckCard[]) => {
    if (!sortColumn) return items;

    const rarityRank: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      mythic: 4,
      special: 5,
    };

    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'available': {
          const aLinked = getCollectionItemForCard(a);
          const bLinked = getCollectionItemForCard(b);
          const aAvail = aLinked?.availableQuantity ?? 0;
          const bAvail = bLinked?.availableQuantity ?? 0;
          cmp = aAvail - bAvail;
          break;
        }
        case 'name':
          cmp = a.card.name.localeCompare(b.card.name, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'cmc':
          cmp = (a.card.cmc ?? 0) - (b.card.cmc ?? 0);
          break;
        case 'type':
          cmp = (a.card.typeLine || '').localeCompare(b.card.typeLine || '', 'pt-BR');
          break;
        case 'set':
          cmp = (a.card.setName || a.card.setCode || '').localeCompare(
            b.card.setName || b.card.setCode || '',
            'pt-BR'
          );
          break;
        case 'rarity':
          cmp =
            (rarityRank[a.card.rarity.toLowerCase()] || 0) -
            (rarityRank[b.card.rarity.toLowerCase()] || 0);
          break;
        case 'price':
          cmp = (a.card.priceUsd || 0) - (b.card.priceUsd || 0);
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  };

  const filteredMainCards = useMemo(
    () => mainCards.filter(filterCardItem),
    [mainCards, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode]
  );
  const sortedMainCards = useMemo(() => {
    const commandersList: DeckCard[] = [];
    const nonCommandersList: DeckCard[] = [];

    for (const c of filteredMainCards) {
      if (isCommanderCard(c)) {
        if (
          c.category === 'partner' ||
          (deck.partnerCard &&
            (c.card.id === deck.partnerCard.id ||
              c.card.name.toLowerCase() === deck.partnerCard.name.toLowerCase()))
        ) {
          commandersList.push(c);
        } else {
          commandersList.unshift(c);
        }
      } else {
        nonCommandersList.push(c);
      }
    }

    const sortedNonCommanders = sortCardItems(nonCommandersList);
    return [...commandersList, ...sortedNonCommanders];
  }, [filteredMainCards, isCommanderCard, sortColumn, sortDirection, collection, deck.partnerCard]);

  const filteredSideCards = useMemo(
    () => sideCards.filter(filterCardItem),
    [sideCards, searchQuery, selectedColors, isMultiOnly, isColorlessOnly, colorMatchMode]
  );
  const sortedSideCards = useMemo(
    () => sortCardItems(filteredSideCards),
    [filteredSideCards, sortColumn, sortDirection, collection]
  );

  // Selection helpers for Mainboard & Sideboard
  const allMainSelected =
    sortedMainCards.length > 0 && sortedMainCards.every((c) => selectedCardIds.has(getCardKey(c)));
  const someMainSelected = sortedMainCards.some((c) => selectedCardIds.has(getCardKey(c)));

  const handleToggleSelectAllMain = () => {
    if (allMainSelected) {
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        sortedMainCards.forEach((c) => next.delete(getCardKey(c)));
        return next;
      });
    } else {
      const next = new Set(selectedCardIds);
      sortedMainCards.forEach((c) => next.add(getCardKey(c)));
      setSelectedCardIds(next);
    }
  };

  const allSideSelected =
    sortedSideCards.length > 0 && sortedSideCards.every((c) => selectedCardIds.has(getCardKey(c)));
  const someSideSelected = sortedSideCards.some((c) => selectedCardIds.has(getCardKey(c)));

  const handleToggleSelectAllSide = () => {
    if (allSideSelected) {
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        sortedSideCards.forEach((c) => next.delete(getCardKey(c)));
        return next;
      });
    } else {
      const next = new Set(selectedCardIds);
      sortedSideCards.forEach((c) => next.add(getCardKey(c)));
      setSelectedCardIds(next);
    }
  };

  const handleBatchDeleteDeckCards = () => {
    if (selectedCardIds.size === 0) return;
    const count = selectedCardIds.size;
    if (
      window.confirm(
        `Deseja realmente remover ${count} ${
          count === 1 ? 'carta selecionada' : 'cartas selecionadas'
        } deste deck?`
      )
    ) {
      const nextCards = deck.cards.filter((c) => !selectedCardIds.has(getCardKey(c)));
      onUpdateDeck({
        ...deck,
        cards: nextCards,
        updatedAt: new Date().toISOString(),
      });
      setSelectedCardIds(new Set());
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled((prev) => {
        if (!prev && y > 50) return true;
        if (prev && y < 25) return false;
        return prev;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Navigation & Deck Header (Sticky & Docks to Main Header on scroll) */}
      <div
        className="glass-panel deck-header-panel"
        style={{
          position: 'sticky',
          top: 'var(--app-header-height, 58px)',
          zIndex: 900,
          background: isScrolled ? 'rgba(10, 13, 20, 0.96)' : undefined,
          backdropFilter: isScrolled ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: isScrolled ? 'blur(16px)' : undefined,
          borderTop: isScrolled ? 'none' : undefined,
          borderRadius: isScrolled ? '0 0 14px 14px' : '16px',
          boxShadow: isScrolled ? '0 10px 25px rgba(0, 0, 0, 0.7)' : undefined,
          borderColor: isScrolled ? 'rgba(255, 255, 255, 0.1)' : undefined,
          padding: isScrolled ? '8px 16px' : '20px',
          transition: 'padding 0.15s ease, border-radius 0.15s ease',
        }}
      >
        {isScrolled ? (
          /* Compact Docked Header (Single slim row without taking much space) */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'nowrap',
              width: '100%',
            }}
          >
            {/* Left Group: Back button, deck title, format & count badges, tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onBack}
                title="Voltar aos Decks"
                style={{ padding: '4px 8px', height: '32px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
              >
                <ArrowLeft size={15} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Decks</span>
              </button>

              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '280px',
                  flexShrink: 1,
                }}
                title={deck.name}
              >
                {deck.name}
              </div>

              <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '2px 7px', flexShrink: 0 }}>
                {deck.format.toUpperCase()}
              </span>

              <span
                className={`badge ${
                  totalCardsCount === targetCardsCount ? 'badge-success' : 'badge-warning'
                }`}
                style={{ fontSize: '0.68rem', padding: '2px 7px', flexShrink: 0 }}
              >
                {totalCardsCount} / {targetCardsCount}
              </span>

              {/* Deck Tags in compact mode */}
              {deck.tags && deck.tags.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', flexShrink: 0 }}>
                  {deck.tags.map((tIdOrName) => {
                    const tag = deckTags.find(
                      (t) => t.id === tIdOrName || t.name.toLowerCase() === tIdOrName.toLowerCase()
                    ) || { id: tIdOrName, name: tIdOrName, color: '#3b82f6' };

                    return (
                      <span
                        key={tag.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: tag.color,
                          backgroundColor: `${tag.color}20`,
                          border: `1px solid ${tag.color}50`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: tag.color,
                          }}
                        />
                        {tag.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

              {/* Right Group: Action buttons */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditModalOpen(true)}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Editar nome, formato, comandante ou lista"
                >
                  <Edit3 size={14} /> <span>Editar</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsExportImageModalOpen(true)}
                  disabled={totalCardsCount === 0}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Personalizar e exportar imagem/pôster do deck"
                >
                  <ImageIcon size={14} /> <span>Imagem</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSendDeckToProxies(deck)}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Diagramar 9 cartas por folha A4 e imprimir"
                >
                  <Printer size={14} /> <span>Proxies</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenExportModal(deck.id)}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Exportar lista de cartas"
                >
                  <Upload size={14} /> <span>Exportar</span>
                </button>

                <button
                  className="btn btn-highlight btn-sm"
                  onClick={() => onOpenImportModal?.(deck.id)}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Importar lista de cartas diretamente para este deck"
                >
                  <Download size={14} /> <span>Importar</span>
                </button>
              </div>
            </div>
          ) : (
            /* Normal Expanded Deck Header (When at top of page) */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={onBack}>
                  <ArrowLeft size={16} /> Voltar aos Decks
                </button>
                <span className="badge badge-primary">{deck.format.toUpperCase()}</span>
                <span
                  className={`badge ${
                    totalCardsCount === targetCardsCount ? 'badge-success' : 'badge-warning'
                  }`}
                >
                  {totalCardsCount} / {targetCardsCount} Cartas
                </span>

                {/* Deck Tags */}
                {deck.tags && deck.tags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {deck.tags.map((tIdOrName) => {
                      const tag = deckTags.find(
                        (t) => t.id === tIdOrName || t.name.toLowerCase() === tIdOrName.toLowerCase()
                      ) || { id: tIdOrName, name: tIdOrName, color: '#3b82f6' };

                      return (
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
                            backgroundColor: `${tag.color}20`,
                            border: `1px solid ${tag.color}50`,
                          }}
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
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc' }}>
                    {deck.name}
                  </h1>
                  {deck.description && (
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: '#94a3b8',
                        marginTop: '4px',
                        maxWidth: '640px',
                      }}
                    >
                      {deck.description}
                    </p>
                  )}
                </div>

                {/* Quick Deck Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditModalOpen(true)}
                    title="Editar nome, formato, comandante ou lista de cartas do deck"
                  >
                    <Edit3 size={15} /> Editar
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsExportImageModalOpen(true)}
                    disabled={totalCardsCount === 0}
                    title="Personalizar e exportar imagem/pôster do deck (resoluções, JPG/PNG/PDF, agrupamento de artes)"
                  >
                    <ImageIcon size={15} /> Gerar Imagem do Deck
                  </button>

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
                    title="Exportar lista de cartas para Moxfield, Arena, LigaMagic ou CSV"
                  >
                    <Upload size={15} /> Exportar Deck
                  </button>

                  <button
                    className="btn btn-highlight btn-sm"
                    onClick={() => onOpenImportModal?.(deck.id)}
                    title="Importar lista de cartas diretamente para este deck"
                  >
                    <Download size={15} /> Importar Cartas
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      {/* Interactive Deck Analytics / Charts */}
      <div className="glass-panel" style={{ padding: '26px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: showCharts ? '22px' : '0px',
          }}
        >
          <h2
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <BarChart3 className="text-primary" size={18} />
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

      {/* Filter & View Switcher Bar (Identical to Collection) */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }}
            />
            <input
              type="text"
              className="input-text"
              placeholder="Filtrar por nome, tipo ou texto da carta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px' }}
            />
          </div>

          {/* Color Filter */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${
                !isColorlessOnly && !isMultiOnly && selectedColors.length === 0
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
              onClick={handleResetColors}
            >
              Todas
            </button>
            {(['W', 'U', 'B', 'R', 'G'] as const).map((col) => {
              const isSelected = selectedColors.includes(col);
              const colNames: Record<string, string> = {
                W: 'Branco',
                U: 'Azul',
                B: 'Preto',
                R: 'Vermelho',
                G: 'Verde',
              };
              return (
                <button
                  key={col}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleToggleColor(col)}
                  title={colNames[col]}
                >
                  <span className={`mana-pip mana-pip-${col}`}>{col}</span>
                </button>
              );
            })}
            <button
              className={`btn btn-sm ${isMultiOnly ? 'btn-primary' : 'btn-ghost'}`}
              onClick={handleToggleMulti}
              title="Multicolor"
            >
              Multi
            </button>
            <button
              className={`btn btn-sm ${isColorlessOnly ? 'btn-primary' : 'btn-ghost'}`}
              onClick={handleToggleColorless}
              title="Incolor"
            >
              Incolor
            </button>

            {selectedColors.length > 1 && !isMultiOnly && (
              <button
                className="btn btn-xs btn-secondary"
                style={{ fontSize: '0.72rem', padding: '3px 8px', marginLeft: '4px' }}
                onClick={() => setColorMatchMode((m) => (m === 'exact' ? 'pool' : 'exact'))}
                title="Alternar entre modo Exato e modo Pool de Identidade"
              >
                {colorMatchMode === 'exact' ? 'Exato (=)' : 'Identidade (≤)'}
              </button>
            )}
          </div>

          {/* Layout View Switcher: Grade Visual (Principal) -> Tabela / Lista (Secundária) */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: 'var(--bg-darkest)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredPreview(null);
                handleSetViewMode('grid');
              }}
              title="Visualização em Grade Visual (Principal)"
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setHoveredPreview(null);
                handleSetViewMode('table');
              }}
              title="Visualização em Lista / Tabela (Secundária)"
            >
              <List size={16} />
            </button>
          </div>

          {/* Grid Scale Zoom Slider & Details Toggle */}
          {viewMode === 'grid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${showGridDetails ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleToggleGridDetails}
                title={showGridDetails ? 'Ocultar detalhes (mostrar apenas artes)' : 'Mostrar detalhes completos das cartas'}
                style={{ fontSize: '0.75rem', padding: '4px 10px', height: '32px' }}
              >
                {showGridDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showGridDetails ? 'Só Artes' : 'Com Detalhes'}</span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-darkest)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  height: '32px',
                }}
                title={`Ajustar escala da grade (${gridCardSize}px)`}
              >
                <ZoomOut size={13} style={{ color: '#94a3b8' }} />
                <input
                  type="range"
                  min={110}
                  max={340}
                  step={10}
                  value={gridCardSize}
                  onChange={(e) => handleGridCardSizeChange(Number(e.target.value))}
                  style={{ width: '85px', accentColor: '#818cf8', cursor: 'pointer' }}
                />
                <ZoomIn size={13} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '36px', textAlign: 'right' }}>
                  {gridCardSize}px
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Cards Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
          Baralho Principal ({sortedMainCards.reduce((s, c) => s + c.quantity, 0)} cartas)
        </h3>
      </div>

      {/* Main Cards Display Based on View Mode */}
      {sortedMainCards.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          {mainCards.length === 0
            ? 'Este deck ainda não possui cartas. Clique em "Importar Cartas" acima para adicionar sua lista!'
            : 'Nenhuma carta encontrada com os filtros selecionados.'}
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. VISUAL GRID VIEW */
        <div
          className="cards-grid"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridCardSize}px, 1fr))` }}
        >
          {sortedMainCards.map((c, idx) => {
            const isFoil = c.isFoil || c.card.isFoil;
            const isCmd = isCommanderCard(c);
            const linked = getCollectionItemForCard(c);
            const availQty = linked?.availableQuantity ?? 0;
            const inUseQty = linked?.inUseQuantity ?? c.quantity;

            const isDfc = isDoubleFacedCard(c.card);
            const cardFlipKey = c.instanceId || c.card.id;
            const isFlipped = isDfc && (flippedCardKeys.has(cardFlipKey) || flippedCardKeys.has(c.card.id));

            const frontName =
              c.card.cardFaces?.[0]?.name ||
              (c.card.name.includes(' // ') ? c.card.name.split(' // ')[0].trim() : c.card.name);
            const backName =
              c.card.cardFaces?.[1]?.name ||
              (c.card.name.includes(' // ')
                ? c.card.name.split(' // ')[1].trim()
                : `${c.card.name} (Verso)`);
            const displayName = isFlipped ? backName : frontName;

            const displayImageUrl = isFlipped
              ? c.card.cardFaces?.[1]?.imageUrl || c.card.imageUrl
              : c.card.imageUrl;
            const displayImageUrlLarge = isFlipped
              ? c.card.cardFaces?.[1]?.imageUrlLarge || c.card.cardFaces?.[1]?.imageUrl || displayImageUrl
              : c.card.imageUrlLarge || displayImageUrl;

            return (
              <div
                key={`${c.card.id}-${idx}`}
                className={`card-item-container ${isCmd ? 'is-commander' : ''} ${isFoil ? 'is-foil' : ''}`}
              >
                <div
                  className="card-image-wrapper"
                  onMouseEnter={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setHoveredPreview({
                      url: displayImageUrlLarge,
                      title: displayName,
                      subtitle: `${c.card.setName} (${c.card.setCode.toUpperCase()} #${c.card.collectorNumber})${isFlipped ? ' • [Verso]' : ''}`,
                      badge: isCmd ? 'Comandante ★' : (isFoil ? 'Foil ★' : undefined),
                      badgeColor: '#ffbb00',
                    });
                  }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredPreview(null)}
                >
                  <CardImage
                    name={displayName}
                    imageUrl={displayImageUrl}
                    imageUrlLarge={displayImageUrlLarge}
                    setCode={c.card.setCode}
                    collectorNumber={c.card.collectorNumber}
                    face={isFlipped ? 'back' : 'front'}
                    className="card-image"
                  />

                  {/* Commander Golden Badge */}
                  {isCmd && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'rgba(12, 15, 23, 0.92)',
                        border: '1px solid #ffbb00',
                        borderRadius: '6px',
                        padding: '2px 7px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#ffbb00',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                        zIndex: 2,
                        letterSpacing: '0.5px',
                      }}
                      title="Comandante do Deck"
                    >
                      <Shield size={11} /> COMANDANTE
                    </div>
                  )}

                  {/* Quantity badge (Bottom-Left) */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(12, 15, 23, 0.88)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    {c.quantity}x
                  </div>

                  {/* Flip Button for Double-Faced Cards (Bottom-Right) */}
                  {isDfc && (
                    <button
                      type="button"
                      className={`btn-flip-card ${isFlipped ? 'is-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredPreview(null);
                        handleToggleFlip(cardFlipKey, c.card);
                      }}
                      title={isFlipped ? 'Virar para Frente' : 'Virar para o Verso'}
                    >
                      <RotateCw
                        size={12}
                        style={{
                          transform: isFlipped ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.25s ease',
                        }}
                      />
                      <span>Virar</span>
                    </button>
                  )}

                  {/* Floating quick actions on Art-Only mode */}
                  {!showGridDetails && (
                    <div className="card-art-actions-overlay">
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ padding: '6px', background: 'rgba(12, 15, 23, 0.9)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredPreview(null);
                          onOpenArtSelector(c.card, findDeckCardIndex(c), isFlipped ? 'back' : 'front', c.instanceId, c.category);
                        }}
                        title={isFlipped ? 'Trocar Arte do Verso' : 'Trocar Arte / Edição'}
                      >
                        <ImageIcon size={15} />
                      </button>
                      {onAddToProxies && (
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: '6px', background: 'rgba(12, 15, 23, 0.9)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoveredPreview(null);
                            onAddToProxies(c.card, c.quantity);
                          }}
                          title="Imprimir Proxies"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-icon text-red-400"
                        style={{ padding: '6px', background: 'rgba(12, 15, 23, 0.9)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredPreview(null);
                          handleRemoveCard(c);
                        }}
                        title="Remover do Deck"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Info Footer (Hidden in Art-Only mode) */}
                {showGridDetails && (
                <div
                  style={{
                    padding: '12px',
                    background: '#0c0f17',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayName}
                      {isFlipped && (
                        <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600 }}>
                          (Verso)
                        </span>
                      )}
                    </div>
                    <ManaCostRenderer manaCost={c.card.manaCost} />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <span>{c.card.typeLine.split('—')[0]}</span>
                    {c.card.priceUsd ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        ${(c.card.priceUsd * c.quantity).toFixed(2)}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>

                  {/* Available / In-Use breakdown pill */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: '#10b981' }}>
                      Disp: <strong>{availQty}</strong>
                    </span>
                    <span style={{ color: '#f59e0b' }}>
                      Uso: <strong>{inUseQty}</strong>
                    </span>
                  </div>

                  {/* Qty +/- & Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 'auto',
                      paddingTop: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '3px' }}
                        onClick={() => handleUpdateCardQuantity(c, c.quantity - 1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          minWidth: '18px',
                          textAlign: 'center',
                        }}
                      >
                        {c.quantity}
                      </span>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '3px' }}
                        onClick={() => handleUpdateCardQuantity(c, c.quantity + 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '5px' }}
                        onClick={() => onOpenArtSelector(c.card, findDeckCardIndex(c), isFlipped ? 'back' : 'front', c.instanceId, c.category)}
                        title={isFlipped ? 'Trocar Arte do Verso' : 'Trocar Arte / Edição'}
                      >
                        <ImageIcon size={15} />
                      </button>
                      {onAddToProxies && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '5px' }}
                          onClick={() => onAddToProxies(c.card, c.quantity)}
                          title="Imprimir Proxies desta Carta"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-icon text-red-400"
                        style={{ padding: '5px' }}
                        onClick={() => handleRemoveCard(c)}
                        title="Remover do Deck"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        /* 2. TABLE / LIST VIEW */
        <div>
          {/* Bulk Action Toolbar for Deck Cards */}
          {selectedCardIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                padding: '10px 16px',
                marginBottom: '12px',
                animation: 'modal-enter 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#fca5a5' }}>
                <CheckSquare size={17} color="#ef4444" />
                <span>
                  <strong>{selectedCardIds.size}</strong> {selectedCardIds.size === 1 ? 'carta selecionada' : 'cartas selecionadas'} no deck
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedCardIds(new Set())}
                  style={{ fontSize: '0.8rem', color: '#cbd5e1' }}
                >
                  Limpar Seleção
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={handleBatchDeleteDeckCards}
                >
                  <Trash2 size={14} /> Remover do Deck ({selectedCardIds.size})
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table
              style={{
                width: '100%',
                minWidth: '700px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', color: '#94a3b8' }}>
                  {/* Select All Checkbox */}
                  <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allMainSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allMainSelected && someMainSelected;
                      }}
                      onChange={handleToggleSelectAllMain}
                      style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#ffbb00' }}
                      title={allMainSelected ? 'Desmarcar todas' : 'Selecionar todas as cartas do baralho principal'}
                    />
                  </th>
                  <th
                    onClick={() => handleSort('quantity')}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: sortColumn === 'quantity' ? '#ffbb00' : '#94a3b8',
                    }}
                    title="Ordenar por Quantidade"
                  >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Qtd.</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'quantity' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'quantity' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('available')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'available' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Disponível / Uso"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Disponível / Uso</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'available' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'available' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('name')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'name' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Nome"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Nome</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'name' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('cmc')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'cmc' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Custo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Custo</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'cmc' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'cmc' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('type')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'type' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Tipo"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Tipo</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'type' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('set')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'set' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Edição"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Edição</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'set' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'set' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('rarity')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'rarity' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Raridade"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Raridade</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'rarity' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'rarity' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th
                  onClick={() => handleSort('price')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortColumn === 'price' ? '#ffbb00' : '#94a3b8',
                  }}
                  title="Ordenar por Preço"
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>Preço</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        opacity: sortColumn === 'price' ? 1 : 0.25,
                      }}
                    >
                      {sortColumn === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedMainCards.map((c, idx) => {
                const linked = getCollectionItemForCard(c);
                const availQty = linked?.availableQuantity ?? 0;
                const inUseQty = linked?.inUseQuantity ?? c.quantity;
                const isFoil = c.isFoil || c.card.isFoil;
                const isCmd = isCommanderCard(c);
                const cardKey = getCardKey(c);
                const isSelected = selectedCardIds.has(cardKey);

                return (
                  <tr
                    key={cardKey}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      backgroundColor: isSelected
                        ? 'rgba(239, 68, 68, 0.08)'
                        : isCmd
                        ? 'rgba(255, 187, 0, 0.06)'
                        : 'transparent',
                      borderLeft: isCmd ? '3px solid #ffbb00' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isCmd
                          ? 'rgba(255, 187, 0, 0.12)'
                          : 'rgba(255,255,255,0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isCmd
                          ? 'rgba(255, 187, 0, 0.06)'
                          : 'transparent';
                      }
                    }}
                  >
                    {/* Row Checkbox */}
                    <td style={{ width: '40px', padding: '10px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectCard(cardKey)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#ffbb00' }}
                      />
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '2px' }}
                          onClick={() => handleUpdateCardQuantity(c, c.quantity - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{c.quantity}</span>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '2px' }}
                          onClick={() => handleUpdateCardQuantity(c, c.quantity + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{availQty}</span>
                      <span style={{ color: '#64748b' }}> / </span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{inUseQty}</span>
                    </td>

                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#f8fafc' }}>
                      <span
                        style={{
                          cursor: 'pointer',
                          borderBottom: '1px dotted rgba(148, 163, 184, 0.45)',
                          paddingBottom: '1px',
                          transition: 'color 0.15s ease, border-color 0.15s ease',
                          color: isCmd ? '#ffbb00' : undefined,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#a5b4fc';
                          e.currentTarget.style.borderColor = '#818cf8';
                          setMousePos({ x: e.clientX, y: e.clientY });
                          setHoveredPreview({
                            url: c.card.imageUrlLarge || c.card.imageUrl,
                            title: c.card.name,
                            subtitle: `${c.card.setName} (${c.card.setCode.toUpperCase()} #${c.card.collectorNumber})`,
                            badge: isCmd ? 'Comandante ★' : (isFoil ? 'Foil ★' : undefined),
                            badgeColor: '#ffbb00',
                          });
                        }}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = isCmd ? '#ffbb00' : '#f8fafc';
                          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                          setHoveredPreview(null);
                        }}
                      >
                        {c.card.name}
                      </span>{' '}
                      {isCmd && (
                        <span
                          style={{
                            background: 'rgba(255, 187, 0, 0.18)',
                            color: '#ffbb00',
                            border: '1px solid rgba(255, 187, 0, 0.4)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            marginRight: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Shield size={10} /> CMD
                        </span>
                      )}
                      {isFoil && <Sparkles size={12} className="inline text-amber-400" />}
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
                          onClick={() => onOpenArtSelector(c.card, findDeckCardIndex(c), undefined, c.instanceId, c.category)}
                          title="Trocar Arte"
                        >
                          <ImageIcon size={15} />
                        </button>
                        {onAddToProxies && (
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ padding: '4px' }}
                            onClick={() => onAddToProxies(c.card, c.quantity)}
                            title="Imprimir Proxies desta Carta"
                          >
                            <Printer size={15} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon text-red-400"
                          style={{ padding: '4px' }}
                          onClick={() => handleRemoveCard(c)}
                          title="Remover do Deck"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Sideboard Section (if exists) */}
      {sideCards.length > 0 && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Sideboard ({sortedSideCards.reduce((s, c) => s + c.quantity, 0)} cartas)
            </h3>
          </div>

          {viewMode === 'table' ? (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: '#94a3b8' }}>
                    {/* Select All Checkbox for Sideboard */}
                    <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allSideSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allSideSelected && someSideSelected;
                        }}
                        onChange={handleToggleSelectAllSide}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#ffbb00' }}
                        title={allSideSelected ? 'Desmarcar todas' : 'Selecionar todas as cartas do sideboard'}
                      />
                    </th>
                    <th style={{ padding: '12px 16px' }}>Qtd.</th>
                    <th style={{ padding: '12px 16px' }}>Disponível / Uso</th>
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
                  {sortedSideCards.map((c, idx) => {
                    const linked = getCollectionItemForCard(c);
                    const availQty = linked?.availableQuantity ?? 0;
                    const inUseQty = linked?.inUseQuantity ?? c.quantity;
                    const isFoil = c.isFoil || c.card.isFoil;
                    const cardKey = getCardKey(c);
                    const isSelected = selectedCardIds.has(cardKey);

                    return (
                      <tr
                        key={`side-${cardKey}`}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.15s ease',
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* Row Checkbox */}
                        <td style={{ width: '40px', padding: '10px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectCard(cardKey)}
                            style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#ffbb00' }}
                          />
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 700 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ padding: '2px' }}
                              onClick={() => handleUpdateCardQuantity(c, c.quantity - 1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span>{c.quantity}</span>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ padding: '2px' }}
                              onClick={() => handleUpdateCardQuantity(c, c.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>{availQty}</span>
                          <span style={{ color: '#64748b' }}> / </span>
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{inUseQty}</span>
                        </td>

                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#f8fafc' }}>
                          <span
                            style={{
                              cursor: 'pointer',
                              borderBottom: '1px dotted rgba(148, 163, 184, 0.45)',
                              paddingBottom: '1px',
                              transition: 'color 0.15s ease, border-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#a5b4fc';
                              e.currentTarget.style.borderColor = '#818cf8';
                              setMousePos({ x: e.clientX, y: e.clientY });
                              setHoveredPreview({
                                url: c.card.imageUrlLarge || c.card.imageUrl,
                                title: c.card.name,
                                subtitle: `${c.card.setName} (${c.card.setCode.toUpperCase()} #${c.card.collectorNumber})`,
                                badge: isFoil ? 'Foil ★' : undefined,
                              });
                            }}
                            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#f8fafc';
                              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.45)';
                              setHoveredPreview(null);
                            }}
                          >
                            {c.card.name}
                          </span>{' '}
                          {isFoil && <Sparkles size={12} className="inline text-amber-400" />}
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
                              onClick={() => onOpenArtSelector(c.card, findDeckCardIndex(c), undefined, c.instanceId, c.category)}
                              title="Trocar Arte"
                            >
                              <ImageIcon size={15} />
                            </button>
                            {onAddToProxies && (
                              <button
                                className="btn btn-ghost btn-icon"
                                style={{ padding: '4px' }}
                                onClick={() => onAddToProxies(c.card, c.quantity)}
                                title="Imprimir Proxies desta Carta"
                              >
                                <Printer size={15} />
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-icon text-red-400"
                              style={{ padding: '4px' }}
                              onClick={() => handleRemoveCard(c)}
                              title="Remover do Deck"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="cards-grid"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridCardSize}px, 1fr))` }}
            >
              {sortedSideCards.map((c, idx) => {
                const isFoil = c.isFoil || c.card.isFoil;
                return (
                  <div key={`side-grid-${getCardKey(c)}`} className={`card-item-container ${isFoil ? 'is-foil' : ''}`}>
                    <div
                      className="card-image-wrapper"
                      onMouseEnter={(e) => {
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setHoveredPreview({
                          url: c.card.imageUrlLarge || c.card.imageUrl,
                          title: c.card.name,
                          subtitle: `${c.card.setName} (${c.card.setCode.toUpperCase()} #${c.card.collectorNumber})`,
                          badge: isFoil ? 'Foil ★' : undefined,
                        });
                      }}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredPreview(null)}
                    >
                      <CardImage
                        name={c.card.name}
                        imageUrl={c.card.imageUrl}
                        imageUrlLarge={c.card.imageUrlLarge}
                        setCode={c.card.setCode}
                        collectorNumber={c.card.collectorNumber}
                        className="card-image"
                      />

                      {/* Quantity badge (Bottom-Left) */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          left: '8px',
                          background: 'rgba(12, 15, 23, 0.88)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#f8fafc',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                          zIndex: 2,
                          pointerEvents: 'none',
                        }}
                      >
                        {c.quantity}x
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Card Zoom Preview (matching Art Selector Modal hover) */}
      <CardHoverPreview preview={hoveredPreview} mousePos={mousePos} />
      {/* Edit Deck Modal (Allows renaming, format changes and card list editing) */}
      {isEditModalOpen && (
        <EditDeckModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          deck={deck}
          collection={collection}
          deckTags={deckTags}
          onOpenManageTags={onOpenManageTags}
          onSaveDeck={(updated) => {
            onUpdateDeck(updated);
          }}
        />
      )}

      {/* Export Deck Poster / Custom Image Modal */}
      {isExportImageModalOpen && (
        <ExportDeckImageModal
          isOpen={isExportImageModalOpen}
          onClose={() => setIsExportImageModalOpen(false)}
          deck={deck}
        />
      )}
    </div>
  );
};
