import React, { useState, useEffect } from 'react';

interface CardImageProps {
  name: string;
  imageUrl?: string;
  imageUrlLarge?: string;
  setCode?: string;
  collectorNumber?: string;
  preferLarge?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}

/**
 * Resilient MTG Card Image component.
 * Automatically recovers if a cached/stored URL is stale or missing by falling back to:
 * 1) Primary image URL (normal or large)
 * 2) Alternate image URL (normal <-> large)
 * 3) Scryfall direct image endpoint by setCode + collectorNumber
 * 4) Scryfall direct image endpoint by card name (fuzzy)
 * 5) Sleek inline SVG card placeholder (when offline)
 */
export const CardImage: React.FC<CardImageProps> = ({
  name,
  imageUrl,
  imageUrlLarge,
  setCode,
  collectorNumber,
  preferLarge = false,
  className = '',
  style,
  loading = 'lazy',
}) => {
  const version = preferLarge ? 'large' : 'normal';

  const candidates = React.useMemo(() => {
    const list: string[] = [];
    const primary = preferLarge ? imageUrlLarge || imageUrl : imageUrl || imageUrlLarge;
    const secondary = preferLarge ? imageUrl : imageUrlLarge;

    if (primary && primary.startsWith('http')) list.push(primary);
    if (secondary && secondary.startsWith('http') && secondary !== primary) list.push(secondary);

    if (setCode && collectorNumber) {
      list.push(
        `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(collectorNumber)}?format=image&version=${version}`
      );
    }

    if (name) {
      const frontName = name.includes('//') ? name.split('//')[0].trim() : name.trim();
      list.push(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(frontName)}&format=image&version=${version}`
      );
    }

    return list;
  }, [name, imageUrl, imageUrlLarge, setCode, collectorNumber, preferLarge, version]);

  const [attemptIndex, setAttemptIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    setAttemptIndex(0);
    setAllFailed(false);
  }, [candidates]);

  if (allFailed || candidates.length === 0) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(145deg, #161d2f 0%, #0b0e17 100%)',
          border: '2px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          textAlign: 'center',
          gap: '8px',
          color: '#e2e8f0',
          ...style,
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: '#a5b4fc',
          }}
        >
          MTG
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}>{name}</div>
        {setCode && (
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            {setCode.toUpperCase()} {collectorNumber ? `#${collectorNumber}` : ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={candidates[attemptIndex]}
      alt={name}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        if (attemptIndex + 1 < candidates.length) {
          setAttemptIndex((prev) => prev + 1);
        } else {
          setAllFailed(true);
        }
      }}
    />
  );
};

