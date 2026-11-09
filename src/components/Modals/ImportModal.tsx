import React, { useState, useEffect } from 'react';
import { Card, CardCategory, Deck, DeckFormat } from '../../types';
import { parseCardList } from '../../services/importer';
import { getCardByName, getCardBySetAndNumber, getCardBySetAndName } from '../../services/scryfall';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import {
  Download,
  Loader2,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Crown,
} from 'lucide-react';

export interface UnmatchedArtNotice {
  name: string;
  requested: string;
  found?: string;
  reason: 'art_not_found' | 'card_not_found';
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: Deck[];
  defaultDestination?: 'collection' | 'new_deck' | string;
  defaultDeckId?: string;
  onImportComplete: (
    cards: Array<{ card: Card; quantity: number; category: CardCategory; isFoil?: boolean }>,
    destination: 'collection' | 'new_deck' | string,
    newDeckName?: string,
    newDeckFormat?: DeckFormat,
    newDeckCommanderName?: string
  ) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  decks,
  defaultDestination = 'collection',
  defaultDeckId,
  onImportComplete,
}) => {
  const [importText, setImportText] = useState('');
  const [importDestination, setImportDestination] = useState<string>(
    defaultDeckId ? defaultDeckId : defaultDestination
  );
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState<DeckFormat>('commander');
  const [newDeckCommanderName, setNewDeckCommanderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [parsedPreviewCount, setParsedPreviewCount] = useState<number>(0);
  const [importWarnings, setImportWarnings] = useState<UnmatchedArtNotice[] | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{
    cards: Array<{ card: Card; quantity: number; category: CardCategory; isFoil?: boolean }>;
    destination: string;
    deckName?: string;
    deckFormat?: DeckFormat;
    deckCommanderName?: string;
  } | null>(null);

  useModalOverlay(isOpen, onClose, isProcessing);

  useEffect(() => {
    if (isOpen) {
      setImportDestination(defaultDeckId ? defaultDeckId : defaultDestination);
      setNewDeckFormat('commander');
      setNewDeckCommanderName('');
      setImportWarnings(null);
      setPendingImportData(null);
    }
  }, [isOpen, defaultDestination, defaultDeckId]);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setImportText(text);
    const parsed = parseCardList(text);
    setParsedPreviewCount(parsed.reduce((sum, p) => sum + p.quantity, 0));
  };

  const handleStartImport = async () => {
    const parsedLines = parseCardList(importText);
    if (parsedLines.length === 0) return;

    setIsProcessing(true);
    setImportWarnings(null);
    setPendingImportData(null);
    const importedResults: Array<{
      card: Card;
      quantity: number;
      category: CardCategory;
      isFoil?: boolean;
    }> = [];
    const unmatchedArtList: UnmatchedArtNotice[] = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const item = parsedLines[i];
      setProgressText(
        `Buscando dados no Scryfall (${i + 1}/${parsedLines.length}): ${item.name}...`
      );

      let card: Card | null = null;
      let exactArtMatched = false;

      // 1. If setCode and collectorNumber were requested, try exact print first
      if (item.setCode && item.collectorNumber) {
        card = await getCardBySetAndNumber(item.setCode, item.collectorNumber);
        if (card) {
          exactArtMatched = true;
        }
      } else if (item.setCode) {
        // 2. If only setCode was specified, search card within that set
        card = await getCardBySetAndName(item.setCode, item.name);
        if (card) {
          exactArtMatched = true;
        }
      }

      // 3. Fallback to default card by name if not found in exact print
      if (!card) {
        card = await getCardByName(item.name);
      }

      if (card) {
        const isFoil = item.isFoil || card.isFoil;

        // Check if a specific edition/art was requested but had to use fallback
        if (item.setCode && !exactArtMatched) {
          const reqStr = `${item.setCode}${item.collectorNumber ? ` #${item.collectorNumber}` : ''}`;
          const foundStr = `${card.setCode} #${card.collectorNumber}`;
          unmatchedArtList.push({
            name: item.name,
            requested: reqStr,
            found: foundStr,
            reason: 'art_not_found',
          });
        }

        importedResults.push({
          card: {
            ...card,
            isFoil,
          },
          quantity: item.quantity,
          category: item.category,
          isFoil,
        });
      } else {
        const reqStr = item.setCode ? `${item.setCode}${item.collectorNumber ? ` #${item.collectorNumber}` : ''}` : '';
        unmatchedArtList.push({
          name: item.name,
          requested: reqStr,
          reason: 'card_not_found',
        });
      }
    }

    setIsProcessing(false);
    setProgressText('');

    if (importedResults.length > 0) {
      const dest =
        importDestination === 'new_deck'
          ? 'new_deck'
          : importDestination === 'collection'
          ? 'collection'
          : importDestination;

      if (unmatchedArtList.length > 0) {
        // Hold and present warnings dialog to the user before finishing
        setImportWarnings(unmatchedArtList);
        setPendingImportData({
          cards: importedResults,
          destination: dest,
          deckName: newDeckName || 'Novo Deck Importado',
          deckFormat: newDeckFormat,
          deckCommanderName: newDeckCommanderName.trim() || undefined,
        });
      } else {
        // All cards found in exact art requested (or no specific art requested)
        onImportComplete(
          importedResults,
          dest,
          newDeckName || 'Novo Deck Importado',
          newDeckFormat,
          newDeckCommanderName.trim() || undefined
        );
        onClose();
      }
    } else if (unmatchedArtList.length > 0) {
      setImportWarnings(unmatchedArtList);
    }
  };

  const handleConfirmImportWithWarnings = () => {
    if (pendingImportData) {
      onImportComplete(
        pendingImportData.cards,
        pendingImportData.destination,
        pendingImportData.deckName,
        pendingImportData.deckFormat,
        pendingImportData.deckCommanderName
      );
      setPendingImportData(null);
      setImportWarnings(null);
      onClose();
    }
  };

  const handleCancelImportWarnings = () => {
    setPendingImportData(null);
    setImportWarnings(null);
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
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '820px',
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
        {/* Header - Dedicated to Import */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(18, 23, 34, 0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={22} className="text-emerald-400" />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Importar Cartas ou Decks
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Cole listas de cartas de qualquer formato (Moxfield, LigaMagic, MTG Arena ou texto puro)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn btn-ghost btn-icon"
            title="Fechar (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
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
          {/* Unmatched / Substituted Art Warning Modal View */}
          {importWarnings && importWarnings.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={24} className="text-amber-400" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#fbbf24' }}>
                    Avisos de Correspondência de Artes ({importWarnings.length})
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    Algumas cartas da sua lista não tinham a edição exata solicitada ou foram encontradas em outra versão:
                  </div>
                </div>
              </div>

              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingRight: '6px',
                }}
              >
                {importWarnings.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(12, 15, 23, 0.8)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#f8fafc' }}>{w.name}</strong>
                      {w.requested && (
                        <span style={{ color: '#94a3b8', marginLeft: '6px' }}>
                          (Solicitada: {w.requested})
                        </span>
                      )}
                    </div>
                    <div>
                      {w.reason === 'art_not_found' ? (
                        <span
                          style={{
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          }}
                        >
                          Usando arte padrão ({w.found})
                        </span>
                      ) : (
                        <span
                          style={{
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          }}
                        >
                          Carta não encontrada
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelImportWarnings}
                >
                  Voltar e Editar Lista
                </button>
                {pendingImportData && pendingImportData.cards.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleConfirmImportWithWarnings}
                  >
                    <CheckCircle2 size={15} /> Importar {pendingImportData.cards.length} Cartas Localizadas
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Destination selector */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px', display: 'block' }}>
                  Onde deseja salvar as cartas importadas?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: importDestination === 'collection' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: importDestination === 'collection' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: importDestination === 'collection' ? '#f8fafc' : '#94a3b8',
                    }}
                  >
                    <input
                      type="radio"
                      name="destination"
                      value="collection"
                      checked={importDestination === 'collection'}
                      onChange={() => setImportDestination('collection')}
                    />
                    Adicionar à Minha Coleção
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: importDestination === 'new_deck' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: importDestination === 'new_deck' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: importDestination === 'new_deck' ? '#f8fafc' : '#94a3b8',
                    }}
                  >
                    <input
                      type="radio"
                      name="destination"
                      value="new_deck"
                      checked={importDestination === 'new_deck'}
                      onChange={() => setImportDestination('new_deck')}
                    />
                    Criar um Novo Deck
                  </label>

                  {decks.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        className="select-field"
                        value={importDestination.startsWith('deck-') ? importDestination : ''}
                        onChange={(e) => {
                          if (e.target.value) setImportDestination(e.target.value);
                        }}
                        style={{ width: '100%', height: '42px', fontSize: '0.85rem' }}
                      >
                        <option value="">Inserir em deck existente...</option>
                        {decks.map((d) => (
                          <option key={d.id} value={d.id}>
                            Deck: {d.name} ({d.cards.length} cartas)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra options when creating new deck */}
              {importDestination === 'new_deck' && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', display: 'block' }}>
                      Nome do Novo Deck:
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="ex: Atraxa Superfriends"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      style={{ width: '100%', height: '38px', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', display: 'block' }}>
                      Formato do Deck:
                    </label>
                    <select
                      className="select-field"
                      value={newDeckFormat}
                      onChange={(e) => setNewDeckFormat(e.target.value as DeckFormat)}
                      style={{ width: '100%', height: '38px', fontSize: '0.84rem' }}
                    >
                      <option value="commander">Commander / EDH (100 cartas)</option>
                      <option value="standard">Standard (60 cartas)</option>
                      <option value="modern">Modern (60 cartas)</option>
                      <option value="pioneer">Pioneer (60 cartas)</option>
                      <option value="pauper">Pauper (60 cartas)</option>
                      <option value="legacy">Legacy (60 cartas)</option>
                      <option value="vintage">Vintage (60 cartas)</option>
                      <option value="custom">Personalizado / Livre</option>
                    </select>
                  </div>

                  {newDeckFormat === 'commander' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crown size={14} className="text-amber-400" />
                        Comandante Principal (Opcional - se vazio, tenta detectar da lista):
                      </label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="ex: Atraxa, Praetors' Voice"
                        value={newDeckCommanderName}
                        onChange={(e) => setNewDeckCommanderName(e.target.value)}
                        style={{ width: '100%', height: '38px', fontSize: '0.84rem' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Text Area Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                    Cole a Lista de Cartas:
                  </label>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {parsedPreviewCount > 0 ? (
                      <strong style={{ color: '#38bdf8' }}>{parsedPreviewCount} carta(s) detectada(s)</strong>
                    ) : (
                      'Formatos: "4 Lightning Bolt", "1 Sol Ring (C21) 263", Arena, LigaMagic ou Moxfield'
                    )}
                  </span>
                </div>

                <textarea
                  className="input-text"
                  placeholder={`Cole aqui sua lista. Exemplos aceitos:\n\n4 Lightning Bolt (A25) 141 *F*\n1 Sol Ring (C21) 263\n1 Counterspell\n\nSideboard\n2 Pyroblast`}
                  value={importText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    height: '220px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '0.84rem',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    background: '#070a10',
                  }}
                />
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#c7d2fe',
                    fontSize: '0.85rem',
                  }}
                >
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span>{progressText || 'Processando lista com Scryfall...'}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartImport}
                  disabled={isProcessing || !importText.trim()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Buscando Artes...
                    </>
                  ) : (
                    <>
                      <Download size={16} /> Iniciar Importação
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
