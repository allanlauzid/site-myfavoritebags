// ═══════════════════════════════════════════════════════════════════════════
// TRANSIÇÃO ENTRE SITES (Bags ⇄ Looks ⇄ Match) — compartilhado entre
// index.html, looks.html e match.html.
//
// Ao clicar num link de navegação cruzada (ex: "My Favorite Looks" no Bags,
// "My Favorite Bags" no Looks/Match, o botão do Match no Bags/Looks etc.),
// em vez de trocar de página instantaneamente:
//   1. Uma cortina cheia da cor do site de destino desce cobrindo a tela;
//   2. Só então a navegação acontece (o navegador troca de página);
//   3. Na página nova, a MESMA cortina já começa cobrindo tudo (sem piscar
//      o conteúdo por trás) e desce mais um pouco, saindo de vista e
//      revelando a página — dando a sensação de uma transição contínua.
//
// Não depende de nenhuma API específica de navegador — funciona com
// navegação normal entre arquivos .html (sem SPA, sem fetch).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const STORAGE_KEY = 'mfb_curtain_in';

  // Cor da cortina por página de destino — combina com o tom de cada site.
  const CURTAIN_COLORS = {
    'index.html': '#2A1F18',
    'looks.html': '#111827',
    'match.html': '#4A2318',
  };

  // Seletores/atributos que identificam um link de navegação cruzada entre
  // os três sites. Cobre tanto os botões fixos (com id) quanto os que são
  // criados dinamicamente por JS (bijusHeroBtn, matchHeroBtn, navBagsBtn).
  const CROSS_LINK_SELECTOR = [
    '#navLooksBtn', '#bijusHeroBtn', '#navBagsBtn', '#matchHeroBtn',
    '#mConfigBagsBtn', '#mExitConfig', '#mExitCard',
    'a[href^="index.html"]', 'a[href^="looks.html"]', 'a[href^="match.html"]',
  ].join(', ');

  function targetFile(href) {
    try { return new URL(href, location.href).pathname.split('/').pop() || 'index.html'; }
    catch (e) { return href; }
  }

  function ensureCurtain(color) {
    let el = document.getElementById('pageCurtain');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pageCurtain';
      el.className = 'page-curtain';
      document.body.appendChild(el);
    }
    if (color) el.style.background = color;
    return el;
  }

  // ── ENTRADA: se chegamos aqui vindos de um clique com cortina, ela já
  // existe "fechada" (cobrindo 100%) — anima descendo mais e saindo de
  // vista, revelando a página por baixo. ─────────────────────────────────
  function playEntrance() {
    const incomingColor = sessionStorage.getItem(STORAGE_KEY);
    if (!incomingColor) return;
    sessionStorage.removeItem(STORAGE_KEY);
    const el = ensureCurtain(incomingColor);
    el.classList.add('is-closed'); // já começa cobrindo tudo, sem transição
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.remove('is-closed');
        el.classList.add('is-opening');
        setTimeout(() => el.remove(), 700);
      });
    });
  }

  // ── SAÍDA: intercepta o clique, fecha a cortina e só depois navega. ────
  function wireCrossLink(el) {
    if (!el || el.dataset.curtainWired) return;
    if (el.target === '_blank') return; // abre em outra aba, sem transição
    el.dataset.curtainWired = '1';
    el.addEventListener('click', e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      const href = el.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      const file = targetFile(href);
      if (!CURTAIN_COLORS[file]) return; // não é um link entre os 3 sites
      e.preventDefault();
      const color = CURTAIN_COLORS[file];
      sessionStorage.setItem(STORAGE_KEY, color);
      const curEl = ensureCurtain(color);
      requestAnimationFrame(() => curEl.classList.add('is-closing'));
      setTimeout(() => { window.location.href = href; }, 550);
    });
  }

  function wireAll() {
    document.querySelectorAll(CROSS_LINK_SELECTOR).forEach(wireCrossLink);
  }

  playEntrance();
  wireAll();
  // Vários desses botões são inseridos dinamicamente depois do load inicial
  // (ex: bijusHeroBtn, matchHeroBtn) — reobserva o DOM pra pegar esses casos.
  new MutationObserver(wireAll).observe(document.body, { childList: true, subtree: true });
})();
