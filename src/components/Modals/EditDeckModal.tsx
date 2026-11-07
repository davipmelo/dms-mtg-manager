import React, { useState, useEffect } from 'react';
import { Deck, DeckFormat, DeckCard, Card, CollectionItem } from '../../types';
import { parseCardList } from '../../services/importer';
import { getCardByName, getCardBySetAndNumber, getCardBySetAndName } from '../../services/scryfall';
import { X, Save, Edit3, Crown, AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react';

interface EditDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck;
  collection: CollectionItem[];
  onSaveDeck: (updatedDeck: Deck) => void;
}

export const EditDeckModal: React.FC<EditDeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  collection: _collection,
  onSaveDeck,
}) => {
  const [deckName, setDeckName] = useState(deck.name);
  const [deckFormat, setDeckFormat] = useState<DeckFormat>(deck.format);
  const [description, setDescription] = useState(deck.description || '');
  const [cardListText, setCardListText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [detectedCount, setDetectedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Commander state
  const [commanderInput, setCommanderInput] = useState('');
  const [commanderCard, setCommanderCard] = useState<Card | undefined>(deck.commanderCard);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      setDeckName(deck.name);
      setDeckFormat(deck.format);
      setDescription(deck.description || '');
      setCommanderCard(deck.commanderCard);
      setCommanderInput(
        deck.commanderCard
          ? `${deck.commanderCard.name} (${deck.commanderCard.setCode}) ${deck.commanderCard.collectorNumber}`
          : ''
      );
      setErrorMessage('');

      // Build initial plain text card list from deck.cards (excluding standalone commander if separated)
      const lines: string[] = [];
      deck.cards.forEach((dc) => {
        const setPart = dc.card.setCode ? ` (${dc.card.setCode})` : '';
        const numPart = dc.card.collectorNumber ? ` ${dc.card.collectorNumber}` : '';
        lines.push(`${dc.quantity} ${dc.card.name}${setPart}${numPart}`);
      });

      const initialText = lines.join('\n');
      setCardListText(initialText);
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

    setIsProcessing(true);
    setErrorMessage('');
    setProgressText('Processando lista de cartas...');

    try {
      const parsedLines = parseCardList(cardListText);
      if (parsedLines.length === 0) {
        setErrorMessage('A lista de cartas não pode ficar vazia.');
        setIsProcessing(false);
        return;
      }

      // Map to keep track of existing cards in current deck to avoid unnecessary network fetches
      const existingCardsMap = new Map<string, Card>();
      deck.cards.forEach((dc) => {
        const keyExact = `${dc.card.name.toLowerCase()}-${dc.card.setCode.toLowerCase()}-${dc.card.collectorNumber}`;
        existingCardsMap.set(keyExact, dc.card);
        existingCardsMap.set(dc.card.name.toLowerCase(), dc.card);
      });

      const updatedDeckCards: DeckCard[] = [];

      for (let i = 0; i < parsedLines.length; i++) {
        const item = parsedLines[i];
        setProgressText(`Sincronizando carta (${i + 1}/${parsedLines.length}): ${item.name}...`);

        const exactKey = `${item.name.toLowerCase()}-${(item.setCode || '').toLowerCase()}-${item.collectorNumber || ''}`;
        let matchedCard: Card | null = existingCardsMap.get(exactKey) || null;

        // If not exact match by set/number, but setCode/collectorNumber was requested, fetch from Scryfall
        if (!matchedCard && item.setCode && item.collectorNumber) {
          matchedCard = await getCardBySetAndNumber(item.setCode, item.collectorNumber);
        } else if (!matchedCard && item.setCode) {
          matchedCard = await getCardBySetAndName(item.setCode, item.name);
        }

        // If still not matched, check existing by name or fetch from Scryfall
        if (!matchedCard) {
          matchedCard = existingCardsMap.get(item.name.toLowerCase()) || null;
        }
        if (!matchedCard) {
          matchedCard = await getCardByName(item.name);
        }

        if (matchedCard) {
          updatedDeckCards.push({
            card: matchedCard,
            quantity: item.quantity,
            category: item.category || 'main',
            isFoil: item.isFoil || matchedCard.isFoil,
          });
        }
      }

      // Ensure commander card is in deck.cards for commander formats
      if (commanderCard && !updatedDeckCards.some((dc) => dc.card.id === commanderCard.id)) {
        updatedDeckCards.unshift({
          card: commanderCard,
          quantity: 1,
          category: 'commander',
        });
      }

      const updatedDeck: Deck = {
        ...deck,
        name: deckName.trim(),
        format: deckFormat,
        description: description.trim() || undefined,
        commanderCard: commanderCard,
        cards: updatedDeckCards,
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
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Descrição / Estratégia (Opcional)
            </label>
            <input
              type="text"
              className="input-text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Focado em marcadores +1/+1 e planeswalkers infect..."
              disabled={isProcessing}
            />
          </div>

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

