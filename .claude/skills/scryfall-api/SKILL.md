---
name: scryfall-api
description: Como consultar a API do Scryfall com segurança neste projeto (cabeçalhos, limites, idiomas, impressões, imagens, CORS). Use ao criar ou alterar buscas de cartas, tokens, artes alternativas ou imagens.
---

# API do Scryfall

Base: `https://api.scryfall.com`. Código em `src/services/scryfall.ts` (siga o estilo dos helpers existentes e o cache em memória).

## Regras
- **No navegador**: enviar `Accept: application/json` (o UA é do navegador). Em scripts Node/curl, o Scryfall rejeita sem `User-Agent` e `Accept` (erro 400 `generic_user_agent`) — defina ambos.
- **Educação**: ~10 req/s no máximo; use debounce (≥400 ms) em busca digitada e `AbortController` para cancelar a anterior. Prefira `unique=cards` (oracle) ou `unique=prints`/`art` só quando precisar.
- Paginação: respeite `has_more`/`next_page`; `getCardPrints` limita a 10 páginas.
- Sintaxe de busca: `!"Nome Exato"`, `set:xxx`, `o:"texto"`, `ft:"sabor"`, `t:`, `c:`, `is:`, `include:extras`, `lang:pt`. Sempre `encodeURIComponent` na query inteira.
- **Idiomas**: busca multilíngue exige `include_multilingual=true`; sem isso `lang:pt` retorna vazio. Texto em português vem em `printed_name`/`printed_text`/`printed_type_line`. Obter a impressão PT direto: `/cards/{set}/{numero}/pt` (404 se não existir).
- Dupla face: `card_faces[]` com `image_uris` por face; cartas split/adventure têm faces mas **uma** imagem na raiz (veja `parseScryfallCard`).
- `flavor_text` é por impressão, não por carta; pode estar ausente.

## Imagens
- CDN `cards.scryfall.io/{small|normal|large|png|art_crop|border_crop}/...`. Para miniaturas use **small** (146×204, ~10 KB) — ver `Common/Thumb.tsx` (`scryfallSmall`). `art_crop` ~626×457 (~40–60 KB).
- Imagens e SVGs do Scryfall enviam `Access-Control-Allow-Origin: *`, então servem em `<canvas>` sem "taint" (`crossOrigin="anonymous"`).
- Símbolos de mana: `https://svgs.scryfall.io/card-symbols/{W|U|2W|WU|T|...}.svg` (remover `/` do símbolo híbrido). Ícones de edição: `https://svgs.scryfall.io/sets/{codigo}.svg`. Os SVGs só têm `viewBox`: injete `width/height` antes de desenhar em canvas.
- Lista de edições: `/sets` (cacheie; muda pouco).

## Falhas comuns
Query vazia → 400; sem resultados → **404** com corpo JSON (trate como lista vazia, não erro); card sem `image_uris` na raiz → use a face; não confie em `prices` sempre presente.
