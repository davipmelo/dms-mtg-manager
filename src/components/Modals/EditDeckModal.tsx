import React, { useState, useEffect, useRef } from 'react';
import { Deck, DeckFormat, DeckCard, Card, CollectionItem, DeckTag, isCardNameMatch } from '../../types';
import { parseCardList } from '../../services/importer';
import { getCardByName, getCardBySetAndNumber, getCardBySetAndName } from '../../services/scryfall';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import { X, Save, Edit3, Crown, AlertTriangle, FileText, Loader2, Check, Tag } from 'lucide-react';

interface EditDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck;
  collection: CollectionItem[];
  onSaveDeck: (updatedDeck: Deck) => void;
  deckTags?: DeckTag[];
  onOpenManageTags?: () => void;
}

export const EditDeckModal: React.FC<EditDeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  collection: _collection,
  onSaveDeck,
  deckTags = [],
  onOpenManageTags,
}) => {
  const [deckName, setDeckName] = useState(deck.name);
  const [deckFormat, setDeckFormat] = useState<DeckFormat>(deck.format);
  const [description, setDescription] = useState(deck.description || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(deck.tags || []);
  const [cardListText, setCardListText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [detectedCount, setDetectedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useModalOverlay(isOpen, onClose, isProcessing);

  // Commander state
  const [commanderInput, setCommanderInput] = useState('');
  const [commanderCard, setCommanderCard] = useState<Card | undefined>(deck.commanderCard);

  // Track initial card list text to prevent destructive card re-fetching when only metadata is edited
  const initialCardListTextRef = useRef<string>('');

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      setDeckName(deck.name);
      setDeckFormat(deck.format);
      setDescription(deck.description || '');
      setSelectedTags(deck.tags || []);
      setCommanderCard(deck.commanderCard);
      setCommanderInput(
        deck.commanderCard
          ? `${deck.commanderCard.name} (${deck.commanderCard.setCode}) ${deck.commanderCard.collectorNumber}`
          : ''
      );
      setErrorMessage('');

      // Build initial plain text card list from deck.cards
      // Differentiate cards with distinct arts/images so that different basic lands are never collapsed into one line
      const cardCounts = new Map<
        string,
        { count: number; name: string; setCode?: string; collectorNumber?: string }
      >();

      deck.cards.forEach((dc) => {
        const artIdentifier = dc.card.imageUrl || dc.card.id || '';
        const key = `${dc.card.name}|${(dc.card.setCode || '').toLowerCase()}|${dc.card.collectorNumber || ''}|${artIdentifier}`;
        const existing = cardCounts.get(key);
        if (existing) {
          existing.count += dc.quantity || 1;
        } else {
          cardCounts.set(key, {
            count: dc.quantity || 1,
            name: dc.card.name,
            setCode: dc.card.setCode,
            collectorNumber: dc.card.collectorNumber,
          });
        }
      });

      const lines: string[] = [];
      cardCounts.forEach((item) => {
        const setPart = item.setCode ? ` (${item.setCode})` : '';
        const numPart = item.collectorNumber ? ` ${item.collectorNumber}` : '';
        lines.push(`${item.count} ${item.name}${setPart}${numPart}`);
      });

      const initialText = lines.join('\n');
      setCardListText(initialText);
      initialCardListTextRef.current = initialText;

      const parsed = parseCardList(initialText);
      setDetectedCount(parsed.reduce((sum, p) => sum + p.quantity, 0));
    }
  }, [isOpen, deck]);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setCardListText(text);
    const parsed = parseCardList(text);
    setDetectedCount(parsed.reduce((sum, p) => sum + p.quantity, 0));
  };

  const handleSearchCommander = async () => {
    if (!commanderInput.trim()) return;
    setIsProcessing(true);
    setProgressText('Buscando comandante...');
    try {
      const parsed = parseCardList(`1 ${commanderInput.trim()}`)[0];
      let found: Card | null = null;
      if (parsed?.setCode && parsed.collectorNumber) {
        found = await getCardBySetAndNumber(parsed.setCode, parsed.collectorNumber);
      } else if (parsed?.setCode) {
        found = await getCardBySetAndName(parsed.setCode, parsed.name);
      }
      if (!found && parsed?.name) {
        found = await getCardByName(parsed.name);
      }
      if (found) {
        setCommanderCard(found);
      } else {
        setErrorMessage(`Comandante "${commanderInput}" não encontrado no Scryfall.`);
      }
    } catch {
      setErrorMessage('Erro ao buscar comandante.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleSave = async () => {
    if (!deckName.trim()) {
      setErrorMessage('O deck precisa de um nome válido.');
      return;
    }

    const isCardListModified = cardListText.trim() !== initialCardListTextRef.current.trim();

    // FAST PATH: When the user only changed description, name, format, tags, or commander (and did NOT edit the card list)
    // NEVER re-parse, NEVER fetch from Scryfall, and NEVER replace existing card arts or basic lands!
    if (!isCardListModified) {
      let updatedDeckCards = [...deck.cards];

      // If commander was modified via the commander input
      if (commanderCard && (!deck.commanderCard || commanderCard.id !== deck.commanderCard.id)) {
        updatedDeckCards = updatedDeckCards.map((dc) => {
          if (
            dc.category === 'commander' &&
            dc.card.id !== commanderCard.id &&
            !isCardNameMatch(dc.card.name, commanderCard.name)
          ) {
            return { ...dc, category: 'main' as const };
          }
          return dc;
        });

        const existingCmdIndex = updatedDeckCards.findIndex(
          (dc) => dc.card.id === commanderCard.id || isCardNameMatch(dc.card.name, commanderCard.name)
        );

        if (existingCmdIndex >= 0) {
          updatedDeckCards[existingCmdIndex] = {
            ...updatedDeckCards[existingCmdIndex],
            category: 'commander',
            card: commanderCard,
          };
        } else {
          updatedDeckCards.unshift({
            card: commanderCard,
            quantity: 1,
            category: 'commander',
            instanceId: `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          });
        }
      }

      const resolvedCommander = commanderCard || deck.commanderCard;
      const oldCoverWasCommander =
        !deck.coverImageUrl ||
        deck.coverImageUrl === deck.commanderCard?.imageUrlArtCrop ||
        deck.coverImageUrl === deck.commanderCard?.imageUrl;
      const commanderChanged =
        Boolean(commanderCard) && commanderCard?.id !== deck.commanderCard?.id;

      const updatedDeck: Deck = {
        ...deck,
        name: deckName.trim(),
        format: deckFormat,
        description: description.trim() || undefined,
        commanderCard: resolvedCommander,
        coverImageUrl:
          commanderChanged && oldCoverWasCommander
            ? resolvedCommander?.imageUrlArtCrop || resolvedCommander?.imageUrl || deck.coverImageUrl
            : deck.coverImageUrl,
        cards: updatedDeckCards,
        tags: selectedTags,
        updatedAt: new Date().toISOString(),
      };

      onSaveDeck(updatedDeck);
      onClose();
      return;
    }

    // SLOW PATH: The user actually edited the card list text
    setIsProcessing(true);
    setErrorMessage('');
    setProgressText('Processando alterações da lista...');

    try {
      const parsedLines = parseCardList(cardListText);
      if (parsedLines.length === 0) {
        setErrorMessage('A lista de cartas não pode ficar vazia.');
        setIsProcessing(false);
        return;
      }

      // Mutable pool of existing cards from the deck to preserve arts, custom MPCFill alters, foils, and instances
      const pool: { item: DeckCard; used: boolean }[] = deck.cards.map((dc) => ({
        item: dc,
        used: false,
      }));

      let updatedDeckCards: DeckCard[] = [];

      for (let i = 0; i < parsedLines.length; i++) {
        const item = parsedLines[i];
        const qty = Math.max(1, item.quantity || 1);

        for (let q = 0; q < qty; q++) {
          // Priority 1: Match unused card in pool with exact Name + SetCode + CollectorNumber
          let matchedIndex = pool.findIndex(
            (p) =>
              !p.used &&
              isCardNameMatch(p.item.card.name, item.name) &&
              (item.setCode
                ? (p.item.card.setCode || '').toLowerCase() === item.setCode.toLowerCase()
                : true) &&
              (item.collectorNumber
                ? String(p.item.card.collectorNumber || '').toLowerCase() ===
                  String(item.collectorNumber).toLowerCase()
                : true)
          );

          // Priority 2: Match unused card in pool with Name + SetCode
          if (matchedIndex === -1 && item.setCode) {
            const targetSet = item.setCode.toLowerCase();
            matchedIndex = pool.findIndex(
              (p) =>
                !p.used &&
                isCardNameMatch(p.item.card.name, item.name) &&
                (p.item.card.setCode || '').toLowerCase() === targetSet
            );
          }

          // Priority 3: Match unused card in pool with Name (preserves different arts for repeated cards/basic lands in sequence!)
          if (matchedIndex === -1) {
            matchedIndex = pool.findIndex(
              (p) => !p.used && isCardNameMatch(p.item.card.name, item.name)
            );
          }

          if (matchedIndex !== -1) {
            const foundPoolItem = pool[matchedIndex];
            foundPoolItem.used = true;
            updatedDeckCards.push({
              ...foundPoolItem.item,
              quantity: 1,
              category: item.category || foundPoolItem.item.category || 'main',
              isFoil: item.isFoil ?? foundPoolItem.item.isFoil ?? false,
              instanceId:
                foundPoolItem.item.instanceId ||
                `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
            continue;
          }

          // Priority 4: If card was NOT in the existing deck, check the user's collection
          let collectionCard: Card | null = null;
          if (_collection && _collection.length > 0) {
            const colItem =
              _collection.find(
                (ci) =>
                  isCardNameMatch(ci.card.name, item.name) &&
                  (item.setCode
                    ? (ci.card.setCode || '').toLowerCase() === item.setCode.toLowerCase()
                    : true) &&
                  (item.collectorNumber
                    ? String(ci.card.collectorNumber || '').toLowerCase() ===
                      String(item.collectorNumber).toLowerCase()
                    : true)
              ) || _collection.find((ci) => isCardNameMatch(ci.card.name, item.name));

            if (colItem) {
              collectionCard = colItem.card;
            }
          }

          if (collectionCard) {
            updatedDeckCards.push({
              card: { ...collectionCard },
              quantity: 1,
              category: item.category || 'main',
              isFoil: item.isFoil || collectionCard.isFoil || false,
              instanceId: `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
            continue;
          }

          // Priority 5: ONLY for genuinely new cards not found in deck or collection, fetch from Scryfall
          setProgressText(`Buscando nova carta (${item.name})...`);
          let fetchedCard: Card | null = null;
          if (item.setCode && item.collectorNumber) {
            fetchedCard = await getCardBySetAndNumber(item.setCode, item.collectorNumber);
          } else if (item.setCode) {
            fetchedCard = await getCardBySetAndName(item.setCode, item.name);
          }
          if (!fetchedCard) {
            fetchedCard = await getCardByName(item.name);
          }

          if (fetchedCard) {
            updatedDeckCards.push({
              card: { ...fetchedCard },
              quantity: 1,
              category: item.category || 'main',
              isFoil: item.isFoil || fetchedCard.isFoil || false,
              instanceId: `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          }
        }
      }

      // Ensure commander card is in deck.cards for commander formats, and demote old non-partner commanders
      if (commanderCard) {
        updatedDeckCards = updatedDeckCards.map((dc) => {
          if (
            dc.category === 'commander' &&
            dc.card.id !== commanderCard.id &&
            !isCardNameMatch(dc.card.name, commanderCard.name)
          ) {
            return { ...dc, category: 'main' as const };
          }
          return dc;
        });

        if (
          !updatedDeckCards.some(
            (dc) =>
              dc.card.id === commanderCard.id ||
              isCardNameMatch(dc.card.name, commanderCard.name)
          )
        ) {
          updatedDeckCards.unshift({
            card: commanderCard,
            quantity: 1,
            category: 'commander',
            instanceId: `dc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          });
        }
      }

      const resolvedCommander = commanderCard || deck.commanderCard;
      const oldCoverWasCommander =
        !deck.coverImageUrl ||
        deck.coverImageUrl === deck.commanderCard?.imageUrlArtCrop ||
        deck.coverImageUrl === deck.commanderCard?.imageUrl;
      const commanderChanged =
        Boolean(commanderCard) && commanderCard?.id !== deck.commanderCard?.id;

      const updatedDeck: Deck = {
        ...deck,
        name: deckName.trim(),
        format: deckFormat,
        description: description.trim() || undefined,
        commanderCard: resolvedCommander,
        coverImageUrl:
          commanderChanged && oldCoverWasCommander
            ? resolvedCommander?.imageUrlArtCrop || resolvedCommander?.imageUrl || deck.coverImageUrl
            : deck.coverImageUrl,
        cards: updatedDeckCards,
        tags: selectedTags,
        updatedAt: new Date().toISOString(),
      };

      onSaveDeck(updatedDeck);
      onClose();
    } catch (err: any) {
      console.error('Error saving deck changes:', err);
      setErrorMessage(err?.message || 'Ocorreu um erro ao salvar as alterações do deck.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const targetCards = deckFormat === 'commander' ? 100 : deckFormat === 'brawl' ? 60 : 60;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 11, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className="modal-container glass-panel"
        style={{
          width: '780px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)',
          borderRadius: '16px',
          overflow: 'hidden',
          animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                Editar Deck: {deck.name}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Altere o nome, formato, comandante ou a lista completa de cartas.
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} disabled={isProcessing}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          className="modal-body"
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px',
            flex: 1,
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name & Format */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Nome do Deck *
              </label>
              <input
                type="text"
                className="input-text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Ex: Atraxa Proliferate..."
                disabled={isProcessing}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Formato
              </label>
              <select
                className="select-field"
                value={deckFormat}
                onChange={(e) => setDeckFormat(e.target.value as DeckFormat)}
                disabled={isProcessing}
              >
                <option value="commander">Commander / EDH (100 cartas)</option>
                <option value="brawl">Brawl (60 cartas com comandante)</option>
                <option value="standard">Standard (60 cartas)</option>
                <option value="modern">Modern (60 cartas)</option>
                <option value="pioneer">Pioneer (60 cartas)</option>
                <option value="pauper">Pauper (60 cartas)</option>
                <option value="legacy">Legacy (60 cartas)</option>
                <option value="vintage">Vintage (60 cartas)</option>
                <option value="casual">Casual (Livre)</option>
              </select>
            </div>
          </div>

          {/* Commander input if commander format */}
          {(deckFormat === 'commander' || deckFormat === 'brawl') && (
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>
                <Crown size={15} />
                Comandante do Deck
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Nome do comandante (ex: Atraxa, Praetors' Voice (2XM) 376)..."
                  value={commanderInput}
                  onChange={(e) => setCommanderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCommander()}
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSearchCommander}
                  disabled={isProcessing || !commanderInput.trim()}
                >
                  Buscar
                </button>
              </div>
              {commanderCard && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fef3c7' }}>
                  <span>✓ Comandante atual: <strong>{commanderCard.name}</strong> ({commanderCard.setCode.toUpperCase()} #{commanderCard.collectorNumber})</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                Descrição do Deck (exibida no card)
              </label>
              {description && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDescription('')}
                  style={{ fontSize: '0.72rem', padding: '1px 6px', color: '#94a3b8' }}
                  title="Remover texto da descrição"
                >
                  Limpar descrição
                </button>
              )}
            </div>
            <textarea
              className="textarea-field"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição, tema ou anotações para este deck..."
              disabled={isProcessing}
            />
          </div>

          {/* Tags Selection */}
          {deckTags && deckTags.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} className="text-amber-400" /> Tags do Deck
                </label>
                {onOpenManageTags && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onOpenManageTags}
                    style={{ fontSize: '0.72rem', padding: '2px 8px', color: '#ffbb00' }}
                  >
                    + Gerenciar Tags
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {deckTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id) || selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTags(selectedTags.filter((t) => t !== tag.id && t !== tag.name));
                        } else {
                          setSelectedTags([...selectedTags, tag.id]);
                        }
                      }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isSelected ? '#ffffff' : tag.color,
                        backgroundColor: isSelected ? tag.color : `${tag.color}15`,
                        border: `1px solid ${isSelected ? tag.color : `${tag.color}50`}`,
                        boxShadow: isSelected ? `0 0 10px ${tag.color}66` : 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#ffffff' : tag.color,
                        }}
                      />
                      {tag.name}
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card list textarea */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                Lista de Cards (1 carta por linha)
              </label>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: detectedCount === targetCards ? '#34d399' : '#f59e0b',
                }}
              >
                {detectedCount} / {targetCards} cartas detectadas
              </span>
            </div>
            <textarea
              className="textarea-field"
              rows={11}
              value={cardListText}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={isProcessing}
              placeholder={`Exemplo:\n4 Lightning Bolt (CLB) 187\n1 Sol Ring (C21) 263\n1 Demonic Tutor\n1 Swords to Plowshares`}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
              Dica: Você pode alterar quantidades, adicionar novas cartas ou editar a edição entre parênteses ex: (CMM) 400.
            </p>
          </div>

          {/* Status bar when processing */}
          {isProcessing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.12)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#a5b4fc',
                fontSize: '0.85rem',
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} />
            <span>{detectedCount} cartas no total</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isProcessing}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isProcessing || !deckName.trim() || detectedCount === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save size={16} /> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

