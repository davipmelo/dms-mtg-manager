import { useState, useEffect } from 'react';
import {
  CollectionItem,
  Deck,
  ProxyItem,
  Card,
  CardPrint,
  CardCategory,
  TokenCard,
  SystemBackup,
} from './types';
import {
  getStoredCollection,
  saveCollection,
  getStoredDecks,
  saveDecks,
  getStoredProxies,
  saveProxies,
  calculateCollectionDeckUsage,
} from './services/storage';

import { CollectionView } from './components/Collection/CollectionView';
import { DeckManager } from './components/Decks/DeckManager';
import { DeckBuilder } from './components/Decks/DeckBuilder';
import { UtilitiesTab } from './components/Utilities/UtilitiesTab';
import { ProxyStudio } from './components/Proxies/ProxyStudio';
import { InteractiveCharts } from './components/Analytics/InteractiveCharts';

import { AddCardModal } from './components/Modals/AddCardModal';
import { DeckCreationModal } from './components/Modals/DeckCreationModal';
import { ArtSelectorModal } from './components/Modals/ArtSelectorModal';
import { ImportExportModal } from './components/Modals/ImportExportModal';

import {
  FolderArchive,
  Swords,
  Compass,
  Printer,
  BarChart3,
  Plus,
  Upload,
  Download,
  Sparkles,
  Globe,
  Database,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<
    'collection' | 'decks' | 'utilities' | 'proxies' | 'stats'
  >('collection');
  const [rawCollection, setRawCollection] = useState<CollectionItem[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);

  // Navigation within Decks
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // Modals state
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'import' | 'export' | 'backup'>(
    'import'
  );
  const [importExportDeckId, setImportExportDeckId] = useState<string | undefined>(undefined);

  // Art Selector state
  const [artSelectorCard, setArtSelectorCard] = useState<Card | null>(null);
  const [artSelectorContext, setArtSelectorContext] = useState<{
    collectionItemId?: string;
    deckCardIndex?: number;
    proxyItemId?: string;
  }>({});

  // Initialize data on load
  useEffect(() => {
    const loadedCollection = getStoredCollection();
    const loadedDecks = getStoredDecks();
    const loadedProxies = getStoredProxies();

    setRawCollection(loadedCollection);
    setDecks(loadedDecks);
    setProxies(loadedProxies);
  }, []);

  // Compute dynamic In-Use vs Available collection usage (Requirement 4)
  const collectionWithUsage = calculateCollectionDeckUsage(rawCollection, decks);

  // Save changes
  const updateCollectionState = (updated: CollectionItem[]) => {
    setRawCollection(updated);
    saveCollection(updated);
  };

  const updateDecksState = (updated: Deck[]) => {
    setDecks(updated);
    saveDecks(updated);
  };

  const updateProxiesState = (updated: ProxyItem[]) => {
    setProxies(updated);
    saveProxies(updated);
  };

  // Full System Backup Restore Handler
  const handleRestoreSystemBackup = (backup: SystemBackup, mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      updateCollectionState(backup.collection);
      updateDecksState(backup.decks);
      updateProxiesState(backup.proxies);
      setActiveDeckId(null);
      return;
    }

    // Merge mode
    const mergedCollection = [...rawCollection];
    for (const incoming of backup.collection) {
      const idx = mergedCollection.findIndex(
        (existing) =>
          (existing.card.oracleId &&
            incoming.card.oracleId &&
            existing.card.oracleId === incoming.card.oracleId) ||
          existing.card.id === incoming.card.id ||
          existing.card.name.toLowerCase() === incoming.card.name.toLowerCase()
      );
      if (idx >= 0) {
        mergedCollection[idx] = {
          ...mergedCollection[idx],
          quantity: mergedCollection[idx].quantity + incoming.quantity,
        };
      } else {
        mergedCollection.push({
          ...incoming,
          id: mergedCollection.some((c) => c.id === incoming.id)
            ? `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            : incoming.id,
        });
      }
    }

    const existingDeckIds = new Set(decks.map((d) => d.id));
    const mergedDecks = [...decks];
    for (const incomingDeck of backup.decks) {
      const safeId = existingDeckIds.has(incomingDeck.id)
        ? `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : incomingDeck.id;
      existingDeckIds.add(safeId);
      mergedDecks.push({ ...incomingDeck, id: safeId });
    }

    const mergedProxies = [...proxies];
    for (const incomingProxy of backup.proxies) {
      const idx = mergedProxies.findIndex((p) => p.card.id === incomingProxy.card.id);
      if (idx >= 0) {
        mergedProxies[idx] = {
          ...mergedProxies[idx],
          quantity: mergedProxies[idx].quantity + incomingProxy.quantity,
        };
      } else {
        mergedProxies.push({
          ...incomingProxy,
          id: `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
      }
    }

    updateCollectionState(mergedCollection);
    updateDecksState(mergedDecks);
    updateProxiesState(mergedProxies);
  };

  // Add Card Handler (from AddCardModal)
  const handleAddCard = (
    card: Card,
    quantity: number,
    isFoil: boolean,
    targetDeckId?: string
  ) => {
    const existingColIdx = rawCollection.findIndex(
      (item) =>
        (item.card.oracleId && card.oracleId && item.card.oracleId === card.oracleId) ||
        item.card.id === card.id ||
        item.card.name.toLowerCase() === card.name.toLowerCase()
    );

    const nextCollection = [...rawCollection];
    if (existingColIdx >= 0) {
      nextCollection[existingColIdx] = {
        ...nextCollection[existingColIdx],
        card,
        quantity: nextCollection[existingColIdx].quantity + quantity,
        isFoil: isFoil || nextCollection[existingColIdx].isFoil,
      };
    } else {
      nextCollection.push({
        id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        card,
        quantity,
        isFoil,
        dateAdded: new Date().toISOString(),
      });
    }
    updateCollectionState(nextCollection);

    if (targetDeckId) {
      const nextDecks = decks.map((d) => {
        if (d.id !== targetDeckId) return d;
        const existingCardIdx = d.cards.findIndex((c) => c.card.name === card.name);
        const nextCards = [...d.cards];
        if (existingCardIdx >= 0) {
          nextCards[existingCardIdx] = {
            ...nextCards[existingCardIdx],
            quantity: nextCards[existingCardIdx].quantity + quantity,
          };
        } else {
          nextCards.push({
            card,
            quantity,
            category: 'main',
          });
        }
        return { ...d, cards: nextCards, updatedAt: new Date().toISOString() };
      });
      updateDecksState(nextDecks);
    }
  };

  // Update Collection Quantity
  const handleUpdateCollectionQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      updateCollectionState(rawCollection.filter((i) => i.id !== itemId));
    } else {
      updateCollectionState(
        rawCollection.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i))
      );
    }
  };

  // Create Deck Handler
  const handleCreateDeck = (deckData: Partial<Deck>) => {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      name: deckData.name || 'Novo Deck',
      format: deckData.format || 'commander',
      description: deckData.description,
      commanderCard: deckData.commanderCard,
      partnerCard: deckData.partnerCard,
      cards: deckData.cards || [],
      coverImageUrl: deckData.coverImageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCollection = [...rawCollection];
    for (const c of newDeck.cards) {
      const exists = nextCollection.some(
        (col) =>
          (col.card.oracleId && col.card.oracleId === c.card.oracleId) ||
          col.card.name === c.card.name
      );
      if (!exists) {
        nextCollection.push({
          id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          card: c.card,
          quantity: c.quantity,
          dateAdded: new Date().toISOString(),
        });
      }
    }
    updateCollectionState(nextCollection);

    const nextDecks = [...decks, newDeck];
    updateDecksState(nextDecks);
    setActiveDeckId(newDeck.id);
    setActiveTab('decks');
  };

  // Plain-text list import handler
  const handleImportComplete = (
    importedCards: Array<{
      card: Card;
      quantity: number;
      category: CardCategory;
      isFoil?: boolean;
    }>,
    destination: 'collection' | 'new_deck' | string,
    newDeckName?: string
  ) => {
    const nextCollection = [...rawCollection];
    for (const item of importedCards) {
      const idx = nextCollection.findIndex(
        (col) =>
          (col.card.oracleId && col.card.oracleId === item.card.oracleId) ||
          col.card.name === item.card.name
      );
      if (idx >= 0) {
        if (destination === 'collection') {
          nextCollection[idx] = {
            ...nextCollection[idx],
            quantity: nextCollection[idx].quantity + item.quantity,
          };
        }
      } else {
        nextCollection.push({
          id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          card: item.card,
          quantity: item.quantity,
          isFoil: item.isFoil,
          dateAdded: new Date().toISOString(),
        });
      }
    }
    updateCollectionState(nextCollection);

    if (destination === 'new_deck') {
      const commanderCard = importedCards.find((c) => c.category === 'commander')?.card;
      const newDeck: Deck = {
        id: `deck-${Date.now()}`,
        name: newDeckName || 'Deck Importado',
        format: commanderCard ? 'commander' : 'standard',
        commanderCard,
        coverImageUrl:
          commanderCard?.imageUrlArtCrop || importedCards[0]?.card.imageUrlArtCrop,
        cards: importedCards.map((c) => ({
          card: c.card,
          quantity: c.quantity,
          category: c.category,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextDecks = [...decks, newDeck];
      updateDecksState(nextDecks);
      setActiveDeckId(newDeck.id);
      setActiveTab('decks');
    } else if (destination !== 'collection') {
      const nextDecks = decks.map((d) => {
        if (d.id !== destination) return d;
        return {
          ...d,
          cards: [
            ...d.cards,
            ...importedCards.map((c) => ({
              card: c.card,
              quantity: c.quantity,
              category: c.category,
            })),
          ],
          updatedAt: new Date().toISOString(),
        };
      });
      updateDecksState(nextDecks);
      setActiveDeckId(destination);
      setActiveTab('decks');
    } else {
      setActiveTab('collection');
    }
  };

  // Art Selection (Collection, Decks, and Proxy Queue)
  const handleSelectArtPrint = (selectedPrint: CardPrint) => {
    if (!artSelectorCard) return;

    const newCardData: Card = {
      ...artSelectorCard,
      id: selectedPrint.id,
      oracleId: selectedPrint.oracleId || artSelectorCard.oracleId,
      printsSearchUri: selectedPrint.printsSearchUri || artSelectorCard.printsSearchUri,
      setCode: selectedPrint.setCode,
      setName: selectedPrint.setName,
      collectorNumber: selectedPrint.collectorNumber,
      imageUrl: selectedPrint.imageUrl,
      imageUrlLarge: selectedPrint.imageUrlLarge || selectedPrint.imageUrl,
      imageUrlArtCrop: selectedPrint.imageUrlArtCrop || artSelectorCard.imageUrlArtCrop,
      priceUsd: selectedPrint.priceUsd ?? artSelectorCard.priceUsd,
    };

    if (artSelectorContext.collectionItemId) {
      updateCollectionState(
        rawCollection.map((i) =>
          i.id === artSelectorContext.collectionItemId ? { ...i, card: newCardData } : i
        )
      );
    }

    if (artSelectorContext.proxyItemId) {
      updateProxiesState(
        proxies.map((p) =>
          p.id === artSelectorContext.proxyItemId ? { ...p, card: newCardData } : p
        )
      );
    }

    if (
      activeDeckId &&
      typeof artSelectorContext.deckCardIndex === 'number' &&
      artSelectorContext.deckCardIndex >= 0
    ) {
      const activeDeck = decks.find((d) => d.id === activeDeckId);
      if (activeDeck && activeDeck.cards[artSelectorContext.deckCardIndex]) {
        const targetEntry = activeDeck.cards[artSelectorContext.deckCardIndex];
        const nextCards = [...activeDeck.cards];
        nextCards[artSelectorContext.deckCardIndex] = {
          ...targetEntry,
          card: newCardData,
        };
        const isCommander = targetEntry.category === 'commander';
        const isPartner = targetEntry.category === 'partner';
        updateDecksState(
          decks.map((d) =>
            d.id === activeDeckId
              ? {
                  ...d,
                  cards: nextCards,
                  commanderCard: isCommander ? newCardData : d.commanderCard,
                  partnerCard: isPartner ? newCardData : d.partnerCard,
                  coverImageUrl: isCommander
                    ? newCardData.imageUrlArtCrop || newCardData.imageUrl
                    : d.coverImageUrl,
                  updatedAt: new Date().toISOString(),
                }
              : d
          )
        );
      }
    }
  };

  // Proxy Queue Handlers
  const handleAddCardToProxies = (card: Card | TokenCard, qty: number = 1) => {
    const existing = proxies.find((p) => p.card.id === card.id);
    let nextProxies: ProxyItem[];
    if (existing) {
      nextProxies = proxies.map((p) =>
        p.card.id === card.id ? { ...p, quantity: p.quantity + qty } : p
      );
    } else {
      nextProxies = [
        ...proxies,
        { id: `proxy-${Date.now()}-${Math.random()}`, card, quantity: qty },
      ];
    }
    updateProxiesState(nextProxies);
  };

  const handleAddDeckToProxies = (deck: Deck) => {
    const nextProxies = [...proxies];
    for (const item of deck.cards) {
      const idx = nextProxies.findIndex((p) => p.card.id === item.card.id);
      if (idx >= 0) {
        nextProxies[idx] = {
          ...nextProxies[idx],
          quantity: nextProxies[idx].quantity + item.quantity,
        };
      } else {
        nextProxies.push({
          id: `proxy-${Date.now()}-${Math.random()}`,
          card: item.card,
          quantity: item.quantity,
        });
      }
    }
    updateProxiesState(nextProxies);
    setActiveTab('proxies');
  };

  const activeDeck = activeDeckId ? decks.find((d) => d.id === activeDeckId) : null;
  const totalProxyCount = proxies.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sleek Top Navigation Bar (Hidden during print) */}
      <header
        className="glass-panel print-hide"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          margin: '12px 16px 0 16px',
          padding: '10px 20px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#f8fafc',
              }}
            >
              DMS MTG Manager
            </h1>
            <div
              style={{
                fontSize: '0.7rem',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Globe size={11} /> Web Edition
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'collection' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveDeckId(null);
              setActiveTab('collection');
            }}
          >
            <FolderArchive size={16} /> Coleção
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'decks' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('decks')}
          >
            <Swords size={16} /> Decks ({decks.length})
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'utilities' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveDeckId(null);
              setActiveTab('utilities');
            }}
          >
            <Compass size={16} /> Utilitários
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'proxies' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveDeckId(null);
              setActiveTab('proxies');
            }}
          >
            <Printer size={16} /> Proxy Studio
            {totalProxyCount > 0 && (
              <span
                style={{
                  background: '#f43f5e',
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  marginLeft: '4px',
                }}
              >
                {totalProxyCount}
              </span>
            )}
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveDeckId(null);
              setActiveTab('stats');
            }}
          >
            <BarChart3 size={16} /> Estatísticas
          </button>
        </nav>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setImportExportMode('backup');
              setImportExportDeckId(undefined);
              setIsImportExportModalOpen(true);
            }}
            title="Exportar ou Restaurar Backup Completo do Sistema (.json)"
          >
            <Database size={14} /> Backup
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setImportExportMode('import');
              setImportExportDeckId(undefined);
              setIsImportExportModalOpen(true);
            }}
          >
            <Upload size={14} /> Importar
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setImportExportMode('export');
              setImportExportDeckId(undefined);
              setIsImportExportModalOpen(true);
            }}
          >
            <Download size={14} /> Exportar
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddCardModalOpen(true)}
          >
            <Plus size={16} /> Nova Carta
          </button>
        </div>
      </header>

      {/* Main App Body */}
      <main
        style={{
          flex: 1,
          padding: '20px 24px',
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {activeTab === 'collection' && (
          <CollectionView
            collection={collectionWithUsage}
            onUpdateQuantity={handleUpdateCollectionQuantity}
            onOpenArtSelector={(card, colItemId) => {
              setArtSelectorCard(card);
              setArtSelectorContext({ collectionItemId: colItemId });
            }}
            onAddToProxies={handleAddCardToProxies}
            onRemoveItem={(id) => handleUpdateCollectionQuantity(id, 0)}
            onOpenAddModal={() => setIsAddCardModalOpen(true)}
          />
        )}

        {activeTab === 'decks' &&
          (activeDeck ? (
            <DeckBuilder
              deck={activeDeck}
              onBack={() => setActiveDeckId(null)}
              onUpdateDeck={(updatedDeck) => {
                updateDecksState(decks.map((d) => (d.id === updatedDeck.id ? updatedDeck : d)));
              }}
              onOpenArtSelector={(card, cardIndex) => {
                setArtSelectorCard(card);
                setArtSelectorContext({ deckCardIndex: cardIndex });
              }}
              onSendDeckToProxies={handleAddDeckToProxies}
              onOpenExportModal={(deckId) => {
                setImportExportMode('export');
                setImportExportDeckId(deckId);
                setIsImportExportModalOpen(true);
              }}
              onOpenAddCardModal={() => {
                setIsAddCardModalOpen(true);
              }}
            />
          ) : (
            <DeckManager
              decks={decks}
              onOpenDeck={(deckId) => setActiveDeckId(deckId)}
              onOpenCreateModal={() => setIsCreateDeckModalOpen(true)}
              onOpenImportModal={() => {
                setImportExportMode('import');
                setImportExportDeckId(undefined);
                setIsImportExportModalOpen(true);
              }}
              onDeleteDeck={(deckId) => {
                updateDecksState(decks.filter((d) => d.id !== deckId));
              }}
              onSendDeckToProxies={handleAddDeckToProxies}
            />
          ))}

        {activeTab === 'utilities' && (
          <UtilitiesTab onAddUtilityToProxies={handleAddCardToProxies} />
        )}

        {activeTab === 'proxies' && (
          <ProxyStudio
            proxies={proxies}
            onUpdateQuantity={(id, qty) => {
              updateProxiesState(proxies.map((p) => (p.id === id ? { ...p, quantity: qty } : p)));
            }}
            onRemoveItem={(id) => {
              updateProxiesState(proxies.filter((p) => p.id !== id));
            }}
            onClearAll={() => updateProxiesState([])}
            onAddDeckToProxies={handleAddDeckToProxies}
            onOpenArtSelector={(card, proxyItemId) => {
              const normalized: Card =
                'cmc' in card
                  ? card
                  : {
                      id: card.id,
                      oracleId: card.oracleId,
                      printsSearchUri: card.printsSearchUri,
                      name: card.name,
                      cmc: 0,
                      typeLine: card.typeLine,
                      oracleText: card.oracleText,
                      colors: card.colors,
                      colorIdentity: card.colors,
                      power: card.power,
                      toughness: card.toughness,
                      rarity: 'common',
                      setName: card.setName,
                      setCode: card.setCode,
                      collectorNumber: card.collectorNumber,
                      imageUrl: card.imageUrl,
                      imageUrlLarge: card.imageUrlLarge,
                    };
              setArtSelectorCard(normalized);
              setArtSelectorContext({ proxyItemId });
            }}
            decks={decks}
          />
        )}

        {activeTab === 'stats' && (
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h2
              style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '22px',
              }}
            >
              Estatísticas Globais da Coleção & Pool
            </h2>
            <InteractiveCharts
              cards={collectionWithUsage.map((i) => ({ card: i.card, quantity: i.quantity }))}
              showDeckMetrics={false}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <AddCardModal
        isOpen={isAddCardModalOpen}
        onClose={() => setIsAddCardModalOpen(false)}
        onAddCard={handleAddCard}
        decks={decks}
        defaultDeckId={activeDeckId || undefined}
      />

      <DeckCreationModal
        isOpen={isCreateDeckModalOpen}
        onClose={() => setIsCreateDeckModalOpen(false)}
        onCreateDeck={handleCreateDeck}
      />

      <ArtSelectorModal
        isOpen={!!artSelectorCard}
        card={artSelectorCard}
        onClose={() => {
          setArtSelectorCard(null);
          setArtSelectorContext({});
        }}
        onSelectPrint={handleSelectArtPrint}
      />

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        collection={collectionWithUsage}
        decks={decks}
        proxies={proxies}
        defaultMode={importExportMode}
        defaultDeckId={importExportDeckId}
        onImportComplete={handleImportComplete}
        onRestoreSystemBackup={handleRestoreSystemBackup}
      />
    </div>
  );
}
