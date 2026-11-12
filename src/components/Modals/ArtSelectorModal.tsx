import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardPrint, isDoubleFacedCard, CardFace } from '../../types';
import { getCardPrints, resolveCardFaces, MELD_PAIRS_MAP, isOldFramePrint } from '../../services/scryfall';
import {
  searchMpcFillAlters,
  MpcCardPrint,
  createPrintFromMpcId,
  createPrintFromCustomImage,
  extractAltersFromXmlForCard,
  extractGoogleDriveId,
  isMpcCardImage,
} from '../../services/mpcFillService';
import { compressImageFile } from '../../services/imageUtils';
import { CardImage } from '../Common/CardImage';
import { CardHoverPreview } from '../Common/CardHoverPreview';
import {
  X,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  Image as ImageIcon,
  Search,
  Layers,
  Sparkles,
  Upload,
  ExternalLink,
  FileCode,
  AlertCircle,
  Plus,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useModalOverlay } from '../../hooks/useModalOverlay';

export type ArtTab = 'official' | 'mpcfill' | 'custom';

interface ArtSelectorModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPrint: (
    selectedPrint: CardPrint,
    targetFace?: 'front' | 'back',
    resolvedFaces?: CardFace[] | null
  ) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  cardIndexLabel?: string;
  initialFace?: 'front' | 'back';
}

export const ArtSelectorModal: React.FC<ArtSelectorModalProps> = ({
  card,
  isOpen,
  onClose,
  onSelectPrint,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  cardIndexLabel,
  initialFace = 'front',
}) => {
  useModalOverlay(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<ArtTab>('official');
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);

  // Active face state for double-faced cards ('front' vs 'back')
  const [activeFace, setActiveFace] = useState<'front' | 'back'>(initialFace);
  const [dfcFaces, setDfcFaces] = useState<CardFace[] | null>(card?.cardFaces || null);
  const [resolvingFaces, setResolvingFaces] = useState<boolean>(false);

  // Local immediate thumbnail and large image overrides for instant real-time header and comparison preview
  const [faceThumbnails, setFaceThumbnails] = useState<{ front?: string; back?: string }>({});
  const [faceLargeImages, setFaceLargeImages] = useState<{ front?: string; back?: string }>({});

  const isCardDfc = useMemo(() => {
    if (!card) return false;
    const layout = card.layout?.toLowerCase();
    if (
      layout &&
      ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
        layout
      )
    ) {
      return false;
    }
    if (card.typeLine?.toLowerCase().includes('adventure') && !layout?.includes('transform')) {
      return false;
    }
    if (dfcFaces && dfcFaces.length >= 2) return true;
    if (card.cardFaces && card.cardFaces.length >= 2) return true;
    return isDoubleFacedCard(card);
  }, [dfcFaces, card]);

  const frontFaceName = useMemo(() => {
    if (!card) return '';
    let fName = '';
    if (dfcFaces?.[0]?.name) {
      fName = dfcFaces[0].name;
    } else if (card.cardFaces?.[0]?.name) {
      fName = card.cardFaces[0].name;
    } else {
      fName = card.name;
    }
    if (fName.includes('//')) {
      fName = fName.split('//')[0];
    }
    return fName.trim();
  }, [card, dfcFaces]);

  const backFaceName = useMemo(() => {
    if (!card) return '';
    if (dfcFaces?.[1]?.name) {
      let bName = dfcFaces[1].name;
      if (bName.includes('//')) bName = bName.split('//')[1] || bName;
      return bName.trim();
    }
    if (card.cardFaces?.[1]?.name) {
      let bName = card.cardFaces[1].name;
      if (bName.includes('//')) bName = bName.split('//')[1] || bName;
      return bName.trim();
    }
    if (card.name.includes('//')) {
      return card.name.split('//')[1].trim();
    }
    if (card.meldResultName) return card.meldResultName.trim();
    const normalized = card.name.toLowerCase().trim();
    if (MELD_PAIRS_MAP[normalized]) return MELD_PAIRS_MAP[normalized];
    return '';
  }, [card, dfcFaces]);

  const currentFaceName = useMemo(() => {
    let name = activeFace === 'back' ? (backFaceName || `${card?.name || ''} (Verso)`) : frontFaceName;
    if (activeFace === 'front' && name.includes('//')) {
      name = name.split('//')[0].trim();
    } else if (activeFace === 'back' && name.includes('//')) {
      name = name.split('//')[1].trim();
    }
    return name.trim();
  }, [activeFace, backFaceName, frontFaceName, card?.name]);

  const currentFrontThumbnail = useMemo(() => {
    if (faceThumbnails.front) return faceThumbnails.front;
    if (!card) return '';
    return (
      card.cardFaces?.[0]?.imageUrl ||
      card.cardFaces?.[0]?.imageUrlSmall ||
      dfcFaces?.[0]?.imageUrl ||
      dfcFaces?.[0]?.imageUrlSmall ||
      card.imageUrl ||
      card.imageUrlSmall
    );
  }, [card, dfcFaces, faceThumbnails.front]);

  const currentBackThumbnail = useMemo(() => {
    if (faceThumbnails.back) return faceThumbnails.back;
    if (!card) return '';
    if (card.cardFaces?.[1]?.imageUrl || card.cardFaces?.[1]?.imageUrlSmall) {
      return card.cardFaces[1].imageUrl || card.cardFaces[1].imageUrlSmall;
    }
    if (dfcFaces?.[1]?.imageUrl || dfcFaces?.[1]?.imageUrlSmall) {
      return dfcFaces[1].imageUrl || dfcFaces[1].imageUrlSmall;
    }
    if (
      card.setCode &&
      card.collectorNumber &&
      card.collectorNumber !== '★' &&
      card.setCode !== 'MPC' &&
      card.setCode !== 'CUSTOM'
    ) {
      return `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${encodeURIComponent(card.collectorNumber)}?format=image&version=small&face=back`;
    }
    return card.imageUrl || card.imageUrlSmall;
  }, [card, dfcFaces, faceThumbnails.back]);

  // Current Card Comparison Preview Data (persistent preview on the left side)
  const currentPreviewData = useMemo(() => {
    if (!card) return null;

    if (isCardDfc) {
      if (activeFace === 'back') {
        let url =
          faceLargeImages.back ||
          faceThumbnails.back ||
          card.cardFaces?.[1]?.imageUrlLarge ||
          card.cardFaces?.[1]?.imageUrl ||
          dfcFaces?.[1]?.imageUrlLarge ||
          dfcFaces?.[1]?.imageUrl ||
          currentBackThumbnail;

        if (
          !url &&
          card.setCode &&
          card.collectorNumber &&
          card.collectorNumber !== '★' &&
          card.setCode !== 'MPC' &&
          card.setCode !== 'CUSTOM'
        ) {
          url = `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${encodeURIComponent(card.collectorNumber)}?format=image&version=large&face=back`;
        }

        const faceName =
          card.cardFaces?.[1]?.name ||
          dfcFaces?.[1]?.name ||
          backFaceName ||
          `${card.name} (Verso)`;

        const artist =
          card.cardFaces?.[1]?.artist ||
          dfcFaces?.[1]?.artist ||
          card.artist;

        return {
          url: url || card.imageUrlLarge || card.imageUrl,
          name: faceName,
          faceLabel: 'Verso',
          artist,
          setCode: card.setCode,
          setName: card.setName,
          collectorNumber: card.collectorNumber,
          isDfc: true,
        };
      } else {
        const url =
          faceLargeImages.front ||
          faceThumbnails.front ||
          card.cardFaces?.[0]?.imageUrlLarge ||
          card.cardFaces?.[0]?.imageUrl ||
          dfcFaces?.[0]?.imageUrlLarge ||
          dfcFaces?.[0]?.imageUrl ||
          currentFrontThumbnail ||
          card.imageUrlLarge ||
          card.imageUrl;

        const faceName =
          card.cardFaces?.[0]?.name ||
          dfcFaces?.[0]?.name ||
          frontFaceName ||
          card.name;

        const artist =
          card.cardFaces?.[0]?.artist ||
          dfcFaces?.[0]?.artist ||
          card.artist;

        return {
          url: url || card.imageUrlLarge || card.imageUrl,
          name: faceName,
          faceLabel: 'Frente',
          artist,
          setCode: card.setCode,
          setName: card.setName,
          collectorNumber: card.collectorNumber,
          isDfc: true,
        };
      }
    }

    // Single-faced card
    const url =
      faceLargeImages.front ||
      faceThumbnails.front ||
      card.imageUrlLarge ||
      card.imageUrl;

    return {
      url,
      name: card.name,
      faceLabel: undefined,
      artist: card.artist,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      isDfc: false,
    };
  }, [
    card,
    isCardDfc,
    activeFace,
    faceLargeImages,
    faceThumbnails,
    dfcFaces,
    frontFaceName,
    backFaceName,
    currentFrontThumbnail,
    currentBackThumbnail,
  ]);

  const activeModalCardKeyRef = useRef<string>('');

  // Sync face resolution when card or modal opens (or when navigating to another card in the deck/collection)
  useEffect(() => {
    if (!isOpen || !card) {
      activeModalCardKeyRef.current = '';
      setDfcFaces(null);
      setResolvingFaces(false);
      setFaceThumbnails({});
      setFaceLargeImages({});
      return;
    }

    const currentCardKey = `${card.name}|${cardIndexLabel || ''}`;
    // If the same card is already loaded, do NOT reset active face or clear local thumbnails!
    if (activeModalCardKeyRef.current === currentCardKey) {
      return;
    }
    activeModalCardKeyRef.current = currentCardKey;

    setActiveFace(initialFace || 'front');
    setFaceThumbnails({});
    setFaceLargeImages({});
    setDfcFaces(null);

    const cardLayout = card.layout?.toLowerCase();
    const isSingleFaced =
      (cardLayout &&
        ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
          cardLayout
        )) ||
      (card.typeLine?.toLowerCase().includes('adventure') && !cardLayout?.includes('transform'));

    if (isSingleFaced) {
      setDfcFaces(null);
    } else if (card.cardFaces && card.cardFaces.length >= 2) {
      setDfcFaces(card.cardFaces);
    } else {
      // Automatically attempt to resolve faces for double-faced cards, MDFCs, meld, or legacy cards
      setResolvingFaces(true);
      resolveCardFaces(card)
        .then((faces) => {
          if (faces && faces.length >= 2) {
            setDfcFaces(faces);
          } else {
            setDfcFaces(null);
          }
        })
        .catch(() => {
          setDfcFaces(null);
        })
        .finally(() => setResolvingFaces(false));
    }
  }, [isOpen, initialFace, card?.name, cardIndexLabel]);

  // Official Prints State (Scryfall)
  const [officialPrints, setOfficialPrints] = useState<CardPrint[]>([]);
  const [loadingOfficial, setLoadingOfficial] = useState(false);
  const [filterOfficialQuery, setFilterOfficialQuery] = useState('');
  const [officialSortBy, setOfficialSortBy] = useState<
    'released-desc' | 'released-asc' | 'price-asc' | 'price-desc' | 'set-name' | 'artist'
  >('released-desc');
  const [officialTypeFilter, setOfficialTypeFilter] = useState<'all' | 'old-frame' | 'regular' | 'special' | 'with-price'>('all');
  const [officialRenderLimit, setOfficialRenderLimit] = useState<number>(40);

  // MPCFill Alters State
  const [mpcPrints, setMpcPrints] = useState<MpcCardPrint[]>([]);
  const [loadingMpc, setLoadingMpc] = useState(false);
  const [mpcMinDpi, setMpcMinDpi] = useState<number>(200);
  const [mpcFilterText, setMpcFilterText] = useState<string>('');
  const [mpcSortBy, setMpcSortBy] = useState<
    'best-creators' | 'dpi-desc' | 'dpi-asc' | 'recent' | 'oldest' | 'name' | 'source'
  >('best-creators');
  const [mpcSourceFilter, setMpcSourceFilter] = useState<string>('');
  const [mpcTagFilter, setMpcTagFilter] = useState<string>('');
  const [mpcDriveInput, setMpcDriveInput] = useState('');
  const [mpcError, setMpcError] = useState<string | null>(null);
  const [mpcProxyNotice, setMpcProxyNotice] = useState<boolean>(false);
  const [mpcRenderLimit, setMpcRenderLimit] = useState<number>(40);
  const mpcXmlInputRef = useRef<HTMLInputElement>(null);

  // References for scroll containers to enable full-screen wheel scrolling
  const officialScrollRef = useRef<HTMLDivElement>(null);
  const mpcScrollRef = useRef<HTMLDivElement>(null);
  const customScrollRef = useRef<HTMLDivElement>(null);

  // Custom User Art State
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customArtist, setCustomArtist] = useState<string>('');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isCompressingCustomImage, setIsCompressingCustomImage] = useState<boolean>(false);
  const customFileInputRef = useRef<HTMLInputElement>(null);

  // Active print highlight
  const [activePrintId, setActivePrintId] = useState<string>('');
  const loadedCardNameRef = useRef<string | null>(null);

  // Detect if current card is a token or utility token card
  const isCardToken = useMemo(() => {
    if (!card) return false;
    if (card.layout === 'token' || card.layout === 'double_faced_token') return true;
    const tl = (card.typeLine || '').toLowerCase();
    return tl.includes('token') || card.name.toLowerCase().includes('token');
  }, [card]);

  // MPCFill Catalog Target Type ('CARD' vs 'TOKEN')
  const [mpcCardType, setMpcCardType] = useState<'CARD' | 'TOKEN'>('CARD');

  // Zoomed Hover Preview State for inspection
  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    dpi?: number;
  } | null>(null);
  const [previewMousePos, setPreviewMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fetch MPCFill alters callback
  const fetchMpcAlters = useCallback(
    async (
      cardName: string,
      minDpi: number = 200,
      overrideType?: 'CARD' | 'TOKEN',
      overrideTypeLine?: string
    ) => {
      setLoadingMpc(true);
      setMpcError(null);
      setMpcProxyNotice(false);
      try {
        const typeToUse = overrideType || mpcCardType;
        const typeLineToUse = overrideTypeLine || card?.typeLine;
        const alters = await searchMpcFillAlters(cardName, {
          minDpi,
          cardType: typeToUse,
          typeLine: typeLineToUse,
        });
        setMpcPrints(alters);
        if (alters.length === 0) {
          setMpcError(null);
        }
      } catch (err: any) {
        if (err?.message === 'PROXY_RETURNED_HTML') {
          setMpcProxyNotice(true);
        } else {
          setMpcError(
            'Não foi possível conectar à API do MPCFill. Você pode colar o link do Drive ou carregar um XML.'
          );
        }
        setMpcPrints([]);
      } finally {
        setLoadingMpc(false);
      }
    },
    [mpcCardType, card?.typeLine]
  );

  // Manual reload for official prints (Scryfall)
  const handleReloadOfficialPrints = useCallback(() => {
    if (!card) return;
    setLoadingOfficial(true);
    getCardPrints(card, true)
      .then((data) => {
        setOfficialPrints(data);
        const cardLayout = card.layout?.toLowerCase();
        const isSingleFaced =
          (cardLayout &&
            ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
              cardLayout
            )) ||
          (card.typeLine?.toLowerCase().includes('adventure') && !cardLayout?.includes('transform'));

        if (!isSingleFaced) {
          const dfcPrint = data.find((p) => p.cardFaces && p.cardFaces.length >= 2);
          if (dfcPrint && dfcPrint.cardFaces) {
            setDfcFaces((prev) => (prev && prev.length >= 2 ? prev : dfcPrint.cardFaces!));
          }
        }
      })
      .finally(() => {
        setLoadingOfficial(false);
      });
  }, [card]);

  // Reset and load on open, or when navigating to a different card name
  useEffect(() => {
    if (!isOpen) {
      loadedCardNameRef.current = null;
      setOfficialPrints([]);
      setMpcPrints([]);
      return;
    }

    if (!card) return;

    // If prints for this exact card name are already loaded, do NOT reload or flash!
    if (loadedCardNameRef.current === card.name && officialPrints.length > 0) {
      setActivePrintId(card.id);
      if (officialScrollRef.current) officialScrollRef.current.scrollTop = 0;
      if (mpcScrollRef.current) mpcScrollRef.current.scrollTop = 0;
      if (customScrollRef.current) customScrollRef.current.scrollTop = 0;
      return;
    }

    loadedCardNameRef.current = card.name;
    let cancelled = false;

    setActivePrintId(card.id);
    if (officialScrollRef.current) officialScrollRef.current.scrollTop = 0;
    if (mpcScrollRef.current) mpcScrollRef.current.scrollTop = 0;
    if (customScrollRef.current) customScrollRef.current.scrollTop = 0;
    setOfficialRenderLimit(40);
    setMpcRenderLimit(40);
    setFilterOfficialQuery('');
    setMpcDriveInput('');
    setMpcError(null);
    setMpcProxyNotice(false);
    setMpcFilterText('');
    setMpcSourceFilter('');
    setMpcTagFilter('');
    setCustomImageUrl('');
    setCustomTitle(
      activeFace === 'back'
        ? `Arte Customizada de ${backFaceName}`
        : `Arte Customizada de ${frontFaceName}`
    );
    setCustomArtist('');
    setCustomUrlInput('');
    setHoveredPreview(null);

    // Auto-detect if this card is a token to filter only token alters
    const initialCardType: 'CARD' | 'TOKEN' = isCardToken ? 'TOKEN' : 'CARD';
    setMpcCardType(initialCardType);

    // 1. Load official prints from Scryfall
    setLoadingOfficial(true);
    getCardPrints(card)
      .then((data) => {
        if (!cancelled) {
          setOfficialPrints(data);
          const cardLayout = card.layout?.toLowerCase();
          const isSingleFaced =
            (cardLayout &&
              ['split', 'adventure', 'flip', 'aftermath', 'normal', 'leveler', 'saga', 'class', 'case', 'prototype'].includes(
                cardLayout
              )) ||
            (card.typeLine?.toLowerCase().includes('adventure') && !cardLayout?.includes('transform'));

          if (!isSingleFaced) {
            const dfcPrint = data.find((p) => p.cardFaces && p.cardFaces.length >= 2);
            if (dfcPrint && dfcPrint.cardFaces) {
              setDfcFaces((prev) => (prev && prev.length >= 2 ? prev : dfcPrint.cardFaces!));
            }
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOfficial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, card?.name, isCardToken]);

  // Fetch MPCFill community alters whenever card or active face changes
  const lastMpcTargetRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen || !card) {
      lastMpcTargetRef.current = '';
      return;
    }
    // If waiting for DFC faces to resolve and back face is active, wait until resolved!
    if (activeFace === 'back' && !backFaceName && resolvingFaces) {
      return;
    }
    const targetName = currentFaceName;
    if (!targetName) return;

    const cacheKey = `${card.name}-${activeFace}-${targetName}`;
    if (lastMpcTargetRef.current === cacheKey) return;
    lastMpcTargetRef.current = cacheKey;
    const initialCardType: 'CARD' | 'TOKEN' = isCardToken ? 'TOKEN' : 'CARD';
    fetchMpcAlters(targetName, mpcMinDpi, initialCardType, card.typeLine);
  }, [isOpen, activeFace, card?.name, currentFaceName, isCardToken, fetchMpcAlters, mpcMinDpi, resolvingFaces]);

  // Keyboard navigation for previous/next card (Left/Right arrows or A/D keys when not typing)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          (activeElement as HTMLElement).isContentEditable);
      if (isInput) return;

      // Ignore if modifier keys are pressed (e.g. Ctrl+A, Cmd+A, Alt+D, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      if ((e.key === 'ArrowLeft' || key === 'a') && hasPrev && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      } else if ((e.key === 'ArrowRight' || key === 'd') && hasNext && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onNavigatePrev, onNavigateNext]);

  // Scroll forwarding: allow scrolling the active grid from anywhere on the screen (backdrop, header, left preview, etc.)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalWheel = (e: WheelEvent) => {
      const activeContainer =
        activeTab === 'official'
          ? officialScrollRef.current
          : activeTab === 'mpcfill'
          ? mpcScrollRef.current
          : customScrollRef.current;

      if (!activeContainer) return;

      // If the cursor is already directly over the active scroll container, allow native scroll
      if (activeContainer.contains(e.target as Node)) {
        return;
      }

      // If the cursor is anywhere else on screen (backdrop, header, left preview, filter bar, etc.),
      // forward the wheel delta to the active card grid
      activeContainer.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: 'auto',
      });
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, [isOpen, activeTab]);

  // Unique artists/sources available in the loaded MPCFill alters for filtering
  const availableMpcSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of mpcPrints) {
      const src = (p.artist || p.sourceName || '').trim();
      if (src && src !== 'Comunidade MPCFill') {
        counts.set(src, (counts.get(src) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [mpcPrints]);

  // Unique tags/styles available in the loaded MPCFill alters for filtering
  const availableMpcTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of mpcPrints) {
      if (p.tags && Array.isArray(p.tags)) {
        for (const t of p.tags) {
          const cleanTag = t.trim();
          if (cleanTag && !['mpcfill', 'alters', 'proxy'].includes(cleanTag.toLowerCase())) {
            counts.set(cleanTag, (counts.get(cleanTag) || 0) + 1);
          }
        }
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [mpcPrints]);

  // Filter and sort official prints
  const filteredOfficialPrints = useMemo(() => {
    let list = [...officialPrints];
    const q = filterOfficialQuery.trim().toLowerCase();

    // 1. Text filter
    if (q) {
      list = list.filter(
        (p) =>
          p.setName.toLowerCase().includes(q) ||
          p.setCode.toLowerCase().includes(q) ||
          p.collectorNumber.toLowerCase().includes(q) ||
          (p.artist && p.artist.toLowerCase().includes(q)) ||
          (p.releasedAt && p.releasedAt.includes(q))
      );
    }

    // 2. Type / Category filter
    if (officialTypeFilter === 'old-frame') {
      list = list.filter((p) => isOldFramePrint(p));
    } else if (officialTypeFilter === 'regular') {
      list = list.filter((p) => {
        const lowerSet = p.setName.toLowerCase();
        const code = p.setCode.toLowerCase();
        const isSpecial =
          lowerSet.includes('secret lair') ||
          lowerSet.includes('promo') ||
          lowerSet.includes('special guest') ||
          lowerSet.includes('timeshifted') ||
          code.startsWith('sl') ||
          code === 'plist' ||
          code === 'fmb1' ||
          code === 'mb2' ||
          p.collectorNumber.startsWith('★');
        return !isSpecial;
      });
    } else if (officialTypeFilter === 'special') {
      list = list.filter((p) => {
        const lowerSet = p.setName.toLowerCase();
        const code = p.setCode.toLowerCase();
        const isSpecial =
          lowerSet.includes('secret lair') ||
          lowerSet.includes('promo') ||
          lowerSet.includes('special guest') ||
          lowerSet.includes('timeshifted') ||
          code.startsWith('sl') ||
          code === 'plist' ||
          code === 'fmb1' ||
          code === 'mb2' ||
          p.collectorNumber.startsWith('★');
        return isSpecial;
      });
    } else if (officialTypeFilter === 'with-price') {
      list = list.filter((p) => p.priceUsd !== undefined && p.priceUsd > 0);
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (officialSortBy === 'released-desc') {
        const dateA = a.releasedAt || '0000-00-00';
        const dateB = b.releasedAt || '0000-00-00';
        const diff = dateB.localeCompare(dateA);
        if (diff !== 0) return diff;
        return (parseInt(a.collectorNumber, 10) || 0) - (parseInt(b.collectorNumber, 10) || 0);
      }
      if (officialSortBy === 'released-asc') {
        const dateA = a.releasedAt || '9999-99-99';
        const dateB = b.releasedAt || '9999-99-99';
        const diff = dateA.localeCompare(dateB);
        if (diff !== 0) return diff;
        return (parseInt(a.collectorNumber, 10) || 0) - (parseInt(b.collectorNumber, 10) || 0);
      }
      if (officialSortBy === 'price-asc') {
        const priceA = a.priceUsd !== undefined && a.priceUsd > 0 ? a.priceUsd : 999999;
        const priceB = b.priceUsd !== undefined && b.priceUsd > 0 ? b.priceUsd : 999999;
        return priceA - priceB;
      }
      if (officialSortBy === 'price-desc') {
        const priceA = a.priceUsd !== undefined && a.priceUsd > 0 ? a.priceUsd : -1;
        const priceB = b.priceUsd !== undefined && b.priceUsd > 0 ? b.priceUsd : -1;
        return priceB - priceA;
      }
      if (officialSortBy === 'set-name') {
        return a.setName.localeCompare(b.setName);
      }
      if (officialSortBy === 'artist') {
        const artistA = a.artist || '';
        const artistB = b.artist || '';
        return artistA.localeCompare(artistB);
      }
      return 0;
    });

    return list;
  }, [officialPrints, filterOfficialQuery, officialTypeFilter, officialSortBy]);

  // Filter and sort MPCFill community alters
  const filteredMpcPrints = useMemo(() => {
    let list = [...mpcPrints];
    const q = mpcFilterText.trim().toLowerCase();

    // 1. Text filter
    if (q) {
      list = list.filter(
        (p) =>
          p.setName.toLowerCase().includes(q) ||
          (p.artist && p.artist.toLowerCase().includes(q)) ||
          (p.sourceName && p.sourceName.toLowerCase().includes(q)) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
          (p.collectorNumber && p.collectorNumber.toLowerCase().includes(q))
      );
    }

    // 2. Specific source/artist filter
    if (mpcSourceFilter) {
      const targetSource = mpcSourceFilter.toLowerCase();
      list = list.filter(
        (p) =>
          (p.artist && p.artist.toLowerCase() === targetSource) ||
          (p.sourceName && p.sourceName.toLowerCase() === targetSource)
      );
    }

    // 3. Specific tag/style filter
    if (mpcTagFilter) {
      const targetTag = mpcTagFilter.toLowerCase();
      list = list.filter(
        (p) => p.tags && p.tags.some((t) => t.toLowerCase() === targetTag)
      );
    }

    // 4. Sorting
    list.sort((a, b) => {
      const dpiA = a.dpi || parseInt(a.collectorNumber, 10) || 0;
      const dpiB = b.dpi || parseInt(b.collectorNumber, 10) || 0;

      if (mpcSortBy === 'best-creators') {
        const srcA = a.sourceId !== undefined ? a.sourceId : 9999;
        const srcB = b.sourceId !== undefined ? b.sourceId : 9999;
        if (srcA !== srcB) return srcA - srcB;

        const idxA = a.orderIndex !== undefined ? a.orderIndex : 9999;
        const idxB = b.orderIndex !== undefined ? b.orderIndex : 9999;
        if (idxA !== idxB) return idxA - idxB;

        return dpiB - dpiA;
      }
      if (mpcSortBy === 'dpi-desc') return dpiB - dpiA;
      if (mpcSortBy === 'dpi-asc') return dpiA - dpiB;
      if (mpcSortBy === 'recent') {
        const dateA = a.dateCreated || a.releasedAt || '0000-00-00';
        const dateB = b.dateCreated || b.releasedAt || '0000-00-00';
        return dateB.localeCompare(dateA);
      }
      if (mpcSortBy === 'oldest') {
        const dateA = a.dateCreated || a.releasedAt || '9999-99-99';
        const dateB = b.dateCreated || b.releasedAt || '9999-99-99';
        return dateA.localeCompare(dateB);
      }
      if (mpcSortBy === 'name') {
        return (a.artist || a.setName).localeCompare(b.artist || b.setName);
      }
      if (mpcSortBy === 'source') {
        const sourceA = a.sourceName || a.artist || '';
        const sourceB = b.sourceName || b.artist || '';
        return sourceA.localeCompare(sourceB);
      }
      return 0;
    });

    return list;
  }, [mpcPrints, mpcFilterText, mpcSourceFilter, mpcTagFilter, mpcSortBy]);

  // Reset render limits when filters change
  useEffect(() => {
    setOfficialRenderLimit(40);
  }, [filterOfficialQuery, officialTypeFilter, officialSortBy, activeFace]);

  useEffect(() => {
    setMpcRenderLimit(40);
  }, [mpcFilterText, mpcSourceFilter, mpcTagFilter, mpcSortBy, mpcMinDpi, activeFace]);

  // Progressive batch rendering slices to prevent DOM bloat and render in 60 FPS
  const displayedOfficialPrints = useMemo(() => {
    return filteredOfficialPrints.slice(0, officialRenderLimit);
  }, [filteredOfficialPrints, officialRenderLimit]);

  const displayedMpcPrints = useMemo(() => {
    return filteredMpcPrints.slice(0, mpcRenderLimit);
  }, [filteredMpcPrints, mpcRenderLimit]);

  // Consolidated selection handler that immediately updates local thumbnails + dfcFaces and notifies parent
  const handleSelectCardArt = (
    selectedPrint: CardPrint,
    face: 'front' | 'back' = activeFace,
    customFeedback?: string
  ) => {
    setHoveredPreview(null);
    setActivePrintId(selectedPrint.id);

    const isBack = face === 'back';
    const newImg: string =
      (isBack
        ? selectedPrint.cardFaces?.[1]?.imageUrl ||
          (selectedPrint.setCode &&
          selectedPrint.collectorNumber &&
          selectedPrint.collectorNumber !== '★' &&
          selectedPrint.setCode !== 'MPC' &&
          selectedPrint.setCode !== 'CUSTOM'
            ? `https://api.scryfall.com/cards/${selectedPrint.setCode.toLowerCase()}/${encodeURIComponent(selectedPrint.collectorNumber)}?format=image&version=normal&face=back`
            : selectedPrint.imageUrl)
        : selectedPrint.cardFaces?.[0]?.imageUrl || selectedPrint.imageUrl) || '';

    const newImgLarge: string =
      (isBack
        ? selectedPrint.cardFaces?.[1]?.imageUrlLarge ||
          (selectedPrint.setCode &&
          selectedPrint.collectorNumber &&
          selectedPrint.collectorNumber !== '★' &&
          selectedPrint.setCode !== 'MPC' &&
          selectedPrint.setCode !== 'CUSTOM'
            ? `https://api.scryfall.com/cards/${selectedPrint.setCode.toLowerCase()}/${encodeURIComponent(selectedPrint.collectorNumber)}?format=image&version=large&face=back`
            : selectedPrint.imageUrlLarge || newImg)
        : selectedPrint.cardFaces?.[0]?.imageUrlLarge || selectedPrint.imageUrlLarge || newImg) || newImg;

    const resolvedFaceName = isBack
      ? selectedPrint.cardFaces?.[1]?.name || backFaceName || `${card?.name || ''} (Verso)`
      : selectedPrint.cardFaces?.[0]?.name || frontFaceName;

    const resolvedArtist = isBack
      ? selectedPrint.cardFaces?.[1]?.artist || selectedPrint.artist
      : selectedPrint.cardFaces?.[0]?.artist || selectedPrint.artist;

    const defaultFront = currentFrontThumbnail || card?.imageUrl || '';
    const defaultBack = currentBackThumbnail || '';

    // Immediately update local faceThumbnails, faceLargeImages and dfcFaces for instant zero-latency UI update
    let updatedFacesForCallback: CardFace[] | null = dfcFaces;
    if (isCardDfc) {
      const base: CardFace[] =
        dfcFaces && dfcFaces.length >= 2
          ? dfcFaces
          : [
              {
                name: frontFaceName,
                imageUrl: defaultFront,
                imageUrlSmall: defaultFront,
                artist: card?.artist,
              },
              {
                name: backFaceName || `${card?.name || ''} (Verso)`,
                imageUrl: defaultBack,
                imageUrlSmall: defaultBack,
              },
            ];

      if (isBack) {
        setFaceThumbnails((prev) => ({ ...prev, back: newImg }));
        setFaceLargeImages((prev) => ({ ...prev, back: newImgLarge }));
        updatedFacesForCallback = [
          base[0],
          {
            ...base[1],
            name: resolvedFaceName,
            imageUrl: newImg,
            imageUrlLarge: newImgLarge,
            imageUrlSmall: newImg,
            artist: resolvedArtist || base[1]?.artist,
          },
        ];
      } else {
        setFaceThumbnails((prev) => ({ ...prev, front: newImg }));
        setFaceLargeImages((prev) => ({ ...prev, front: newImgLarge }));
        updatedFacesForCallback = [
          {
            ...base[0],
            name: resolvedFaceName,
            imageUrl: newImg,
            imageUrlLarge: newImgLarge,
            imageUrlSmall: newImg,
            artist: resolvedArtist || base[0]?.artist,
          },
          base[1],
        ];
      }
      setDfcFaces(updatedFacesForCallback);
    }

    onSelectPrint(selectedPrint, face, updatedFacesForCallback);
    setSelectedFeedback(
      customFeedback ||
        `Arte da ${isBack ? 'face posterior (Verso)' : 'frente'} selecionada (${selectedPrint.setName})`
    );
    setTimeout(() => setSelectedFeedback(null), 2200);
  };

  // Handle manual Drive ID submission in MPC tab
  const handleApplyDriveId = () => {
    if (!card || !mpcDriveInput.trim()) return;
    const print = createPrintFromMpcId(currentFaceName, mpcDriveInput.trim(), `MPCFill Alter (${currentFaceName})`);
    if (!print) {
      setMpcError('ID ou link do Google Drive inválido. Cole o ID alfanumérico ou o link de compartilhamento.');
      return;
    }
    setMpcError(null);
    handleSelectCardArt(print, activeFace, 'Arte do Google Drive selecionada!');
  };

  // Handle uploading an MPCFill XML to extract alters for this card
  const handleMpcXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const matches = extractAltersFromXmlForCard(text, currentFaceName);
        if (matches.length > 0) {
          // Prepend matches to MPC prints
          setMpcPrints((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnly = matches.filter((m) => !existingIds.has(m.id));
            return [...newOnly, ...prev];
          });
          setMpcError(null);
        } else {
          setMpcError(`Nenhuma arte para "${currentFaceName}" foi encontrada dentro do arquivo XML fornecido.`);
        }
      } catch (err: any) {
        setMpcError(err?.message || 'Erro ao processar arquivo XML do MPCFill.');
      } finally {
        if (mpcXmlInputRef.current) mpcXmlInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Handle local image file upload in Custom Art tab
  const handleCustomImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingCustomImage(true);
    try {
      // Compress and resize image so it remains lightweight (~40-60KB) for Cloud Firestore sync
      const compressedDataUrl = await compressImageFile(file, 800, 1120, 0.82);
      setCustomImageUrl(compressedDataUrl);
      if (!customTitle && card) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      console.error('Falha ao otimizar imagem local:', err);
      // Fallback to uncompressed read if canvas is unsupported
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCustomImageUrl(dataUrl);
        if (!customTitle && card) {
          setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressingCustomImage(false);
      if (customFileInputRef.current) customFileInputRef.current.value = '';
    }
  };

  // Handle custom URL input confirmation
  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    setCustomImageUrl(customUrlInput.trim());
  };

  // Handle confirm custom art
  const handleConfirmCustomArt = () => {
    if (!card || !customImageUrl) return;
    const print = createPrintFromCustomImage(currentFaceName, customImageUrl, customTitle, customArtist);
    handleSelectCardArt(print, activeFace, `Arte personalizada selecionada para o ${activeFace === 'back' ? 'Verso' : 'Frente'}!`);
  };

  if (!isOpen || !card) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 11, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setHoveredPreview(null);
          onClose();
        }
      }}
    >
      <div
        className="art-selector-modal-wrapper"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setHoveredPreview(null);
            onClose();
          }
        }}
      >
        {/* Left Side: Current Card Preview (Persistent comparison) */}
        {currentPreviewData && (
          <div className="art-selector-current-preview">
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#e2e8f0',
                  }}
                >
                  Arte Atual Selecionada
                </span>
              </div>

              {isCardDfc && (
                <button
                  type="button"
                  onClick={() => setActiveFace(activeFace === 'front' ? 'back' : 'front')}
                  className="btn btn-ghost btn-xs"
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    color: activeFace === 'back' ? '#fbbf24' : '#818cf8',
                    background:
                      activeFace === 'back'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(99, 102, 241, 0.15)',
                    border: `1px solid ${
                      activeFace === 'back'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(99, 102, 241, 0.3)'
                    }`,
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                  title="Alternar entre Frente e Verso"
                >
                  <RotateCw size={11} />
                  {activeFace === 'back' ? 'Ver Frente' : 'Ver Verso'}
                </button>
              )}
            </div>

            {/* Card Image Display */}
            <div
              onClick={() => {
                if (isCardDfc) {
                  setActiveFace(activeFace === 'front' ? 'back' : 'front');
                  setHoveredPreview(null);
                }
              }}
              onMouseEnter={(e) => {
                setPreviewMousePos({ x: e.clientX, y: e.clientY });

                let largeUrl = currentPreviewData.url;
                if (card?.imageUrlLarge && (!isCardDfc || activeFace === 'front')) {
                  largeUrl = card.imageUrlLarge;
                } else if (largeUrl.includes('/normal/')) {
                  largeUrl = largeUrl.replace('/normal/', '/large/');
                }

                const setPart =
                  currentPreviewData.setCode &&
                  currentPreviewData.setCode !== 'MPC' &&
                  currentPreviewData.setCode !== 'CUSTOM'
                    ? ` (${currentPreviewData.setCode.toUpperCase()}${
                        currentPreviewData.collectorNumber
                          ? ` #${currentPreviewData.collectorNumber}`
                          : ''
                      })`
                    : currentPreviewData.setCode === 'MPC'
                    ? ' (MPCFill)'
                    : '';

                const artistPart = currentPreviewData.artist
                  ? ` • Arte por ${currentPreviewData.artist}`
                  : '';
                const facePart = currentPreviewData.faceLabel
                  ? ` • [${currentPreviewData.faceLabel}]`
                  : '';
                const setLabel =
                  currentPreviewData.setName ||
                  (currentPreviewData.setCode === 'MPC' ? 'MPCFill Alter' : '');

                setHoveredPreview({
                  url: largeUrl,
                  title: `${currentPreviewData.name}${setPart}`,
                  subtitle: `${setLabel}${artistPart}${facePart}`.trim(),
                });
              }}
              onMouseMove={(e) => setPreviewMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredPreview(null)}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '5/7',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#05070b',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: isCardDfc ? 'pointer' : 'zoom-in',
                transition: 'all 0.15s ease',
              }}
              title={
                isCardDfc
                  ? 'Clique para virar a carta (passe o mouse para ampliar a arte)'
                  : 'Passe o mouse para ampliar a arte'
              }
            >
              <img
                key={currentPreviewData.url}
                src={
                  currentPreviewData.url.includes('lh3.googleusercontent.com/d/') && !currentPreviewData.url.includes('=')
                    ? `${currentPreviewData.url}=w800`
                    : currentPreviewData.url
                }
                alt={currentPreviewData.name}
                referrerPolicy="no-referrer"
                decoding="async"
                className={
                  currentPreviewData.setCode === 'MPC' ||
                  isMpcCardImage(currentPreviewData.setCode, currentPreviewData.url)
                    ? 'is-mpc-bleed-crop'
                    : ''
                }
                onError={(e) => {
                  const target = e.currentTarget;
                  if (card.imageUrl && target.src !== card.imageUrl) {
                    target.src = card.imageUrl;
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
              {isCardDfc && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '3px 7px',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    pointerEvents: 'none',
                  }}
                >
                  <RotateCw size={10} className="text-amber-400" />
                  {currentPreviewData.faceLabel}
                </div>
              )}
            </div>

            {/* Card Details & Metadata */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={currentPreviewData.name}
              >
                {currentPreviewData.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {currentPreviewData.setCode === 'MPC' ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fbbf24',
                    }}
                  >
                    MPCFill Alter
                  </span>
                ) : currentPreviewData.setCode === 'CUSTOM' ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                    }}
                  >
                    Arte Própria
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#a5b4fc',
                    }}
                  >
                    {currentPreviewData.setCode?.toUpperCase()} #{currentPreviewData.collectorNumber}
                  </span>
                )}

                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '140px',
                  }}
                  title={currentPreviewData.setName}
                >
                  {currentPreviewData.setName}
                </span>
              </div>

              {currentPreviewData.artist && (
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={currentPreviewData.artist}
                >
                  Arte: {currentPreviewData.artist}
                </div>
              )}
            </div>

            {/* Helpful comparison hint */}
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 9px',
                borderRadius: '7px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.7rem',
                color: '#94a3b8',
                lineHeight: 1.3,
              }}
            >
              <Eye size={13} className="text-amber-400" style={{ flexShrink: 0 }} />
              <span>Passe o mouse nas opções da grade para comparar lado a lado com esta.</span>
            </div>
          </div>
        )}

        {/* Main Modal Panel */}
        <div
          className="glass-panel"
          style={{
            width: '980px',
            maxWidth: 'calc(96vw - 310px)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0c0f17',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)',
            borderRadius: '16px',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          }}
        >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            background: 'rgba(18, 23, 34, 0.85)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                flexShrink: 0,
              }}
            >
              <ImageIcon size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Trocar Arte — {card.name}
                </h2>
                {selectedFeedback && (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Check size={12} /> {selectedFeedback}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
                {isCardDfc
                  ? `Carta dupla face: escolha a face abaixo para ver e trocar artes separadamente.`
                  : 'Clique em uma arte para selecioná-la. Use as setas para trocar a arte das outras cartas.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Card Navigation Controls */}
            {(onNavigatePrev || onNavigateNext) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ padding: '4px', opacity: hasPrev ? 1 : 0.3 }}
                  disabled={!hasPrev}
                  onClick={onNavigatePrev}
                  title="Carta Anterior (Seta Esquerda ou Tecla A)"
                >
                  <ChevronLeft size={18} />
                </button>

                {cardIndexLabel && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#cbd5e1',
                      padding: '0 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cardIndexLabel}
                  </span>
                )}

                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ padding: '4px', opacity: hasNext ? 1 : 0.3 }}
                  disabled={!hasNext}
                  onClick={onNavigateNext}
                  title="Próxima Carta (Seta Direita ou Tecla D)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setHoveredPreview(null);
                onClose();
              }}
              className="btn btn-secondary btn-sm"
              style={{ gap: '6px', padding: '6px 12px' }}
              title="Concluir e Fechar (ESC)"
            >
              <X size={15} /> Concluir
            </button>
          </div>
        </div>

        {/* DFC Dual-Face Visual Switcher */}
        {isCardDfc && (
          <div
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(10, 15, 26, 0.95))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} className="text-amber-400" />
                Carta Dupla Face: Clique em uma das faces para selecionar e buscar artes para ela:
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: activeFace === 'back' ? '#fbbf24' : '#818cf8',
                  background: activeFace === 'back' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  border: `1px solid ${activeFace === 'back' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(99, 102, 241, 0.35)'}`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {activeFace === 'back' ? `Alterando VERSO (${backFaceName || 'Verso'})` : `Alterando FRENTE (${frontFaceName})`}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Frente Face Selector Box */}
              <div
                onClick={() => setActiveFace('front')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: activeFace === 'front' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: activeFace === 'front' ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  boxShadow: activeFace === 'front' ? '0 0 16px rgba(99, 102, 241, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ width: '40px', height: '56px', borderRadius: '5px', overflow: 'hidden', background: '#05070b', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                  <img
                    key={currentFrontThumbnail}
                    src={currentFrontThumbnail}
                    alt={frontFaceName}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: activeFace === 'front' ? '#a5b4fc' : '#94a3b8' }}>
                      FRENTE
                    </span>
                    {activeFace === 'front' ? (
                      <span style={{ fontSize: '0.62rem', background: '#6366f1', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        Ativa para troca
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                        Clique para selecionar
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {frontFaceName}
                  </div>
                </div>
              </div>

              {/* Center Switch Icon */}
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setActiveFace(activeFace === 'front' ? 'back' : 'front')}
                style={{
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffbb00',
                }}
                title="Alternar entre Frente e Verso"
              >
                <RotateCw size={17} style={{ transform: activeFace === 'back' ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
              </button>

              {/* Verso Face Selector Box */}
              <div
                onClick={() => setActiveFace('back')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: activeFace === 'back' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: activeFace === 'back' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  boxShadow: activeFace === 'back' ? '0 0 16px rgba(245, 158, 11, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ width: '40px', height: '56px', borderRadius: '5px', overflow: 'hidden', background: '#05070b', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                  <img
                    key={currentBackThumbnail}
                    src={currentBackThumbnail}
                    alt={backFaceName || 'Verso'}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: activeFace === 'back' ? '#fcd34d' : '#94a3b8' }}>
                      VERSO
                    </span>
                    {activeFace === 'back' ? (
                      <span style={{ fontSize: '0.62rem', background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        Ativa para troca
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                        Clique para selecionar
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {resolvingFaces && !backFaceName ? 'Identificando verso...' : (backFaceName || `${card.name} (Verso)`)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs (3 Abas solicitadas) */}
        <div
          style={{
            flexShrink: 0,
            minHeight: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(15, 20, 30, 0.98)',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          {/* Aba 1: Artes Oficiais */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setHoveredPreview(null);
              setActiveTab('official');
            }}
            style={{
              flexShrink: 0,
              height: '100%',
              padding: '0 16px',
              borderRadius: '0',
              borderBottom: activeTab === 'official' ? '3px solid #6366f1' : '3px solid transparent',
              color: activeTab === 'official' ? '#f8fafc' : '#94a3b8',
              fontWeight: activeTab === 'official' ? 700 : 500,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Layers size={16} className={activeTab === 'official' ? 'text-indigo-400' : ''} />
            <span>Artes Oficiais</span>
            {!loadingOfficial && officialPrints.length > 0 && (
              <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                {officialPrints.length}
              </span>
            )}
          </button>

          {/* Aba 2: Artes do MPCFill */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setHoveredPreview(null);
              setActiveTab('mpcfill');
            }}
            style={{
              flexShrink: 0,
              height: '100%',
              padding: '0 16px',
              borderRadius: '0',
              borderBottom: activeTab === 'mpcfill' ? '3px solid #ffbb00' : '3px solid transparent',
              color: activeTab === 'mpcfill' ? '#ffbb00' : '#94a3b8',
              fontWeight: activeTab === 'mpcfill' ? 700 : 500,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={16} className="text-amber-400" />
            <span>Artes do MPCFill</span>
            {!loadingMpc && mpcPrints.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(255, 187, 0, 0.2)',
                  color: '#ffbb00',
                  fontWeight: 700,
                }}
              >
                {mpcPrints.length}
              </span>
            )}
          </button>

          {/* Aba 3: Importar a Própria Arte */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setHoveredPreview(null);
              setActiveTab('custom');
            }}
            style={{
              flexShrink: 0,
              height: '100%',
              padding: '0 16px',
              borderRadius: '0',
              borderBottom: activeTab === 'custom' ? '3px solid #10b981' : '3px solid transparent',
              color: activeTab === 'custom' ? '#10b981' : '#94a3b8',
              fontWeight: activeTab === 'custom' ? 700 : 500,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Upload size={16} className={activeTab === 'custom' ? 'text-emerald-400' : ''} />
            <span>Importar a Própria Arte</span>
            {customImageUrl && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  fontWeight: 700,
                }}
              >
                Pronta
              </span>
            )}
          </button>
        </div>

        {/* Tab 1 Content: Artes Oficiais (Scryfall) */}
        {activeTab === 'official' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Filter toolbar */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(18, 23, 34, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '250px', minWidth: '180px' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Filtrar por edição, código, ano, artista..."
                    value={filterOfficialQuery}
                    onChange={(e) => setFilterOfficialQuery(e.target.value)}
                    style={{ paddingLeft: '32px', paddingRight: filterOfficialQuery ? '28px' : '10px', height: '34px', fontSize: '0.8rem', width: '100%' }}
                  />
                  {filterOfficialQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterOfficialQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '9px',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                      title="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter by Category/Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={14} className="text-indigo-400" />
                  <select
                    className="input-text"
                    value={officialTypeFilter}
                    onChange={(e) => setOfficialTypeFilter(e.target.value as any)}
                    style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                    title="Filtrar tipo de edição oficial"
                  >
                    <option value="all">Todas as edições</option>
                    <option value="old-frame">Moldura Clássica (Old Frame / Retrô)</option>
                    <option value="regular">Edições Regulares</option>
                    <option value="special">Secret Lair & Especiais</option>
                    <option value="with-price">Com Preço em Dólar</option>
                  </select>
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowUpDown size={14} className="text-indigo-400" />
                  <select
                    className="input-text"
                    value={officialSortBy}
                    onChange={(e) => setOfficialSortBy(e.target.value as any)}
                    style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                    title="Ordenar ilustrações oficiais"
                  >
                    <option value="released-desc">Mais recentes primeiro</option>
                    <option value="released-asc">Mais antigas / Clássicas</option>
                    <option value="price-asc">Menor Preço ($)</option>
                    <option value="price-desc">Maior Preço ($)</option>
                    <option value="set-name">Nome da Edição (A-Z)</option>
                    <option value="artist">Artista (A-Z)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReloadOfficialPrints}
                  disabled={loadingOfficial}
                  title="Recarregar ilustrações oficiais do Scryfall"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    height: '34px',
                  }}
                >
                  <RotateCw size={14} className={loadingOfficial ? 'animate-spin' : ''} />
                  <span>Recarregar</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Exibindo <strong>{displayedOfficialPrints.length}</strong> de <strong>{filteredOfficialPrints.length}</strong> ilustrações oficiais
                </span>
                {(filterOfficialQuery || officialTypeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterOfficialQuery('');
                      setOfficialTypeFilter('all');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#818cf8',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Prints Grid */}
            <div
              ref={officialScrollRef}
              onScroll={(e) => {
                if (hoveredPreview) setHoveredPreview(null);
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 600) {
                  setOfficialRenderLimit((prev) => {
                    if (prev < filteredOfficialPrints.length) {
                      return Math.min(prev + 40, filteredOfficialPrints.length);
                    }
                    return prev;
                  });
                }
              }}
              style={{ padding: '24px', overflowY: 'auto', flex: 1, overscrollBehavior: 'contain' }}
            >
              {loadingOfficial ? (
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
                  <span>Buscando edições oficiais no Scryfall...</span>
                </div>
              ) : filteredOfficialPrints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <p style={{ marginBottom: '16px' }}>
                    {officialPrints.length > 0
                      ? 'Nenhuma edição corresponde aos filtros selecionados.'
                      : 'Nenhuma outra arte oficial encontrada para esta carta.'}
                  </p>
                  {officialPrints.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setFilterOfficialQuery('');
                        setOfficialTypeFilter('all');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCw size={13} /> Limpar Filtros
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleReloadOfficialPrints}
                      disabled={loadingOfficial}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                    >
                      <RotateCw size={15} className={loadingOfficial ? 'animate-spin' : ''} />
                      Tentar Novamente
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {displayedOfficialPrints.map((p) => {
                      const printImg =
                        activeFace === 'back'
                          ? p.cardFaces?.[1]?.imageUrl ||
                            (p.setCode && p.collectorNumber && p.collectorNumber !== '★' && p.setCode !== 'MPC' && p.setCode !== 'CUSTOM'
                              ? `https://api.scryfall.com/cards/${p.setCode.toLowerCase()}/${encodeURIComponent(p.collectorNumber)}?format=image&version=normal&face=back`
                              : p.imageUrl)
                          : p.imageUrl;

                      const printImgLarge =
                        activeFace === 'back'
                          ? p.cardFaces?.[1]?.imageUrlLarge ||
                            p.cardFaces?.[1]?.imageUrl ||
                            (p.setCode && p.collectorNumber && p.collectorNumber !== '★' && p.setCode !== 'MPC' && p.setCode !== 'CUSTOM'
                              ? `https://api.scryfall.com/cards/${p.setCode.toLowerCase()}/${encodeURIComponent(p.collectorNumber)}?format=image&version=large&face=back`
                              : p.imageUrlLarge || p.imageUrl)
                          : p.imageUrlLarge || p.imageUrl;

                      const printArtist =
                        activeFace === 'back'
                          ? p.cardFaces?.[1]?.artist || p.artist
                          : p.cardFaces?.[0]?.artist || p.artist;

                      const printFaceName =
                        activeFace === 'back'
                          ? p.cardFaces?.[1]?.name || backFaceName || `${card.name} (Verso)`
                          : p.cardFaces?.[0]?.name || frontFaceName;

                      const isSelected =
                        activeFace === 'front'
                          ? p.id === activePrintId ||
                            p.imageUrl === currentFrontThumbnail ||
                            p.imageUrl === (card.cardFaces?.[0]?.imageUrl || card.imageUrl)
                          : p.id === activePrintId ||
                            (Boolean(p.cardFaces?.[1]?.imageUrl) &&
                              (p.cardFaces![1].imageUrl === currentBackThumbnail ||
                                p.cardFaces![1].imageUrl === card.cardFaces?.[1]?.imageUrl)) ||
                            printImg === currentBackThumbnail;

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectCardArt(p, activeFace)}
                          onMouseEnter={(e) => {
                            setPreviewMousePos({ x: e.clientX, y: e.clientY });
                            setHoveredPreview({
                              url: printImgLarge,
                              title: `${printFaceName} (${p.setCode.toUpperCase()} #${p.collectorNumber})`,
                              subtitle: `${p.setName}${printArtist ? ` • Arte por ${printArtist}` : ''}${activeFace === 'back' ? ' • [Verso]' : ''}`,
                            });
                          }}
                          onMouseMove={(e) => setPreviewMousePos({ x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHoveredPreview(null)}
                          className="glass-card"
                          style={{
                            cursor: 'pointer',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                            boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.4)' : undefined,
                            transform: isSelected ? 'scale(1.02)' : undefined,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ position: 'relative', aspectRatio: '5/7', background: '#05070b', overflow: 'hidden' }}>
                            <CardImage
                              name={printFaceName}
                              imageUrl={printImg}
                              imageUrlLarge={printImgLarge}
                              setCode={p.setCode}
                              collectorNumber={p.collectorNumber}
                              face={activeFace}
                              loading="lazy"
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
                  {displayedOfficialPrints.length < filteredOfficialPrints.length && (
                    <div style={{ textAlign: 'center', padding: '24px 0 8px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Mostrando {displayedOfficialPrints.length} de {filteredOfficialPrints.length} ilustrações oficiais. Role para carregar mais...
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 Content: Artes do MPCFill */}
        {activeTab === 'mpcfill' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* MPCFill Controls & Filter Toolbar */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(18, 23, 34, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Search in MPC Alters */}
                <div style={{ position: 'relative', width: '260px', minWidth: '200px' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Filtrar por artista, variante, tag..."
                    value={mpcFilterText}
                    onChange={(e) => setMpcFilterText(e.target.value)}
                    style={{ paddingLeft: '32px', paddingRight: mpcFilterText ? '28px' : '10px', height: '34px', fontSize: '0.8rem', width: '100%' }}
                  />
                  {mpcFilterText && (
                    <button
                      type="button"
                      onClick={() => setMpcFilterText('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '9px',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                      title="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* DPI, Type, Source, Tag, and Sort Selectors */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Card Type Selector (Cartas Oficiais vs Fichas/Tokens) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} className="text-amber-400" />
                    <select
                      className="input-text"
                      value={mpcCardType}
                      onChange={(e) => {
                        const newType = e.target.value as 'CARD' | 'TOKEN';
                        setMpcCardType(newType);
                        fetchMpcAlters(currentFaceName, mpcMinDpi, newType, card.typeLine);
                      }}
                      style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                      title="Tipo de item no catálogo MPCFill (Cartas ou Fichas/Tokens)"
                    >
                      <option value="CARD">Cartas Oficiais</option>
                      <option value="TOKEN">Fichas / Tokens</option>
                    </select>
                  </div>

                  {/* DPI Resolution Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SlidersHorizontal size={14} className="text-amber-400" />
                    <select
                      className="input-text"
                      value={mpcMinDpi}
                      onChange={(e) => {
                        const newDpi = Number(e.target.value);
                        setMpcMinDpi(newDpi);
                        fetchMpcAlters(currentFaceName, newDpi, mpcCardType, card.typeLine);
                      }}
                      style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                      title="Filtrar resolução mínima de DPI"
                    >
                      <option value={200}>DPI: 200+ (Todas as artes)</option>
                      <option value={300}>DPI: 300+ DPI</option>
                      <option value={600}>DPI: 600+ DPI (HD)</option>
                      <option value={800}>DPI: 800+ DPI (Alta Definição)</option>
                      <option value={1200}>DPI: 1200+ DPI (Ultra HD)</option>
                    </select>
                  </div>

                  {/* Filter by Source / Artist (if multiple available) */}
                  {availableMpcSources.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={14} className="text-amber-400" />
                      <select
                        className="input-text"
                        value={mpcSourceFilter}
                        onChange={(e) => setMpcSourceFilter(e.target.value)}
                        style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px', maxWidth: '170px' }}
                        title="Filtrar por artista ou fonte do alter"
                      >
                        <option value="">Todas as Fontes ({availableMpcSources.length})</option>
                        {availableMpcSources.map(([src, count]) => (
                          <option key={src} value={src}>
                            {src} ({count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filter by Tag / Style (if available) */}
                  {availableMpcTags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} className="text-amber-400" />
                      <select
                        className="input-text"
                        value={mpcTagFilter}
                        onChange={(e) => setMpcTagFilter(e.target.value)}
                        style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px', maxWidth: '150px' }}
                        title="Filtrar por estilo ou tag"
                      >
                        <option value="">Todos os Estilos</option>
                        {availableMpcTags.map(([tag, count]) => (
                          <option key={tag} value={tag}>
                            {tag} ({count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sort Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowUpDown size={14} className="text-amber-400" />
                    <select
                      className="input-text"
                      value={mpcSortBy}
                      onChange={(e) => setMpcSortBy(e.target.value as any)}
                      style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                      title="Ordenar resultados"
                    >
                      <option value="best-creators">Melhores Criadores (Recomendadas)</option>
                      <option value="dpi-desc">Maior DPI primeiro</option>
                      <option value="dpi-asc">Menor DPI primeiro</option>
                      <option value="recent">Mais recentes</option>
                      <option value="oldest">Mais antigas</option>
                      <option value="name">Artista / Nome (A-Z)</option>
                      <option value="source">Fonte / Drive (A-Z)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fetchMpcAlters(currentFaceName, mpcMinDpi, mpcCardType, card.typeLine)}
                    disabled={loadingMpc}
                    style={{
                      height: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: 'rgba(255, 187, 0, 0.35)',
                    }}
                    title="Recarregar artes do MPCFill"
                  >
                    <RefreshCw size={13} className={loadingMpc ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                    <span>Recarregar</span>
                  </button>
                </div>
              </div>

              {/* Sub-strip with Drive ID, XML upload, and external link */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Cole aqui o ID ou link do Google Drive no MPCFill..."
                    value={mpcDriveInput}
                    onChange={(e) => {
                      setMpcDriveInput(e.target.value);
                      setMpcError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyDriveId();
                    }}
                    style={{ height: '30px', fontSize: '0.75rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleApplyDriveId}
                    disabled={!mpcDriveInput.trim()}
                    style={{ height: '30px', fontSize: '0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Aplicar ID
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    ref={mpcXmlInputRef}
                    type="file"
                    accept=".xml"
                    style={{ display: 'none' }}
                    onChange={handleMpcXmlFile}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => mpcXmlInputRef.current?.click()}
                    style={{ height: '30px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px', color: '#cbd5e1' }}
                    title="Carregar um arquivo XML exportado do MPCFill para buscar as artes desta carta"
                  >
                    <FileCode size={13} className="text-amber-400" />
                    Carregar XML (.xml)
                  </button>

                  <a
                    href={`https://mpcfill.com/editor?query=${encodeURIComponent(currentFaceName)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ height: '30px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}
                    title="Abrir página de seleção no MPCFill.com em uma nova aba"
                  >
                    <ExternalLink size={13} />
                    Ver no MPCFill.com
                  </a>
                </div>
              </div>

              {/* Status info or errors */}
              {mpcProxyNotice ? (
                <div
                  style={{
                    fontSize: '0.8rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={15} />
                    <span>
                      O servidor local precisa ser reiniciado para ativar o proxy da API do MPCFill. No seu terminal, pare e execute <code>npm run dev</code> novamente.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fetchMpcAlters(currentFaceName, mpcMinDpi, mpcCardType, card.typeLine)}
                    style={{ fontSize: '0.75rem', height: '28px', whiteSpace: 'nowrap' }}
                  >
                    <RefreshCw size={12} /> Tentar Novamente
                  </button>
                </div>
              ) : mpcError ? (
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{mpcError}</span>
                </div>
              ) : (
                !loadingMpc && mpcPrints.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>
                        Exibindo <strong>{displayedMpcPrints.length}</strong> de <strong>{filteredMpcPrints.length}</strong> artes de {mpcCardType === 'TOKEN' ? 'ficha/token' : 'carta'} com {mpcMinDpi}+ DPI
                      </span>
                      {(mpcFilterText || mpcSourceFilter || mpcTagFilter || mpcMinDpi !== 200) && (
                        <button
                          type="button"
                          onClick={() => {
                            setMpcFilterText('');
                            setMpcSourceFilter('');
                            setMpcTagFilter('');
                            setMpcMinDpi(200);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ffbb00',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                    <span style={{ color: '#ffbb00' }}>
                      Clique em qualquer arte para selecioná-la
                    </span>
                  </div>
                )
              )}
            </div>

            {/* MPCFill Cards Grid */}
            <div
              ref={mpcScrollRef}
              onScroll={(e) => {
                if (hoveredPreview) setHoveredPreview(null);
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 600) {
                  setMpcRenderLimit((prev) => {
                    if (prev < filteredMpcPrints.length) {
                      return Math.min(prev + 40, filteredMpcPrints.length);
                    }
                    return prev;
                  });
                }
              }}
              style={{ padding: '24px', overflowY: 'auto', flex: 1, overscrollBehavior: 'contain' }}
            >
              {loadingMpc ? (
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
                  <Loader2 className="animate-spin text-amber-400" size={32} />
                  <span style={{ fontSize: '0.9rem' }}>
                    Buscando artes de {mpcCardType === 'TOKEN' ? 'fichas/tokens' : 'cartas'} no MPCFill para <strong>"{currentFaceName}"</strong> (&gt;{mpcMinDpi} DPI)...
                  </span>
                </div>
              ) : filteredMpcPrints.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <Sparkles size={36} className="text-amber-400" />
                  <div style={{ maxWidth: '460px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    {mpcPrints.length > 0
                      ? 'Nenhuma arte corresponde aos filtros selecionados. Tente ajustar a busca ou o DPI mínimo.'
                      : (
                        <>
                          Nenhuma arte de {mpcCardType === 'TOKEN' ? 'ficha/token' : 'carta'} foi encontrada automaticamente para <strong>{currentFaceName}</strong>.
                          Certifique-se de que o servidor local (<code>npm run dev</code>) foi reiniciado, ou use a barra acima para colar o link/ID do Google Drive ou carregar um XML.
                        </>
                      )}
                  </div>
                  {mpcPrints.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setMpcFilterText('');
                        setMpcSourceFilter('');
                        setMpcTagFilter('');
                        setMpcMinDpi(200);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCw size={13} /> Limpar Filtros
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchMpcAlters(currentFaceName, mpcMinDpi, mpcCardType, card.typeLine)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} className="text-amber-400" /> Tentar Novamente
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                      gap: '18px',
                    }}
                  >
                  {displayedMpcPrints.map((p) => {
                    const isSelected =
                      activeFace === 'back'
                        ? p.id === activePrintId ||
                          p.imageUrl === currentBackThumbnail ||
                          (Boolean(card.cardFaces?.[1]?.imageUrl) && card.cardFaces?.[1]?.imageUrl === p.imageUrl)
                        : p.id === activePrintId ||
                          p.imageUrl === currentFrontThumbnail ||
                          ((card.cardFaces?.[0]?.imageUrl || card.imageUrl) === p.imageUrl);
                    const dpiVal = p.dpi || parseInt(p.collectorNumber, 10) || 0;

                    // Color code for DPI badge
                    let dpiBadgeBg = 'rgba(217, 119, 6, 0.2)';
                    let dpiBadgeBorder = 'rgba(217, 119, 6, 0.4)';
                    let dpiBadgeColor = '#fbbf24';
                    let dpiLabel = `${dpiVal} DPI`;

                    if (dpiVal >= 1200) {
                      dpiBadgeBg = 'linear-gradient(135deg, rgba(147, 51, 234, 0.3), rgba(245, 158, 11, 0.3))';
                      dpiBadgeBorder = 'rgba(168, 85, 247, 0.5)';
                      dpiBadgeColor = '#e9d5ff';
                      dpiLabel = `${dpiVal} DPI ★`;
                    } else if (dpiVal >= 800) {
                      dpiBadgeBg = 'rgba(16, 185, 129, 0.25)';
                      dpiBadgeBorder = 'rgba(16, 185, 129, 0.5)';
                      dpiBadgeColor = '#34d399';
                      dpiLabel = `${dpiVal} DPI HD`;
                    } else if (dpiVal >= 600) {
                      dpiBadgeBg = 'rgba(14, 165, 233, 0.25)';
                      dpiBadgeBorder = 'rgba(14, 165, 233, 0.5)';
                      dpiBadgeColor = '#38bdf8';
                      dpiLabel = `${dpiVal} DPI`;
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() =>
                          handleSelectCardArt(
                            p,
                            activeFace,
                            `Alter MPCFill selecionado para o ${activeFace === 'back' ? 'Verso' : 'Frente'} (${p.setName})`
                          )
                        }
                        onMouseEnter={(e) => {
                          setPreviewMousePos({ x: e.clientX, y: e.clientY });
                          setHoveredPreview({
                            url: p.imageUrlLarge || p.imageUrl,
                            title: p.setName,
                            subtitle: p.artist ? `Comunidade MPCFill • ${p.artist}` : 'Comunidade MPCFill',
                            dpi: dpiVal || undefined,
                          });
                        }}
                        onMouseMove={(e) => setPreviewMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHoveredPreview(null)}
                        className="glass-card"
                        style={{
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          borderColor: isSelected ? '#ffbb00' : 'var(--border-subtle)',
                          boxShadow: isSelected ? '0 0 18px rgba(255, 187, 0, 0.45)' : undefined,
                          transform: isSelected ? 'scale(1.02)' : undefined,
                          transition: 'all 0.15s ease',
                          background: '#0a0d14',
                        }}
                      >
                        <div style={{ position: 'relative', aspectRatio: '5/7', background: '#05070b', overflow: 'hidden' }}>
                          <CardImage
                            name={p.setName}
                            imageUrl={p.imageUrl}
                            imageUrlLarge={p.imageUrlLarge || p.imageUrl}
                            setCode="MPC"
                            cropMpcBleed
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />

                          {/* Prominent DPI Badge on Card */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              background: dpiBadgeBg,
                              border: `1px solid ${dpiBadgeBorder}`,
                              color: dpiBadgeColor,
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backdropFilter: 'blur(6px)',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
                            }}
                          >
                            {dpiLabel}
                          </div>

                          {/* Selected Checkmark Indicator */}
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: '#ffbb00',
                                borderRadius: '50%',
                                padding: '4px',
                                color: '#000000',
                                display: 'flex',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
                              }}
                            >
                              <Check size={14} />
                            </div>
                          )}
                        </div>

                        {/* Card Info Details */}
                        <div style={{ padding: '8px 10px', fontSize: '0.75rem', background: '#0f141d', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
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
                                alignItems: 'center',
                                gap: '4px',
                                color: '#cbd5e1',
                                marginTop: '3px',
                                fontSize: '0.72rem',
                              }}
                            >
                              <span style={{ color: '#94a3b8' }}>Autor:</span>
                              <strong style={{ color: '#ffbb00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.sourceName || p.artist || 'Comunidade'}
                              </strong>
                            </div>
                          </div>

                          {/* Tags if available */}
                          {p.tags && p.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                              {p.tags.slice(0, 2).map((t, tidx) => (
                                <span
                                  key={tidx}
                                  style={{
                                    fontSize: '0.62rem',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    background: 'rgba(255, 255, 255, 0.07)',
                                    color: '#94a3b8',
                                  }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {displayedMpcPrints.length < filteredMpcPrints.length && (
                  <div style={{ textAlign: 'center', padding: '24px 0 8px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Mostrando {displayedMpcPrints.length} de {filteredMpcPrints.length} artes do MPCFill. Role para carregar mais...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3 Content: Importar a Própria Arte */}
      {activeTab === 'custom' && (
        <div
          ref={customScrollRef}
          onScroll={() => {
            if (hoveredPreview) setHoveredPreview(null);
          }}
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Upload options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isCardDfc && (
                <div
                  style={{
                    background: activeFace === 'back' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                    border: `1px solid ${activeFace === 'back' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(99, 102, 241, 0.35)'}`,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: activeFace === 'back' ? '#fbbf24' : '#a5b4fc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={16} />
                  <span>
                    Importando arte para a face:{' '}
                    <strong>{activeFace === 'back' ? `VERSO (${backFaceName || 'Verso'})` : `FRENTE (${frontFaceName})`}</strong>
                  </span>
                </div>
              )}

                {/* File Dropzone */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', display: 'block' }}>
                    1. Enviar arquivo de imagem do computador:
                  </label>
                  <input
                    ref={customFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleCustomImageFile}
                  />
                  <div
                    onClick={() => customFileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(16, 185, 129, 0.4)',
                      borderRadius: '12px',
                      padding: '28px 20px',
                      textAlign: 'center',
                      background: 'rgba(16, 185, 129, 0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isCompressingCustomImage ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Loader2 size={32} className="animate-spin text-amber-400" />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                          Otimizando imagem para nuvem...
                        </span>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                          Compactando com alta resolução para sincronização instantânea
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload size={32} className="text-emerald-400" />
                        <div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                            Clique para escolher a imagem
                          </span>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                            Suporta PNG, JPG, JPEG ou WEBP (otimização e sincronização automática)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Or Direct Image URL */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', display: 'block' }}>
                    2. Ou insira o link direto de uma imagem online:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      className="input-text"
                      placeholder="https://exemplo.com/minha-arte.jpg"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCustomUrl();
                      }}
                      style={{ flex: 1, height: '36px', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleApplyCustomUrl}
                      disabled={!customUrlInput.trim()}
                    >
                      Carregar Link
                    </button>
                  </div>
                </div>

                {/* Metadata Fields (Optional) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Título / Versão da Arte (opcional):
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={`Ex: Arte Alternativa - ${currentFaceName}`}
                      style={{ width: '100%', height: '34px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Nome do Ilustrador / Autor (opcional):
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={customArtist}
                      onChange={(e) => setCustomArtist(e.target.value)}
                      placeholder="Ex: Artista Customizado"
                      style={{ width: '100%', height: '34px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Card Preview & Confirm */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  gap: '16px',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Prévia da Carta Personalizada
                </span>

                <div
                  style={{
                    width: '200px',
                    aspectRatio: '5/7',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#05070b',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 12px 24px -6px rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {customImageUrl ? (
                    <img
                      src={customImageUrl}
                      alt={customTitle || currentFaceName}
                      referrerPolicy="no-referrer"
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <ImageIcon size={32} />
                      <span>Envie uma imagem ou cole uma URL para ver a prévia</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmCustomArt}
                  disabled={!customImageUrl}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                  }}
                >
                  <Check size={16} />
                  Aplicar Esta Arte na Carta
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Floating Zoom Hover Preview Tooltip */}
      <CardHoverPreview
        preview={
          hoveredPreview
            ? {
                url: hoveredPreview.url,
                title: hoveredPreview.title,
                subtitle: hoveredPreview.subtitle,
                badge: hoveredPreview.dpi ? `${hoveredPreview.dpi} DPI` : undefined,
              }
            : null
        }
        mousePos={previewMousePos}
      />
    </div>
  );
};
