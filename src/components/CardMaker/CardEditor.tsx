import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  FlipHorizontal2,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Palette,
  Redo2,
  ScrollText,
  Stamp,
  Type,
  Undo2,
  X,
  BookMarked,
  Move,
} from 'lucide-react';
import {
  CardFaceData,
  CardIndexEntry,
  CardMeta,
  CustomCard,
  cardTitle,
  createBlankFace,
} from '../../services/cardMaker/model';
import { RenderReport, renderThumb, renderToCanvas } from '../../services/cardMaker/renderer';
import { saveCard } from '../../services/cardMaker/storage';
import { RefCard, RefField, applyRefToCard, setIconUrl } from '../../services/cardMaker/scryfallRef';
import { compressImageFile } from '../../services/imageUtils';
import { CardPreview } from './CardPreview';
import { ArtPanel, ContentPanel, EditionPanel, TextPanel, VisualPanel, PanelProps } from './EditorPanels';
import { ArtSearchModal, SetPicker } from './Pickers';
import { ReferenceModal, ReferencePurpose } from './ReferenceModal';
import { ExportModal, ProxySendItem } from './ExportModal';

/* ------------------------------------------------------------------ */
/* Histórico (desfazer / refazer) com agrupamento de digitação          */
/* ------------------------------------------------------------------ */

interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
}

function useHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({ present: initial, past: [], future: [] });
  const ref = useRef(state);
  const group = useRef<{ key: string; t: number } | null>(null);

  const commit = (next: HistoryState<T>) => {
    ref.current = next;
    setState(next);
  };

  const update = useCallback((updater: (prev: T) => T, key?: string) => {
    const s = ref.current;
    const next = updater(s.present);
    if (next === s.present) return;
    const now = Date.now();
    const merge = Boolean(key && group.current && group.current.key === key && now - group.current.t < 1500);
    group.current = key ? { key, t: now } : null;
    if (merge) commit({ present: next, past: s.past, future: [] });
    else commit({ present: next, past: [...s.past.slice(-79), s.present], future: [] });
  }, []);

  const undo = useCallback(() => {
    const s = ref.current;
    if (s.past.length === 0) return;
    group.current = null;
    commit({ present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future] });
  }, []);

  const redo = useCallback(() => {
    const s = ref.current;
    if (s.future.length === 0) return;
    group.current = null;
    commit({ present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1) });
  }, []);

  return { card: state.present, update, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

/* ------------------------------------------------------------------ */

type TabId = 'content' | 'text' | 'art' | 'visual' | 'edition';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Carta', icon: <Type size={15} /> },
  { id: 'text', label: 'Texto', icon: <ScrollText size={15} /> },
  { id: 'art', label: 'Arte', icon: <ImageIcon size={15} /> },
  { id: 'visual', label: 'Visual', icon: <Palette size={15} /> },
  { id: 'edition', label: 'Edição', icon: <BookMarked size={15} /> },
];

interface CardEditorProps {
  initial: CustomCard;
  /** true quando a carta ainda não existe na biblioteca (grava logo ao abrir) */
  isNew: boolean;
  onBack: () => void;
  onSaved: (entry: CardIndexEntry) => void;
  onSendToProxies?: (items: ProxySendItem[]) => void;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export const CardEditor: React.FC<CardEditorProps> = ({ initial, isNew, onBack, onSaved, onSendToProxies, onToast }) => {
  const { card, update, undo, redo, canUndo, canRedo } = useHistory<CustomCard>(initial);
  const [faceIndex, setFaceIndex] = useState(0);
  const [tab, setTab] = useState<TabId>('content');
  const [artAdjust, setArtAdjust] = useState(false);
  const [report, setReport] = useState<RenderReport | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [modal, setModal] = useState<null | 'set' | 'art' | 'export' | ReferencePurpose>(null);
  const [lightbox, setLightbox] = useState<string>('');
  const [lightboxBusy, setLightboxBusy] = useState(false);

  const face: CardFaceData = card.faces[Math.min(faceIndex, card.faces.length - 1)];
  const safeFaceIndex = Math.min(faceIndex, card.faces.length - 1);

  /* ---------------- atualizações ---------------- */
  const updateFace = useCallback(
    (patch: Partial<CardFaceData>, group?: string) => {
      update((prev) => {
        const idx = Math.min(safeFaceIndex, prev.faces.length - 1);
        const faces = prev.faces.map((f, i) => (i === idx ? { ...f, ...patch } : f));
        return { ...prev, faces };
      }, group ? `${group}:${safeFaceIndex}` : undefined);
    },
    [update, safeFaceIndex]
  );

  const updateMeta = useCallback(
    (patch: Partial<CardMeta>, group?: string) => {
      update((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }), group ? `meta:${group}` : undefined);
    },
    [update]
  );

  const handleArtChange = useCallback(
    (patch: { px?: number; py?: number; zoom?: number }) => {
      update((prev) => {
        const idx = Math.min(safeFaceIndex, prev.faces.length - 1);
        const faces = prev.faces.map((f, i) => (i === idx ? { ...f, art: { ...f.art, ...patch } } : f));
        return { ...prev, faces };
      }, `art-drag:${safeFaceIndex}`);
    },
    [update, safeFaceIndex]
  );

  /* ---------------- autosave ---------------- */
  const firstRun = useRef(true);
  const latest = useRef(card);
  latest.current = card;
  const saveTimer = useRef<number | null>(null);
  const savingRef = useRef(false);

  const pendingRef = useRef(false);

  const persist = useCallback(async function run(): Promise<void> {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveState('saving');
    const source = latest.current;
    try {
      const snapshot = { ...source, updatedAt: new Date().toISOString() };
      const thumb = await renderThumb(snapshot, 280);
      const entry = await saveCard(snapshot, thumb);
      onSaved(entry);
      setSaveState(latest.current === source ? 'saved' : 'dirty');
    } catch (e) {
      console.error('Card Maker: falha ao salvar', e);
      setSaveState('error');
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void run();
      }
    }
  }, [onSaved]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      // cartas novas são gravadas logo na abertura para aparecerem na biblioteca
      if (isNew) void persist();
      return;
    }
    setSaveState('dirty');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(), 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [card, persist]);

  // grava pendências quando o editor é desmontado (ex.: troca de aba do app)
  useEffect(
    () => () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void persist();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // grava ao sair da aba/janela
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void persist();
      }
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [persist]);

  const handleBack = async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await persist();
    }
    onBack();
  };

  /* ---------------- atalhos ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  /* ---------------- arte: arquivo / colar ---------------- */
  const setArtFromFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await compressImageFile(file, 2200, 2200, 0.9);
        updateFace({ art: { ...face.art, src: dataUrl, zoom: 1, px: 0.5, py: 0.5, flipX: false, origin: 'upload' } });
        onToast('Arte aplicada.', 'success');
      } catch (e) {
        onToast((e as Error).message || 'Não foi possível ler a imagem.', 'error');
      }
    },
    [face.art, updateFace, onToast]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void setArtFromFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [setArtFromFile]);

  /* ---------------- faces ---------------- */
  const addFace = () => {
    update((prev) => {
      if (prev.faces.length >= 2) return prev;
      const back = createBlankFace('standard');
      back.name = '';
      back.autoColor = true;
      return { ...prev, faces: [...prev.faces, back] };
    });
    setFaceIndex(1);
    setTab('content');
    onToast('Verso criado — preencha os dados da segunda face.', 'info');
  };

  const removeFace = () => {
    update((prev) => {
      if (prev.faces.length < 2) return prev;
      return { ...prev, faces: prev.faces.filter((_, i) => i !== safeFaceIndex) };
    });
    setFaceIndex(0);
  };

  /* ---------------- referência (regras/sabor) ---------------- */
  const applyReference = (ref: RefCard, fields: Set<RefField>, rulesMode: 'replace' | 'append') => {
    update((prev) => applyRefToCard(prev, safeFaceIndex, ref, fields, { rulesMode }));
    setModal(null);
    onToast(`Dados de “${ref.name}” aplicados.`, 'success');
  };

  /* ---------------- tela cheia ---------------- */
  const openLightbox = async () => {
    setLightboxBusy(true);
    setLightbox('pending');
    try {
      const { canvas } = await renderToCanvas(card, safeFaceIndex, { scale: 1.6, bleed: 0, rounded: true });
      setLightbox(canvas.toDataURL('image/png'));
    } catch {
      setLightbox('');
    } finally {
      setLightboxBusy(false);
    }
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox('');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const panelProps: PanelProps = useMemo(
    () => ({ card, face, faceIndex: safeFaceIndex, updateFace, updateMeta, report, onToast }),
    [card, face, safeFaceIndex, updateFace, updateMeta, report, onToast]
  );

  const faceTabs = card.faces.length > 1;

  return (
    <div className="cm-editor">
      <div className="cm-editor-bar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleBack}>
          <ArrowLeft size={15} /> Biblioteca
        </button>
        <div className="cm-editor-title">
          <strong>{cardTitle(card)}</strong>
          <span className={`cm-save-state is-${saveState}`}>
            {saveState === 'saving' && (
              <>
                <Loader2 size={12} className="cm-spin" /> Salvando…
              </>
            )}
            {saveState === 'saved' && (
              <>
                <Check size={12} /> Salvo
              </>
            )}
            {saveState === 'dirty' && <>Alterações pendentes…</>}
            {saveState === 'error' && (
              <>
                <CloudOff size={12} /> Erro ao salvar
              </>
            )}
          </span>
        </div>
        <div className="cm-editor-bar-actions">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
            <Undo2 size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
            <Redo2 size={16} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('export')}>
            <Download size={15} /> <span className="cm-hide-sm">Exportar</span>
          </button>
        </div>
      </div>

      <div className="cm-editor-grid">
        <aside className="cm-stage">
          <div className="cm-stage-inner">
            {faceTabs && (
              <div className="cm-face-tabs" role="tablist">
                {card.faces.map((f, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === safeFaceIndex} className={`cm-face-tab ${i === safeFaceIndex ? 'is-active' : ''}`} onClick={() => setFaceIndex(i)}>
                    {i === 0 ? 'Frente' : 'Verso'}
                    <small>{f.name || '—'}</small>
                  </button>
                ))}
              </div>
            )}
            <CardPreview card={card} faceIndex={safeFaceIndex} artAdjust={artAdjust} onArtChange={handleArtChange} onReport={setReport} onClick={openLightbox} />
            <div className="cm-stage-tools">
              <button type="button" className={`cm-stage-btn ${artAdjust ? 'is-active' : ''}`} onClick={() => { setArtAdjust(!artAdjust); }} disabled={!face.art.src} title={face.art.src ? 'Ajustar arte na carta' : 'Adicione uma arte primeiro'}>
                <Move size={15} /> <span>{artAdjust ? 'Concluir ajuste' : 'Ajustar arte'}</span>
              </button>
              {faceTabs && (
                <button type="button" className="cm-stage-btn" onClick={() => setFaceIndex((safeFaceIndex + 1) % card.faces.length)}>
                  <FlipHorizontal2 size={15} /> <span>Virar</span>
                </button>
              )}
              <button type="button" className="cm-stage-btn" onClick={openLightbox} title="Ver em tela cheia">
                <Maximize2 size={15} /> <span>Ampliar</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="cm-panel glass-panel">
          <div className="cm-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`cm-tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="cm-panel-body" key={`${tab}-${safeFaceIndex}`}>
            {tab === 'content' && <ContentPanel {...panelProps} onAddFace={addFace} onRemoveFace={removeFace} />}
            {tab === 'text' && <TextPanel {...panelProps} onSearchRules={() => setModal('rules')} onSearchFlavor={() => setModal('flavor')} />}
            {tab === 'art' && <ArtPanel {...panelProps} artAdjust={artAdjust} setArtAdjust={setArtAdjust} onOpenArtSearch={() => setModal('art')} setArtFromFile={setArtFromFile} />}
            {tab === 'visual' && <VisualPanel {...panelProps} />}
            {tab === 'edition' && <EditionPanel {...panelProps} onOpenSetPicker={() => setModal('set')} />}
            <div className="cm-panel-extra">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal('import')}>
                <Stamp size={14} /> Importar dados de uma carta existente
              </button>
            </div>
          </div>
        </section>
      </div>

      {modal === 'set' && (
        <SetPicker
          currentCode={card.meta.setCode}
          onClose={() => setModal(null)}
          onPick={(s) => {
            updateMeta({ setCode: s.code, setName: s.name, setIconUri: s.iconUri || setIconUrl(s.code), iconMode: 'set' });
            setModal(null);
          }}
        />
      )}
      {modal === 'art' && (
        <ArtSearchModal
          onClose={() => setModal(null)}
          onPick={(ref, copyArtist) => {
            const rf = ref.faces[0];
            updateFace({
              art: { ...face.art, src: rf.artCrop, zoom: 1, px: 0.5, py: 0.5, flipX: false, origin: 'scryfall' },
              ...(copyArtist && rf.artist ? { artist: rf.artist } : {}),
            });
            setModal(null);
            onToast(`Arte de “${ref.name}” aplicada.`, 'success');
          }}
        />
      )}
      {(modal === 'rules' || modal === 'flavor' || modal === 'import') && (
        <ReferenceModal purpose={modal} faceIndex={safeFaceIndex} defaultLang={card.meta.language} onClose={() => setModal(null)} onApply={applyReference} />
      )}
      {modal === 'export' && <ExportModal card={card} initialFace={safeFaceIndex} onClose={() => setModal(null)} onSendToProxies={onSendToProxies} onToast={onToast} />}

      {lightbox && (
        <div className="modal-backdrop cm-lightbox" onClick={() => setLightbox('')}>
          <button type="button" className="btn btn-secondary btn-icon cm-lightbox-close" aria-label="Fechar" onClick={() => setLightbox('')}>
            <X size={18} />
          </button>
          {lightboxBusy || lightbox === 'pending' ? <Loader2 size={30} className="cm-spin" /> : <img src={lightbox} alt={face.name || 'Carta'} className="cm-lightbox-img" />}
        </div>
      )}
    </div>
  );
};
