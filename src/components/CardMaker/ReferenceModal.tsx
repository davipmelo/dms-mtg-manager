import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, Search, Sparkles, Languages, AlertCircle } from 'lucide-react';
import { CardLang } from '../../services/cardMaker/model';
import {
  ALL_REF_FIELDS,
  REF_FIELD_LABELS,
  RefCard,
  RefField,
  RefFace,
  SearchMode,
  fetchLocalizedPrint,
  searchReferences,
} from '../../services/cardMaker/scryfallRef';
import { Modal, Segmented } from './ui';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';

export type ReferencePurpose = 'rules' | 'flavor' | 'import' | 'new';

interface ReferenceModalProps {
  purpose: ReferencePurpose;
  faceIndex?: number;
  defaultLang?: CardLang;
  onClose: () => void;
  onApply?: (ref: RefCard, fields: Set<RefField>, rulesMode: 'replace' | 'append') => void;
  onCreate?: (ref: RefCard) => void;
}

const PURPOSE_TEXT: Record<ReferencePurpose, { title: string; subtitle: string; cta: string; placeholder: Record<string, string> }> = {
  rules: {
    title: 'Copiar regras de uma carta existente',
    subtitle: 'Pesquise pelo nome ou por um trecho do texto e traga as regras para a sua carta.',
    cta: 'Aplicar regras',
    placeholder: { name: 'Nome da carta (ex.: Llanowar Elves)', rules: 'Trecho do texto (ex.: draw a card)' },
  },
  flavor: {
    title: 'Copiar texto de sabor',
    subtitle: 'Encontre citações de cartas reais — cada impressão pode ter um sabor diferente.',
    cta: 'Aplicar texto de sabor',
    placeholder: { flavorByName: 'Nome da carta (ex.: Lightning Bolt)', flavor: 'Trecho da citação (ex.: lightning)' },
  },
  import: {
    title: 'Importar de uma carta existente',
    subtitle: 'Escolha o que copiar: nome, custo, tipo, regras, sabor, arte, edição…',
    cta: 'Aplicar à carta',
    placeholder: { name: 'Nome da carta', rules: 'Trecho do texto de regras', flavor: 'Trecho do texto de sabor' },
  },
  new: {
    title: 'Nova carta a partir de uma existente',
    subtitle: 'Comece com todos os dados de uma carta real e personalize como quiser.',
    cta: 'Criar carta',
    placeholder: { name: 'Nome da carta', rules: 'Trecho do texto de regras', flavor: 'Trecho do texto de sabor' },
  },
};

const MODES_FOR: Record<ReferencePurpose, { id: SearchMode; label: string }[]> = {
  rules: [
    { id: 'name', label: 'Por nome' },
    { id: 'rules', label: 'Por texto de regras' },
  ],
  flavor: [
    { id: 'flavorByName', label: 'Por nome da carta' },
    { id: 'flavor', label: 'Por trecho do sabor' },
  ],
  import: [
    { id: 'name', label: 'Por nome' },
    { id: 'rules', label: 'Por regras' },
    { id: 'flavor', label: 'Por sabor' },
  ],
  new: [
    { id: 'name', label: 'Por nome' },
    { id: 'rules', label: 'Por regras' },
    { id: 'flavor', label: 'Por sabor' },
  ],
};

const DEFAULT_FIELDS: Record<ReferencePurpose, RefField[]> = {
  rules: ['rules'],
  flavor: ['flavor'],
  import: ALL_REF_FIELDS,
  new: ALL_REF_FIELDS,
};

function mergeLocalized(orig: RefCard, loc: RefCard): RefCard {
  const faces: RefFace[] = orig.faces.map((of, i) => {
    const lf = loc.faces[Math.min(i, loc.faces.length - 1)];
    if (!lf) return of;
    return {
      ...lf,
      flavorText: lf.flavorText || of.flavorText,
      artCrop: lf.artCrop || of.artCrop,
      image: lf.image || of.image,
      name: lf.name || of.name,
      oracleText: lf.oracleText || of.oracleText,
      manaCost: lf.manaCost || of.manaCost,
    };
  });
  return { ...orig, faces, name: loc.name || orig.name, lang: loc.lang };
}

const Snippet: React.FC<{ text: string; max?: number }> = ({ text, max = 150 }) => (
  <span>{text.length > max ? text.slice(0, max).trimEnd() + '…' : text}</span>
);

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ purpose, faceIndex = 0, defaultLang = 'pt', onClose, onApply, onCreate }) => {
  const cfg = PURPOSE_TEXT[purpose];
  const modes = MODES_FOR[purpose];
  const [mode, setMode] = useState<SearchMode>(modes[0].id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RefCard[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<RefCard | null>(null);
  const [lang, setLang] = useState<CardLang>(defaultLang);
  const [localized, setLocalized] = useState<RefCard | null>(null);
  const [locState, setLocState] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [fields, setFields] = useState<Set<RefField>>(new Set(DEFAULT_FIELDS[purpose]));
  const [rulesMode, setRulesMode] = useState<'replace' | 'append'>('replace');
  const [showDetail, setShowDetail] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback(
    async (q: string, m: SearchMode, page?: string) => {
      abortRef.current?.abort();
      if (!q.trim() && !page) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        setError('');
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError('');
      try {
        const res = await searchReferences(q, m, ctrl.signal, page);
        if (ctrl.signal.aborted) return;
        setResults((prev) => (page ? [...prev, ...res.cards] : res.cards));
        setTotal(res.total);
        setNextPage(res.hasMore ? res.nextPage : undefined);
        setSearched(true);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError((e as Error).message || 'Falha na busca.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = window.setTimeout(() => runSearch(query, mode), 450);
    return () => window.clearTimeout(t);
  }, [query, mode, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // carrega a versão localizada quando o usuário escolhe uma carta e o idioma não é inglês
  useEffect(() => {
    setLocalized(null);
    setLocState('idle');
    if (!selected || lang === 'en') return;
    const ctrl = new AbortController();
    setLocState('loading');
    fetchLocalizedPrint(selected, lang, ctrl.signal)
      .then((loc) => {
        if (ctrl.signal.aborted) return;
        if (loc && loc.id !== selected.id) {
          setLocalized(loc);
          setLocState('idle');
        } else if (loc && selected.lang === lang) {
          setLocState('idle');
        } else {
          setLocState('missing');
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLocState('missing');
      });
    return () => ctrl.abort();
  }, [selected, lang]);

  const effective = useMemo(() => (selected && localized ? mergeLocalized(selected, localized) : selected), [selected, localized]);
  const refFace: RefFace | null = effective ? effective.faces[Math.min(faceIndex, effective.faces.length - 1)] : null;

  const toggleField = (f: RefField) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const pick = (c: RefCard) => {
    setSelected(c);
    setShowDetail(true);
  };

  const canApply = purpose === 'new' ? Boolean(effective) : Boolean(effective) && fields.size > 0;

  const handleApply = () => {
    if (!effective) return;
    if (purpose === 'new') onCreate?.(effective);
    else onApply?.(effective, fields, rulesMode);
  };

  const isFlavorList = mode === 'flavor' || mode === 'flavorByName';

  const fieldPreview = (f: RefField): string => {
    if (!refFace || !effective) return '';
    switch (f) {
      case 'name':
        return refFace.name;
      case 'cost':
        return refFace.manaCost;
      case 'type':
        return refFace.typeLine;
      case 'rules':
        return refFace.oracleText;
      case 'pt':
        return refFace.loyalty ? `Lealdade ${refFace.loyalty}` : refFace.power || refFace.toughness ? `${refFace.power}/${refFace.toughness}` : '—';
      case 'flavor':
        return refFace.flavorText || '— (esta impressão não tem texto de sabor)';
      case 'art':
        return refFace.artCrop ? 'Arte desta impressão' : '—';
      case 'artist':
        return refFace.artist;
      case 'set':
        return `${effective.setName} (${effective.setCode}) · #${effective.collectorNumber} · ${effective.rarity}`;
      default:
        return '';
    }
  };

  const visibleFields: RefField[] =
    purpose === 'new' ? [] : purpose === 'flavor' ? (['flavor', 'artist', 'art'] as RefField[]) : ALL_REF_FIELDS;

  return (
    <Modal
      title={cfg.title}
      subtitle={cfg.subtitle}
      onClose={onClose}
      width={1040}
      className="cm-ref-modal"
      footer={
        <div className="cm-ref-footer">
          <div className="cm-ref-footer-info">
            {effective ? (
              <span>
                <strong>{effective.name}</strong> · {effective.setName}
              </span>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>Selecione uma carta da lista</span>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!canApply} onClick={handleApply}>
            <Check size={16} /> {cfg.cta}
          </button>
        </div>
      }
    >
      <div className="cm-ref-toolbar">
        <div className="cm-ref-search">
          <Search size={16} />
          <input
            ref={inputRef}
            className="input-text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={cfg.placeholder[mode] || 'Buscar…'}
            spellCheck={false}
          />
          {loading && <Loader2 size={16} className="cm-spin" />}
        </div>
        <Segmented size="sm" value={mode} onChange={setMode} options={modes} />
        <div className="cm-ref-lang" title="Idioma do texto copiado">
          <Languages size={14} />
          <Segmented
            size="sm"
            value={lang}
            onChange={setLang}
            options={[
              { id: 'pt', label: 'PT' },
              { id: 'en', label: 'EN' },
            ]}
          />
        </div>
      </div>
      <p className="cm-hint" style={{ margin: '2px 0 10px' }}>
        Dica: aceita a sintaxe do Scryfall (ex.: <code>t:goblin c:r</code>, <code>o:&quot;draw a card&quot;</code>).
      </p>

      <div className={`cm-ref-grid ${showDetail ? 'show-detail' : ''}`}>
        <div className="cm-ref-list">
          {error && (
            <div className="cm-notice cm-notice-error">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {!searched && !loading && !error && (
            <div className="cm-ref-empty">
              <Sparkles size={22} />
              <p>Digite para pesquisar no Scryfall.</p>
            </div>
          )}
          {searched && results.length === 0 && !loading && (
            <div className="cm-ref-empty">
              <p>Nenhum resultado para “{query}”.</p>
            </div>
          )}
          {results.map((c) => {
            const f = c.faces[0];
            const active = selected?.id === c.id;
            return (
              <button type="button" key={c.id} className={`cm-ref-item ${active ? 'is-active' : ''}`} onClick={() => pick(c)}>
                <img src={f.artCrop || f.image} alt="" loading="lazy" className="cm-ref-thumb" />
                <span className="cm-ref-item-body">
                  <span className="cm-ref-item-top">
                    <strong>{c.name}</strong>
                    {f.manaCost && <ManaCostRenderer manaCost={f.manaCost.split(' // ')[0]} />}
                  </span>
                  <span className="cm-ref-item-type">{c.faces.map((x) => x.typeLine).join(' // ')}</span>
                  <span className="cm-ref-item-text">
                    {isFlavorList ? (
                      <em>
                        “<Snippet text={c.faces.map((x) => x.flavorText).filter(Boolean).join(' / ')} />”
                      </em>
                    ) : (
                      <Snippet text={f.oracleText.replace(/\n/g, ' · ')} />
                    )}
                  </span>
                  <span className="cm-ref-item-set">
                    {c.setName} · {c.setCode}
                  </span>
                </span>
              </button>
            );
          })}
          {results.length > 0 && (
            <div className="cm-ref-more">
              <span>
                {results.length} de {total} resultados
              </span>
              {nextPage && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => runSearch(query, mode, nextPage)}>
                  Carregar mais
                </button>
              )}
            </div>
          )}
        </div>

        <div className="cm-ref-detail">
          <button type="button" className="btn btn-ghost btn-sm cm-ref-back" onClick={() => setShowDetail(false)}>
            <ArrowLeft size={14} /> Voltar à lista
          </button>
          {!effective || !refFace ? (
            <div className="cm-ref-empty">
              <p>Selecione um resultado para ver os detalhes.</p>
            </div>
          ) : (
            <>
              <div className="cm-ref-detail-top">
                <img src={refFace.image || refFace.artCrop} alt={effective.name} className="cm-ref-image" />
                <div className="cm-ref-detail-info">
                  <h3 className="font-display">{effective.name}</h3>
                  <p className="cm-ref-item-type">{refFace.typeLine}</p>
                  <p className="cm-hint">
                    {effective.setName} · {effective.setCode} #{effective.collectorNumber}
                    {refFace.artist && <> · Ilus. {refFace.artist}</>}
                  </p>
                  {lang !== 'en' && (
                    <p className={`cm-hint ${locState === 'missing' ? 'cm-hint-warn' : ''}`}>
                      {locState === 'loading' && 'Buscando versão em português…'}
                      {locState === 'missing' && 'Sem versão em português no Scryfall — usando o texto original.'}
                      {locState === 'idle' && effective.lang === 'pt' && 'Texto em português (versão oficial impressa).'}
                    </p>
                  )}
                </div>
              </div>

              {purpose !== 'new' && (
                <div className="cm-ref-fields">
                  <p className="cm-label">O que copiar</p>
                  {visibleFields.map((f) => (
                    <label key={f} className={`cm-check-row ${fields.has(f) ? 'is-on' : ''}`}>
                      <input type="checkbox" checked={fields.has(f)} onChange={() => toggleField(f)} />
                      <span className="cm-check-body">
                        <span className="cm-check-title">{REF_FIELD_LABELS[f]}</span>
                        <span className="cm-check-preview">
                          {f === 'cost' && refFace.manaCost ? <ManaCostRenderer manaCost={refFace.manaCost} /> : <Snippet text={fieldPreview(f)} max={200} />}
                        </span>
                      </span>
                    </label>
                  ))}
                  {fields.has('rules') && (
                    <div style={{ marginTop: 8 }}>
                      <Segmented
                        size="sm"
                        value={rulesMode}
                        onChange={setRulesMode}
                        options={[
                          { id: 'replace', label: 'Substituir regras atuais' },
                          { id: 'append', label: 'Acrescentar ao final' },
                        ]}
                      />
                    </div>
                  )}
                </div>
              )}
              {purpose === 'new' && (
                <div className="cm-ref-preview-text">
                  <p className="cm-label">Texto</p>
                  <pre>{refFace.oracleText || '—'}</pre>
                  {refFace.flavorText && (
                    <>
                      <p className="cm-label" style={{ marginTop: 8 }}>
                        Sabor
                      </p>
                      <pre style={{ fontStyle: 'italic' }}>{refFace.flavorText}</pre>
                    </>
                  )}
                  {effective.isDfc && <p className="cm-hint">Carta de dupla face: as duas faces serão importadas.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
