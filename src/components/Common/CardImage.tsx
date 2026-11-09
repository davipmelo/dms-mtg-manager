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
  face?: 'front' | 'back';
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
  face = 'front',
}) => {
  const version = preferLarge ? 'large' : 'normal';

  const candidates = React.useMemo(() => {
    const list: string[] = [];
    const primary = preferLarge ? imageUrlLarge || imageUrl : imageUrl || imageUrlLarge;
    const secondary = preferLarge ? imageUrl : imageUrlLarge;

    const isValidSrc = (src?: string) =>
      Boolean(
        src &&
          (src.startsWith('http://') ||
            src.startsWith('https://') ||
            src.startsWith('data:image/') ||
            src.startsWith('blob:'))
      );

    if (isValidSrc(primary)) list.push(primary!);
    if (isValidSrc(secondary) && secondary !== primary) list.push(secondary!);

    const isCustomOrAlter = setCode === 'CUSTOM' || setCode === 'MPC';

    // Only fallback to Scryfall endpoints for official Scryfall cards
    if (!isCustomOrAlter) {
      const faceParam = face === 'back' ? '&face=back' : '';

      if (setCode && collectorNumber && collectorNumber !== '★') {
        list.push(
          `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(collectorNumber)}?format=image&version=${version}${faceParam}`
        );
      }

      if (name) {
        const frontName = name.includes('//') ? name.split('//')[0].trim() : name.trim();
        list.push(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(frontName)}&format=image&version=${version}${faceParam}`
        );
      }
    }

    return list;
  }, [name, imageUrl, imageUrlLarge, setCode, collectorNumber, preferLarge, version, face]);

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
          background: '#17171c',
          border: '1px solid rgba(255, 187, 0, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          textAlign: 'center',
          gap: '8px',
          color: '#f4f4f6',
          ...style,
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255, 187, 0, 0.15)',
            border: '1px solid rgba(255, 187, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: '#ffbb00',
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
      crossOrigin="anonymous"
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

