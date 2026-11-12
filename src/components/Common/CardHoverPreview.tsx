import React from 'react';
import { isMpcCardImage } from '../../services/mpcFillService';

export interface CardHoverPreviewData {
  url: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
}

interface CardHoverPreviewProps {
  preview: CardHoverPreviewData | null;
  mousePos: { x: number; y: number };
}

export const CardHoverPreview: React.FC<CardHoverPreviewProps> = ({ preview, mousePos }) => {
  if (!preview || !preview.url) return null;

  const tooltipWidth = 380;
  const isNearRight = mousePos.x + 24 + tooltipWidth > window.innerWidth;
  const left = Math.max(
    16,
    Math.min(
      window.innerWidth - (tooltipWidth + 24),
      isNearRight ? mousePos.x - (tooltipWidth + 24) : mousePos.x + 24
    )
  );
  const top = Math.max(16, Math.min(window.innerHeight - 580, mousePos.y - 210));

  const isMpc = isMpcCardImage(undefined, preview.url);

  // Optimize Google Drive MPCFill URLs to 1000px WebP (~200KB) instead of downloading raw 30MB TIFFs
  const previewSrc =
    preview.url.includes('lh3.googleusercontent.com/d/') && !preview.url.includes('=')
      ? `${preview.url}=w1000`
      : preview.url;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        pointerEvents: 'none',
        zIndex: 100000,
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 30px 70px rgba(0, 0, 0, 0.98), 0 0 40px rgba(245, 158, 11, 0.3)',
        border: '1px solid rgba(255, 187, 0, 0.45)',
        background: '#070a10',
        animation: 'modal-enter 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '5/7',
          background: '#000',
          maxHeight: 'calc(100vh - 90px)',
          overflow: 'hidden',
        }}
      >
        <img
          src={previewSrc}
          alt={preview.title}
          referrerPolicy="no-referrer"
          decoding="async"
          className={isMpc ? 'is-mpc-bleed-crop' : ''}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
      <div
        style={{
          padding: '9px 14px',
          background: 'rgba(10, 14, 23, 0.97)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#f8fafc',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: preview.badge ? '280px' : '100%',
            }}
          >
            {preview.title}
          </span>
          {preview.badge && (
            <span
              style={{
                fontSize: '0.74rem',
                color: preview.badgeColor || '#ffbb00',
                fontWeight: 800,
                background: 'rgba(245, 158, 11, 0.18)',
                padding: '2px 7px',
                borderRadius: '4px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                flexShrink: 0,
              }}
            >
              {preview.badge}
            </span>
          )}
        </div>
        {preview.subtitle && (
          <div
            style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {preview.subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

