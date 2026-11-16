import React, { useState } from 'react';

/**
 * Converte uma URL de imagem do Scryfall para a versão "small" (146×204, ~10 KB),
 * muito mais leve que normal/large/png. Outras URLs são mantidas.
 */
export function scryfallSmall(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/(cards\.scryfall\.io\/)(normal|large|png|border_crop)(\/)/, '$1small$3');
}

interface ThumbProps {
  /** Imagem principal (idealmente já leve). */
  src?: string;
  /** Alternativa caso a principal falhe. */
  fallback?: string;
  className?: string;
  /** Posição vertical do recorte (para mostrar a arte de uma carta inteira). */
  position?: string;
  alt?: string;
}

/**
 * Miniatura leve: <img> com lazy loading nativo, decodificação assíncrona,
 * prioridade baixa e fade-in. Evita centenas de downloads simultâneos.
 */
export const Thumb: React.FC<ThumbProps> = ({ src, fallback, className = '', position = '50% 50%', alt = '' }) => {
  const [current, setCurrent] = useState(src || fallback);
  const [loaded, setLoaded] = useState(false);
  if (!current) return <span className={`thumb ${className}`} />;
  return (
    <span className={`thumb ${loaded ? 'is-loaded' : ''} ${className}`}>
      <img
        src={current}
        alt={alt}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        draggable={false}
        style={{ objectPosition: position }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallback && current !== fallback) setCurrent(fallback);
        }}
      />
    </span>
  );
};
