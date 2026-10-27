import React from 'react';

interface MtgLogoProps {
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Official Magic: The Gathering Planeswalker Symbol
 */
export const MtgLogo: React.FC<MtgLogoProps> = ({
  size = 24,
  className = '',
  color = 'currentColor',
  style = {},
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill={color}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Magic: The Gathering"
    >
      {/* Center blade */}
      <path d="M256 0c-10.9 92.5-38.6 142.3-91.2 181.7 34.6 6.8 61.3 22.8 77.2 46.5 3.5-55.8 8.1-112.5 14-168.9 5.9 56.4 10.5 113.1 14 168.9 15.9-23.7 42.6-39.7 77.2-46.5-52.6-39.4-80.3-89.2-91.2-181.7z" />
      {/* Top left blade */}
      <path d="M115.1 71.9c-2.1 63.8-21.4 116.8-59.5 156.4 34.9 3.5 61.1 18.2 75.7 41.7-6.1-44.1-9.5-88.9-9.5-134.1 0-21.7 0.9-43.1 2.3-64-3-0.1-6-0.1-9 0z" />
      {/* Top right blade */}
      <path d="M396.9 71.9c-3-0.1-6-0.1-9 0 1.4 20.9 2.3 42.3 2.3 64 0 45.2-3.4 90-9.5 134.1 14.6-23.5 40.8-38.2 75.7-41.7-38.1-39.6-57.4-92.6-59.5-156.4z" />
      {/* Bottom left blade */}
      <path d="M172.9 313.8c-20.6-11.9-45.1-17.8-72.6-16.2 16.5 21.6 30.7 45.4 42.1 70.9 12.8-18.7 20.7-36.9 23.6-54.7 2.3-0.1 4.6-0.1 6.9 0z" />
      {/* Bottom right blade */}
      <path d="M339.1 313.8c2.3-0.1 4.6-0.1 6.9 0 2.9 17.8 10.8 36 23.6 54.7 11.4-25.5 25.6-49.3 42.1-70.9-27.5-1.6-52 4.3-72.6 16.2z" />
      {/* Bottom center spike */}
      <path d="M256 288.6c-13.2 45.1-31.3 87.2-53.8 125.1 28.5 28.1 53.8 62.7 53.8 98.3 0-35.6 25.3-70.2 53.8-98.3-22.5-37.9-40.6-80-53.8-125.1z" />
    </svg>
  );
};
