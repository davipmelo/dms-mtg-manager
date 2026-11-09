import React, { useState, useRef, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  WifiOff,
  User,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { UserProfile, SyncStatus } from '../../types';
import { sendForgotPasswordEmail, getFriendlyErrorMessage } from '../../services/firebase';

interface UserMenuProps {
  user: UserProfile | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  onOpenAuthModal: (tab?: 'login' | 'register' | 'forgot') => void;
  onLogout: () => void;
  onForceSync: () => Promise<void>;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  syncStatus,
  lastSyncedAt,
  onOpenAuthModal,
  onLogout,
  onForceSync,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualSync = async () => {
    try {
      setIsManualSyncing(true);
      setFeedbackMessage(null);
      await onForceSync();
      setFeedbackMessage({ text: 'Sincronizado com sucesso!', type: 'success' });
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: any) {
      setFeedbackMessage({
        text: getFriendlyErrorMessage(err) || 'Falha ao sincronizar.',
        type: 'error',
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) {
      // In case email isn't in memory, open the forgot password modal tab
      onOpenAuthModal('forgot');
      setIsOpen(false);
      return;
    }

    try {
      setFeedbackMessage(null);
      const res = await sendForgotPasswordEmail(user.email);
      setFeedbackMessage({ text: res.message, type: 'success' });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage({
        text: getFriendlyErrorMessage(err) || 'Erro ao enviar e-mail de recuperação.',
        type: 'error',
      });
    }
  };

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Nunca sincronizado';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastSyncedAt.getTime()) / 1000);

    if (diffSeconds < 20) return 'Agora há pouco';
    if (diffSeconds < 60) return `Há ${diffSeconds} segundos`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    return lastSyncedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // When user is NOT logged in
  if (!user) {
    return (
      <button
        onClick={() => onOpenAuthModal('login')}
        className="btn btn-primary btn-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(255, 187, 0, 0.25)',
        }}
        title="Entrar ou criar conta para sincronizar decks e coleção entre dispositivos"
      >
        <Cloud size={15} />
        <span>Entrar / Sincronizar</span>
      </button>
    );
  }

  // When user IS logged in
  const userInitial = (user.username || 'U').charAt(0).toUpperCase();

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Pill Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px 4px 6px',
          background: 'var(--bg-surface, #222228)',
          border: '1px solid var(--border-subtle, #292932)',
          borderRadius: '9999px',
          cursor: 'pointer',
        }}
      >
        {/* User Avatar Circle */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ffbb00',
            color: '#111114',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.75rem',
          }}
        >
          {userInitial}
        </div>

        {/* Username */}
        <span
          style={{
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#f8fafc',
            maxWidth: '120px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.username}
        </span>

        {/* Sync Status Badge Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={
            syncStatus === 'syncing' || isManualSyncing
              ? 'Sincronizando com a nuvem...'
              : syncStatus === 'synced'
              ? `Sincronizado (${formatLastSync()})`
              : syncStatus === 'offline'
              ? 'Modo Offline'
              : 'Status da sincronização'
          }
        >
          {syncStatus === 'syncing' || isManualSyncing ? (
            <RefreshCw size={13} color="#ffbb00" className="animate-spin" />
          ) : syncStatus === 'synced' ? (
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }}
            />
          ) : syncStatus === 'offline' ? (
            <WifiOff size={13} color="#f43f5e" />
          ) : (
            <AlertCircle size={13} color="#ef4444" />
          )}
        </div>

        <ChevronDown size={14} color="#a0a0ab" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            background: 'var(--bg-card, #18181d)',
            border: '1px solid var(--border-subtle, #292932)',
            borderRadius: '12px',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 0, 0, 0.4)',
            zIndex: 1050,
            overflow: 'hidden',
            animation: 'modal-enter 0.15s ease-out',
          }}
        >
          {/* Header Info */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-subtle, #292932)',
              background: 'var(--bg-dark, #1a1a20)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#ffbb00',
                  color: '#111114',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                }}
              >
                {userInitial}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.username}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.7rem',
                    color: '#38bdf8',
                    marginTop: '2px',
                  }}
                >
                  <ShieldCheck size={12} />
                  <span>E-mail estritamente confidencial</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Status Card */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle, #292932)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {syncStatus === 'synced' ? (
                  <CheckCircle2 size={14} color="#10b981" />
                ) : (
                  <Cloud size={14} color="#ffbb00" />
                )}
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>
                  {syncStatus === 'synced'
                    ? 'Nuvem Sincronizada'
                    : syncStatus === 'syncing' || isManualSyncing
                    ? 'Sincronizando...'
                    : 'Modo Offline'}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#a0a0ab' }}>{formatLastSync()}</span>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isManualSyncing || syncStatus === 'syncing'}
              className="btn btn-secondary btn-sm"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                padding: '6px 10px',
              }}
            >
              <RefreshCw
                size={13}
                className={isManualSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''}
              />
              <span>Sincronizar Agora</span>
            </button>
          </div>

          {/* Feedback Banner */}
          {feedbackMessage && (
            <div
              style={{
                padding: '8px 12px',
                fontSize: '0.75rem',
                background:
                  feedbackMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color: feedbackMessage.type === 'success' ? '#86efac' : '#fca5a5',
                borderBottom: '1px solid var(--border-subtle, #292932)',
              }}
            >
              {feedbackMessage.text}
            </div>
          )}

          {/* Actions List */}
          <div style={{ padding: '6px' }}>
            <button
              onClick={handleResetPassword}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover, #2c2c34)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <KeyRound size={15} color="#ffbb00" />
              <span>Redefinir Minha Senha</span>
            </button>

            <div style={{ height: '1px', background: 'var(--border-subtle, #292932)', margin: '4px 0' }} />

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: '#f43f5e',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={15} color="#f43f5e" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

