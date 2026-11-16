---
name: publicar
description: Valida, commita e dá push na main do Proliferate (dispara o deploy no GitHub Pages). Use quando o usuário pedir para commitar, publicar ou enviar as mudanças.
---

# Publicar na main

O usuário quer tudo salvo direto na `main` (sem branch/PR).

1. `git status` — confirme que só há mudanças esperadas. Nunca adicione `.env*`; adicione arquivos por caminho (`git add -A src tests ...`), não a pasta inteira às cegas.
2. `npx tsc --noEmit -p .`, `npm test` e `npm run build` devem passar. Se algo falhar, corrija ou informe; não publique quebrado.
3. Commit em português: `tipo(area): resumo` + corpo com bullets do que mudou e por quê, terminando com a linha `Co-Authored-By` indicada pelo ambiente.
4. `git push origin main`.
5. Informe o hash do commit e lembre que o deploy roda em Actions (~1 min). Se o usuário perguntar do deploy, use `gh run list --limit 3`.
