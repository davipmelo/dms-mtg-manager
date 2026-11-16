---
name: mtg-dados
description: Regras e convenções de dados de Magic: The Gathering usadas no Proliferate (formatos, tamanho de deck, cartas de dupla face, comandante/partner, edições, cartas customizadas/MPC, chaves de armazenamento). Use ao mexer em decks, coleção, importação/exportação ou tipos de carta.
---

# Dados de MTG no Proliferate

## Decks
- `DeckFormat` (`src/types/index.ts`): commander, standard, modern, pioneer, pauper, legacy, vintage, brawl, casual.
- Meta de cartas na UI: **100** para `commander`, **60** para os demais (`targetCount` em `DeckManager.tsx`). Brawl e outros não têm regra própria hoje — se mudar, atualize todos os usos.
- `DeckCard.category`: commander, partner, companion, main, sideboard, maybeboard. Comandante e partner também aparecem em `deck.commanderCard` / `deck.partnerCard`; a UI deduplica por id **e** por nome.
- `normalizeDeck` (`storage.ts`) desagrupa cópias, preserva partners, limita `coverPosition` (0–100) e `coverZoom` (1–3). Passe decks externos por ela.

## Cartas
- `Card` é o modelo único; `TokenCard` é usado para fichas/utilitários. `ProxyItem.card` aceita ambos.
- **Dupla face**: use `isDoubleFacedCard(card)` (`types`). Layouts realmente de duas faces: transform, modal_dfc, meld, battle, reversible_card, double_faced_token. `split`, `adventure`, `flip`, `aftermath`, `saga`, `class`, `case`, `prototype` são **uma** face física. Faces ficam em `card.cardFaces`; frente/verso em proxies usam `faceLabel: 'frente' | 'verso'` e id `${id}-back`.
- Nome de carta: compare com `isCardNameMatch` (aceita "Frente // Verso", "Frente / Verso" e só a frente). Impressão idêntica: `isSameCardPrint`.
- **Cartas customizadas/alteradas**: `setCode === 'CUSTOM'` ou `'MPC'`, ou `collectorNumber === '★'`. Nunca consulte o Scryfall por set/número para elas; compare por `imageUrl`.
- `rarity`: common, uncommon, rare, mythic, special. Cores: letras `W U B R G`; incolor = lista vazia.
- Custo de mana é string `{2}{W}{U}`; `ManaCostRenderer` desenha os símbolos.

## Armazenamento local (`storage.ts`)
Chaves: `dms_mtg_collection_v1`, `dms_mtg_decks_v1`, `dms_mtg_proxies_v1`, `dms_mtg_deck_tags_v1`. Preferências de UI: `dms_collection_view_mode`, `dms_deck_list_view`, `dms_grid_card_size`, `dms_grid_show_details`. Mudou o formato de um registro? Escreva migração em `normalizeDeck`/`getStored*` (dados antigos de usuários continuam no navegador).

## Importação/exportação
`importer.ts`: `parseCardList` (texto estilo Arena/Moxfield/LigaMagic, com tradução de nomes PT via `translatePtCardName`), `exportToMtgArena`, `exportToMoxfield`, `exportToLigaMagic`, CSV da coleção. MPCFill (XML) em `mpcFillService.ts`. Há testes em `tests/suite.test.ts` — estenda-os ao mudar esses parsers.
