import React, { useState } from 'react';
import { Deck, DeckFormat, Card, CardPrint } from '../../types';
import {
  searchAutocomplete,
  getCardByName,
  getCardBySetAndNumber,
  getCardBySetAndName,
} from '../../services/scryfall';
import { translatePtCardName } from '../../services/importer';
import { ArtSelectorModal } from './ArtSelectorModal';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import { Shield, Sparkles, X, Plus, Search, Loader2, Image as ImageIcon, AlertTriangle } from 'lucide-react';

function parseCardQuery(raw: string) {
  let line = raw.trim().replace(/^\d+x?\s+/, '');
  const arenaMatch = line.match(/^([^(]+?)\s+\(([A-Za-z0-9]{3,5})\)(?:\s+([A-Za-z0-9]+))?/i);
  if (arenaMatch) {
    return {
      name: arenaMatch[1].trim(),
      setCode: arenaMatch[2].toUpperCase(),
      collectorNumber: arenaMatch[3]?.trim(),
    };
  }
  const bracketMatch = line.match(/^([^[]+?)\s+\[([A-Za-z0-9]{3,5})(?::([A-Za-z0-9]+))?\]/i);
  if (bracketMatch) {
    return {
      name: bracketMatch[1].trim(),
      setCode: bracketMatch[2].toUpperCase(),
      collectorNumber: bracketMatch[3]?.trim(),
    };
  }
  return { name: line };
}

interface DeckCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDeck: (deckData: Partial<Deck>) => void;
}

export const DeckCreationModal: React.FC<DeckCreationModalProps> = ({
  isOpen,
  onClose,
  onCreateDeck,
}) => {
  useModalOverlay(isOpen, onClose);

  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [description, setDescription] = useState('');
  const [commanderQuery, setCommanderQuery] = useState('');
  const [commanderSuggestions, setCommanderSuggestions] = useState<string[]>([]);
  const [selectedCommander, setSelectedCommander] = useState<Card | null>(null);
  const [loadingCommander, setLoadingCommander] = useState(false);
  const [commanderWarning, setCommanderWarning] = useState<string | null>(null);

  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerSuggestions, setPartnerSuggestions] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Card | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [partnerWarning, setPartnerWarning] = useState<string | null>(null);

  // Art Selector state for commander / partner
  const [artSelectorTarget, setArtSelectorTarget] = useState<'commander' | 'partner' | null>(null);

  if (!isOpen) return null;

  const resolveCardWithArt = async (rawInput: string) => {
    const { name: parsedName, setCode, collectorNumber } = parseCardQuery(rawInput);
    const translated = translatePtCardName(parsedName);

    let card: Card | null = null;
    let matchedExact = false;

    if (setCode && collectorNumber) {
      card = await getCardBySetAndNumber(setCode, collectorNumber);
      if (card) matchedExact = true;
    } else if (setCode) {
      card = await getCardBySetAndName(setCode, translated);
      if (card) matchedExact = true;
    }

    if (!card) {
      card = await getCardByName(translated);
    }

    return {
      card,
      matchedExact,
      requestedSet: setCode,
      requestedNumber: collectorNumber,
    };
  };

  const handleSearchCommander = async (query: string) => {
    setCommanderQuery(query);
    setCommanderWarning(null);
    const { name: parsedName } = parseCardQuery(query);
    if (!parsedName || parsedName.length < 2) {
      setCommanderSuggestions([]);
      return;
    }
    const results = await searchAutocomplete(parsedName);
    setCommanderSuggestions(results.slice(0, 6));
  };

  const handleExecuteCommanderLookup = async (textToLookup: string) => {
    if (!textToLookup.trim()) return;
    setLoadingCommander(true);
    setCommanderSuggestions([]);
    setCommanderWarning(null);
    try {
      const { card, matchedExact, requestedSet, requestedNumber } = await resolveCardWithArt(textToLookup);
      if (card) {
        setSelectedCommander(card);
        setCommanderQuery(
          requestedSet
            ? `${card.name} (${card.setCode}) ${card.collectorNumber}`
            : card.name
        );
        if (requestedSet && !matchedExact) {
          setCommanderWarning(
            `A arte solicitada (${requestedSet}${requestedNumber ? ` #${requestedNumber}` : ''}) não foi localizada no Scryfall. Carregamos a arte padrão (${card.setCode} #${card.collectorNumber}). Você pode clicar em "Artes" para trocar.`
          );
        }
      } else {
        setCommanderWarning(`Carta "${textToLookup}" não foi encontrada no Scryfall.`);
      }
    } finally {
      setLoadingCommander(false);
    }
  };

  const handleSelectCommanderSuggestion = async (cardName: string) => {
    await handleExecuteCommanderLookup(cardName);
  };

  const handleSearchPartner = async (query: string) => {
    setPartnerQuery(query);
    setPartnerWarning(null);
    const { name: parsedName } = parseCardQuery(query);
    if (!parsedName || parsedName.length < 2) {
      setPartnerSuggestions([]);
      return;
    }
    const results = await searchAutocomplete(parsedName);
    setPartnerSuggestions(results.slice(0, 6));
  };

  const handleExecutePartnerLookup = async (textToLookup: string) => {
    if (!textToLookup.trim()) return;
    setLoadingPartner(true);
    setPartnerSuggestions([]);
    setPartnerWarning(null);
    try {
      const { card, matchedExact, requestedSet, requestedNumber } = await resolveCardWithArt(textToLookup);
      if (card) {
        setSelectedPartner(card);
        setPartnerQuery(
          requestedSet
            ? `${card.name} (${card.setCode}) ${card.collectorNumber}`
            : card.name
        );
        if (requestedSet && !matchedExact) {
          setPartnerWarning(
            `A arte solicitada (${requestedSet}${requestedNumber ? ` #${requestedNumber}` : ''}) não foi localizada. Carregamos a arte padrão (${card.setCode} #${card.collectorNumber}).`
          );
        }
      } else {
        setPartnerWarning(`Carta "${textToLookup}" não foi encontrada no Scryfall.`);
      }
    } finally {
      setLoadingPartner(false);
    }
  };

  const handleSelectPartnerSuggestion = async (cardName: string) => {
    await handleExecutePartnerLookup(cardName);
  };

  const handleSelectPrintForCommanderOrPartner = (print: CardPrint) => {
    if (artSelectorTarget === 'commander' && selectedCommander) {
      setSelectedCommander({
        ...selectedCommander,
        id: print.id,
        oracleId: print.oracleId || selectedCommander.oracleId,
        printsSearchUri: print.printsSearchUri || selectedCommander.printsSearchUri,
        setCode: print.setCode,
        setName: print.setName,
        collectorNumber: print.collectorNumber,
        imageUrl: print.imageUrl,
        imageUrlLarge: print.imageUrlLarge || print.imageUrl,
        imageUrlArtCrop: print.imageUrlArtCrop || print.imageUrl || selectedCommander.imageUrlArtCrop,
      });
      setCommanderQuery(`${selectedCommander.name} (${print.setCode}) ${print.collectorNumber}`);
      setCommanderWarning(null);
    } else if (artSelectorTarget === 'partner' && selectedPartner) {
      setSelectedPartner({
        ...selectedPartner,
        id: print.id,
        oracleId: print.oracleId || selectedPartner.oracleId,
        printsSearchUri: print.printsSearchUri || selectedPartner.printsSearchUri,
        setCode: print.setCode,
        setName: print.setName,
        collectorNumber: print.collectorNumber,
        imageUrl: print.imageUrl,
        imageUrlLarge: print.imageUrlLarge || print.imageUrl,
        imageUrlArtCrop: print.imageUrlArtCrop || print.imageUrl || selectedPartner.imageUrlArtCrop,
      });
      setPartnerQuery(`${selectedPartner.name} (${print.setCode}) ${print.collectorNumber}`);
      setPartnerWarning(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newDeck: Partial<Deck> = {
      name: name.trim(),
      format,
      description: description.trim(),
      commanderCard: selectedCommander || undefined,
      partnerCard: selectedPartner || undefined,
      coverImageUrl: selectedCommander?.imageUrlArtCrop || selectedCommander?.imageUrl,
      cards: selectedCommander
        ? [{ card: selectedCommander, quantity: 1, category: 'commander' }]
        : [],
    };

    if (selectedPartner) {
      newDeck.cards?.push({ card: selectedPartner, quantity: 1, category: 'partner' });
    }

    onCreateDeck(newDeck);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 11, 0.8)',
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
          width: '680px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0c0f17',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield className="text-indigo-400" size={20} />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                Criar Novo Deck
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                O formulário adapta as regras dinamicamente de acordo com o formato escolhido
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Deck Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Nome do Deck *
              </label>
              <input
                type="text"
                required
                className="input-text"
                placeholder="Ex: Atraxa Contadores, Modern Burn, Golgari Elves..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Format Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Formato do Jogo
              </label>
              <select
                className="select-field"
                value={format}
                onChange={(e) => setFormat(e.target.value as DeckFormat)}
              >
                <option value="commander">Commander / EDH (100 cartas, Singleton, Comandante)</option>
                <option value="brawl">Brawl (60 cartas, Singleton, Comandante)</option>
                <option value="standard">Standard / Padrão (60 cartas, máx 4 cópias)</option>
                <option value="modern">Modern (60 cartas, máx 4 cópias)</option>
                <option value="pioneer">Pioneer (60 cartas, máx 4 cópias)</option>
                <option value="pauper">Pauper (Apenas Comuns, 60 cartas)</option>
                <option value="legacy">Legacy (60 cartas)</option>
                <option value="vintage">Vintage (60 cartas)</option>
                <option value="casual">Casual / Livre</option>
              </select>
            </div>

            {/* Format Rules Guidance Badge */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8rem',
                color: '#a5b4fc',
              }}
            >
              <Sparkles size={16} />
              {format === 'commander' && (
                <span>
                  Regra Commander: O deck deve conter exatamente 100 cartas (incluindo o Comandante). Formato Singleton (1 cópia de cada carta, exceto terrenos básicos).
                </span>
              )}
              {format === 'brawl' && (
                <span>
                  Regra Brawl: O deck deve conter 60 cartas lideradas por uma criatura lendária ou planeswalker.
                </span>
              )}
              {format === 'pauper' && (
                <span>
                  Regra Pauper: São permitidas apenas cartas lançadas na raridade Comum. Mínimo de 60 cartas no mainboard e até 15 no sideboard.
                </span>
              )}
              {['standard', 'modern', 'pioneer', 'legacy', 'vintage'].includes(format) && (
                <span>
                  Regra de Construção: Mínimo de 60 cartas no baralho principal e até 15 no sideboard. Limite de até 4 cópias por carta.
                </span>
              )}
              {format === 'casual' && (
                <span>
                  Formato Livre: Sem restrições automáticas de cópias ou comandantes.
                </span>
              )}
            </div>

            {/* Dynamic Commander Fields if format is commander or brawl */}
            {(format === 'commander' || format === 'brawl') && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: 'rgba(18, 23, 34, 0.6)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Primary Commander Field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                      Comandante Principal
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Aceita nome, ou com edição/número: <em>Nome (SET) NUM</em>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                      <input
                        type="text"
                        className="input-text"
                        placeholder="Ex: Atraxa, Praetors' Voice (2XM) 190 ou digite o nome..."
                        value={commanderQuery}
                        onChange={(e) => handleSearchCommander(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleExecuteCommanderLookup(commanderQuery);
                          }
                        }}
                        style={{ paddingLeft: '36px' }}
                      />
                      {loadingCommander && (
                        <Loader2 size={16} className="animate-spin text-indigo-400" style={{ position: 'absolute', right: '12px', top: '12px' }} />
                      )}

                      {/* Commander Suggestions */}
                      {commanderSuggestions.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: '#121722',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            zIndex: 60,
                            maxHeight: '180px',
                            overflowY: 'auto',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                          }}
                        >
                          {commanderSuggestions.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectCommanderSuggestion(item)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.85rem',
                                color: '#f8fafc',
                              }}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleExecuteCommanderLookup(commanderQuery)}
                      disabled={loadingCommander || !commanderQuery.trim()}
                      style={{ flexShrink: 0 }}
                    >
                      Buscar Arte
                    </button>
                  </div>

                  {commanderWarning && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.78rem',
                        color: '#fcd34d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{commanderWarning}</span>
                    </div>
                  )}

                  {selectedCommander && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginTop: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={selectedCommander.imageUrl}
                          alt={selectedCommander.name}
                          style={{ width: '42px', height: '58px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                            {selectedCommander.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {selectedCommander.typeLine}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#818cf8', marginTop: '2px' }}>
                            Edição atual: <strong>{selectedCommander.setName} ({selectedCommander.setCode}) #{selectedCommander.collectorNumber}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setArtSelectorTarget('commander')}
                        title="Escolher entre todas as artes e edições disponíveis no Scryfall"
                      >
                        <ImageIcon size={14} /> Alterar Arte
                      </button>
                    </div>
                  )}
                </div>

                {/* Partner / Background Field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>
                      Parceiro / Segundo Comandante / Background (Opcional)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Aceita nome, ou com edição/número: <em>Nome (SET) NUM</em>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                      <input
                        type="text"
                        className="input-text"
                        placeholder="Pesquisar parceiro se houver (ex: Tymna, Thrasios, etc.)..."
                        value={partnerQuery}
                        onChange={(e) => handleSearchPartner(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleExecutePartnerLookup(partnerQuery);
                          }
                        }}
                        style={{ paddingLeft: '36px' }}
                      />
                      {loadingPartner && (
                        <Loader2 size={16} className="animate-spin text-indigo-400" style={{ position: 'absolute', right: '12px', top: '12px' }} />
                      )}

                      {partnerSuggestions.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            background: '#121722',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '8px',
                            zIndex: 60,
                            maxHeight: '180px',
                            overflowY: 'auto',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                          }}
                        >
                          {partnerSuggestions.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectPartnerSuggestion(item)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.85rem',
                                color: '#f8fafc',
                              }}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleExecutePartnerLookup(partnerQuery)}
                      disabled={loadingPartner || !partnerQuery.trim()}
                      style={{ flexShrink: 0 }}
                    >
                      Buscar Arte
                    </button>
                  </div>

                  {partnerWarning && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.78rem',
                        color: '#fcd34d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{partnerWarning}</span>
                    </div>
                  )}

                  {selectedPartner && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginTop: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={selectedPartner.imageUrl}
                          alt={selectedPartner.name}
                          style={{ width: '42px', height: '58px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                            {selectedPartner.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {selectedPartner.typeLine}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#818cf8', marginTop: '2px' }}>
                            Edição atual: <strong>{selectedPartner.setName} ({selectedPartner.setCode}) #{selectedPartner.collectorNumber}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setArtSelectorTarget('partner')}
                        title="Escolher entre todas as artes e edições disponíveis no Scryfall"
                      >
                        <ImageIcon size={14} /> Alterar Arte
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deck Description / Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Descrição / Notas da Estratégia
              </label>
              <textarea
                className="textarea-field"
                rows={3}
                placeholder="Descreva a estratégia principal, combos ou anotações para este deck..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'rgba(18, 23, 34, 0.8)',
            }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              <Plus size={16} /> Criar Deck
            </button>
          </div>
        </form>
      </div>

      {/* Art Selector Modal for Commander and Partner */}
      <ArtSelectorModal
        isOpen={artSelectorTarget !== null}
        card={artSelectorTarget === 'commander' ? selectedCommander : selectedPartner}
        onClose={() => setArtSelectorTarget(null)}
        onSelectPrint={handleSelectPrintForCommanderOrPartner}
      />
    </div>
  );
};
