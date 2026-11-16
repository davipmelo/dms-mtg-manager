import React, { useCallback, useEffect, useState } from 'react';
import { CardIndexEntry, CardTemplate, CustomCard, cardTitle, cloneCard, createBlankCard } from '../../services/cardMaker/model';
import { renderThumb, renderToCanvas } from '../../services/cardMaker/renderer';
import {
  buildProjectFile,
  deleteCards,
  getCard,
  getCards,
  listCardIndex,
  parseProjectFile,
  saveCard,
} from '../../services/cardMaker/storage';
import { RefCard, createCardFromRef } from '../../services/cardMaker/scryfallRef';
import { CardLibrary } from './CardLibrary';
import { CardEditor } from './CardEditor';
import { ExportModal, ProxySendItem } from './ExportModal';
import { ReferenceModal } from './ReferenceModal';
import { TemplateModal } from './Pickers';
import { ConfirmModal, ToastStack, downloadBlob, useToasts } from './ui';

interface CardMakerProps {
  onSendToProxies: (items: ProxySendItem[]) => void;
}

export const CardMaker: React.FC<CardMakerProps> = ({ onSendToProxies }) => {
  const [entries, setEntries] = useState<CardIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomCard | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFromExisting, setShowFromExisting] = useState(false);
  const [exportCard, setExportCard] = useState<CustomCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const { toasts, push } = useToasts();

  const refresh = useCallback(async () => {
    try {
      setEntries(await listCardIndex());
    } catch (e) {
      console.error(e);
      push('Não foi possível acessar o armazenamento local do navegador. Suas cartas não serão salvas.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertEntry = useCallback((entry: CardIndexEntry) => {
    setEntries((prev) => {
      const without = prev.filter((e) => e.id !== entry.id);
      return [entry, ...without].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }, []);

  const openCard = async (id: string) => {
    const card = await getCard(id);
    if (!card) {
      push('Carta não encontrada.', 'error');
      void refresh();
      return;
    }
    setEditingIsNew(false);
    setEditing(card);
    window.scrollTo({ top: 0 });
  };

  const startFromTemplate = (t: CardTemplate) => {
    setShowTemplates(false);
    setEditingIsNew(true);
    setEditing(t.build());
    window.scrollTo({ top: 0 });
  };

  const startFromRef = (ref: RefCard) => {
    setShowFromExisting(false);
    setShowTemplates(false);
    setEditingIsNew(true);
    setEditing(createCardFromRef(ref));
    window.scrollTo({ top: 0 });
    push(`Carta criada a partir de “${ref.name}”.`, 'success');
  };

  const duplicate = async (id: string) => {
    const card = await getCard(id);
    if (!card) return;
    const copy = cloneCard(card, true);
    copy.faces[0] = { ...copy.faces[0], name: `${copy.faces[0].name || 'Carta'} (cópia)` };
    const thumb = await renderThumb(copy, 280);
    upsertEntry(await saveCard(copy, thumb));
    push('Carta duplicada.', 'success');
  };

  const openExport = async (id: string) => {
    const card = await getCard(id);
    if (card) setExportCard(card);
  };

  const performDelete = async (ids: string[]) => {
    await deleteCards(ids);
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
    setConfirmDelete(null);
    push(ids.length === 1 ? 'Carta excluída.' : `${ids.length} cartas excluídas.`, 'success');
  };

  const sendManyToProxies = async (ids: string[]) => {
    setBusy(true);
    try {
      const cards = await getCards(ids);
      const items: ProxySendItem[] = [];
      for (const c of cards) {
        for (let i = 0; i < c.faces.length; i++) {
          const { canvas } = await renderToCanvas(c, i, { scale: 1, bleed: 0, rounded: false });
          items.push({
            name: c.faces[i].name || 'Carta customizada',
            typeLine: c.faces[i].typeLine,
            imageUrl: canvas.toDataURL('image/jpeg', 0.86),
            quantity: 1,
            setCode: c.meta.setCode,
            rarity: c.meta.rarity,
          });
        }
      }
      onSendToProxies(items);
      push(`${items.length} imagem${items.length === 1 ? '' : 'ns'} enviada${items.length === 1 ? '' : 's'} ao Proxy Studio.`, 'success');
    } catch (e) {
      push((e as Error).message || 'Falha ao enviar para o Proxy Studio.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportProject = async (ids: string[]) => {
    setBusy(true);
    try {
      const targets = ids.length > 0 ? ids : entries.map((e) => e.id);
      const cards = await getCards(targets);
      const blob = new Blob([JSON.stringify(buildProjectFile(cards))], { type: 'application/json' });
      downloadBlob(blob, `card-maker-${new Date().toISOString().slice(0, 10)}.json`);
      push(`${cards.length} carta${cards.length === 1 ? '' : 's'} exportada${cards.length === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
      push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const importProject = async (file: File) => {
    setBusy(true);
    try {
      const cards = parseProjectFile(await file.text());
      for (const c of cards) {
        const thumb = await renderThumb(c, 280);
        await saveCard(c, thumb);
      }
      await refresh();
      push(`${cards.length} carta${cards.length === 1 ? '' : 's'} importada${cards.length === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
      push((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <>
        <CardEditor
          key={editing.id}
          initial={editing}
          isNew={editingIsNew}
          onBack={() => {
            setEditing(null);
            void refresh();
          }}
          onSaved={upsertEntry}
          onSendToProxies={onSendToProxies}
          onToast={push}
        />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  return (
    <>
      <CardLibrary
        entries={entries}
        loading={loading}
        busy={busy}
        onNew={() => setShowTemplates(true)}
        onOpen={openCard}
        onDuplicate={duplicate}
        onExport={openExport}
        onDelete={(ids) => setConfirmDelete(ids)}
        onSendToProxies={sendManyToProxies}
        onExportProject={exportProject}
        onImportProject={importProject}
      />
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} onPick={startFromTemplate} onFromExisting={() => setShowFromExisting(true)} />}
      {showFromExisting && <ReferenceModal purpose="new" onClose={() => setShowFromExisting(false)} onCreate={startFromRef} />}
      {exportCard && <ExportModal card={exportCard} onClose={() => setExportCard(null)} onSendToProxies={onSendToProxies} onToast={push} />}
      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.length === 1 ? 'Excluir carta?' : `Excluir ${confirmDelete.length} cartas?`}
          message={
            confirmDelete.length === 1
              ? `“${entries.find((e) => e.id === confirmDelete[0])?.name || cardTitle(createBlankCard())}” será removida definitivamente deste navegador. Exporte o projeto antes se quiser um backup.`
              : 'As cartas selecionadas serão removidas definitivamente deste navegador. Exporte o projeto antes se quiser um backup.'
          }
          confirmLabel="Excluir"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => void performDelete(confirmDelete)}
        />
      )}
      <ToastStack toasts={toasts} />
    </>
  );
};
