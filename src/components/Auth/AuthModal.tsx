import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  registerUser,
  loginUser,
  sendForgotPasswordEmail,
  getFriendlyErrorMessage,
} from '../../services/firebase';
import { UserProfile } from '../../types';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialTab?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialTab = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(initialTab);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useModalOverlay(isOpen, onClose, isLoading);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { label: 'Fraca', color: '#ef4444', percent: 33 };
    if (score <= 4) return { label: 'Média', color: '#ffbb00', percent: 66 };
    return { label: 'Forte', color: '#10b981', percent: 100 };
  };

  const strength = getPasswordStrength(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e senha.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await loginUser(email, password);
      setSuccessMessage(`Bem-vindo de volta, ${user.username}!`);
      setTimeout(() => {
        onAuthSuccess(user);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim()) {
      setErrorMessage('Por favor, informe seu nome de usuário.');
      return;
    }
    if (username.trim().length < 3) {
      setErrorMessage('O nome de usuário deve ter no mínimo 3 caracteres.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve conter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await registerUser(username, email, password);
      setSuccessMessage(`Conta criada com sucesso! Olá, ${user.username}.`);
      setTimeout(() => {
        onAuthSuccess(user);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, digite o e-mail cadastrado na sua conta.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await sendForgotPasswordEmail(email);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-container"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card, #18181d)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #292932)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px rgba(255, 187, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle, #292932)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-dark, #1a1a20)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ffbb00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#111114',
                fontWeight: 800,
              }}
            >
              <Cloud size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {activeTab === 'login' && 'Entrar na Conta'}
                {activeTab === 'register' && 'Criar Nova Conta'}
                {activeTab === 'forgot' && 'Recuperar Senha'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#a0a0ab', margin: 0 }}>
                {activeTab === 'login' && 'Sincronize seus decks e coleções em qualquer dispositivo'}
                {activeTab === 'register' && 'Cadastre-se para sincronizar seus dados com segurança'}
                {activeTab === 'forgot' && 'Enviaremos um link de recuperação para seu e-mail'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', borderRadius: '8px' }}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs (Login / Register) */}
        {(activeTab === 'login' || activeTab === 'register') && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle, #292932)',
              background: 'var(--bg-darkest, #0e0e11)',
            }}
          >
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: activeTab === 'login' ? 'var(--bg-card, #18181d)' : 'transparent',
                color: activeTab === 'login' ? '#ffbb00' : '#a0a0ab',
                borderBottom: activeTab === 'login' ? '2px solid #ffbb00' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                background: activeTab === 'register' ? 'var(--bg-card, #18181d)' : 'transparent',
                color: activeTab === 'register' ? '#ffbb00' : '#a0a0ab',
                borderBottom:
                  activeTab === 'register' ? '2px solid #ffbb00' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '22px', overflowY: 'auto' }}>
          {/* Notification Banners */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                color: '#fca5a5',
                fontSize: '0.84rem',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '10px',
                color: '#86efac',
                fontSize: '0.84rem',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* =========================================================================
              VIEW 1: LOGIN FORM
             ========================================================================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  E-mail
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#e2e8f0',
                    }}
                  >
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffbb00',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha secreta"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#a0a0ab',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Conectando...
                  </>
                ) : (
                  <>
                    <Cloud size={16} /> Entrar na Conta
                  </>
                )}
              </button>
            </form>
          )}

          {/* =========================================================================
              VIEW 2: REGISTER FORM
             ========================================================================= */}
          {activeTab === 'register' && (
            <form
              onSubmit={handleRegister}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  Nome de Usuário
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ex: Davi MTG"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#a0a0ab', marginTop: '4px', display: 'block' }}>
                  Este é o único identificador visível no site.
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  E-mail
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.72rem',
                    color: '#38bdf8',
                    marginTop: '5px',
                  }}
                >
                  <ShieldCheck size={13} />
                  <span>Seu e-mail é estritamente confidencial e nunca será divulgado.</span>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#a0a0ab',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {password.length > 0 && (
                  <div style={{ marginTop: '6px' }}>
                    <div
                      style={{
                        height: '4px',
                        background: '#292932',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${strength.percent}%`,
                          backgroundColor: strength.color,
                          transition: 'all 0.3s',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: strength.color, marginTop: '2px', display: 'inline-block' }}>
                      Força da senha: {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  Confirmar Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border:
                        confirmPassword && confirmPassword !== password
                          ? '1px solid #ef4444'
                          : '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Cadastrando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Criar Minha Conta
                  </>
                )}
              </button>
            </form>
          )}

          {/* =========================================================================
              VIEW 3: FORGOT PASSWORD
             ========================================================================= */}
          {activeTab === 'forgot' && (
            <form
              onSubmit={handleForgotPassword}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: '#bae6fd',
                  lineHeight: 1.4,
                }}
              >
                Informe seu endereço de e-mail abaixo. Nós lhe enviaremos um link protegido para
                redefinir sua senha com segurança.
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    marginBottom: '6px',
                  }}
                >
                  E-mail da sua conta
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#a0a0ab',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      background: 'var(--bg-dark, #1a1a20)',
                      border: '1px solid var(--border-subtle, #292932)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Enviando e-mail...
                  </>
                ) : (
                  <>
                    <Mail size={16} /> Enviar Link de Recuperação
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="btn btn-ghost"
                style={{
                  width: '100%',
                  padding: '9px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#a0a0ab',
                }}
              >
                <ArrowLeft size={16} /> Voltar para o Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
