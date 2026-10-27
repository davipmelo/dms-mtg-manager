import React, { useState } from 'react';
import { Deck, DeckFormat, Card } from '../../types';
import { searchAutocomplete, getCardByName } from '../../services/scryfall';
import { Shield, Sparkles, X, Plus, Search, Loader2 } from 'lucide-react';

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
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [description, setDescription] = useState('');
  const [commanderQuery, setCommanderQuery] = useState('');
  const [commanderSuggestions, setCommanderSuggestions] = useState<string[]>([]);
  const [selectedCommander, setSelectedCommander] = useState<Card | null>(null);
  const [loadingCommander, setLoadingCommander] = useState(false);

  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerSuggestions, setPartnerSuggestions] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Card | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(false);

  if (!isOpen) return null;

  const handleSearchCommander = async (query: string) => {
    setCommanderQuery(query);
    if (!query.trim() || query.length < 2) {
      setCommanderSuggestions([]);
      return;
    }
    const results = await searchAutocomplete(query);
    setCommanderSuggestions(results.slice(0, 6));
  };

  const handleSelectCommander = async (cardName: string) => {
    setLoadingCommander(true);
    setCommanderSuggestions([]);
    setCommanderQuery(cardName);
    try {
      const card = await getCardByName(cardName);
      if (card) setSelectedCommander(card);
    } finally {
      setLoadingCommander(false);
    }
  };

  const handleSearchPartner = async (query: string) => {
    setPartnerQuery(query);
    if (!query.trim() || query.length < 2) {
      setPartnerSuggestions([]);
      return;
    }
    const results = await searchAutocomplete(query);
    setPartnerSuggestions(results.slice(0, 6));
  };

  const handleSelectPartner = async (cardName: string) => {
    setLoadingPartner(true);
    setPartnerSuggestions([]);
    setPartnerQuery(cardName);
    try {
      const card = await getCardByName(cardName);
      if (card) setSelectedPartner(card);
    } finally {
      setLoadingPartner(false);
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
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                    Comandante Principal
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Pesquisar criatura lendária ou planeswalker..."
                      value={commanderQuery}
                      onChange={(e) => handleSearchCommander(e.target.value)}
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
                        }}
                      >
                        {commanderSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectCommander(item)}
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

                  {selectedCommander && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                      <img
                        src={selectedCommander.imageUrl}
                        alt={selectedCommander.name}
                        style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{selectedCommander.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedCommander.typeLine}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Partner / Background Field */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Parceiro / Segundo Comandante / Background (Opcional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Pesquisar parceiro se houver (ex: Tymna, Thrasios, etc.)..."
                      value={partnerQuery}
                      onChange={(e) => handleSearchPartner(e.target.value)}
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
                        }}
                      >
                        {partnerSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectPartner(item)}
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

                  {selectedPartner && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                      <img
                        src={selectedPartner.imageUrl}
                        alt={selectedPartner.name}
                        style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{selectedPartner.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedPartner.typeLine}</div>
                      </div>
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
    </div>
  );
};
