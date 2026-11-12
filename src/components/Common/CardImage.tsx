import React, { useState, useEffect, useMemo, useRef } from 'react';
import { isMpcCardImage } from '../../services/mpcFillService';

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
  cropMpcBleed?: boolean;
}

// Global cache of URLs that have successfully loaded in this browser session.
// Prevents skeleton shimmer / reload when components re-render or re-mount.
const globalLoadedUrls = new Set<string>();

/**
 * Normalizes Google User Content / MPCFill Drive URLs into fast-loading web thumbnail URLs.
 * E.g. https://lh3.googleusercontent.com/d/{id} -> https://lh3.googleusercontent.com/d/{id}=w400 (or =w1000 for preferLarge)
 * =w400 reduces file size from 20MB-40MB raw to ~40KB WebP.
 */
function getMpcThumbnailUrl(url?: string, preferLarge?: boolean): string | undefined {
  if (!url) return undefined;
  if (url.includes('lh3.googleusercontent.com/d/') && !url.includes('=')) {
    return `${url}=w${preferLarge ? '1000' : '400'}`;
  }
  return undefined;
}

/**
 * Resilient MTG Card Image component with high-performance IntersectionObserver lazy loading.
 * Automatically recovers if a cached/stored URL is stale or missing by falling back to:
 * 1) Fast optimized web thumbnail (for MPCFill/Google Drive)
 * 2) Primary image URL (normal or large)
 * 3) Alternate image URL (normal <-> large)
 * 4) Scryfall direct image endpoint by setCode + collectorNumber
 * 5) Scryfall direct image endpoint by card name (fuzzy)
 * 6) Sleek inline MTG card placeholder
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
  cropMpcBleed = true,
}) => {
  const version = preferLarge ? 'large' : 'normal';

  const candidates = useMemo(() => {
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

    // If it is a Google Drive MPCFill image, prioritize the fast web thumbnail (40KB instead of 20MB)
    const mpcThumbPrimary = getMpcThumbnailUrl(primary, preferLarge);
    if (mpcThumbPrimary) {
      list.push(mpcThumbPrimary);
    }

    if (isValidSrc(primary) && !list.includes(primary!)) {
      list.push(primary!);
    }

    const mpcThumbSecondary = getMpcThumbnailUrl(secondary, preferLarge);
    if (mpcThumbSecondary && !list.includes(mpcThumbSecondary)) {
      list.push(mpcThumbSecondary);
    }

    if (isValidSrc(secondary) && !list.includes(secondary!)) {
      list.push(secondary!);
    }

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
        let targetFaceName = name.trim();
        targetFaceName = targetFaceName.replace(/\s*\((verso|frente|back|front)\)/gi, '').trim();
        if (targetFaceName.includes('//')) {
          targetFaceName = face === 'back' ? targetFaceName.split('//')[1].trim() : targetFaceName.split('//')[0].trim();
        }
        list.push(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(targetFaceName)}&format=image&version=${version}${faceParam}`
        );
      }
    }

    return list;
  }, [name, imageUrl, imageUrlLarge, setCode, collectorNumber, preferLarge, version, face]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Check if candidate is already loaded in global session cache
  const initialCandidate = candidates[0];
  const [isLoaded, setIsLoaded] = useState(() => (initialCandidate ? globalLoadedUrls.has(initialCandidate) : false));
  const [isVisible, setIsVisible] = useState(() => {
    if (loading === 'eager') return true;
    if (initialCandidate && globalLoadedUrls.has(initialCandidate)) return true;
    if (typeof IntersectionObserver === 'undefined') return true;
    return false;
  });

  useEffect(() => {
    setAttemptIndex(0);
    setAllFailed(false);
    const cand = candidates[0];
    const cached = cand ? globalLoadedUrls.has(cand) : false;
    setIsLoaded(cached);
    if (cached || loading === 'eager') {
      setIsVisible(true);
    }
  }, [candidates, loading]);

  useEffect(() => {
    if (isVisible) return;
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '500px 0px 500px 0px', // Preload when within 500px of visible scroll area
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  if (allFailed || candidates.length === 0) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          background: '#131722',
          border: '1px solid rgba(255, 187, 0, 0.35)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          textAlign: 'center',
          gap: '6px',
          color: '#f4f4f6',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 187, 0, 0.15)',
            border: '1px solid rgba(255, 187, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: '#ffbb00',
          }}
        >
          MTG
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.25 }}>{name}</div>
        {setCode && (
          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
            {setCode.toUpperCase()} {collectorNumber ? `#${collectorNumber}` : ''}
          </div>
        )}
      </div>
    );
  }

  const currentSrc = candidates[attemptIndex];
  const isMpc = cropMpcBleed && isMpcCardImage(setCode, currentSrc, imageUrlLarge);
  const combinedClassName = [className, isMpc ? 'is-mpc-bleed-crop' : ''].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      {/* Visual Shimmer Loading Skeleton while the image is loading or waiting to be visible */}
      {!isLoaded && (
        <div
          className="card-image-skeleton"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {isVisible && currentSrc && (
        <img
          src={currentSrc}
          alt={name}
          className={combinedClassName}
          style={{
            ...style,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (currentSrc) globalLoadedUrls.add(currentSrc);
            setIsLoaded(true);
          }}
          onError={() => {
            setIsLoaded(false);
            if (attemptIndex + 1 < candidates.length) {
              const nextIdx = attemptIndex + 1;
              setAttemptIndex(nextIdx);
              if (globalLoadedUrls.has(candidates[nextIdx])) {
                setIsLoaded(true);
              }
            } else {
              setAllFailed(true);
            }
          }}
        />
      )}
    </div>
  );
};

