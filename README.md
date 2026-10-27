# DMS MTG Manager 🎴✨

Aplicação Web moderna e minimalista para gerenciamento completo da sua coleção (pool), construção dinâmica de decks, central de utilitários e estúdio de diagramação de proxies A4 para **Magic: The Gathering**.

🌐 **Acesso Web (GitHub Pages):** [https://davipmelo.github.io/dms-mtg-manager](https://davipmelo.github.io/dms-mtg-manager)

---

## 🚀 Como Executar Localmente

```bash
npm install
npm run dev
```

Acesse no navegador em `http://localhost:5173` (ou dê dois cliques em `iniciar_navegador.bat` no Windows).

---

## 🌐 Como Publicar no GitHub Pages (`davipmelo.github.io/dms-mtg-manager`)

O repositório Git e o workflow oficial de deploy automático (`.github/workflows/deploy.yml`) já estão configurados:

1. Crie um repositório público chamado **`dms-mtg-manager`** na sua conta GitHub (`https://github.com/new` — **sem** marcar "Add a README").
2. No repositório recém-criado no GitHub, vá em **Settings → Pages** e em **Build and deployment → Source** selecione **GitHub Actions**.
3. Envie o código na raiz do projeto executando:
   ```bash
   git push -u origin main
   ```
   *(Ou clique duas vezes em `publicar_github.bat`).*
4. Em cerca de 1 minuto, a Action concluirá o build e publicará o site em:
   **https://davipmelo.github.io/dms-mtg-manager**

> **Alternativa manual via branch `gh-pages`:** caso prefira publicar direto pela branch `gh-pages`, basta rodar `npm run deploy` e selecionar a branch `gh-pages` em **Settings → Pages**.

---

## 💾 Portabilidade Completa (Troca de Máquina / Navegador)

Como o aplicativo roda 100% na web sem exigir login ou servidor externo, seus dados ficam salvos localmente no navegador (`localStorage`). Para continuar trabalhando em outra máquina:

1. Clique no botão **Backup** na barra superior.
2. Clique em **Exportar Sistema Completo (.json)** para baixar seu arquivo único com **Pool + Decks + Artes Escolhidas + Fila de Proxies**.
3. Na outra máquina, abra o site, clique em **Backup → Selecionar Arquivo .json** e clique em **Restaurar Sistema Completo**.

---

## 🌟 Funcionalidades Principais

- **Coleção & Pool Inteligente**: Visualizações em **Tabela / Lista (principal)**, **Grade Visual** e **Colunas Stackadas** (estilo Moxfield), com indicadores em tempo real de cópias **Disponíveis na Pool** vs **Em Uso nos Decks**.
- **Decks Dinâmicos por Formato**: Suporte a Commander, Brawl, Standard, Modern, Pioneer, Pauper, Legacy, Vintage e Casual, adaptando campos de Comandante/Parceiro e metas de cartas automaticamente.
- **Central de Utilitários**: Catálogo integrado com **Fichas / Tokens**, **Planos & Fenômenos (Planechase)**, **Emblemas**, **Marcadores & Auxiliares** (*Monarch, Initiative, Day/Night, The Ring, Poison, Energy, Foretell, Plot*, etc.), **Masmorras (Dungeons)**, **Schemes (Archenemy)**, **Conspirações** e **Atrações**, todos com seleção de **Artes Alternativas**.
- **Seleção de Ilustrações Oficiais**: Troque a arte/edição de qualquer carta na coleção, nos decks, nos utilitários ou na fila de proxies via API oficial do Scryfall.
- **Proxy Studio A4 (3×3)**: Diagramação automática de **9 cartas por folha A4** no tamanho oficial de Magic (**63mm × 88mm**) com guias de corte e marcas de enquadramento prontas para imprimir ou salvar em PDF.
- **Estatísticas Interativas**: Gráficos de curva de mana, distribuição de cores, divisão por tipos, raridades e estimativa financeira em USD e BRL.
