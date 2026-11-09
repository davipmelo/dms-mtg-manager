import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardPrint } from '../../types';
import { getCardPrints } from '../../services/scryfall';
import {
  searchMpcFillAlters,
  MpcCardPrint,
  createPrintFromMpcId,
  createPrintFromCustomImage,
  extractAltersFromXmlForCard,
  extractGoogleDriveId,
} from '../../services/mpcFillService';
import { CardImage } from '../Common/CardImage';
import {
  X,
  Check,
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
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
} from 'lucide-react';

export type ArtTab = 'official' | 'mpcfill' | 'custom';

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
  const [activeTab, setActiveTab] = useState<ArtTab>('official');

  // Official Prints State (Scryfall)
  const [officialPrints, setOfficialPrints] = useState<CardPrint[]>([]);
  const [loadingOfficial, setLoadingOfficial] = useState(false);
  const [filterOfficialQuery, setFilterOfficialQuery] = useState('');

  // MPCFill Alters State
  const [mpcPrints, setMpcPrints] = useState<MpcCardPrint[]>([]);
  const [loadingMpc, setLoadingMpc] = useState(false);
  const [mpcMinDpi, setMpcMinDpi] = useState<number>(200);
  const [mpcFilterText, setMpcFilterText] = useState<string>('');
  const [mpcSortBy, setMpcSortBy] = useState<'dpi-desc' | 'dpi-asc' | 'recent' | 'name'>('dpi-desc');
  const [mpcDriveInput, setMpcDriveInput] = useState('');
  const [mpcError, setMpcError] = useState<string | null>(null);
  const [mpcProxyNotice, setMpcProxyNotice] = useState<boolean>(false);
  const mpcXmlInputRef = useRef<HTMLInputElement>(null);

  // Custom User Art State
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customArtist, setCustomArtist] = useState<string>('');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const customFileInputRef = useRef<HTMLInputElement>(null);

  // Active print highlight
  const [activePrintId, setActivePrintId] = useState<string>('');

  // Detect if current card is a token or utility token card
  const isCardToken = useMemo(() => {
    if (!card) return false;
    if (card.layout === 'token' || card.layout === 'double_faced_token') return true;
    const tl = (card.typeLine || '').toLowerCase();
    return tl.includes('token') || card.name.toLowerCase().includes('token');
  }, [card]);

  // MPCFill Catalog Target Type ('CARD' vs 'TOKEN')
  const [mpcCardType, setMpcCardType] = useState<'CARD' | 'TOKEN'>('CARD');

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

  // Reset and load on open
  useEffect(() => {
    let cancelled = false;
    if (isOpen && card) {
      setActivePrintId(card.id);
      setFilterOfficialQuery('');
      setMpcDriveInput('');
      setMpcError(null);
      setMpcProxyNotice(false);
      setMpcFilterText('');
      setCustomImageUrl('');
      setCustomTitle(`Arte Customizada de ${card.name}`);
      setCustomArtist('');
      setCustomUrlInput('');

      // Auto-detect if this card is a token to filter only token alters
      const initialCardType: 'CARD' | 'TOKEN' = isCardToken ? 'TOKEN' : 'CARD';
      setMpcCardType(initialCardType);

      // 1. Load official prints from Scryfall
      setLoadingOfficial(true);
      getCardPrints(card)
        .then((data) => {
          if (!cancelled) setOfficialPrints(data);
        })
        .finally(() => {
          if (!cancelled) setLoadingOfficial(false);
        });

      // 2. Fetch MPCFill community alters (>= 200 DPI)
      fetchMpcAlters(card.name, mpcMinDpi, initialCardType, card.typeLine);
    } else {
      setOfficialPrints([]);
      setMpcPrints([]);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, card, isCardToken]);

  // Filter official prints
  const filteredOfficialPrints = useMemo(() => {
    const q = filterOfficialQuery.trim().toLowerCase();
    if (!q) return officialPrints;
    return officialPrints.filter(
      (p) =>
        p.setName.toLowerCase().includes(q) ||
        p.setCode.toLowerCase().includes(q) ||
        p.collectorNumber.toLowerCase().includes(q) ||
        (p.artist && p.artist.toLowerCase().includes(q)) ||
        (p.releasedAt && p.releasedAt.includes(q))
    );
  }, [officialPrints, filterOfficialQuery]);

  // Filter and sort MPCFill community alters
  const filteredMpcPrints = useMemo(() => {
    let list = [...mpcPrints];
    const q = mpcFilterText.trim().toLowerCase();
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
    // Sorting
    list.sort((a, b) => {
      const dpiA = a.dpi || parseInt(a.collectorNumber, 10) || 0;
      const dpiB = b.dpi || parseInt(b.collectorNumber, 10) || 0;
      if (mpcSortBy === 'dpi-desc') return dpiB - dpiA;
      if (mpcSortBy === 'dpi-asc') return dpiA - dpiB;
      if (mpcSortBy === 'name') return (a.artist || a.setName).localeCompare(b.artist || b.setName);
      if (mpcSortBy === 'recent') return (b.dateCreated || '').localeCompare(a.dateCreated || '');
      return 0;
    });
    return list;
  }, [mpcPrints, mpcFilterText, mpcSortBy]);

  // Handle manual Drive ID submission in MPC tab
  const handleApplyDriveId = () => {
    if (!card || !mpcDriveInput.trim()) return;
    const print = createPrintFromMpcId(card.name, mpcDriveInput.trim(), `MPCFill Alter (${card.name})`);
    if (!print) {
      setMpcError('ID ou link do Google Drive inválido. Cole o ID alfanumérico ou o link de compartilhamento.');
      return;
    }
    setMpcError(null);
    onSelectPrint(print);
    onClose();
  };

  // Handle uploading an MPCFill XML to extract alters for this card
  const handleMpcXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const matches = extractAltersFromXmlForCard(text, card.name);
        if (matches.length > 0) {
          // Prepend matches to MPC prints
          setMpcPrints((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnly = matches.filter((m) => !existingIds.has(m.id));
            return [...newOnly, ...prev];
          });
          setMpcError(null);
        } else {
          setMpcError(`Nenhuma arte para "${card.name}" foi encontrada dentro do arquivo XML fornecido.`);
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
  const handleCustomImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomImageUrl(dataUrl);
      if (!customTitle && card) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle custom URL input confirmation
  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    setCustomImageUrl(customUrlInput.trim());
  };

  // Handle confirm custom art
  const handleConfirmCustomArt = () => {
    if (!card || !customImageUrl) return;
    const print = createPrintFromCustomImage(card.name, customImageUrl, customTitle, customArtist);
    onSelectPrint(print);
    onClose();
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '980px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)',
          borderRadius: '16px',
          overflow: 'hidden',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Trocar Arte — {card.name}
                </h2>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Selecione uma arte oficial do Scryfall, um alter da comunidade MPCFill ou importe sua própria ilustração
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ borderRadius: '50%', padding: '6px', color: '#94a3b8', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

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
            onClick={() => setActiveTab('official')}
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
            onClick={() => setActiveTab('mpcfill')}
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
            onClick={() => setActiveTab('custom')}
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
            {officialPrints.length > 6 && (
              <div
                style={{
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(18, 23, 34, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Filtrar por edição, código, ano..."
                    value={filterOfficialQuery}
                    onChange={(e) => setFilterOfficialQuery(e.target.value)}
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8rem', width: '100%' }}
                  />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Exibindo {filteredOfficialPrints.length} de {officialPrints.length} ilustrações oficiais
                </span>
              </div>
            )}

            {/* Prints Grid */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
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
                  {officialPrints.length > 0
                    ? 'Nenhuma edição corresponde ao filtro digitado.'
                    : 'Nenhuma outra arte oficial encontrada para esta carta.'}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {filteredOfficialPrints.map((p) => {
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
                          transition: 'all 0.15s ease',
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
                <div style={{ position: 'relative', width: '280px', minWidth: '220px' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Filtrar por artista, variante..."
                    value={mpcFilterText}
                    onChange={(e) => setMpcFilterText(e.target.value)}
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8rem', width: '100%' }}
                  />
                </div>

                {/* DPI, Type and Sort Selectors */}
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
                        fetchMpcAlters(card.name, mpcMinDpi, newType, card.typeLine);
                      }}
                      style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                      title="Tipo de item no catálogo MPCFill (Cartas ou Fichas/Tokens)"
                    >
                      <option value="CARD">Cartas Oficiais</option>
                      <option value="TOKEN">Fichas / Tokens</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SlidersHorizontal size={14} className="text-amber-400" />
                    <select
                      className="input-text"
                      value={mpcMinDpi}
                      onChange={(e) => {
                        const newDpi = Number(e.target.value);
                        setMpcMinDpi(newDpi);
                        fetchMpcAlters(card.name, newDpi, mpcCardType, card.typeLine);
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowUpDown size={14} className="text-amber-400" />
                    <select
                      className="input-text"
                      value={mpcSortBy}
                      onChange={(e) => setMpcSortBy(e.target.value as any)}
                      style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px' }}
                      title="Ordenar resultados"
                    >
                      <option value="dpi-desc">Maior DPI primeiro</option>
                      <option value="dpi-asc">Menor DPI primeiro</option>
                      <option value="recent">Mais recentes</option>
                      <option value="name">Artista / Nome (A-Z)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fetchMpcAlters(card.name, mpcMinDpi, mpcCardType, card.typeLine)}
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
                    href={`https://mpcfill.com/editor?query=${encodeURIComponent(card.name)}`}
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
                    onClick={() => fetchMpcAlters(card.name, mpcMinDpi, mpcCardType, card.typeLine)}
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
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      Exibindo <strong>{filteredMpcPrints.length}</strong> de <strong>{mpcPrints.length}</strong> artes de {mpcCardType === 'TOKEN' ? 'ficha/token' : 'carta'} com {mpcMinDpi}+ DPI
                    </span>
                    <span style={{ color: '#ffbb00' }}>
                      Clique em qualquer arte para selecioná-la
                    </span>
                  </div>
                )
              )}
            </div>

            {/* MPCFill Cards Grid */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
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
                    Buscando artes de {mpcCardType === 'TOKEN' ? 'fichas/tokens' : 'cartas'} no MPCFill para <strong>"{card.name}"</strong> (&gt;{mpcMinDpi} DPI)...
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
                          Nenhuma arte de {mpcCardType === 'TOKEN' ? 'ficha/token' : 'carta'} foi encontrada automaticamente para <strong>{card.name}</strong>.
                          Certifique-se de que o servidor local (<code>npm run dev</code>) foi reiniciado, ou use a barra acima para colar o link/ID do Google Drive ou carregar um XML.
                        </>
                      )}
                  </div>
                  {mpcPrints.length === 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchMpcAlters(card.name, mpcMinDpi, mpcCardType, card.typeLine)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} className="text-amber-400" /> Tentar Novamente
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: '18px',
                  }}
                >
                  {filteredMpcPrints.map((p) => {
                    const isSelected = p.id === activePrintId || card.imageUrl === p.imageUrl;
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
                          borderColor: isSelected ? '#ffbb00' : 'var(--border-subtle)',
                          boxShadow: isSelected ? '0 0 18px rgba(255, 187, 0, 0.45)' : undefined,
                          transform: isSelected ? 'scale(1.02)' : undefined,
                          transition: 'all 0.15s ease',
                          background: '#0a0d14',
                        }}
                      >
                        <div style={{ position: 'relative', aspectRatio: '5/7', background: '#05070b' }}>
                          <img
                            src={p.imageUrl}
                            alt={p.setName}
                            crossOrigin="anonymous"
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
              )}
            </div>
          </div>
        )}

        {/* Tab 3 Content: Importar a Própria Arte */}
        {activeTab === 'custom' && (
          <div
            style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
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
                    <Upload size={32} className="text-emerald-400" />
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                        Clique para escolher a imagem
                      </span>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                        Suporta PNG, JPG, JPEG ou WEBP (alta resolução recomendada)
                      </p>
                    </div>
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
                      placeholder={`Ex: Arte Alternativa - ${card.name}`}
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
                      alt={customTitle || card.name}
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
  );
};
