import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';

export const Field: React.FC<{
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}> = ({ label, hint, children, className = '', action }) => (
  <div className={`cm-field ${className}`}>
    {(label || action) && (
      <div className="cm-field-head">
        {label && <label className="cm-label">{label}</label>}
        {action}
      </div>
    )}
    {children}
    {hint && <p className="cm-hint">{hint}</p>}
  </div>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { id: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`cm-segmented cm-segmented-${size}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.title}
          className={`cm-seg-btn ${value === o.id ? 'is-active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}> = ({ checked, onChange, label, hint, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    className={`cm-toggle ${checked ? 'is-on' : ''}`}
    onClick={() => onChange(!checked)}
  >
    <span className="cm-toggle-track">
      <span className="cm-toggle-thumb" />
    </span>
    <span className="cm-toggle-text">
      <span className="cm-toggle-label">{label}</span>
      {hint && <span className="cm-toggle-hint">{hint}</span>}
    </span>
  </button>
);

export const SymbolButton: React.FC<{ sym: string; label?: string; onClick: () => void }> = ({ sym, label, onClick }) => (
  <button type="button" className="cm-sym-btn" title={label || sym} onClick={onClick} aria-label={label || sym}>
    {/^\{(?:[WUBRGC])\}$/.test(sym) ? (
      <ManaCostRenderer manaCost={sym} />
    ) : (
      <span className="cm-sym-text">{sym.replace(/[{}]/g, '')}</span>
    )}
  </button>
);

export const Modal: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  className?: string;
}> = ({ title, subtitle, onClose, children, footer, width = 920, className = '' }) => {
  useModalOverlay(true, onClose);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-container cm-modal ${className}`} style={{ width, maxWidth: '96vw' }} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="font-display" style={{ fontSize: '1.12rem', fontWeight: 700 }}>
              {title}
            </h2>
            {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body cm-modal-body">{children}</div>
        {footer && <div className="cm-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

/** Pequeno aviso temporário no rodapé. */
export interface ToastMsg {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'error';
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const push = (text: string, tone: ToastMsg['tone'] = 'info') => {
    counter.current += 1;
    const id = counter.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };
  return { toasts, push };
}

export const ToastStack: React.FC<{ toasts: ToastMsg[] }> = ({ toasts }) => (
  <div className="cm-toasts" aria-live="polite">
    {toasts.map((t) => (
      <div key={t.id} className={`cm-toast cm-toast-${t.tone || 'info'}`}>
        {t.text}
      </div>
    ))}
  </div>
);

export function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const ConfirmModal: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, message, confirmLabel, onConfirm, onClose }) => (
  <Modal title={title} onClose={onClose} width={460}>
    <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.55 }}>{message}</p>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Cancelar
      </button>
      <button type="button" className="btn btn-danger" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  </Modal>
);
