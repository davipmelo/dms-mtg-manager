import React, { useState } from 'react';
import { DeckTag, Deck } from '../../types';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import { X, Tag, Plus, Trash2, Edit2, Check, Palette } from 'lucide-react';

export const TAG_COLOR_PRESETS = [
  { label: 'Vermelho', color: '#ef4444' },
  { label: 'Laranja', color: '#f97316' },
  { label: 'Âmbar', color: '#f59e0b' },
  { label: 'Esmeralda', color: '#10b981' },
  { label: 'Ciano', color: '#06b6d4' },
  { label: 'Azul', color: '#3b82f6' },
  { label: 'Roxo', color: '#8b5cf6' },
  { label: 'Rosa', color: '#ec4899' },
  { label: 'Carmesim', color: '#e11d48' },
  { label: 'Cinza', color: '#64748b' },
];

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: DeckTag[];
  onUpdateTags: (tags: DeckTag[]) => void;
  decks: Deck[];
  onUpdateDecks: (decks: Deck[]) => void;
}

export const ManageTagsModal: React.FC<ManageTagsModalProps> = ({
  isOpen,
  onClose,
  tags,
  onUpdateTags,
  decks,
  onUpdateDecks,
}) => {
  useModalOverlay(isOpen, onClose);

  // New tag state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // Edit tag state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  if (!isOpen) return null;

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    // Check duplicate name
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Já existe uma tag com esse nome.');
      return;
    }

    const newTag: DeckTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: trimmed,
      color: newTagColor,
    };

    onUpdateTags([...tags, newTag]);
    setNewTagName('');
  };

  const handleStartEdit = (tag: DeckTag) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setEditingColor(tag.color);
  };

  const handleSaveEdit = (tagId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    if (tags.some((t) => t.id !== tagId && t.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Já existe outra tag com esse nome.');
      return;
    }

    const updatedTags = tags.map((t) =>
      t.id === tagId ? { ...t, name: trimmed, color: editingColor } : t
    );
    onUpdateTags(updatedTags);
    setEditingTagId(null);
  };

  const handleDeleteTag = (tag: DeckTag) => {
    const count = decks.filter((d) => d.tags?.includes(tag.id) || d.tags?.includes(tag.name)).length;
    const confirmMsg =
      count > 0
        ? `A tag "${tag.name}" está aplicada em ${count} ${count === 1 ? 'deck' : 'decks'}. Deseja realmente excluí-la? Ela será removida desses decks.`
        : `Deseja realmente excluir a tag "${tag.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    const remainingTags = tags.filter((t) => t.id !== tag.id);
    onUpdateTags(remainingTags);

    // Remove from all decks
    const updatedDecks = decks.map((d) => {
      if (!d.tags) return d;
      const nextTags = d.tags.filter((idOrName) => idOrName !== tag.id && idOrName !== tag.name);
      return { ...d, tags: nextTags, updatedAt: new Date().toISOString() };
    });
    onUpdateDecks(updatedDecks);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#0d111a',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 187, 0, 0.12)',
                border: '1px solid rgba(255, 187, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffbb00',
              }}
            >
              <Tag size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Gerenciar Tags de Decks
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Crie e personalize tags com suas cores favoritas para organizar seus decks.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Create New Tag Box */}
          <form
            onSubmit={handleCreateTag}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} className="text-amber-400" /> Criar Nova Tag
            </span>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Nome da tag (ex: Competitivo, Tribal, Em Construção)..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                maxLength={30}
                style={{ flex: 1 }}
              />

              {/* Tag Preview */}
              {newTagName.trim() && (
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: newTagColor,
                    backgroundColor: `${newTagColor}20`,
                    border: `1px solid ${newTagColor}60`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: newTagColor,
                    }}
                  />
                  {newTagName.trim()}
                </div>
              )}
            </div>

            {/* Color Palette Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '6px' }}>
                Escolha a cor da tag:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {TAG_COLOR_PRESETS.map((p) => {
                  const isSelected = newTagColor.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setNewTagColor(p.color)}
                      title={p.label}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: isSelected ? `0 0 10px ${p.color}` : 'none',
                        transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.15s ease',
                      }}
                    />
                  );
                })}

                {/* Custom Color Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    title="Cor personalizada"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                  <Palette size={14} className="text-slate-400" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!newTagName.trim()}
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
            >
              <Plus size={15} /> Adicionar Tag
            </button>
          </form>

          {/* Existing Tags List */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '10px' }}>
              Tags Cadastradas ({tags.length})
            </h3>

            {tags.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                Nenhuma tag cadastrada ainda. Crie sua primeira tag acima!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tags.map((tag) => {
                  const deckCount = decks.filter(
                    (d) => d.tags?.includes(tag.id) || d.tags?.includes(tag.name)
                  ).length;
                  const isEditing = editingTagId === tag.id;

                  return (
                    <div
                      key={tag.id}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="input-text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            maxLength={30}
                            style={{ flex: 1, minWidth: '140px', padding: '4px 8px', fontSize: '0.85rem' }}
                            autoFocus
                          />
                          <input
                            type="color"
                            value={editingColor}
                            onChange={(e) => setEditingColor(e.target.value)}
                            title="Cor"
                            style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveEdit(tag.id)}
                            style={{ padding: '4px 10px' }}
                          >
                            <Check size={14} /> Salvar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditingTagId(null)}
                            style={{ padding: '4px 8px' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: tag.color,
                                backgroundColor: `${tag.color}22`,
                                border: `1px solid ${tag.color}66`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: tag.color,
                                }}
                              />
                              {tag.name}
                            </div>

                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              onClick={() => handleStartEdit(tag)}
                              title="Editar tag"
                              style={{ padding: '5px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon text-red-400"
                              onClick={() => handleDeleteTag(tag)}
                              title="Excluir tag"
                              style={{ padding: '5px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
