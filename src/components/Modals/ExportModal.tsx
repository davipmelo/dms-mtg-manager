import React, { useState, useEffect } from 'react';
import { CollectionItem, Deck, ProxyItem } from '../../types';
import {
  exportToMtgArena,
  exportToMoxfield,
  exportToLigaMagic,
  exportCollectionToCsv,
} from '../../services/importer';
import { createSystemBackup } from '../../services/storage';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import {
  Upload,
  Copy,
  Check,
  Download,
  X,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  defaultDeckId?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  collection,
  decks,
  proxies,
  defaultDeckId,
}) => {
  useModalOverlay(isOpen, onClose);

  const [exportSource, setExportSource] = useState<string>(defaultDeckId || 'collection');
  const [exportFormat, setExportFormat] = useState<
    'arena' | 'moxfield' | 'ligamagic' | 'csv' | 'json'
  >('arena');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setExportSource(defaultDeckId || 'collection');
    }
  }, [isOpen, defaultDeckId]);

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
    const ext = exportFormat === 'csv' ? 'csv' : exportFormat === 'json' ? 'json' : 'txt';
    const filename = `${
      exportSource === 'collection' ? 'minha_colecao' : 'meu_deck'
    }_${Date.now()}.${ext}`;
    triggerBrowserDownload(exportContent, filename, 'text/plain;charset=utf-8');
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
          width: '780px',
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
        {/* Header - Dedicated to Export */}
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
            <Upload size={22} className="text-blue-400" />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Exportar Listas de Cartas
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Exporte sua coleção ou decks para MTG Arena, Moxfield, LigaMagic ou formatos de arquivo
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
            gap: '16px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Origin source */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                Origem das Cartas:
              </label>
              <select
                className="select-field"
                value={exportSource}
                onChange={(e) => setExportSource(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="collection">Minha Coleção ({collection.length} cartas únicas)</option>
                <optgroup label="Meus Decks">
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      Deck: {d.name} ({d.cards.length} cartas)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Target format */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                Formato do Destino:
              </label>
              <select
                className="select-field"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="arena">MTG Arena (.txt)</option>
                <option value="moxfield">Moxfield (Texto com Edição e Número)</option>
                <option value="ligamagic">LigaMagic (Compatível com Importador Nacional)</option>
                <option value="csv">Planilha CSV (.csv)</option>
                <option value="json">Objeto JSON (.json)</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyExport}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" /> Copiado!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar Texto
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleDownloadFile}
            >
              <Download size={14} /> Baixar Arquivo
            </button>
          </div>

          {/* Text Area Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Prévia do Texto Formatado ({exportContent.split('\n').filter(Boolean).length} linhas):
              </span>
            </div>
            <textarea
              readOnly
              value={exportContent}
              style={{
                width: '100%',
                height: '320px',
                padding: '12px',
                borderRadius: '8px',
                background: '#070a10',
                border: '1px solid var(--border-medium)',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '0.84rem',
                resize: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

