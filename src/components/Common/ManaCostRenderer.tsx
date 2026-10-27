import React from 'react';

interface ManaCostProps {
  manaCost?: string;
  className?: string;
}

export const ManaCostRenderer: React.FC<ManaCostProps> = ({ manaCost, className = '' }) => {
  if (!manaCost) return null;

  const regex = /\{([^}]+)\}/g;
  const symbols: string[] = [];
  let match;

  while ((match = regex.exec(manaCost)) !== null) {
    symbols.push(match[1]);
  }

  if (symbols.length === 0) return <span>{manaCost}</span>;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        flexWrap: 'wrap',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      {symbols.map((sym, index) => {
        let pipClass = 'mana-pip-generic';
        if (sym === 'W') pipClass = 'mana-pip-W';
        else if (sym === 'U') pipClass = 'mana-pip-U';
        else if (sym === 'B') pipClass = 'mana-pip-B';
        else if (sym === 'R') pipClass = 'mana-pip-R';
        else if (sym === 'G') pipClass = 'mana-pip-G';
        else if (sym === 'C') pipClass = 'mana-pip-C';

        return (
          <span key={index} className={`mana-pip ${pipClass}`} title={`Mana ${sym}`}>
            {sym}
          </span>
        );
      })}
    </span>
  );
};
