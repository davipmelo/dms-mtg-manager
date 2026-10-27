import React, { useState, useEffect, useRef } from 'react';
import { CollectionItem, Deck, ProxyItem, CardCategory, Card, SystemBackup, DeckFormat } from '../../types';
import {
  parseCardList,
  exportToMtgArena,
  exportToMoxfield,
  exportToLigaMagic,
  exportCollectionToCsv,
} from '../../services/importer';
import { createSystemBackup, parseSystemBackup } from '../../services/storage';
import { getCardByName, getCardBySetAndNumber, getCardByNameAndSet } from '../../services/scryfall';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileText,
  Loader2,
  X,
  Database,
  HardDriveDownload,
  HardDriveUpload,
  AlertCircle,
  CheckCircle2,
  Crown,
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  defaultMode?: 'import' | 'export' | 'backup';
  defaultDeckId?: string;
  onImportComplete: (
    cards: Array<{ card: Card; quantity: number; category: CardCategory; isFoil?: boolean }>,
    destination: 'collection' | 'new_deck' | string,
    newDeckName?: string,
    newDeckFormat?: DeckFormat,
    newDeckCommanderName?: string
  ) => void;
  onRestoreSystemBackup: (backup: SystemBackup, mode: 'replace' | 'merge') => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  collection,
  decks,
  proxies,
  defaultMode = 'import',
  defaultDeckId,
  onImportComplete,
  onRestoreSystemBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'import' | 'export'>(defaultMode);

  // Import list state
  const [importText, setImportText] = useState('');
  const [importDestination, setImportDestination] = useState<string>(
    defaultDeckId ? defaultDeckId : 'collection'
  );
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState<DeckFormat>('commander');
  const [newDeckCommanderName, setNewDeckCommanderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [parsedPreviewCount, setParsedPreviewCount] = useState<number>(0);

  // Export list state
  const [exportSource, setExportSource] = useState<string>(defaultDeckId || 'collection');
  const [exportFormat, setExportFormat] = useState<
    'arena' | 'moxfield' | 'ligamagic' | 'csv' | 'json'
  >('arena');
  const [copied, setCopied] = useState(false);

  // Full System Backup state
  const [pendingBackup, setPendingBackup] = useState<SystemBackup | null>(null);
  const [backupFileName, setBackupFileName] = useState<string>('');
  const [backupError, setBackupError] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [backupExportedNotice, setBackupExportedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultMode);
      setImportDestination(defaultDeckId ? defaultDeckId : 'collection');
      setExportSource(defaultDeckId ? defaultDeckId : 'collection');
      setNewDeckFormat('commander');
      setNewDeckCommanderName('');
      setPendingBackup(null);
      setBackupFileName('');
      setBackupError('');
      setBackupExportedNotice(false);
    }
  }, [isOpen, defaultMode, defaultDeckId]);

  if (!isOpen) return null;

  const triggerBrowserDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Full System Backup Handlers ---
  const handleDownloadFullBackup = () => {
    const backup = createSystemBackup(collection, decks, proxies);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `dms-mtg-backup-${dateStamp}.json`;
    triggerBrowserDownload(
      JSON.stringify(backup, null, 2),
      filename,
      'application/json;charset=utf-8'
    );
    setBackupExportedNotice(true);
    setTimeout(() => setBackupExportedNotice(false), 2500);
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError('');
    setBackupFileName(file.name);
    try {
      const text = await file.text();
      const validated = parseSystemBackup(text);
      setPendingBackup(validated);
    } catch (err: any) {
      setPendingBackup(null);
      setBackupError(err?.message || 'Não foi possível ler o arquivo de backup selecionado.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;
    onRestoreSystemBackup(pendingBackup, restoreMode);
    onClose();
  };

  // --- Plain-Text List Import Handlers ---
  const handleTextChange = (text: string) => {
    setImportText(text);
    const parsed = parseCardList(text);
    setParsedPreviewCount(parsed.reduce((sum, p) => sum + p.quantity, 0));
  };

  const handleStartImport = async () => {
    const parsedLines = parseCardList(importText);
    if (parsedLines.length === 0) return;

    setIsProcessing(true);
    const importedResults: Array<{
      card: Card;
      quantity: number;
      category: CardCategory;
      isFoil?: boolean;
    }> = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const item = parsedLines[i];
      setProgressText(
        `Buscando dados no Scryfall (${i + 1}/${parsedLines.length}): ${item.name}...`
      );

      let card: Card | null = null;
      if (item.setCode && item.collectorNumber) {
        card = await getCardBySetAndNumber(item.setCode, item.collectorNumber);
      }
      if (!card && item.setCode) {
        card = await getCardByNameAndSet(item.name, item.setCode);
      }
      if (!card) {
        card = await getCardByName(item.name);
      }

      if (card) {
        const isFoil = item.isFoil || card.isFoil;
        importedResults.push({
          card: {
            ...card,
            isFoil,
          },
          quantity: item.quantity,
          category: item.category,
          isFoil,
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
      onImportComplete(
        importedResults,
        dest,
        newDeckName || 'Novo Deck Importado',
        newDeckFormat,
        newDeckCommanderName.trim() || undefined
      );
      onClose();
    }
  };

  // --- List Export Handlers ---
  const generateExportText = (): string => {
    if (exportSource === 'full_system') {
      return JSON.stringify(createSystemBackup(collection, decks, proxies), null, 2);
    }

    if (exportSource === 'collection') {
      if (exportFormat === 'csv') {
        return exportCollectionToCsv(collection);
      }
      if (exportFormat === 'json') {
        return JSON.stringify(collection, null, 2);
      }
      return collection.map((i) => `${i.quantity} ${i.card.name}`).join('\n');
    }

    const deck = decks.find((d) => d.id === exportSource);
    if (!deck) return '';

    if (exportFormat === 'arena') {
      const commander = deck.cards.find((c) => c.category === 'commander');
      return exportToMtgArena(deck.cards, commander);
    }
    if (exportFormat === 'moxfield') {
      return exportToMoxfield(deck.cards);
    }
    if (exportFormat === 'ligamagic') {
      return exportToLigaMagic(deck.cards);
    }
    if (exportFormat === 'csv') {
      return deck.cards
        .map((c) => `${c.quantity},"${c.card.name}","${c.card.setCode}",${c.category}`)
        .join('\n');
    }
    if (exportFormat === 'json') {
      return JSON.stringify(deck, null, 2);
    }
    return '';
  };

  const exportContent = generateExportText();

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (exportSource === 'full_system') {
      handleDownloadFullBackup();
      return;
    }
    const ext = exportFormat === 'csv' ? 'csv' : exportFormat === 'json' ? 'json' : 'txt';
    const filename = `${
      exportSource === 'collection' ? 'minha_colecao' : 'meu_deck'
    }_${Date.now()}.${ext}`;
    triggerBrowserDownload(exportContent, filename, 'text/plain;charset=utf-8');
  };

  const totalOwnedCards = collection.reduce((s, c) => s + c.quantity, 0);
  const totalProxyCards = proxies.reduce((s, p) => s + p.quantity, 0);

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
        {/* Navigation Tabs Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            background: 'rgba(18, 23, 34, 0.8)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'backup' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('backup')}
            >
              <Database size={16} /> Backup do Sistema (.json)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'import' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('import')}
            >
              <Download size={16} /> Importar Listas
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'export' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('export')}
            >
              <Upload size={16} /> Exportar Listas
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn btn-ghost btn-icon"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'backup' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#f8fafc' }}>
                  Portabilidade Completa do Sistema Pessoal
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '4px' }}>
                  Exporte um único arquivo <code>.json</code> contendo toda a sua pool de cartas, artes escolhidas, decks montados e fila de proxies para importar em outro computador ou navegador e continuar de onde parou.
                </p>
              </div>

              {/* 1. Export Full System Card */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background:
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(18, 23, 34, 0.8) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <HardDriveDownload size={22} className="text-indigo-400" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f8fafc' }}>
                        1. Exportar Todos os Meus Dados
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Gera um snapshot completo salvo no seu dispositivo
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadFullBackup}
                  >
                    {backupExportedNotice ? (
                      <>
                        <Check size={16} /> Arquivo Baixado!
                      </>
                    ) : (
                      <>
                        <Download size={16} /> Exportar Sistema Completo (.json)
                      </>
                    )}
                  </button>
                </div>

                {/* Current system metrics preview */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>Pool / Coleção: </span>
                    <strong>{totalOwnedCards} cartas</strong> ({collection.length} únicas)
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>Decks Salvos: </span>
                    <strong>{decks.length} deck(s)</strong>
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8' }}>Fila de Proxies: </span>
                    <strong>{totalProxyCards} carta(s)</strong>
                  </div>
                </div>
              </div>

              {/* 2. Import / Restore Full System Card */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(18, 23, 34, 0.7)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <HardDriveUpload size={22} className="text-emerald-400" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f8fafc' }}>
                        2. Importar / Restaurar Backup de Outra Máquina
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Selecione um arquivo <code>.json</code> exportado anteriormente pelo DMS MTG Manager
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleSelectBackupFile}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} /> Selecionar Arquivo .json
                    </button>
                  </div>
                </div>

                {backupError && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#fca5a5',
                      fontSize: '0.83rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{backupError}</span>
                  </div>
                )}

                {pendingBackup && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#34d399',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                        }}
                      >
                        <CheckCircle2 size={17} />
                        <span>Backup válido carregado: {backupFileName}</span>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                        Exportado em:{' '}
                        {new Date(pendingBackup.exportedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '10px',
                        fontSize: '0.82rem',
                        color: '#e2e8f0',
                      }}
                    >
                      <div>
                        •{' '}
                        <strong>
                          {pendingBackup.collection.reduce((s, c) => s + c.quantity, 0)}
                        </strong>{' '}
                        cartas na Pool ({pendingBackup.collection.length} únicas)
                      </div>
                      <div>
                        • <strong>{pendingBackup.decks.length}</strong> deck(s) completos
                      </div>
                      <div>
                        •{' '}
                        <strong>
                          {pendingBackup.proxies.reduce((s, p) => s + p.quantity, 0)}
                        </strong>{' '}
                        carta(s) em Proxies
                      </div>
                    </div>

                    {/* Restore Mode Selection */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                        Modo de Restauração:
                      </span>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.83rem',
                            color: '#f8fafc',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'replace'}
                            onChange={() => setRestoreMode('replace')}
                          />
                          Substituir dados atuais (Recomendado ao trocar de máquina)
                        </label>

                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.83rem',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'merge'}
                            onChange={() => setRestoreMode('merge')}
                          />
                          Mesclar com os dados já existentes neste navegador
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirmRestore}
                      >
                        <Check size={16} /> Restaurar Sistema Completo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'import' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                    Importação de Texto (Arena, Moxfield, LigaMagic, EDHREC)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Cole sua lista em texto. O sistema reconhece formatos Arena, Moxfield, LigaMagic (inclusive nomes em português) e plain text.
                  </p>
                </div>
              </div>

              {/* Destination selector */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      marginBottom: '6px',
                    }}
                  >
                    Destino da Importação
                  </label>
                  <select
                    className="select-field"
                    value={importDestination}
                    onChange={(e) => setImportDestination(e.target.value)}
                  >
                    <option value="collection">Apenas Minha Coleção (Pool)</option>
                    <option value="new_deck">
                      + Criar como Novo Deck (adiciona também à coleção)
                    </option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        Adicionar ao Deck: {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {importDestination === 'new_deck' && (
                  <>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                          marginBottom: '6px',
                        }}
                      >
                        Nome do Novo Deck
                      </label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="Ex: Atraxa Reanimator..."
                        value={newDeckName}
                        onChange={(e) => setNewDeckName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                          marginBottom: '6px',
                        }}
                      >
                        Formato do Deck
                      </label>
                      <select
                        className="select-field"
                        value={newDeckFormat}
                        onChange={(e) => setNewDeckFormat(e.target.value as DeckFormat)}
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

                    {(newDeckFormat === 'commander' || newDeckFormat === 'brawl') && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: '#ffbb00',
                            fontWeight: 600,
                            marginBottom: '6px',
                          }}
                        >
                          <Crown size={14} />
                          Comandante do Deck
                        </label>
                        <input
                          type="text"
                          className="input-text"
                          placeholder="Digite o nome do comandante (ex: Atraxa, Praetors' Voice)..."
                          value={newDeckCommanderName}
                          onChange={(e) => setNewDeckCommanderName(e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '4px', display: 'block' }}>
                          Será definido como comandante oficial e capa do novo deck.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  className="textarea-field"
                  rows={10}
                  placeholder={`Exemplo MTG Arena:\n4 Lightning Bolt (CLB) 187\n1 Sol Ring (C21) 263\n\nExemplo Moxfield / LigaMagic:\n4x Raio\n1 Sol Ring\n1 Atraxa, Praetors' Voice`}
                  value={importText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Summary / Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(18, 23, 34, 0.6)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.85rem',
                    color: '#cbd5e1',
                  }}
                >
                  <FileText size={16} className="text-indigo-400" />
                  <span>
                    {parsedPreviewCount > 0
                      ? `${parsedPreviewCount} cartas detectadas prontas para importar`
                      : 'Cole uma lista acima para iniciar a leitura'}
                  </span>
                </div>

                {isProcessing && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#a5b4fc',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" />
                    <span>{progressText}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Export Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                  Exportar Listas de Cartas ou Coleção
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Exporte decks individuais ou sua coleção para MTG Arena, Moxfield, LigaMagic, CSV ou JSON.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      marginBottom: '6px',
                    }}
                  >
                    Fonte de Dados
                  </label>
                  <select
                    className="select-field"
                    value={exportSource}
                    onChange={(e) => setExportSource(e.target.value)}
                  >
                    <option value="full_system">
                      Sistema Completo — Pool + Decks + Proxies (.json)
                    </option>
                    <option value="collection">
                      Toda a Minha Coleção ({collection.length} tipos)
                    </option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        Deck: {d.name} ({d.cards.length} cartas)
                      </option>
                    ))}
                  </select>
                </div>

                {exportSource !== 'full_system' && (
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        marginBottom: '6px',
                      }}
                    >
                      Formato de Exportação
                    </label>
                    <select
                      className="select-field"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    >
                      <option value="arena">MTG Arena (.txt)</option>
                      <option value="moxfield">Moxfield / EDHREC (.txt)</option>
                      <option value="ligamagic">LigaMagic (.txt)</option>
                      <option value="csv">Planilha CSV (.csv)</option>
                      <option value="json">Dados Brutos (.json)</option>
                    </select>
                  </div>
                )}
              </div>

              <textarea
                readOnly
                className="textarea-field"
                rows={10}
                value={exportContent}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCopyExport}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar Texto'}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownloadFile}>
                  <Download size={16} /> Baixar Arquivo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer for List Import */}
        {activeTab === 'import' && (
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
              disabled={isProcessing || parsedPreviewCount === 0}
              onClick={handleStartImport}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Upload size={16} /> Iniciar Importação
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
