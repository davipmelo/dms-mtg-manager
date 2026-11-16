# Proliferate (dms-mtg-manager)

Web app em React 19 + TypeScript + Vite para gerenciar coleção, decks, utilitários (tokens etc.) e impressão de proxies A4 de Magic: The Gathering. Interface em **português (pt-BR)**. Dados de cartas vêm do Scryfall; sincronização opcional via Firebase.

## Comandos
- `npm run dev` — servidor de desenvolvimento (porta 5173; há `dev` em `.claude/launch.json` para `preview_start`).
- `npm test` — testes (`node:test` via esbuild, em `tests/suite.test.ts`; só lógica pura de services/types).
- `npm run build` — `tsc` + `vite build`. Rode sempre antes de commitar.

## Fluxo de trabalho (preferência do usuário)
- Commitar e dar push **direto na `main`**, sem branch/PR, salvo pedido explícito. O deploy (GitHub Pages, `.github/workflows/deploy.yml`) só roda em push na `main`.
- Mensagens de commit em português, estilo `feat(area): ...` / `fix:` / `perf:` / `style:`.
- Não commitar `.env*`. `gh` está instalado e autenticado.

## Estrutura
- `src/App.tsx` — shell, abas (Decks, Coleção, Utilitários, Proxies), estado global e sync.
- `src/components/{Decks,Collection,Utilities,Proxies,Modals,Common,Auth,Analytics}`.
- `src/services/` — `scryfall.ts` (API), `storage.ts` (localStorage + normalização), `firebase.ts` (nuvem), `mpcFillService.ts`, `proxyPdfService.ts`.
- `src/types/index.ts` — tipos (`Card`, `Deck`, `CollectionItem`, `ProxyItem`...).
- `src/styles/base.css` (design system e componentes) e `mobile.css` (ajustes mobile).

## Design system
- Tema grafite escuro com destaque âmbar `#ffbb00`. Use os tokens em `:root` de `base.css` (`--primary`, `--bg-surface`, `--border-subtle`, `--radius-*`); não invente cores.
- Botões: `.btn` + `btn-primary` (no máximo **um** CTA primário por área), `btn-secondary`, `btn-ghost`, `btn-danger`; tamanhos `btn-sm`/`btn-xs`/`btn-icon`. **Não** sobrescreva `padding`/`fontSize` inline em botões.
- Preferir classes CSS a `style={{}}` inline em código novo (muito código antigo usa inline).
- Mobile (<= 768px): barra de abas inferior fixa (4 abas); modais viram bottom sheets; confira sempre em 375px.
- Chips/segmentados: `.chip`, `.view-toggle`, `.proxy-presets-group` como referência.

## Armadilhas
- Defaults: Decks e Coleção abrem em **lista**; cards são opcionais. Preferência em `localStorage` (`dms_deck_list_view`, `dms_collection_view_mode`).
- Imagens: usar `<img loading="lazy">`/`Thumb` (`Common/Thumb.tsx`) e a versão `small` do Scryfall para miniaturas; **não** usar `background-image` em listas longas.
- Sincronização na nuvem (Firestore) limita o documento a ~1 MB: evite guardar imagens embutidas (data URLs) nos dados do usuário.
- Proxies de PDF/A4 usam medidas exatas (63×88 mm); não altere o CSS `.a4-*` sem testar impressão.
- Em `preview` do navegador, screenshots logo após trocar de aba podem sair pretos por causa da animação `page-enter`; espere ~2 s antes de capturar.
