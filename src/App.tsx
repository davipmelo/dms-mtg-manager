import { useState, useEffect, useMemo } from 'react';
import {
  CollectionItem,
  Deck,
  DeckCard,
  ProxyItem,
  Card,
  CardPrint,
  CardCategory,
  DeckFormat,
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
import { getCardByName, resolveCardFaces } from './services/scryfall';

import { CollectionView } from './components/Collection/CollectionView';
import { DeckManager } from './components/Decks/DeckManager';
import { DeckBuilder } from './components/Decks/DeckBuilder';
import { UtilitiesTab } from './components/Utilities/UtilitiesTab';
import { ProxyStudio } from './components/Proxies/ProxyStudio';

import { AddCardModal } from './components/Modals/AddCardModal';
import { DeckCreationModal } from './components/Modals/DeckCreationModal';
import { ArtSelectorModal } from './components/Modals/ArtSelectorModal';
import { ImportExportModal } from './components/Modals/ImportExportModal';
import { EditDeckModal } from './components/Modals/EditDeckModal';
import { MtgLogo } from './components/Common/MtgLogo';

import {
  FolderArchive,
  Swords,
  Compass,
  Printer,
  Plus,
  Upload,
  Download,
  Database,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<
    'collection' | 'decks' | 'utilities' | 'proxies'
  >('collection');
  const [rawCollection, setRawCollection] = useState<CollectionItem[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);

  // Navigation within Decks
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // Modals state
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
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

    // Merge mode: distinguish different card arts
    const mergedCollection = [...rawCollection];
    for (const incoming of backup.collection) {
      const idx = mergedCollection.findIndex(
        (existing) =>
          existing.card.id === incoming.card.id ||
          (existing.card.setCode.toLowerCase() === incoming.card.setCode.toLowerCase() &&
            existing.card.collectorNumber === incoming.card.collectorNumber)
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
    // Check if EXACT print already in collection (distinct arts treated separately)
    const existingColIdx = rawCollection.findIndex(
      (item) =>
        item.card.id === card.id ||
        (item.card.setCode.toLowerCase() === card.setCode.toLowerCase() &&
          item.card.collectorNumber === card.collectorNumber)
    );

    let colItemId: string;
    const nextCollection = [...rawCollection];
    if (existingColIdx >= 0) {
      colItemId = nextCollection[existingColIdx].id;
      nextCollection[existingColIdx] = {
        ...nextCollection[existingColIdx],
        quantity: nextCollection[existingColIdx].quantity + quantity,
        isFoil: isFoil || nextCollection[existingColIdx].isFoil,
      };
    } else {
      colItemId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      nextCollection.push({
        id: colItemId,
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
        const existingCardIdx = d.cards.findIndex(
          (c) => c.collectionItemId === colItemId || c.card.id === card.id
        );
        const nextCards = [...d.cards];
        if (existingCardIdx >= 0) {
          nextCards[existingCardIdx] = {
            ...nextCards[existingCardIdx],
            quantity: nextCards[existingCardIdx].quantity + quantity,
            collectionItemId: colItemId,
          };
        } else {
          nextCards.push({
            card,
            quantity,
            category: 'main',
            collectionItemId: colItemId,
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
    const nextCollection = [...rawCollection];
    const linkedCards: DeckCard[] = [];

    for (const c of deckData.cards || []) {
      const colIdx = nextCollection.findIndex(
        (col) =>
          col.card.id === c.card.id ||
          (col.card.setCode.toLowerCase() === c.card.setCode.toLowerCase() &&
            col.card.collectorNumber === c.card.collectorNumber)
      );
      let colId: string;
      if (colIdx >= 0) {
        colId = nextCollection[colIdx].id;
      } else {
        colId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        nextCollection.push({
          id: colId,
          card: c.card,
          quantity: c.quantity,
          dateAdded: new Date().toISOString(),
        });
      }
      linkedCards.push({
        ...c,
        collectionItemId: colId,
      });
    }
    updateCollectionState(nextCollection);

    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      name: deckData.name || 'Novo Deck',
      format: deckData.format || 'commander',
      description: deckData.description,
      commanderCard: deckData.commanderCard,
      partnerCard: deckData.partnerCard,
      cards: linkedCards,
      coverImageUrl: deckData.coverImageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextDecks = [...decks, newDeck];
    updateDecksState(nextDecks);
    setActiveDeckId(newDeck.id);
    setActiveTab('decks');
  };

  // Plain-text list import handler
  const handleImportComplete = async (
    importedCards: Array<{
      card: Card;
      quantity: number;
      category: CardCategory;
      isFoil?: boolean;
    }>,
    destination: 'collection' | 'new_deck' | string,
    newDeckName?: string,
    newDeckFormat?: DeckFormat,
    newDeckCommanderName?: string
  ) => {
    const nextCollection = [...rawCollection];
    const cardToColId = new Map<string, string>();

    for (const item of importedCards) {
      const idx = nextCollection.findIndex(
        (col) =>
          col.card.id === item.card.id ||
          (col.card.setCode.toLowerCase() === item.card.setCode.toLowerCase() &&
            col.card.collectorNumber === item.card.collectorNumber)
      );
      if (idx >= 0) {
        cardToColId.set(item.card.id, nextCollection[idx].id);
        if (destination === 'collection') {
          nextCollection[idx] = {
            ...nextCollection[idx],
            quantity: nextCollection[idx].quantity + item.quantity,
          };
        }
      } else {
        const newColId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        cardToColId.set(item.card.id, newColId);
        nextCollection.push({
          id: newColId,
          card: item.card,
          quantity: item.quantity,
          isFoil: item.isFoil,
          dateAdded: new Date().toISOString(),
        });
      }
    }
    updateCollectionState(nextCollection);

    if (destination === 'new_deck') {
      const format = newDeckFormat || 'commander';
      let commanderCard: Card | undefined;

      // If user typed commander name
      if (newDeckCommanderName?.trim()) {
        const qName = newDeckCommanderName.trim().toLowerCase();
        const match = importedCards.find((c) => c.card.name.toLowerCase() === qName);
        if (match) {
          commanderCard = match.card;
          match.category = 'commander';
        } else {
          const fetched = await getCardByName(newDeckCommanderName.trim());
          if (fetched) {
            commanderCard = fetched;
            const newColId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            nextCollection.push({
              id: newColId,
              card: fetched,
              quantity: 1,
              dateAdded: new Date().toISOString(),
            });
            updateCollectionState([...nextCollection]);
            cardToColId.set(fetched.id, newColId);
            importedCards.unshift({
              card: fetched,
              quantity: 1,
              category: 'commander',
            });
          }
        }
      }

      if (!commanderCard) {
        commanderCard = importedCards.find((c) => c.category === 'commander')?.card;
      }
      if (!commanderCard && (format === 'commander' || format === 'brawl')) {
        const legend = importedCards.find((c) =>
          c.card.typeLine.toLowerCase().includes('legendary')
        );
        if (legend) {
          commanderCard = legend.card;
          legend.category = 'commander';
        }
      }

      const newDeck: Deck = {
        id: `deck-${Date.now()}`,
        name: newDeckName || 'Deck Importado',
        format,
        commanderCard,
        coverImageUrl:
          commanderCard?.imageUrlArtCrop ||
          commanderCard?.imageUrl ||
          importedCards[0]?.card.imageUrlArtCrop,
        cards: importedCards.map((c) => ({
          card: c.card,
          quantity: c.quantity,
          category: c.category,
          collectionItemId: cardToColId.get(c.card.id),
          isFoil: c.isFoil || c.card.isFoil,
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
              collectionItemId: cardToColId.get(c.card.id),
              isFoil: c.isFoil || c.card.isFoil,
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
      // 1. Update collection
      const nextCol = rawCollection.map((i) =>
        i.id === artSelectorContext.collectionItemId ? { ...i, card: newCardData } : i
      );
      updateCollectionState(nextCol);

      // 2. Real link between collection card and all decks!
      // Requirement 2: "se eu mudo uma arte de uma carta na coleção e essa carta está dentro de algum deck, quando eu entrar na lista do deck ela deve estar com a arte nova lá também."
      const targetColId = artSelectorContext.collectionItemId;
      const oldCardId = artSelectorCard.id;

      const nextDecks = decks.map((d) => {
        let deckUpdated = false;
        const nextCards = d.cards.map((dc) => {
          if (dc.collectionItemId === targetColId || dc.card.id === oldCardId) {
            deckUpdated = true;
            return { ...dc, card: newCardData, collectionItemId: targetColId };
          }
          return dc;
        });

        let commanderCard = d.commanderCard;
        let coverImageUrl = d.coverImageUrl;
        if (
          commanderCard &&
          (commanderCard.id === oldCardId ||
            nextCards.some(
              (c) => c.category === 'commander' && c.card.id === newCardData.id
            ))
        ) {
          commanderCard = newCardData;
          coverImageUrl = newCardData.imageUrlArtCrop || newCardData.imageUrl;
          deckUpdated = true;
        }

        let partnerCard = d.partnerCard;
        if (partnerCard && partnerCard.id === oldCardId) {
          partnerCard = newCardData;
          deckUpdated = true;
        }

        if (deckUpdated) {
          return {
            ...d,
            cards: nextCards,
            commanderCard,
            partnerCard,
            coverImageUrl,
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      });

      updateDecksState(nextDecks);
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

        // Also update linked collection item
        if (targetEntry.collectionItemId) {
          updateCollectionState(
            rawCollection.map((c) =>
              c.id === targetEntry.collectionItemId ? { ...c, card: newCardData } : c
            )
          );
        } else {
          const matchedCol = rawCollection.find((c) => c.card.id === targetEntry.card.id);
          if (matchedCol) {
            updateCollectionState(
              rawCollection.map((c) =>
                c.id === matchedCol.id ? { ...c, card: newCardData } : c
              )
            );
          }
        }
      }
    }
  };

  // Proxy Queue Handlers
  const handleAddCardToProxies = async (card: Card | TokenCard, qty: number = 1) => {
    let faces = card.cardFaces;
    if ((!faces || faces.length < 2) && !card.faceLabel) {
      faces = (await resolveCardFaces(card)) || undefined;
    }

    if (faces && faces.length >= 2 && !card.faceLabel) {
      const frontCard: Card | TokenCard = {
        ...card,
        name: faces[0].name || card.name.split(' // ')[0].trim(),
        typeLine: faces[0].typeLine || card.typeLine,
        imageUrl: faces[0].imageUrl || card.imageUrl,
        imageUrlLarge: faces[0].imageUrlLarge || card.imageUrlLarge || card.imageUrl,
        faceLabel: 'frente',
      };
      const backCard: Card | TokenCard = {
        ...card,
        id: `${card.id}-back`,
        name:
          faces[1].name ||
          (card.name.includes(' // ')
            ? card.name.split(' // ')[1].trim()
            : `${card.name} (Verso)`),
        typeLine: faces[1].typeLine || card.typeLine,
        imageUrl:
          faces[1].imageUrl ||
          `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=large&face=back`,
        imageUrlLarge:
          faces[1].imageUrlLarge ||
          faces[1].imageUrl ||
          `https://api.scryfall.com/cards/${card.setCode.toLowerCase()}/${card.collectorNumber}?format=image&version=large&face=back`,
        faceLabel: 'verso',
      };

      const nextProxies = [...proxies];
      // Front face
      const existingFront = nextProxies.find(
        (p) => p.card.id === frontCard.id && p.card.faceLabel === 'frente'
      );
      if (existingFront) {
        existingFront.quantity += qty;
      } else {
        nextProxies.push({
          id: `proxy-${Date.now()}-front-${Math.random().toString(36).substring(2, 6)}`,
          card: frontCard,
          quantity: qty,
        });
      }
      // Back face
      const existingBack = nextProxies.find(
        (p) => p.card.id === backCard.id && p.card.faceLabel === 'verso'
      );
      if (existingBack) {
        existingBack.quantity += qty;
      } else {
        nextProxies.push({
          id: `proxy-${Date.now()}-back-${Math.random().toString(36).substring(2, 6)}`,
          card: backCard,
          quantity: qty,
        });
      }
      updateProxiesState(nextProxies);
    } else {
      const existing = proxies.find((p) => p.card.id === card.id);
      let nextProxies: ProxyItem[];
      if (existing) {
        nextProxies = proxies.map((p) =>
          p.card.id === card.id ? { ...p, quantity: p.quantity + qty } : p
        );
      } else {
        nextProxies = [
          ...proxies,
          { id: `proxy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, card, quantity: qty },
        ];
      }
      updateProxiesState(nextProxies);
    }
  };

  const handleAddDeckToProxies = async (deck: Deck) => {
    // 1. Separate commander(s) and other cards
    const commanderCards: Array<{ card: Card; quantity: number }> = [];
    const otherCards: Array<{ card: Card; quantity: number }> = [];

    const cmdId = deck.commanderCard?.id;
    const cmdName = deck.commanderCard?.name.toLowerCase();
    const partnerId = deck.partnerCard?.id;
    const partnerName = deck.partnerCard?.name.toLowerCase();

    for (const item of deck.cards) {
      const isCmd =
        item.category === 'commander' ||
        (cmdId && item.card.id === cmdId) ||
        (cmdName && item.card.name.toLowerCase() === cmdName);

      const isPartner =
        item.category === 'partner' ||
        (partnerId && item.card.id === partnerId) ||
        (partnerName && item.card.name.toLowerCase() === partnerName);

      if (isCmd) {
        commanderCards.unshift({ card: item.card, quantity: item.quantity });
      } else if (isPartner) {
        commanderCards.push({ card: item.card, quantity: item.quantity });
      } else {
        otherCards.push({ card: item.card, quantity: item.quantity });
      }
    }

    // Ensure commanderCard is present even if omitted from deck.cards
    if (deck.commanderCard && !commanderCards.some((c) => c.card.name.toLowerCase() === cmdName)) {
      commanderCards.unshift({ card: deck.commanderCard, quantity: 1 });
    }
    if (deck.partnerCard && !commanderCards.some((c) => c.card.name.toLowerCase() === partnerName)) {
      commanderCards.push({ card: deck.partnerCard, quantity: 1 });
    }

    // Sort other cards alphabetically by card name
    otherCards.sort((a, b) =>
      a.card.name.localeCompare(b.card.name, 'en', { sensitivity: 'base' })
    );

    // Combined deck entries: Commander(s) first, then remaining cards alphabetically
    const sortedDeckEntries = [...commanderCards, ...otherCards];

    // Expand double-faced cards (DFCs and Meld) into Front face first, immediately followed by Back face
    const deckProxyItems: ProxyItem[] = [];

    for (let idx = 0; idx < sortedDeckEntries.length; idx++) {
      const entry = sortedDeckEntries[idx];
      let faces = entry.card.cardFaces;

      // If faces not yet cached, resolve faces (supports DFCs, meld, battles, etc.)
      if (!faces || faces.length < 2) {
        const resolved = await resolveCardFaces(entry.card);
        if (resolved) faces = resolved;
      }

      if (faces && faces.length >= 2) {
        // Front face (printed first)
        const frontCard: Card = {
          ...entry.card,
          name: faces[0].name || entry.card.name.split(' // ')[0].trim(),
          typeLine: faces[0].typeLine || entry.card.typeLine,
          imageUrl: faces[0].imageUrl || entry.card.imageUrl,
          imageUrlLarge: faces[0].imageUrlLarge || entry.card.imageUrlLarge || entry.card.imageUrl,
          faceLabel: 'frente',
        };
        deckProxyItems.push({
          id: `proxy-deck-${Date.now()}-${idx}-front-${Math.random().toString(36).substring(2, 6)}`,
          card: frontCard,
          quantity: entry.quantity,
        });

        // Back face (immediately follows front face!)
        const backCard: Card = {
          ...entry.card,
          id: `${entry.card.id}-back`,
          name:
            faces[1].name ||
            (entry.card.name.includes(' // ')
              ? entry.card.name.split(' // ')[1].trim()
              : `${entry.card.name} (Verso)`),
          typeLine: faces[1].typeLine || entry.card.typeLine,
          imageUrl:
            faces[1].imageUrl ||
            `https://api.scryfall.com/cards/${entry.card.setCode.toLowerCase()}/${entry.card.collectorNumber}?format=image&version=large&face=back`,
          imageUrlLarge:
            faces[1].imageUrlLarge ||
            faces[1].imageUrl ||
            `https://api.scryfall.com/cards/${entry.card.setCode.toLowerCase()}/${entry.card.collectorNumber}?format=image&version=large&face=back`,
          faceLabel: 'verso',
        };
        deckProxyItems.push({
          id: `proxy-deck-${Date.now()}-${idx}-back-${Math.random().toString(36).substring(2, 6)}`,
          card: backCard,
          quantity: entry.quantity,
        });
      } else {
        // Single-faced normal card
        deckProxyItems.push({
          id: `proxy-deck-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          card: entry.card,
          quantity: entry.quantity,
        });
      }
    }

    if (proxies.length > 0) {
      const shouldReplace = window.confirm(
        `Sua fila de proxies já possui ${proxies.reduce((s, p) => s + p.quantity, 0)} carta(s).\n\nDeseja SUBSTITUIR a fila atual pelo deck completo "${deck.name}" para que o Comandante fique exatamente em 1º lugar na página 1?\n\n[OK = Substituir e colocar Comandante em 1º lugar]\n[Cancelar = Adicionar cartas ao final da fila atual]`
      );
      if (shouldReplace) {
        updateProxiesState(deckProxyItems);
      } else {
        updateProxiesState([...proxies, ...deckProxyItems]);
      }
    } else {
      updateProxiesState(deckProxyItems);
    }

    setActiveTab('proxies');
  };

  const activeDeck = activeDeckId ? decks.find((d) => d.id === activeDeckId) : null;
  const syncedActiveDeck = useMemo(() => {
    if (!activeDeck) return null;
    const colMap = new Map(rawCollection.map((c) => [c.id, c.card]));
    const syncedCards = activeDeck.cards.map((dc) => {
      if (dc.collectionItemId && colMap.has(dc.collectionItemId)) {
        return { ...dc, card: colMap.get(dc.collectionItemId)! };
      }
      return dc;
    });
    return {
      ...activeDeck,
      cards: syncedCards,
    };
  }, [activeDeck, rawCollection]);
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
              background: '#ffbb00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(255, 187, 0, 0.3)',
            }}
          >
            <MtgLogo size={22} color="#111114" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#f8fafc',
                lineHeight: 1.1,
              }}
            >
              DM`S MTG MANAGER
            </h1>
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
            <Download size={14} /> Importar
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setImportExportMode('export');
              setImportExportDeckId(undefined);
              setIsImportExportModalOpen(true);
            }}
          >
            <Upload size={14} /> Exportar
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
          (syncedActiveDeck ? (
            <DeckBuilder
              deck={syncedActiveDeck}
              collection={collectionWithUsage}
              onBack={() => setActiveDeckId(null)}
              onUpdateDeck={(updatedDeck) => {
                updateDecksState(decks.map((d) => (d.id === updatedDeck.id ? updatedDeck : d)));
              }}
              onOpenArtSelector={(card, cardIndex) => {
                setArtSelectorCard(card);
                setArtSelectorContext({ deckCardIndex: cardIndex });
              }}
              onAddToProxies={handleAddCardToProxies}
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
              onEditDeck={(deck) => setEditingDeck(deck)}
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

      {editingDeck && (
        <EditDeckModal
          isOpen={Boolean(editingDeck)}
          onClose={() => setEditingDeck(null)}
          deck={editingDeck}
          collection={collectionWithUsage}
          onSaveDeck={(updated) => {
            updateDecksState(decks.map((d) => (d.id === updated.id ? updated : d)));
            setEditingDeck(null);
          }}
        />
      )}
    </div>
  );
}
