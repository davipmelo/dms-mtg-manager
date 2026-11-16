import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { CustomCard } from '../../services/cardMaker/model';
import {
  CARD_H,
  CARD_W,
  RenderAssets,
  RenderReport,
  drawCard,
  getArtRect,
  loadRenderAssets,
} from '../../services/cardMaker/renderer';

const PREVIEW_SCALE = 1.5;

interface CardPreviewProps {
  card: CustomCard;
  faceIndex: number;
  /** quando true, arrastar sobre a arte move; roda do mouse / pinça dá zoom */
  artAdjust: boolean;
  onArtChange?: (patch: { px?: number; py?: number; zoom?: number }) => void;
  onReport?: (r: RenderReport) => void;
  onClick?: () => void;
  className?: string;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ card, faceIndex, artAdjust, onArtChange, onReport, onClick, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const assetsRef = useRef<RenderAssets>({ art: null, icon: null });
  const deferred = useDeferredValue(card);
  const [ready, setReady] = useState(false);
  const cardRef = useRef(card);
  cardRef.current = card;
  const reportRef = useRef(onReport);
  reportRef.current = onReport;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assets = await loadRenderAssets(deferred, faceIndex);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      assetsRef.current = assets;
      const report = drawCard(ctx, deferred, faceIndex, assets, { scale: PREVIEW_SCALE, bleed: 0, rounded: true });
      reportRef.current?.(report);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [deferred, faceIndex]);

  /* ---------------- tilt 3D (apenas mouse, fora do modo ajuste) ---------------- */
  const onTiltMove = (e: React.PointerEvent) => {
    if (artAdjust || e.pointerType !== 'mouse') return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    wrap.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
    wrap.style.setProperty('--ry', `${((x - 0.5) * 11).toFixed(2)}deg`);
    wrap.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    wrap.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    wrap.classList.add('is-tilting');
  };
  const onTiltLeave = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.style.setProperty('--rx', '0deg');
    wrap.style.setProperty('--ry', '0deg');
    wrap.classList.remove('is-tilting');
  };

  /* ---------------- arrastar / zoom da arte ---------------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const toCardX = (clientX: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * CARD_W;
  };
  const toCardY = (clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return ((clientY - r.top) / r.height) * CARD_H;
  };

  const overflowFor = () => {
    const c = cardRef.current;
    const face = c.faces[faceIndex] || c.faces[0];
    const img = assetsRef.current.art;
    if (!img) return null;
    const rect = getArtRect(c, faceIndex);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s = Math.max(rect.w / iw, rect.h / ih) * face.art.zoom;
    return { ox: iw * s - rect.w, oy: ih * s - rect.h, rect, face };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!artAdjust || !onArtChange) return;
    const rect = getArtRect(cardRef.current, faceIndex);
    const cx = toCardX(e.clientX);
    const cy = toCardY(e.clientY);
    const inside = cx >= rect.x - 6 && cx <= rect.x + rect.w + 6 && cy >= rect.y - 6 && cy <= rect.y + rect.h + 6;
    if (!inside && pointers.current.size === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    draggingRef.current = true;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    onTiltMove(e);
    if (!artAdjust || !onArtChange || !pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const info = overflowFor();
    if (!info) return;
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / pinchRef.current;
      pinchRef.current = dist;
      onArtChange({ zoom: Math.min(4, Math.max(0.5, info.face.art.zoom * ratio)) });
      return;
    }
    const r = canvasRef.current!.getBoundingClientRect();
    const k = CARD_W / r.width;
    const dx = (e.clientX - prev.x) * k;
    const dy = (e.clientY - prev.y) * k;
    const patch: { px?: number; py?: number } = {};
    if (Math.abs(info.ox) > 1) patch.px = Math.min(1, Math.max(0, info.face.art.px - dx / info.ox));
    if (Math.abs(info.oy) > 1) patch.py = Math.min(1, Math.max(0, info.face.art.py - dy / info.oy));
    onArtChange(patch);
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
    if (pointers.current.size === 0) draggingRef.current = false;
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !artAdjust || !onArtChange) return;
    const onWheel = (e: WheelEvent) => {
      const rect = getArtRect(cardRef.current, faceIndex);
      const cx = toCardX(e.clientX);
      const cy = toCardY(e.clientY);
      if (cx < rect.x || cx > rect.x + rect.w || cy < rect.y || cy > rect.y + rect.h) return;
      e.preventDefault();
      const face = cardRef.current.faces[faceIndex] || cardRef.current.faces[0];
      onArtChange({ zoom: Math.min(4, Math.max(0.5, face.art.zoom * Math.exp(-e.deltaY * 0.0015))) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artAdjust, faceIndex, onArtChange]);

  return (
    <div
      ref={wrapRef}
      className={`cm-preview ${artAdjust ? 'is-adjusting' : ''} ${ready ? 'is-ready' : ''} ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onTiltLeave}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="cm-preview-tilt">
        <canvas
          ref={canvasRef}
          width={Math.round(CARD_W * PREVIEW_SCALE)}
          height={Math.round(CARD_H * PREVIEW_SCALE)}
          className="cm-preview-canvas"
          onClick={() => {
            if (!artAdjust) onClick?.();
          }}
          aria-label="Pré-visualização da carta"
        />
        <div className="cm-preview-glare" />
        {artAdjust && <div className="cm-preview-adjust-hint">Arraste para mover · role ou use pinça para zoom</div>}
      </div>
    </div>
  );
};
