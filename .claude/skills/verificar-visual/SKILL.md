---
name: verificar-visual
description: Verifica visualmente uma mudança de UI no Proliferate (desktop e mobile 375px), rodando tipos, testes e build. Use depois de qualquer alteração de layout, estilo ou componente.
---

# Verificar mudança visual

1. `npx tsc --noEmit -p .` e `npm test` — corrija qualquer erro antes de seguir.
2. Suba o app com `preview_start` (`name: "dev"`). Nunca rode o dev server via Bash.
3. Navegue até a aba afetada (os botões do menu têm `data-tab`: `decks`, `collection`, `utilities`, `proxies`). Aguarde ~2 s pela animação `page-enter` antes de capturar.
4. Capture **desktop** (largura padrão) e **mobile** (`resize_window` preset `mobile`, 375 px). Cheque: nada cortado ou sobreposto, botões consistentes (um único `btn-primary` por área), textos legíveis, ações visíveis, barra inferior não cobre conteúdo.
5. Verifique o console (`read_console_messages`, só erros; ignore falhas do WebSocket do HMR) e, se mexeu em imagens/rede, `read_network_requests`.
6. Volte o viewport para `desktop` e pare o servidor com `preview_stop`.
7. Rode `npm run build`. Reporte o que foi verificado e o que **não** foi.
