import React from 'react';
import { Cloud, GitMerge, DownloadCloud, UploadCloud, Layers, Swords } from 'lucide-react';
import { CollectionItem, Deck, ProxyItem } from '../../types';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface SyncConflictModalProps {
  isOpen: boolean;
  cloudData: {
    collection: CollectionItem[];
    decks: Deck[];
    proxies: ProxyItem[];
    updatedAt: string;
  };
  localData: {
    collection: CollectionItem[];
    decks: Deck[];
    proxies: ProxyItem[];
  };
  onMerge: () => void;
  onUseCloud: () => void;
  onUseLocal: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  cloudData,
  localData,
  onMerge,
  onUseCloud,
  onUseLocal,
}) => {
  useModalOverlay(isOpen, onUseLocal);

  if (!isOpen) return null;

  const cloudCollectionCount = cloudData.collection.reduce((sum, item) => sum + item.quantity, 0);
  const localCollectionCount = localData.collection.reduce((sum, item) => sum + item.quantity, 0);

  const formattedDate = cloudData.updatedAt
    ? new Date(cloudData.updatedAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Data desconhecida';

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
    >
      <div
        className="modal-container"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card, #18181d)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #292932)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 187, 0, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, #292932)',
            background: 'var(--bg-dark, #1a1a20)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#ffbb00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#111114',
            }}
          >
            <Cloud size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Sincronização de Dispositivos
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#a0a0ab', margin: 0 }}>
              Encontramos dados salvos na sua Nuvem e neste Dispositivo
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Comparison Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            {/* Cloud Summary */}
            <div
              style={{
                background: 'var(--bg-darkest, #0e0e11)',
                border: '1px solid var(--border-subtle, #292932)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38bdf8',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                <Cloud size={14} /> Salvo na Nuvem
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f8fafc', marginBottom: '4px' }}>
                <Swords size={13} style={{ display: 'inline', marginRight: '4px' }} />
                <strong>{cloudData.decks.length}</strong> decks
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f8fafc', marginBottom: '8px' }}>
                <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} />
                <strong>{cloudCollectionCount}</strong> cartas na coleção
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a0a0ab' }}>Último salvo: {formattedDate}</div>
            </div>

            {/* Local Summary */}
            <div
              style={{
                background: 'var(--bg-darkest, #0e0e11)',
                border: '1px solid var(--border-subtle, #292932)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ffbb00',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                <DownloadCloud size={14} /> Neste Dispositivo
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f8fafc', marginBottom: '4px' }}>
                <Swords size={13} style={{ display: 'inline', marginRight: '4px' }} />
                <strong>{localData.decks.length}</strong> decks
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f8fafc', marginBottom: '8px' }}>
                <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} />
                <strong>{localCollectionCount}</strong> cartas na coleção
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a0a0ab' }}>Dados locais em cache</div>
            </div>
          </div>

          <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.4, margin: 0 }}>
            Como você deseja prosseguir com a sincronização entre seus dispositivos?
          </p>

          {/* Action Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Option 1: Merge (Recommended) */}
            <button
              onClick={onMerge}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '10px',
                textAlign: 'left',
                border: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GitMerge size={20} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    Mesclar Tudo (Recomendado)
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                    Junta a coleção e todos os decks dos dois lugares sem perder nada.
                  </div>
                </div>
              </div>
            </button>

            {/* Option 2: Use Cloud */}
            <button
              onClick={onUseCloud}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                textAlign: 'left',
              }}
            >
              <DownloadCloud size={18} color="#38bdf8" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc' }}>
                  Baixar da Nuvem
                </div>
                <div style={{ fontSize: '0.74rem', color: '#a0a0ab' }}>
                  Substitui os dados locais pelo que está salvo na sua conta da nuvem.
                </div>
              </div>
            </button>

            {/* Option 3: Use Local */}
            <button
              onClick={onUseLocal}
              className="btn btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                textAlign: 'left',
                border: '1px solid var(--border-subtle, #292932)',
              }}
            >
              <UploadCloud size={18} color="#ffbb00" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc' }}>
                  Enviar Dados Deste Dispositivo
                </div>
                <div style={{ fontSize: '0.74rem', color: '#a0a0ab' }}>
                  Substitui a nuvem com os dados salvos atualmente nesta máquina.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

