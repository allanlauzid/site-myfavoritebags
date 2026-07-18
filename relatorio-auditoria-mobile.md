# Auditoria Mobile — My Favorite Bags
### index.html · looks.html · match.html — análise baseada em UI/UX Pro Max + Modern Web Design

Data: 18/07/2026

Metodologia: leitura de todos os blocos `@media` (25 por HTML principal), `css/nav.css`, `cursor.js/css`, `admin-image-manager.css`, `interface-polish.css`, `catalog-admin.js` e `supabase-client.js`, considerando viewports de referência 320/360/375/390/414/768px.

---

## Resumo de prioridade para o sprint

| Prioridade | Item | Categoria |
|---|---|---|
| Crítico | `prefers-reduced-motion` não implementado nativamente | Acessibilidade/Animação |
| Alto | `.nav-links{display:none}` sem alternativa acessível — possível perda de itens de navegação em mobile | Layout/Touch |
| Alto | `loading="lazy"` ausente na maioria das imagens | Performance |
| Alto | `width`/`height` ausentes nas imagens → CLS (salto de layout) | Performance |
| Alto | `body{zoom:1.1}` não padrão, inconsistente entre navegadores, interage mal com `overflow-x:hidden` | Layout |
| Alto | Modais sem tecla Escape / focus trap | Acessibilidade |
| Alto | Inputs administrativos com fonte <16px disparando zoom automático no iOS | Touch/Formulário |
| Médio | Preço e categoria do produto com fonte <16px em mobile | Tipografia |
| Médio | z-index sem sistema/tokens, valores repetidos entre componentes não relacionados | Layout |
| Médio | Labels sem `for`/`id` em alguns campos do admin | Acessibilidade |
| Médio | CSS duplicado entre index/looks; CSS morto em match.html | Performance/Arquitetura |
| Baixo | Imagens do painel admin sem `alt` | Acessibilidade |
| Baixo | Listeners de `cursor.js` ativos em touch sem necessidade | Performance |

---

## 1. Acessibilidade

**1.1 — Nenhum `prefers-reduced-motion` real no site (crítico)**
Não existe a media query nativa `@media (prefers-reduced-motion: reduce)` em nenhum arquivo. Há apenas comentários afirmando que "o site zera transitions sob prefers-reduced-motion" (`index.html:1571`, `looks.html:1631`, `css/interface-polish.css:185`), mas isso é documentação desatualizada — não reflete o código. O que existe de fato é uma classe `html.reduce-motion` acionada via JS em `js/cursor.js:11-20`, baseada em `navigator.connection` / Save-Data / rede 2G — **não** na preferência de sistema operacional do usuário. Alguém com "reduzir movimento" ativado no iOS/Android/Windows, mas com boa conexão, continua recebendo todas as animações do site (index.html tem 56 `transition`, 25 `@keyframes`, 30 `animation`). Isso viola WCAG 2.2 (2.3.3) e pode causar desconforto real (vestibular/enxaqueca).

**1.2 — Modais sem tecla Escape e sem focus trap (alto)**
`#bagModal` (index.html:5519) e os modais do admin (`galleryModal:3452`, `cropModal:3781`, `imgZoomOv:3993`, `pimModal:4276`, `reviewModal:5636`) não têm listener de `Escape` em nenhum dos 3 HTMLs, e não há `trapFocus`/`inert`. Afeta usuários de teclado Bluetooth e leitores de tela — o foco pode "vazar" para elementos atrás do modal.

**1.3 — Labels sem associação `for`/`id` em alguns campos do admin (médio)**
Exemplo: `index.html:2644-2645` — `<label class="flabel">Nome da Bolsa</label>` seguido de `<input class="fi" id="nn">` como irmãos, sem `for="nn"`. Sem vínculo programático, o leitor de tela não anuncia o rótulo ao focar o campo. A maioria dos outros campos usa label envolvente (válido), mas o padrão não é consistente no arquivo.

**1.4 — Imagens do admin sem `alt` (baixo)**
7 `<img>` em index.html (~linhas 2700, 2704, 2717, 3791, 3997, 4281) e 6 em looks.html sem atributo `alt`, todas em preview/crop/zoom do painel administrativo. Impacto baixo (área restrita), mas ainda é falha técnica.

**1.5 — Ponto positivo a preservar**
`.bag-photo` (index.html:2128 / looks.html:2181) tem `alt="${p.name}"` dinâmico, `width`/`height`, `loading="lazy"` e `srcset` condicional — é o único componente do site com boas práticas de imagem completas. Deve ser o padrão replicado nas demais imagens.

**1.6 — Ponto positivo a preservar**
Botões de ícone reais (fechar modal, editar/baixar/excluir imagem) têm `aria-label`. A bottom nav mobile (`#mobileBottomNav`, index.html:1729) tem `aria-label="Navegação mobile"` no `<nav>` e cada botão interno tem `aria-label` próprio.

---

## 2. Touch & Interação

**2.1 — `.nav-links` some sem alternativa acessível no mobile (alto)**
No breakpoint `max-width:768px` (index.html ~1034-1038, mesmo em looks.html), a regra é simplesmente `.nav-links { display:none; }` — os links de topo (Coleção/Sobre/Instagram) desaparecem sem virar um menu hamburger com `aria-expanded`/`aria-controls`. A bottom nav fixa cobre parte disso (Início/Catálogo/Match), mas qualquer item de `.nav-links` que não esteja replicado ali fica **inacessível em mobile por qualquer meio**, nem por toque nem por teclado. Recomenda-se auditar o conteúdo de `.nav-links` e garantir que tudo tenha uma rota mobile equivalente.

**2.2 — Cursor customizado com overhead residual em touch (médio)**
`css/cursor.css:39-42` desliga corretamente `.cursor/.cursor-ring/.trail-dot` via `@media (hover:none), (pointer:coarse)`. Porém `js/cursor.js` não tem early-return no topo do arquivo — os listeners de `mousemove` (linhas 43-54) e `bindHoverTargets` (56-64) continuam sendo registrados em dispositivos touch. Inofensivo funcionalmente, mas é parsing/memória desperdiçados em todo carregamento mobile.

**2.3 — `body { zoom: 1.1 }` (alto, problema cross-browser)**
`index.html:88` e `looks.html:80` aplicam `zoom:1.1` ao body inteiro. `zoom` é propriedade não-padrão, sem suporte no Firefox (incluindo Firefox Android), com comportamento imprevisível junto a `vw`, viewport units e a régua de toque de 44px do sistema. Em Safari iOS pode alterar como o teclado virtual e o `visualViewport` se comportam. O próprio `js/cursor.js:32-41` precisa compensar manualmente esse zoom — sinal de dívida técnica já reconhecida no código.

**2.4 — Tamanho de toque não garantido sistematicamente**
`.fi` (inputs do admin) só recebe `min-height:44px` dentro de `@media(max-width:600px)` (index.html ~1429). Entre 601px e a largura de tablet/desktop essa garantia desaparece. Como o admin costuma ser usado no celular do lojista, isso é relevante mesmo sendo uma área "interna".

**2.5 — Sem estados de carregamento/erro padronizados**
Não há padrão consistente de skeleton/spinner para imagens de produto em lazy load, nem mensagens de erro de rede padronizadas — pode causar salto de conteúdo perceptível (ver 3.2).

---

## 3. Performance

**3.1 — `loading="lazy"` em apenas 2 de ~27 imagens por página (alto)**
Em index.html só 2 ocorrências (linhas 2128, 3592) e em looks.html só 2 (2181, 3259), de um total de ~24-27 tags `<img>`. A maioria carrega eager, competindo por banda com o LCP em conexões móveis lentas — especialmente ruim num catálogo com muitas fotos.

**3.2 — `width`/`height` ausentes na maioria das imagens → CLS (alto)**
Só as 2 imagens `.bag-photo` por HTML declaram `width`/`height`. Banners, logos e ícones de galeria não reservam espaço, causando salto de layout durante o carregamento em 3G/4G — crítico no hero/topo da página.

**3.3 — `zoom:1.1` no body pode forçar recálculo de layout adicional** (reforça o item 2.3).

**3.4 — Ausência de `prefers-reduced-motion` real também é questão de performance** (ver 1.1): usuários que ativam "reduzir movimento" para poupar bateria/CPU não recebem esse benefício.

**3.5 — CSS duplicado entre index.html e looks.html (médio)**
Blocos inteiros de `<style>` (breakpoints, `.catalog::before`, `.fi`, `.pgrid` etc.) estão duplicados byte-a-byte entre os dois arquivos, em vez de compartilhados via CSS externo cacheável. Infla o HTML transferido em cada página, pior em mobile com banda limitada.

**3.6 — match.html carrega `css/nav.css` sem uso real (baixo-médio)**
match.html não tem `<nav id="nav">` nem `#mobileBottomNav` no DOM, mas ainda baixa e parseia as 490 linhas de `nav.css` — CSS morto em uma página que deveria ser a mais leve do site.

---

## 4. Layout & Responsividade

**4.1 — `.nav-links{display:none}` sem substituto de conteúdo** (repete o item 2.1) — **alto**

**4.2 — z-index sem sistema, valores reaproveitados entre componentes não relacionados (médio)**
`.page-curtain` (nav.css:339, z-index:99999) e componentes como `.cursor`/toast (z-index:9999) reutilizam números altos sem relação lógica entre si. A escala vai de 2 até 99999 de forma ad-hoc: index.html usa 2,4,5,6,10,1000,9000-9999; nav.css usa 1,20,200,300,9000,99999. Sem tokens documentados, qualquer modal novo corre o risco de ficar atrás da bottom nav (z:9000) ou da page-curtain (z:99999) por escolha arbitrária.

**4.3 — match.html usa escala de z-index isolada (baixo)**
match.html usa 0-11, sem relação com os 9000+ de index/looks. Não gera bug direto, mas evidencia ausência de um sistema de z-index compartilhado entre as 3 páginas.

**4.4 — Overflow horizontal mascarado, não eliminado na origem (médio)**
`body{overflow-x:hidden}` está presente em index.html:88, looks.html:80 e match.html:112 — isso é justamente o anti-padrão de "remediar sintoma, não causa": esconde o overflow em vez de corrigir o elemento causador. Indício de que já existiu (ou existe) overflow horizontal real sendo escondido, provavelmente ligado à técnica full-bleed `width:100vw` + `margin-left:-50vw` usada em `.catalog::before` (index.html:1294, looks.html:1356), que é sensível à interação com o `zoom:1.1` do body (ver 2.3).

**4.5 — Preço e categoria do produto com fonte <16px em mobile (médio)**
No bloco `@media(max-width:600px)`: `.pprice` (preço) = 15px, `.pcat` (categoria) = 13px, `.pwa` = 12px. Preço é informação comercial primária — não deveria ficar abaixo do corpo de texto padrão numa página de e-commerce de luxo. Em telas de 360-375px compromete legibilidade e a percepção premium da marca.

**4.6 — Inputs administrativos disparando zoom automático no iOS (alto para uso do admin no celular)**
`.fi` (classe base, index.html:928-931) = `font-size:13px`, só sobe para 16px dentro de `@media(max-width:600px)`. Entre 601-768px (tablet) permanece 13px. Campos com estilo inline específico, como `#apFrom`/`#apTo` (index.html:2995-2997, `font-size:13.6px`), não são cobertos por nenhuma regra responsiva e permanecem abaixo de 16px em qualquer largura — ao focar esses campos no Safari iOS, a página sofre zoom automático indesejado.

**4.7 — Modal de produto: contenção correta (positivo)**
`#bagModalPanel` usa `max-width:520px; width:92%; max-height:88svh; overflow-y:auto` — cabe corretamente em telas pequenas e usa a unidade moderna `svh`.

---

## 5. Tipografia & Cor

**5.1 — Inconsistência de escala tipográfica entre index/looks e match**
index.html e looks.html compartilham os mesmos breakpoints (768/820/900/1100/1400) e os mesmos valores de font-size nos mesmos blocos — boa consistência entre as duas. match.html usa um conjunto totalmente diferente (`min-width:600px`, `max-width:360px + max-height:640px`) com sua própria escala (`.m-brand-t:14.7px`, `.m-close:13px`, `.mf-pill:13px`) — não há garantia de que as 3 páginas "conversem" no mesmo sistema tipográfico responsivo, mesmo usando as mesmas famílias de fonte (Cormorant Garamond + Jost).

**5.2 — Texto de preço e categoria abaixo de 16px** (ver 4.5 — também é questão de hierarquia visual: o preço deveria ter mais peso, não menos).

---

## 6. Animação

**6.1 — Ausência de `prefers-reduced-motion` nativa** — é o achado mais transversal do relatório: afeta acessibilidade, performance e conforto simultaneamente (ver 1.1).

**6.2 — Volume alto de animação sem fallback real (médio)**
30 `animation:` + 25 `@keyframes` + 56 `transition:` só em index.html (números similares em looks.html). Sem a media query de redução de movimento funcionando de fato, é bastante animação para hardware mobile modesto, ainda mais combinada com o `zoom:1.1` do body e o cursor customizado tentando compensar posição em tempo real.

---

## 7. Consistência entre index.html, looks.html e match.html

**7.1 — index/looks: alta consistência estrutural (positivo, com ressalva)**
Carregam os mesmos 4 arquivos CSS na mesma ordem, com os mesmos 25 breakpoints e offsets de linha praticamente idênticos — evidência de terem sido mantidos em paralelo/copiados. Bom para quem navega entre as duas páginas, ruim para manutenção: qualquer mudança precisa ser replicada manualmente duas vezes, com risco de divergência futura.

**7.2 — match.html é estruturalmente isolado (alto para consistência de marca)**
Não carrega `css/admin-image-manager.css`, não tem `<nav id="nav">` nem `#mobileBottomNav`, usa outro conjunto de breakpoints, outra escala de z-index e sua própria navegação (`.m-config-navbtn`) 100% inline. A transição index/looks → match pode parecer "outro produto": perde a bottom nav e os breakpoints tipográficos. Se for uma "mini-app" deliberadamente separada (o nome e o layout de swipe sugerem isso), pode ser intencional — mas vale confirmar com o time se é decisão de produto ou dívida técnica acumulada.

**7.3 — CSS morto: nav.css carregado por match.html sem uso real** (reforça 3.6 — falha de arquitetura: o arquivo é "obrigatório" nas 3 páginas, mas só se aplica de fato a 2 delas).

---

## Pontos positivos a preservar

- Fotos de produto (`.bag-photo`) com `alt` dinâmico + `width`/`height` + `loading="lazy"` + `srcset` — padrão de imagem correto, replicar nas demais.
- Bottom nav mobile com `aria-label` correto em todos os botões.
- `:focus-visible` definido globalmente.
- `touch-action:manipulation` aplicado a elementos clicáveis.
- Modal de produto com `max-height:88svh`, usando unidade moderna de viewport.
- Cursor customizado corretamente desligado via CSS em dispositivos touch (`(hover:none), (pointer:coarse)`).
