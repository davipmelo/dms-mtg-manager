---
name: desempenho-imagens
description: Boas práticas de desempenho do Proliferate para imagens, listas longas e carregamento. Use ao adicionar miniaturas, grades, listas, modais com muitas cartas ou qualquer coisa que baixe imagens/dados.
---

# Desempenho

1. **Nunca** `background-image` para miniaturas em listas: o navegador baixa tudo de uma vez. Use `<img loading="lazy" decoding="async">` ou `Common/Thumb.tsx`.
2. Escolha o tamanho certo: miniatura → `small` do Scryfall; grade → `normal`; zoom/hover → `large`. O componente `CardImage` já faz lazy via IntersectionObserver e cai em alternativas.
3. Listas com centenas de itens: renderização progressiva (ex.: 100 por vez com sentinela `IntersectionObserver` + botão "Mostrar mais", como em `CollectionView`).
4. Se a lista dispensa a imagem (como a lista da Coleção), **não renderize imagem** — é o ganho maior.
5. Buscas: debounce, `AbortController`, cache em memória (`Map`) — ver `scryfall.ts`.
6. Estado derivado caro → `useMemo`; callbacks passados a itens memoizados → `useCallback`/`React.memo`.
7. Efeitos de entrada (`page-enter` com blur) são caros em páginas grandes; não anime elementos individuais de listas longas.
8. Mede antes de afirmar: `read_network_requests` (quantas imagens, tamanho) e `preview_start` para ver o resultado. Reporte o que **não** mediu.
9. Build: `npm run build` mostra chunks > 500 kB (hoje: app, firebase, pdf). Carregar jsPDF/Firebase sob demanda com `import()` é a próxima melhoria possível.
