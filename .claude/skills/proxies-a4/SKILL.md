---
name: proxies-a4
description: Detalhes da impressão de proxies A4 (medidas, folha 3x3, marcas de corte, sangria, presets, PDF direto) no Proxy Studio. Use antes de alterar `ProxyStudio.tsx`, `proxyPdfService.ts` ou os estilos `.a4-*`.
---

# Proxies A4

- Carta **63 × 88 mm**, folha **A4 210 × 297 mm**, grade **3 × 3 = 9 por folha**, sem espaçamento; margens centralizadas (`.a4-page-sheet` em `src/index.css`). Não altere essas medidas sem testar a impressão (escala 100%, margens "nenhuma").
- Duas saídas: **impressão do navegador** (CSS `@media print`, `@page` A4) e **PDF direto** (`proxyPdfService.ts`, jsPDF). Mudou o layout? Atualize **as duas** e compare.
- Cartas de dupla face não separadas são expandidas em frente + verso na fila.
- Controles (estado local em `ProxyStudio.tsx`): linhas de corte (cor/espessura/estilo), marcas de enquadramento (cor/espessura/comprimento), réguas e cruzes, fundo da borda da carta (`black`/`white`/`none`), rodapé de metadados, recorte de sangria de arte MPC.
- **Presets** (`PRESETS` no componente): Guilhotina (padrão ao abrir), Estilete Manual, Minimalista, Econômico. O preset ativo é **derivado** dos valores atuais: ao adicionar um controle novo, inclua-o em `currentControls` e nos presets que o definem. Controles avançados começam **retraídos**.
- Imagens MPCFill (Google Drive) usam miniatura `=w400`/`=w1000` (`CardImage.tsx`); não baixe o original de 20 MB.
- Imagens embutidas (data URL) em proxies pesam no `localStorage` e na nuvem (limite ~1 MB) — evite.
- Teste visual: abrir a aba Proxies, conferir pré-visualização A4 (desktop e mobile, onde a folha usa `zoom`), e se possível "Baixar PDF Direto".
