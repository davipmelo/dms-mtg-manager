import React, { useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Download,
  FileDown,
  FileUp,
  Loader2,
  PenTool,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { CardIndexEntry, FRAME_STYLES, RARITIES } from '../../services/cardMaker/model';

type SortKey = 'recent' | 'name' | 'rarity' | 'created';

const RARITY_ORDER: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3, special: 4 };

interface CardLibraryProps {
  entries: CardIndexEntry[];
  loading: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onSendToProxies: (ids: string[]) => Promise<void>;
  onExportProject: (ids: string[]) => Promise<void>;
  onImportProject: (file: File) => Promise<void>;
  busy: boolean;
}

const rarityBadge = (id: string) => {
  const r = RARITIES.find((x) => x.id === id);
  const cls = id === 'mythic' ? 'badge-rarity-mythic' : id === 'rare' ? 'badge-rarity-rare' : id === 'uncommon' ? 'badge-rarity-uncommon' : 'badge-rarity-common';
  return <span className={`badge ${cls}`}>{r?.label || id}</span>;
};

export const CardLibrary: React.FC<CardLibraryProps> = ({ entries, loading, onNew, onOpen, onDuplicate, onExport, onDelete, onSendToProxies, onExportProject, onImportProject, busy }) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => !q || e.name.toLowerCase().includes(q) || e.typeLine.toLowerCase().includes(q) || e.setCode.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'rarity') sorted.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || a.name.localeCompare(b.name, 'pt-BR'));
    else if (sort === 'created') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted;
  }, [entries, query, sort]);

  const sets = new Set(entries.map((e) => e.setCode)).size;
  const faces = entries.reduce((n, e) => n + e.faceCount, 0);
  const lastUpdated = entries[0]?.updatedAt ? new Date(entries[0].updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const selectedIds = [...selected];

  return (
    <div className="cm-library">
      <div className="glass-panel page-header-panel cm-hero">
        <div className="cm-hero-row">
          <div>
            <span className="section-eyebrow">
              <PenTool size={12} /> Cartas customizadas
            </span>
            <h2 className="page-title">Card Maker</h2>
            <p className="page-subtitle">
              Crie cartas do zero ou a partir de cartas reais: escolha frames, arte, edição e raridade, escreva suas próprias regras (ou copie as de qualquer carta) e exporte para imprimir no Proxy Studio.
            </p>
          </div>
          <div className="cm-hero-actions">
            <button type="button" className="btn btn-primary" onClick={onNew}>
              <Plus size={16} /> Nova carta
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileUp size={16} /> <span className="cm-btn-label">Importar</span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onExportProject([])} disabled={busy || entries.length === 0}>
              <FileDown size={16} /> <span className="cm-btn-label">Exportar</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportProject(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="stat-tiles">
          <div className="stat-tile is-primary">
            <span className="stat-tile-label">Cartas</span>
            <span className="stat-tile-value">{entries.length}</span>
            <span className="stat-tile-hint">{faces} {faces === 1 ? 'face' : 'faces'} no total</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-label">Edições</span>
            <span className="stat-tile-value">{sets}</span>
            <span className="stat-tile-hint">códigos distintos usados</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-label">Última edição</span>
            <span className="stat-tile-value" style={{ fontSize: '1.25rem' }}>{lastUpdated}</span>
            <span className="stat-tile-hint">salvo automaticamente neste navegador</span>
          </div>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="cm-lib-toolbar">
          <div className="cm-ref-search">
            <Search size={16} />
            <input className="input-text" placeholder="Buscar por nome, tipo ou edição…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select-field cm-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar">
            <option value="recent">Mais recentes</option>
            <option value="created">Mais antigas</option>
            <option value="name">Nome (A–Z)</option>
            <option value="rarity">Raridade</option>
          </select>
          <button type="button" className={`btn btn-sm ${selectMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
            {selectMode ? <X size={14} /> : <CheckSquare size={14} />} {selectMode ? 'Cancelar' : 'Selecionar'}
          </button>
        </div>
      )}

      {selectMode && (
        <div className="cm-select-bar">
          <span>
            <strong>{selected.size}</strong> selecionada{selected.size === 1 ? '' : 's'}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set(visible.map((v) => v.id)))}>
            Todas
          </button>
          <span className="cm-select-spacer" />
          <button type="button" className="btn btn-highlight btn-sm" disabled={selected.size === 0 || busy} onClick={() => onSendToProxies(selectedIds).then(exitSelect)}>
            {busy ? <Loader2 size={14} className="cm-spin" /> : <Printer size={14} />} Proxy Studio
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={selected.size === 0 || busy} onClick={() => onExportProject(selectedIds)}>
            <Download size={14} /> Projeto
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={selected.size === 0 || busy}
            onClick={() => {
              onDelete(selectedIds);
              exitSelect();
            }}
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}

      {loading ? (
        <div className="cm-lib-loading">
          <Loader2 className="cm-spin" size={22} /> Carregando biblioteca…
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-panel empty-state cm-empty">
          <div className="empty-state-icon">
            <Wand2 size={32} />
          </div>
          <h3 className="font-display" style={{ fontSize: '1.3rem', marginTop: 18 }}>
            Sua primeira carta começa aqui
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '8px auto 20px', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Comece de um modelo (criatura, feitiço, planeswalker, saga, ficha…) ou parta de uma carta real do Scryfall e mude o que quiser.
          </p>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            <Sparkles size={16} /> Criar carta
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="cm-lib-loading">Nenhuma carta encontrada para “{query}”.</div>
      ) : (
        <div className="cm-lib-grid">
          {visible.map((e) => {
            const isSel = selected.has(e.id);
            return (
              <article key={e.id} className={`cm-lib-card ${isSel ? 'is-selected' : ''}`}>
                <button
                  type="button"
                  className="cm-lib-thumb"
                  onClick={() => (selectMode ? toggle(e.id) : onOpen(e.id))}
                  aria-label={selectMode ? `Selecionar ${e.name}` : `Editar ${e.name}`}
                >
                  {e.thumb ? <img src={e.thumb} alt={e.name} loading="lazy" /> : <span className="cm-lib-thumb-empty" />}
                  {selectMode && <span className={`cm-lib-check ${isSel ? 'is-on' : ''}`}>{isSel ? '✓' : ''}</span>}
                  {e.faceCount > 1 && <span className="cm-lib-dfc">Dupla face</span>}
                </button>
                <div className="cm-lib-info">
                  <strong title={e.name}>{e.name}</strong>
                  <span className="cm-lib-type">{e.typeLine || '—'}</span>
                  <div className="cm-lib-badges">
                    {rarityBadge(e.rarity)}
                    <span className="badge badge-primary">{e.setCode}</span>
                    <span className="cm-lib-style">{FRAME_STYLES.find((f) => f.id === e.frameStyle)?.label}</span>
                  </div>
                </div>
                {!selectMode && (
                  <div className="cm-lib-actions">
                    <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => onOpen(e.id)} title="Editar" aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => onDuplicate(e.id)} title="Duplicar" aria-label="Duplicar">
                      <Copy size={14} />
                    </button>
                    <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => onExport(e.id)} title="Exportar imagem" aria-label="Exportar imagem">
                      <Download size={14} />
                    </button>
                    <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => onDelete([e.id])} title="Excluir" aria-label="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
