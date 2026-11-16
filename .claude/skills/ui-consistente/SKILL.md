---
name: ui-consistente
description: Guia de consistência visual do Proliferate (tokens, botões, chips, listas, modais, mobile). Use ao criar ou alterar qualquer tela, componente ou estilo, para manter o site coeso.
---

# UI consistente

Fonte da verdade: `src/styles/base.css` (tokens em `:root`) e `mobile.css`. Tema grafite com âmbar `#ffbb00`.

## Regras
- Cores/espaços/raios: sempre variáveis (`--primary`, `--bg-surface`, `--bg-card`, `--border-subtle/medium`, `--text-main/muted/dim`, `--radius-md/lg`). Não crie hex novos, exceto estados (verde `#22c55e` completo, vermelho para perigo).
- **Um CTA primário** (`btn-primary`) por área; demais `btn-secondary`; ações discretas `btn-ghost`; destrutivas `btn-danger`. Tamanhos `btn-sm`/`btn-xs`; só ícone: `btn-icon` + `aria-label` + `title`. Nunca sobrescreva `padding`/`fontSize` de botão inline.
- Alvos de toque ≥ 36–42 px em telas de toque (já garantido em `.btn`).
- Alternadores: `.view-toggle` (ícones) ou `.cm-segmented`-estilo segmentado; filtros: `.chip`/`.btn-sm`.
- Cabeçalho de página: `glass-panel page-header-panel` + `section-eyebrow` + `page-title` + `page-subtitle`; estatísticas em `.stat-tiles`.
- Listas: linhas finas, informação principal à esquerda, ações à direita; esconder colunas secundárias em telas menores (classes `hide-sm`/`hide-md`) em vez de rolar na horizontal; ações sempre visíveis.
- Modais: `.modal-backdrop` + `.modal-container` (viram bottom sheet no mobile); use `useModalOverlay` (ESC e travar scroll).
- CSS novo: classes em `base.css`/`mobile.css` (prefixo por tela), não `style={{}}` inline.
- Texto da interface em **pt-BR**, curto e direto ("Imprimir", não "Imprimir Proxies").

## Checklist antes de entregar
Desktop e 375 px sem cortes ou sobreposição; barra inferior não cobre conteúdo (há padding no container); foco visível; sem erros no console. Use a skill `verificar-visual`.
