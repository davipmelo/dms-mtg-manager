---
name: testar-logica
description: Como escrever e rodar testes da lógica do Proliferate (services, parsers, normalização) com node:test. Use ao alterar código em src/services ou src/types, ou ao corrigir um bug de dados.
---

# Testes de lógica

- Rodar: `npm test` (esbuild empacota `tests/suite.test.ts` e executa com `node --test`). Hoje cobre storage, tipos, MPCFill e firebase (nuvem simulada).
- Só código **sem DOM** é testável aqui. Componentes React não têm teste automatizado: valide-os no navegador (skill `verificar-visual`).
- Ambiente: `tests/setup-env.ts` simula `localStorage` e um parser XML mínimo; importe-o primeiro. Se um módulo novo usar outra API do navegador, simule-a ali ou isole a lógica pura em função separada.
- Estilo: `test('area: comportamento esperado', () => { ... })` com `assert` estrito (`node:assert/strict`); fábricas como `makeCard` já existem no arquivo — reutilize.
- Bug corrigido → escreva primeiro um teste que falha, depois a correção.
- Antes de publicar: `npx tsc --noEmit -p .`, `npm test`, `npm run build`.
