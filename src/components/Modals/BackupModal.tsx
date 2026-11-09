import React, { useState, useRef } from 'react';
import { CollectionItem, Deck, ProxyItem, SystemBackup } from '../../types';
import { createSystemBackup, parseSystemBackup } from '../../services/storage';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import {
  Database,
  HardDriveDownload,
  HardDriveUpload,
  Upload,
  Download,
  Check,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  onRestoreSystemBackup: (backup: SystemBackup, mode: 'replace' | 'merge') => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  collection,
  decks,
  proxies,
  onRestoreSystemBackup,
}) => {
  useModalOverlay(isOpen, onClose);

  const [pendingBackup, setPendingBackup] = useState<SystemBackup | null>(null);
  const [backupFileName, setBackupFileName] = useState<string>('');
  const [backupError, setBackupError] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [backupExportedNotice, setBackupExportedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '760px',
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
        {/* Header - Dedicated to Backup */}
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
            <Database size={22} className="text-amber-400" />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Backup do Sistema (.json)
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Exporte uma cópia completa dos seus dados ou restaure um arquivo de segurança
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          {/* 1. Export Section - Arrow pointing UP */}
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
                <HardDriveUpload size={22} className="text-indigo-400" />
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
                    <Upload size={16} /> Exportar Sistema Completo (.json)
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

          {/* 2. Import / Restore Section - Arrow pointing DOWN */}
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
                <HardDriveDownload size={22} className="text-emerald-400" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f8fafc' }}>
                    2. Importar / Restaurar Backup de Outra Máquina
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Selecione um arquivo <code>.json</code> exportado anteriormente pelo Proliferate
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
                  <Download size={16} /> Escolher Arquivo .json
                </button>
              </div>
            </div>

            {backupError && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{backupError}</span>
              </div>
            )}

            {/* Pending restore inspection */}
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
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#34d399' }}>
                    Arquivo Válido: {backupFileName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Versão do schema: v{pendingBackup.schemaVersion} • Exportado em:{' '}
                    {new Date(pendingBackup.exportedAt).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                    fontSize: '0.82rem',
                    color: '#cbd5e1',
                  }}
                >
                  <div>
                    Cartas na Coleção: <strong>{pendingBackup.collection.length} entradas</strong>
                  </div>
                  <div>
                    Decks no Backup: <strong>{pendingBackup.decks.length} deck(s)</strong>
                  </div>
                  <div>
                    Fila de Proxies: <strong>{pendingBackup.proxies.length} carta(s)</strong>
                  </div>
                </div>

                {/* Restoration Mode Selector */}
                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                    Como deseja restaurar este backup?
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background:
                          restoreMode === 'replace'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(255, 255, 255, 0.03)',
                        border:
                          restoreMode === 'replace'
                            ? '1px solid rgba(239, 68, 68, 0.4)'
                            : '1px solid transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="replace"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fca5a5' }}>
                          Substituir Tudo (Recomendado ao trocar de computador)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Apaga as cartas locais e coloca exatamente o conteúdo deste arquivo.
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background:
                          restoreMode === 'merge'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(255, 255, 255, 0.03)',
                        border:
                          restoreMode === 'merge'
                            ? '1px solid rgba(16, 185, 129, 0.4)'
                            : '1px solid transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#6ee7b7' }}>
                          Mesclar Dados (Manter o que já tenho)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Soma as quantidades de cartas iguais e preserva artes customizadas diferentes.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPendingBackup(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={restoreMode === 'replace' ? 'btn btn-danger' : 'btn btn-primary'}
                      onClick={handleConfirmRestore}
                    >
                      {restoreMode === 'replace' ? (
                        <>
                          <AlertTriangle size={15} /> Confirmar Substituição Completa
                        </>
                      ) : (
                        <>
                          <Check size={15} /> Confirmar Mesclagem dos Dados
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

