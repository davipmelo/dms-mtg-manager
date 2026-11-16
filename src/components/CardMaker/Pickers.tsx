import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, AlertCircle, Check } from 'lucide-react';
import { SetInfo, RefCard, loadSets, searchArt } from '../../services/cardMaker/scryfallRef';
import { Modal, Segmented } from './ui';
import { CARD_TEMPLATES, CardTemplate } from '../../services/cardMaker/model';
import { renderThumb } from '../../services/cardMaker/renderer';

/* ------------------------------------------------------------------ */
/* Seletor de edição                                                    */
/* ------------------------------------------------------------------ */

type SetGroup = 'all' | 'main' | 'commander' | 'masters' | 'other';

const GROUPS: { id: SetGroup; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'main', label: 'Principais' },
  { id: 'commander', label: 'Commander' },
  { id: 'masters', label: 'Masters' },
  { id: 'other', label: 'Outras' },
];

function groupOf(type: string): SetGroup {
  if (type === 'core' || type === 'expansion') return 'main';
  if (type === 'commander') return 'commander';
  if (type === 'masters' || type === 'eternal' || type === 'masterpiece') return 'masters';
  return 'other';
}

export const SetPicker: React.FC<{
  currentCode: string;
  onPick: (s: SetInfo) => void;
  onClose: () => void;
}> = ({ currentCode, onPick, onClose }) => {
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<SetGroup>('main');
  const [limit, setLimit] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadSets()
      .then((s) => {
        if (alive) setSets(s.filter((x) => !x.digital));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    inputRef.current?.focus();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets.filter((s) => {
      if (q) return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      return group === 'all' || groupOf(s.type) === group;
    });
  }, [sets, query, group]);

  useEffect(() => setLimit(60), [query, group]);

  return (
    <Modal title="Escolher edição" subtitle="O símbolo da edição é aplicado com a cor da raridade." onClose={onClose} width={720}>
      <div className="cm-ref-toolbar">
        <div className="cm-ref-search">
          <Search size={16} />
          <input ref={inputRef} className="input-text" placeholder="Buscar por nome ou código (ex.: Dominaria, DOM)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {!query && <Segmented size="sm" value={group} onChange={setGroup} options={GROUPS} />}
      </div>
      {loading && (
        <div className="cm-ref-empty">
          <Loader2 className="cm-spin" size={20} />
          <p>Carregando edições…</p>
        </div>
      )}
      {error && (
        <div className="cm-notice cm-notice-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      <div className="cm-set-list">
        {filtered.slice(0, limit).map((s) => (
          <button type="button" key={s.code} className={`cm-set-item ${s.code === currentCode.toUpperCase() ? 'is-active' : ''}`} onClick={() => onPick(s)}>
            <img src={s.iconUri} alt="" className="cm-set-icon" loading="lazy" />
            <span className="cm-set-name">{s.name}</span>
            <span className="cm-set-meta">
              {s.code} · {s.releasedAt.slice(0, 4)}
            </span>
          </button>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="cm-ref-empty">
            <p>Nenhuma edição encontrada.</p>
          </div>
        )}
        {filtered.length > limit && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ margin: '8px auto' }} onClick={() => setLimit((l) => l + 80)}>
            Mostrar mais ({filtered.length - limit})
          </button>
        )}
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Galeria de artes                                                     */
/* ------------------------------------------------------------------ */

export const ArtSearchModal: React.FC<{
  onPick: (ref: RefCard, copyArtist: boolean) => void;
  onClose: () => void;
}> = ({ onPick, onClose }) => {
  const [mode, setMode] = useState<'name' | 'artist'>('name');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RefCard[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [copyArtist, setCopyArtist] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (q: string, m: 'name' | 'artist', page?: string) => {
    abortRef.current?.abort();
    if (!q.trim() && !page) {
      setResults([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const res = await searchArt(q, m, ctrl.signal, page);
      if (ctrl.signal.aborted) return;
      setResults((prev) => (page ? [...prev, ...res.cards] : res.cards));
      setTotal(res.total);
      setNext(res.hasMore ? res.nextPage : undefined);
      setSearched(true);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => run(query, mode), 450);
    return () => window.clearTimeout(t);
  }, [query, mode]);
  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  return (
    <Modal title="Buscar arte no Scryfall" subtitle="Ilustrações oficiais — pesquise pelo nome da carta ou pelo artista." onClose={onClose} width={980}>
      <div className="cm-ref-toolbar">
        <div className="cm-ref-search">
          <Search size={16} />
          <input
            ref={inputRef}
            className="input-text"
            placeholder={mode === 'name' ? 'Nome da carta (ex.: Black Lotus, forest)' : 'Nome do artista (ex.: Rebecca Guay)'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 size={16} className="cm-spin" />}
        </div>
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'name', label: 'Por carta' },
            { id: 'artist', label: 'Por artista' },
          ]}
        />
        <label className="cm-inline-check">
          <input type="checkbox" checked={copyArtist} onChange={(e) => setCopyArtist(e.target.checked)} /> Copiar nome do artista
        </label>
      </div>
      {error && (
        <div className="cm-notice cm-notice-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {!searched && !loading && (
        <div className="cm-ref-empty">
          <p>Digite para ver as artes disponíveis.</p>
        </div>
      )}
      {searched && results.length === 0 && !loading && (
        <div className="cm-ref-empty">
          <p>Nenhuma arte encontrada.</p>
        </div>
      )}
      <div className="cm-art-grid">
        {results.map((c) => (
          <button type="button" key={c.id} className="cm-art-tile" onClick={() => onPick(c, copyArtist)} title={`${c.name} — ${c.faces[0].artist}`}>
            <img src={c.faces[0].artCrop} alt={c.name} loading="lazy" />
            <span className="cm-art-caption">
              <strong>{c.name}</strong>
              <span>
                {c.faces[0].artist || '—'} · {c.setCode}
              </span>
            </span>
          </button>
        ))}
      </div>
      {results.length > 0 && (
        <div className="cm-ref-more">
          <span>
            {results.length} de {total} artes
          </span>
          {next && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => run(query, mode, next)}>
              Carregar mais
            </button>
          )}
        </div>
      )}
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Modelos                                                              */
/* ------------------------------------------------------------------ */

export const TemplateModal: React.FC<{
  onPick: (t: CardTemplate) => void;
  onFromExisting: () => void;
  onClose: () => void;
}> = ({ onPick, onFromExisting, onClose }) => {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const t of CARD_TEMPLATES) {
        if (!alive) return;
        try {
          const url = await renderThumb(t.build(), 260);
          if (alive) setThumbs((prev) => ({ ...prev, [t.id]: url }));
        } catch {
          /* miniatura é só decorativa */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Modal title="Nova carta" subtitle="Comece de um modelo ou traga uma carta real para personalizar." onClose={onClose} width={900}>
      <button type="button" className="cm-from-existing" onClick={onFromExisting}>
        <span className="cm-from-existing-icon">
          <Search size={18} />
        </span>
        <span>
          <strong>Partir de uma carta existente</strong>
          <span>Pesquise no Scryfall e copie nome, regras, sabor, arte e edição.</span>
        </span>
      </button>
      <div className="cm-template-grid">
        {CARD_TEMPLATES.map((t) => (
          <button type="button" key={t.id} className="cm-template" onClick={() => onPick(t)}>
            <span className="cm-template-thumb">{thumbs[t.id] ? <img src={thumbs[t.id]} alt={t.label} /> : <Loader2 size={18} className="cm-spin" />}</span>
            <strong>{t.label}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export const CheckMark: React.FC = () => <Check size={14} />;
