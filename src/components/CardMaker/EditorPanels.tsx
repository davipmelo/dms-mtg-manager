import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Clipboard,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Wand2,
  Check,
  Layers,
} from 'lucide-react';
import {
  BORDER_COLORS,
  CUSTOM_ICONS,
  CardFaceData,
  CardLayout,
  CardMeta,
  CustomCard,
  FRAME_COLORS,
  FRAME_STYLES,
  FrameColor,
  KEYWORDS,
  LANGUAGES,
  LAYOUTS,
  RARITIES,
  SYMBOL_PALETTE,
  TYPE_CHIPS,
  abilitiesToText,
  chaptersToText,
  colorsInManaCost,
  detectFrameColors,
  keywordText,
  normalizeManaCost,
  parsePlaneswalkerText,
  parseSagaText,
  romanNumeral,
  uid,
} from '../../services/cardMaker/model';
import { RenderReport, renderThumb } from '../../services/cardMaker/renderer';
import { compressImageFile } from '../../services/imageUtils';
import { UserAsset, deleteAsset, listAssets, saveAsset } from '../../services/cardMaker/storage';
import { Field, Segmented, SymbolButton, Toggle, useDebounced } from './ui';
import { ManaCostRenderer } from '../Common/ManaCostRenderer';

export interface PanelProps {
  card: CustomCard;
  face: CardFaceData;
  faceIndex: number;
  updateFace: (patch: Partial<CardFaceData>, group?: string) => void;
  updateMeta: (patch: Partial<CardMeta>, group?: string) => void;
  report: RenderReport | null;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const COLOR_SWATCH: Record<FrameColor, string> = {
  W: '#f4efd2',
  U: '#4f9fcb',
  B: '#4a4340',
  R: '#d4634a',
  G: '#4c9a69',
  M: '#d6b252',
  A: '#9aaab6',
  L: '#a08a63',
  C: '#b3b7bb',
};

/* ------------------------------------------------------------------ */
/* Campo de texto rico (símbolos + palavras-chave)                      */
/* ------------------------------------------------------------------ */

interface RichTextFieldProps {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  symbols?: boolean;
  keywordLang?: 'pt' | 'en';
  onSearch?: () => void;
  searchLabel?: string;
  hint?: React.ReactNode;
  extra?: React.ReactNode;
}

export const RichTextField: React.FC<RichTextFieldProps> = ({ label, value, onChange, rows = 5, placeholder, symbols, keywordLang, onSearch, searchLabel, hint, extra }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState<'none' | 'sym' | 'kw'>('none');
  const [reminder, setReminder] = useState(true);

  const insert = (text: string) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? s;
    const next = value.slice(0, s) + text + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(s + text.length, s + text.length);
    });
  };

  const insertKeyword = (text: string) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length;
    const before = value.slice(0, s);
    const needsBreak = before.length > 0 && !before.endsWith('\n');
    insert((needsBreak ? '\n' : '') + text);
  };

  return (
    <Field
      label={label}
      hint={hint}
      action={
        <div className="cm-field-tools">
          {symbols && (
            <button type="button" className={`cm-tool-btn ${open === 'sym' ? 'is-active' : ''}`} onClick={() => setOpen(open === 'sym' ? 'none' : 'sym')}>
              {'{ }'} Símbolos
            </button>
          )}
          {keywordLang && (
            <button type="button" className={`cm-tool-btn ${open === 'kw' ? 'is-active' : ''}`} onClick={() => setOpen(open === 'kw' ? 'none' : 'kw')}>
              <Wand2 size={12} /> Palavras-chave
            </button>
          )}
          {onSearch && (
            <button type="button" className="cm-tool-btn cm-tool-accent" onClick={onSearch}>
              <Search size={12} /> {searchLabel || 'Pesquisar'}
            </button>
          )}
        </div>
      }
    >
      {open === 'sym' && (
        <div className="cm-popover">
          {SYMBOL_PALETTE.map((s) => (
            <SymbolButton key={s.sym} sym={s.sym} label={s.label} onClick={() => insert(s.sym)} />
          ))}
          <SymbolButton sym="—" label="Travessão" onClick={() => insert('—')} />
          <SymbolButton sym="•" label="Marcador" onClick={() => insert('• ')} />
          <SymbolButton sym="−" label="Menos" onClick={() => insert('−')} />
        </div>
      )}
      {open === 'kw' && keywordLang && (
        <div className="cm-popover cm-popover-kw">
          <label className="cm-inline-check" style={{ width: '100%' }}>
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> Incluir texto lembrete
          </label>
          {KEYWORDS.map((k) => (
            <button key={k.id} type="button" className="chip" onClick={() => insertKeyword(keywordText(k, keywordLang, reminder))}>
              {(keywordLang === 'pt' ? k.pt : k.en).name}
            </button>
          ))}
        </div>
      )}
      <textarea ref={ref} className="textarea-field cm-textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} spellCheck />
      {extra}
    </Field>
  );
};

/* ------------------------------------------------------------------ */
/* Painel: Carta                                                        */
/* ------------------------------------------------------------------ */

const COST_QUICK = ['{W}', '{U}', '{B}', '{R}', '{G}', '{C}', '{X}', '{1}', '{2}', '{3}', '{W/U}', '{2/W}'];

export const ContentPanel: React.FC<
  PanelProps & { onAddFace: () => void; onRemoveFace: () => void }
> = ({ card, face, faceIndex, updateFace, updateMeta, onAddFace, onRemoveFace }) => {
  const lang = card.meta.language;
  const detected = detectFrameColors(face, card.meta.multiStyle);

  const changeLayout = (next: CardLayout) => {
    if (next === face.layout) return;
    const patch: Partial<CardFaceData> = { layout: next };
    if (next === 'planeswalker') {
      if (face.abilities.length === 0 && face.rulesText.trim()) {
        patch.abilities = parsePlaneswalkerText(face.rulesText);
        patch.rulesText = '';
      } else if (face.abilities.length === 0) {
        patch.abilities = [{ id: uid('ab'), cost: '+1', text: '' }];
      }
      if (!face.typeLine.trim()) patch.typeLine = lang === 'pt' ? 'Planeswalker — ' : 'Planeswalker — ';
    } else if (next === 'saga') {
      if (face.chapters.length === 0 && face.rulesText.trim()) {
        const { chapters, rest } = parseSagaText(face.rulesText);
        if (chapters.length) {
          patch.chapters = chapters;
          patch.rulesText = rest;
        }
      }
      if (face.chapters.length === 0 && !patch.chapters) {
        patch.chapters = [
          { id: uid('ch'), marks: 'I', text: '' },
          { id: uid('ch'), marks: 'II', text: '' },
          { id: uid('ch'), marks: 'III', text: '' },
        ];
      }
      if (!face.typeLine.trim()) patch.typeLine = lang === 'pt' ? 'Encantamento — Saga' : 'Enchantment — Saga';
    } else {
      if (face.layout === 'planeswalker' && face.abilities.length && !face.rulesText.trim()) patch.rulesText = abilitiesToText(face.abilities);
      if (face.layout === 'saga' && face.chapters.length) {
        patch.rulesText = [face.rulesText.trim(), chaptersToText(face.chapters)].filter(Boolean).join('\n');
      }
    }
    updateFace(patch);
  };

  const toggleColor = (c: FrameColor) => {
    const base = face.autoColor ? [...detected] : [...face.colors];
    const single = c === 'M' || c === 'A' || c === 'L' || c === 'C';
    let next: FrameColor[];
    if (single) next = base.length === 1 && base[0] === c ? [] : [c];
    else {
      const cleaned = base.filter((x) => 'WUBRG'.includes(x));
      next = cleaned.includes(c) ? cleaned.filter((x) => x !== c) : [...cleaned, c].slice(-2);
    }
    updateFace({ autoColor: false, colors: next });
  };

  const activeColors = face.autoColor ? detected : face.colors;
  const showMulti = face.autoColor
    ? colorsInManaCost(face.manaCost).length === 2
    : face.colors.length === 2 && face.colors.every((c) => 'WUBRG'.includes(c));

  return (
    <div className="cm-panel-stack">
      {card.faces.length === 1 ? (
        <button type="button" className="cm-add-face" onClick={onAddFace}>
          <Layers size={15} /> Transformar em carta de dupla face
        </button>
      ) : (
        <button type="button" className="cm-add-face is-danger" onClick={onRemoveFace}>
          <Trash2 size={15} /> Remover {faceIndex === 0 ? 'frente (o verso vira a carta)' : 'o verso'}
        </button>
      )}

      <Field label="Modelo de carta">
        <div className="cm-layout-grid">
          {LAYOUTS.map((l) => (
            <button type="button" key={l.id} className={`cm-layout-opt ${face.layout === l.id ? 'is-active' : ''}`} onClick={() => changeLayout(l.id)}>
              <strong>{l.label}</strong>
              <span>{l.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nome">
        <input className="input-text" value={face.name} onChange={(e) => updateFace({ name: e.target.value }, 'name')} placeholder="Nome da carta" maxLength={60} />
      </Field>

      {face.layout !== 'token' && (
        <Field label="Custo de mana" hint="Digite {2}{W}{U} ou apenas 2WU — o símbolo é montado automaticamente.">
          <div className="cm-cost-row">
            <input
              className="input-text"
              value={face.manaCost}
              onChange={(e) => updateFace({ manaCost: e.target.value }, 'cost')}
              onBlur={() => face.manaCost && updateFace({ manaCost: normalizeManaCost(face.manaCost) })}
              placeholder="{2}{W}{U}"
              spellCheck={false}
            />
            <span className="cm-cost-preview">
              <ManaCostRenderer manaCost={normalizeManaCost(face.manaCost)} />
            </span>
          </div>
          <div className="cm-chip-row">
            {COST_QUICK.map((s) => (
              <SymbolButton key={s} sym={s} onClick={() => updateFace({ manaCost: normalizeManaCost(face.manaCost) + s })} />
            ))}
            <button type="button" className="cm-tool-btn" onClick={() => updateFace({ manaCost: '' })} disabled={!face.manaCost}>
              <RotateCcw size={12} /> Limpar
            </button>
          </div>
        </Field>
      )}

      <Field label="Linha de tipo">
        <input className="input-text" value={face.typeLine} onChange={(e) => updateFace({ typeLine: e.target.value }, 'type')} placeholder="Criatura — Humano Guerreiro" maxLength={80} />
        <div className="cm-chip-row">
          {TYPE_CHIPS[lang].map((c) => (
            <button
              type="button"
              key={c.label}
              className="chip"
              onClick={() => {
                const cur = face.typeLine;
                const sep = cur && !cur.endsWith(' ') && !c.insert.startsWith(' ') ? ' ' : '';
                updateFace({ typeLine: c.insert.includes('—') && cur.includes('—') ? cur : cur + sep + c.insert });
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      {face.layout === 'planeswalker' ? (
        <Field label="Lealdade inicial">
          <input className="input-text cm-narrow" value={face.loyalty} onChange={(e) => updateFace({ loyalty: e.target.value }, 'pt')} placeholder="4" maxLength={3} />
        </Field>
      ) : face.layout !== 'saga' ? (
        <Field label="Poder / Resistência" hint="Deixe os dois vazios para ocultar o quadro (feitiços, terrenos…). Aceita * e X.">
          <div className="cm-pt-row">
            <input className="input-text" value={face.power} onChange={(e) => updateFace({ power: e.target.value }, 'pt')} placeholder="3" maxLength={3} />
            <span>/</span>
            <input className="input-text" value={face.toughness} onChange={(e) => updateFace({ toughness: e.target.value }, 'pt')} placeholder="4" maxLength={3} />
          </div>
        </Field>
      ) : null}

      <Field
        label="Cor da moldura"
        action={
          <button type="button" className={`cm-tool-btn ${face.autoColor ? 'is-active' : ''}`} onClick={() => updateFace({ autoColor: !face.autoColor, colors: face.autoColor ? detected : [] })}>
            <Wand2 size={12} /> Automática
          </button>
        }
        hint={face.autoColor ? 'Detectada pelo custo de mana e pelo tipo. Toque em uma cor para ajustar manualmente.' : 'Até duas cores básicas formam um degradê ou ouro; escolha Artefato, Terreno ou Incolor para cores especiais.'}
      >
        <div className="cm-color-row">
          {FRAME_COLORS.map((c) => {
            const on = activeColors.includes(c.id);
            return (
              <button type="button" key={c.id} className={`cm-color-chip ${on ? 'is-active' : ''}`} onClick={() => toggleColor(c.id)} title={c.label} aria-pressed={on}>
                <span className="cm-color-dot" style={{ background: COLOR_SWATCH[c.id] }} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
        {showMulti && (
          <div style={{ marginTop: 10 }}>
            <Segmented
              size="sm"
              value={card.meta.multiStyle}
              onChange={(v) => updateMeta({ multiStyle: v })}
              options={[
                { id: 'gold', label: 'Ouro (multicolor)' },
                { id: 'gradient', label: 'Degradê (híbrida)' },
              ]}
            />
          </div>
        )}
      </Field>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Painel: Texto                                                        */
/* ------------------------------------------------------------------ */

export const TextPanel: React.FC<PanelProps & { onSearchRules: () => void; onSearchFlavor: () => void }> = ({
  card,
  face,
  updateFace,
  report,
  onSearchRules,
  onSearchFlavor,
}) => {
  const lang = card.meta.language;

  const moveItem = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <div className="cm-panel-stack">
      {report && !report.textFits && (
        <div className="cm-notice cm-notice-warn">
          <AlertTriangle size={15} /> O texto é longo demais para a caixa, mesmo com a fonte no tamanho mínimo. Encurte as regras ou o sabor.
        </div>
      )}

      {face.layout === 'planeswalker' ? (
        <Field
          label="Habilidades de lealdade"
          action={
            <div className="cm-field-tools">
              <button type="button" className="cm-tool-btn cm-tool-accent" onClick={onSearchRules}>
                <Search size={12} /> Copiar de carta
              </button>
            </div>
          }
        >
          <div className="cm-list">
            {face.abilities.map((a, i) => (
              <div key={a.id} className="cm-list-row">
                <div className="cm-list-row-head">
                  <input
                    className="input-text cm-cost-input"
                    value={a.cost}
                    onChange={(e) => updateFace({ abilities: face.abilities.map((x) => (x.id === a.id ? { ...x, cost: e.target.value } : x)) }, 'ability-cost')}
                    placeholder="+1"
                    maxLength={4}
                    aria-label="Custo de lealdade"
                  />
                  <div className="cm-chip-row" style={{ flex: 1 }}>
                    {['+1', '+2', '0', '−1', '−2', '−3', '−X'].map((c) => (
                      <button key={c} type="button" className={`chip ${a.cost === c ? 'is-active' : ''}`} onClick={() => updateFace({ abilities: face.abilities.map((x) => (x.id === a.id ? { ...x, cost: c } : x)) })}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="cm-row-actions">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ abilities: moveItem(face.abilities, i, -1) })} disabled={i === 0} aria-label="Subir">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ abilities: moveItem(face.abilities, i, 1) })} disabled={i === face.abilities.length - 1} aria-label="Descer">
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ abilities: face.abilities.filter((x) => x.id !== a.id) })} aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <RichTextField
                  label=""
                  value={a.text}
                  rows={2}
                  symbols
                  keywordLang={lang}
                  placeholder="Texto da habilidade"
                  onChange={(v) => updateFace({ abilities: face.abilities.map((x) => (x.id === a.id ? { ...x, text: v } : x)) }, `ability-${a.id}`)}
                />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={face.abilities.length >= 5} onClick={() => updateFace({ abilities: [...face.abilities, { id: uid('ab'), cost: '−1', text: '' }] })}>
            <Plus size={14} /> Adicionar habilidade
          </button>
        </Field>
      ) : (
        <RichTextField
          label={face.layout === 'saga' ? 'Texto lembrete da Saga (opcional)' : 'Texto de regras'}
          value={face.rulesText}
          rows={face.layout === 'saga' ? 2 : 7}
          symbols
          keywordLang={lang}
          placeholder={face.layout === 'saga' ? '(À medida que esta Saga entra…)' : 'Voar\nQuando esta criatura entrar no campo de batalha, compre um card.'}
          onChange={(v) => updateFace({ rulesText: v }, 'rules')}
          onSearch={face.layout === 'saga' ? undefined : onSearchRules}
          searchLabel="Copiar de carta"
          hint="Cada linha é um parágrafo. O que estiver entre parênteses vira texto lembrete em itálico."
        />
      )}

      {face.layout === 'saga' && (
        <Field
          label="Capítulos"
          action={
            <div className="cm-field-tools">
              <button type="button" className="cm-tool-btn cm-tool-accent" onClick={onSearchRules}>
                <Search size={12} /> Copiar de carta
              </button>
            </div>
          }
        >
          <div className="cm-list">
            {face.chapters.map((c, i) => (
              <div key={c.id} className="cm-list-row">
                <div className="cm-list-row-head">
                  <input
                    className="input-text cm-cost-input"
                    value={c.marks}
                    onChange={(e) => updateFace({ chapters: face.chapters.map((x) => (x.id === c.id ? { ...x, marks: e.target.value } : x)) }, 'chapter-marks')}
                    placeholder="I"
                    maxLength={14}
                    aria-label="Numeral do capítulo"
                  />
                  <span className="cm-hint" style={{ flex: 1 }}>
                    Use vírgula para capítulos combinados (ex.: II, III)
                  </span>
                  <div className="cm-row-actions">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ chapters: moveItem(face.chapters, i, -1) })} disabled={i === 0} aria-label="Subir">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ chapters: moveItem(face.chapters, i, 1) })} disabled={i === face.chapters.length - 1} aria-label="Descer">
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => updateFace({ chapters: face.chapters.filter((x) => x.id !== c.id) })} aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <RichTextField
                  label=""
                  value={c.text}
                  rows={2}
                  symbols
                  keywordLang={lang}
                  placeholder="Efeito do capítulo"
                  onChange={(v) => updateFace({ chapters: face.chapters.map((x) => (x.id === c.id ? { ...x, text: v } : x)) }, `chapter-${c.id}`)}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            disabled={face.chapters.length >= 5}
            onClick={() => updateFace({ chapters: [...face.chapters, { id: uid('ch'), marks: romanNumeral(face.chapters.length + 1), text: '' }] })}
          >
            <Plus size={14} /> Adicionar capítulo
          </button>
        </Field>
      )}

      {face.layout !== 'planeswalker' && face.layout !== 'saga' && (
        <RichTextField
          label="Texto de sabor"
          value={face.flavorText}
          rows={3}
          placeholder="“Uma frase marcante do mundo da carta.”"
          onChange={(v) => updateFace({ flavorText: v }, 'flavor')}
          onSearch={onSearchFlavor}
          searchLabel="Copiar sabor"
          extra={
            <div className="cm-chip-row">
              <button type="button" className="cm-tool-btn" onClick={() => updateFace({ flavorText: `“${face.flavorText.replace(/^[“"]|[”"]$/g, '')}”` })} disabled={!face.flavorText}>
                <Quote size={12} /> Adicionar aspas
              </button>
              <button type="button" className="cm-tool-btn" onClick={() => updateFace({ flavorText: face.flavorText.replace(/\s*$/, '') + '\n— ' })}>
                — Autor
              </button>
              <button type="button" className="cm-tool-btn" onClick={() => updateFace({ flavorText: '' })} disabled={!face.flavorText}>
                <RotateCcw size={12} /> Limpar
              </button>
            </div>
          }
        />
      )}

      <Field label={`Tamanho do texto — ${face.textScale === 1 ? 'automático' : Math.round(face.textScale * 100) + '%'}`} hint="No automático a fonte é a maior que cabe na caixa. Reduza para deixar mais respiro.">
        <input type="range" min={0.6} max={1.2} step={0.02} value={face.textScale} onChange={(e) => updateFace({ textScale: Number(e.target.value) }, 'textScale')} className="cm-range" />
      </Field>

      {face.layout !== 'planeswalker' && face.layout !== 'saga' && (
        <>
          <Field label="Alinhamento">
            <Segmented
              size="sm"
              value={face.textAlign}
              onChange={(v) => updateFace({ textAlign: v })}
              options={[
                { id: 'left', label: 'Esquerda' },
                { id: 'center', label: 'Centralizado' },
              ]}
            />
          </Field>
          <Toggle checked={face.hideTextBox} onChange={(v) => updateFace({ hideTextBox: v })} label="Ocultar caixa de texto" hint="A arte cresce e ocupa o espaço (cartas só de arte)." />
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Painel: Arte                                                         */
/* ------------------------------------------------------------------ */

export const ArtPanel: React.FC<
  PanelProps & {
    artAdjust: boolean;
    setArtAdjust: (v: boolean) => void;
    onOpenArtSearch: () => void;
    setArtFromFile: (file: File) => Promise<void>;
  }
> = ({ face, updateFace, report, artAdjust, setArtAdjust, onOpenArtSearch, setArtFromFile, onToast }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const art = face.art;
  const hasArt = Boolean(art.src);

  const updateArt = (patch: Partial<typeof art>, group?: string) => updateFace({ art: { ...art, ...patch } }, group || 'art');

  const loadUrl = () => {
    const u = url.trim();
    if (!u) return;
    setLoadingUrl(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadingUrl(false);
      updateFace({ art: { ...art, src: u, zoom: 1, px: 0.5, py: 0.5, origin: 'url' } });
      setUrl('');
      onToast('Arte carregada do link.', 'success');
    };
    img.onerror = () => {
      setLoadingUrl(false);
      onToast('Não foi possível carregar a imagem. O site de origem precisa permitir uso externo (CORS) — prefira enviar o arquivo.', 'error');
    };
    img.src = u;
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await setArtFromFile(new File([blob], 'colado.png', { type }));
          return;
        }
      }
      onToast('Nenhuma imagem encontrada na área de transferência.', 'info');
    } catch {
      onToast('Use Ctrl+V / ⌘V com o editor aberto para colar uma imagem.', 'info');
    }
  };

  return (
    <div className="cm-panel-stack">
      <div
        className={`cm-dropzone ${drag ? 'is-over' : ''} ${hasArt ? 'has-art' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void setArtFromFile(f);
        }}
      >
        {hasArt ? (
          <img src={art.src} alt="Arte atual" className="cm-dropzone-thumb" />
        ) : (
          <div className="cm-dropzone-empty">
            <ImagePlus size={26} />
            <strong>Arraste uma imagem aqui</strong>
            <span>ou use as opções abaixo</span>
          </div>
        )}
      </div>

      <div className="cm-btn-grid">
        <button type="button" className="btn btn-primary" onClick={onOpenArtSearch}>
          <Search size={15} /> Buscar no Scryfall
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Enviar arquivo
        </button>
        <button type="button" className="btn btn-secondary" onClick={pasteFromClipboard}>
          <Clipboard size={15} /> Colar imagem
        </button>
        <button type="button" className="btn btn-secondary" disabled={!hasArt} onClick={() => updateFace({ art: { ...art, src: '', origin: undefined } })}>
          <Trash2 size={15} /> Remover
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void setArtFromFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <Field label="Ou cole o link de uma imagem">
        <div className="cm-url-row">
          <input className="input-text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadUrl()} placeholder="https://…/arte.jpg" />
          <button type="button" className="btn btn-secondary" onClick={loadUrl} disabled={!url.trim() || loadingUrl}>
            {loadingUrl ? <Loader2 size={15} className="cm-spin" /> : <Link2 size={15} />} Usar
          </button>
        </div>
      </Field>

      <Field label="Artista (crédito)">
        <input className="input-text" value={face.artist} onChange={(e) => updateFace({ artist: e.target.value }, 'artist')} placeholder="Nome do artista" maxLength={50} />
      </Field>

      {hasArt && (
        <>
          {report && report.artUpscale > 1.6 && (
            <div className="cm-notice cm-notice-warn">
              <AlertTriangle size={15} /> A arte está ampliada {report.artUpscale.toFixed(1)}× e pode ficar pixelada na impressão. Use uma imagem maior ou reduza o zoom.
            </div>
          )}
          <Toggle checked={artAdjust} onChange={setArtAdjust} label="Ajustar arte direto na carta" hint="Arraste para mover; role a roda do mouse ou use pinça para dar zoom." />
          <Field label={`Zoom — ${Math.round(art.zoom * 100)}%`}>
            <input type="range" min={0.5} max={4} step={0.01} value={art.zoom} onChange={(e) => updateFace({ art: { ...art, zoom: Number(e.target.value) } }, 'art-zoom')} className="cm-range" />
          </Field>
          <div className="cm-two-col">
            <Field label="Posição horizontal">
              <input type="range" min={0} max={1} step={0.005} value={art.px} onChange={(e) => updateFace({ art: { ...art, px: Number(e.target.value) } }, 'art-px')} className="cm-range" />
            </Field>
            <Field label="Posição vertical">
              <input type="range" min={0} max={1} step={0.005} value={art.py} onChange={(e) => updateFace({ art: { ...art, py: Number(e.target.value) } }, 'art-py')} className="cm-range" />
            </Field>
          </div>
          <div className="cm-two-col">
            <Field label={`Brilho — ${art.brightness}%`}>
              <input type="range" min={50} max={150} value={art.brightness} onChange={(e) => updateFace({ art: { ...art, brightness: Number(e.target.value) } }, 'art-b')} className="cm-range" />
            </Field>
            <Field label={`Contraste — ${art.contrast}%`}>
              <input type="range" min={50} max={150} value={art.contrast} onChange={(e) => updateFace({ art: { ...art, contrast: Number(e.target.value) } }, 'art-c')} className="cm-range" />
            </Field>
          </div>
          <Field label={`Saturação — ${art.saturation}%`}>
            <input type="range" min={0} max={200} value={art.saturation} onChange={(e) => updateFace({ art: { ...art, saturation: Number(e.target.value) } }, 'art-s')} className="cm-range" />
          </Field>
          <div className="cm-chip-row">
            <button type="button" className={`chip ${art.flipX ? 'is-active' : ''}`} onClick={() => updateArt({ flipX: !art.flipX }, 'flip')}>
              Espelhar horizontalmente
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => updateFace({ art: { ...art, zoom: 1, px: 0.5, py: 0.5, brightness: 100, contrast: 100, saturation: 100, flipX: false } })}
            >
              <RotateCcw size={12} /> Redefinir ajustes
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Painel: Visual                                                       */
/* ------------------------------------------------------------------ */

const FrameThumb: React.FC<{ card: CustomCard; faceIndex: number; styleId: CardMeta['frameStyle']; active: boolean; onClick: () => void; label: string; description: string }> = ({ card, faceIndex, styleId, active, onClick, label, description }) => {
  const [src, setSrc] = useState('');
  const debounced = useDebounced(card, 450);
  useEffect(() => {
    let alive = true;
    const sample: CustomCard = {
      ...debounced,
      meta: { ...debounced.meta, frameStyle: styleId },
      faces: [debounced.faces[Math.min(faceIndex, debounced.faces.length - 1)]],
    };
    renderThumb(sample, 190)
      .then((u) => alive && setSrc(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [debounced, styleId, faceIndex]);
  return (
    <button type="button" className={`cm-frame-opt ${active ? 'is-active' : ''}`} onClick={onClick} title={description}>
      <span className="cm-frame-thumb">{src ? <img src={src} alt={label} /> : <Loader2 size={16} className="cm-spin" />}</span>
      <strong>{label}</strong>
      {active && (
        <span className="cm-frame-check">
          <Check size={12} />
        </span>
      )}
    </button>
  );
};


/* ------------------------------------------------------------------ */
/* Fontes e frames próprios (arquivos do usuário)                       */
/* ------------------------------------------------------------------ */

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });

const AssetsSection: React.FC<{ card: CustomCard; updateMeta: PanelProps['updateMeta']; onToast: PanelProps['onToast'] }> = ({ card, updateMeta, onToast }) => {
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const m = card.meta;

  const refresh = () => listAssets().then(setAssets).catch(() => undefined);
  useEffect(() => {
    void refresh();
  }, []);

  const fonts = assets.filter((a) => a.kind === 'font');
  const frames = assets.filter((a) => a.kind === 'frame');

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const isFont = FONT_EXT.test(file.name);
        if (!isFont && !file.type.startsWith('image/')) throw new Error(`“${file.name}” não é fonte (.ttf, .otf, .woff) nem imagem.`);
        const data = await readAsDataUrl(file);
        const asset: UserAsset = {
          id: uid('asset'),
          kind: isFont ? 'font' : 'frame',
          name: file.name.replace(/\.[^.]+$/, ''),
          data,
          createdAt: new Date().toISOString(),
        };
        await saveAsset(asset);
        onToast(`${isFont ? 'Fonte' : 'Frame'} “${asset.name}” adicionado.`, 'success');
      } catch (e) {
        onToast((e as Error).message, 'error');
      }
    }
    void refresh();
  };

  const remove = async (a: UserAsset) => {
    await deleteAsset(a.id);
    const patch: Partial<CardMeta> = {};
    if (m.titleFontId === a.id) patch.titleFontId = '';
    if (m.bodyFontId === a.id) patch.bodyFontId = '';
    if (m.customFrameId === a.id) patch.customFrameId = '';
    if (Object.keys(patch).length) updateMeta(patch);
    void refresh();
  };

  return (
    <Field
      label="Fontes e frames originais"
      hint="Use arquivos que você já possui (por exemplo fontes como Beleren e MPlantin, ou imagens de frame com janela transparente para a arte). Ficam guardados só neste navegador e não são incluídos no projeto .json."
    >
      <div className="cm-asset-grid">
        <label className="cm-asset-pick">
          <span>Fonte do título</span>
          <select className="select-field" value={m.titleFontId} onChange={(e) => updateMeta({ titleFontId: e.target.value })}>
            <option value="">Padrão do estilo</option>
            {fonts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-asset-pick">
          <span>Fonte do texto</span>
          <select className="select-field" value={m.bodyFontId} onChange={(e) => updateMeta({ bodyFontId: e.target.value })}>
            <option value="">Padrão do estilo</option>
            {fonts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-asset-pick cm-asset-wide">
          <span>Frame personalizado (imagem sobre a carta)</span>
          <select className="select-field" value={m.customFrameId} onChange={(e) => updateMeta({ customFrameId: e.target.value })}>
            <option value="">Nenhum — usar o estilo acima</option>
            {frames.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {m.customFrameId && (
        <Toggle checked={m.frameTextLight} onChange={(v) => updateMeta({ frameTextLight: v })} label="Texto claro no frame" hint="Ative para frames escuros. O texto segue o layout Moderno (arte 628×458 em 744×1039)." />
      )}
      <div className="cm-chip-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Adicionar fonte ou frame
        </button>
        <input ref={fileRef} type="file" hidden multiple accept=".ttf,.otf,.woff,.woff2,image/*" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {assets.length > 0 && (
        <div className="cm-asset-list">
          {assets.map((a) => (
            <span key={a.id} className="cm-asset-chip">
              {a.kind === 'font' ? 'Aa' : '▭'} {a.name}
              <button type="button" aria-label={`Remover ${a.name}`} onClick={() => remove(a)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
};

export const VisualPanel: React.FC<PanelProps> = ({ card, faceIndex, updateMeta, onToast }) => {
  const m = card.meta;
  return (
    <div className="cm-panel-stack">
      <Field label="Estilo de moldura" hint={FRAME_STYLES.find((f) => f.id === m.frameStyle)?.description}>
        <div className="cm-frame-grid">
          {FRAME_STYLES.map((f) => (
            <FrameThumb key={f.id} card={card} faceIndex={faceIndex} styleId={f.id} active={m.frameStyle === f.id} label={f.label} description={f.description} onClick={() => updateMeta({ frameStyle: f.id })} />
          ))}
        </div>
      </Field>

      {m.frameStyle !== 'borderless' && (
        <Field label="Cor da borda">
          <div className="cm-color-row">
            {BORDER_COLORS.map((b) => (
              <button type="button" key={b.id} className={`cm-color-chip ${m.borderColor === b.id ? 'is-active' : ''}`} onClick={() => updateMeta({ borderColor: b.id })}>
                <span className="cm-color-dot" style={{ background: b.hex }} />
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Acabamento">
        <Segmented
          value={m.foil}
          onChange={(v) => updateMeta({ foil: v })}
          options={[
            { id: 'none', label: 'Normal' },
            { id: 'foil', label: 'Foil' },
            { id: 'etched', label: 'Etched' },
          ]}
        />
      </Field>

      <AssetsSection card={card} updateMeta={updateMeta} onToast={onToast} />

      <div className="cm-toggle-stack">
        <Toggle checked={m.holoStamp} onChange={(v) => updateMeta({ holoStamp: v })} label="Selo holográfico" hint="Aparece em cartas raras, míticas e especiais" />
        <Toggle checked={m.legendCrown} onChange={(v) => updateMeta({ legendCrown: v })} label="Coroa de lendária" hint="Moldura Moderno + tipo “Lendária” / “Legendary”" />
        <Toggle checked={m.showFooter} onChange={(v) => updateMeta({ showFooter: v })} label="Mostrar rodapé" hint="Número, edição, idioma, artista e aviso" />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Painel: Edição                                                       */
/* ------------------------------------------------------------------ */

export const EditionPanel: React.FC<PanelProps & { onOpenSetPicker: () => void }> = ({ card, updateMeta, onOpenSetPicker }) => {
  const m = card.meta;
  return (
    <div className="cm-panel-stack">
      <Field label="Edição" hint="Escolha uma edição real do Magic para usar o símbolo oficial, ou defina a sua própria.">
        <button type="button" className="cm-set-current" onClick={onOpenSetPicker}>
          {m.iconMode === 'set' && m.setIconUri ? <img src={m.setIconUri} alt="" className="cm-set-icon" /> : <BookOpen size={20} />}
          <span>
            <strong>{m.setName || 'Sem nome'}</strong>
            <small>{m.setCode || '—'}</small>
          </span>
          <Search size={15} style={{ marginLeft: 'auto' }} />
        </button>
      </Field>

      <div className="cm-two-col">
        <Field label="Código da edição">
          <input className="input-text" value={m.setCode} onChange={(e) => updateMeta({ setCode: e.target.value.toUpperCase().slice(0, 5) }, 'setCode')} placeholder="CUS" />
        </Field>
        <Field label="Nome da edição">
          <input className="input-text" value={m.setName} onChange={(e) => updateMeta({ setName: e.target.value }, 'setName')} placeholder="Minha Edição" maxLength={50} />
        </Field>
      </div>

      <Field label="Símbolo da edição">
        <Segmented
          value={m.iconMode}
          onChange={(v) => updateMeta({ iconMode: v })}
          options={[
            { id: 'set', label: 'Da edição', title: 'Símbolo oficial do Scryfall' },
            { id: 'custom', label: 'Personalizado' },
            { id: 'none', label: 'Nenhum' },
          ]}
        />
        {m.iconMode === 'set' && !m.setIconUri && <p className="cm-hint cm-hint-warn">Escolha uma edição acima para carregar o símbolo.</p>}
        {m.iconMode === 'custom' && (
          <div className="cm-chip-row" style={{ marginTop: 10 }}>
            {CUSTOM_ICONS.map((i) => (
              <button key={i.id} type="button" className={`chip ${m.customIcon === i.id ? 'is-active' : ''}`} onClick={() => updateMeta({ customIcon: i.id })}>
                {i.label}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Raridade">
        <div className="cm-color-row">
          {RARITIES.map((r) => (
            <button type="button" key={r.id} className={`cm-color-chip ${m.rarity === r.id ? 'is-active' : ''}`} onClick={() => updateMeta({ rarity: r.id })}>
              <span className="cm-color-dot" style={{ background: r.color, boxShadow: r.id === 'common' ? 'inset 0 0 0 1px #666' : undefined }} />
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="cm-two-col">
        <Field label="Número da carta">
          <input className="input-text" value={m.collectorNumber} onChange={(e) => updateMeta({ collectorNumber: e.target.value.slice(0, 5) }, 'cn')} placeholder="001" />
        </Field>
        <Field label="Total da edição">
          <input className="input-text" value={m.collectorTotal} onChange={(e) => updateMeta({ collectorTotal: e.target.value.slice(0, 5) }, 'ct')} placeholder="280" />
        </Field>
      </div>

      <Field label="Idioma da carta" hint="Afeta o rodapé e as sugestões de tipos e palavras-chave.">
        <Segmented value={m.language} onChange={(v) => updateMeta({ language: v })} options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} />
      </Field>

      <Field label="Aviso de copyright / rodapé">
        <input className="input-text" value={m.copyright} onChange={(e) => updateMeta({ copyright: e.target.value }, 'cp')} placeholder="Carta customizada · Não oficial" maxLength={60} />
      </Field>
    </div>
  );
};
