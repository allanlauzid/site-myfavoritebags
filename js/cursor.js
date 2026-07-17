// ═══════════════════════════════════════════════════════════════════════════
// CURSOR CUSTOMIZADO — compartilhado entre index.html, looks.html e match.html
// Requer: <div class="cursor" id="cur"></div> e <div class="cursor-ring" id="ring"></div>
// já presentes logo após a abertura do <body>, e css/cursor.css incluído.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const curEl = document.getElementById('cur');
  const ringEl = document.getElementById('ring');
  if (!curEl || !ringEl) return;

  // O site aplica `zoom` no <body> em algumas páginas (Bags/Looks, 110%).
  // Como o cursor/trail são elementos fixed *dentro* desse body "zoomado",
  // os valores de left/top/transform em px acabam sendo re-escalados pelo
  // navegador — por isso dividimos as coordenadas reais do mouse (que vêm
  // sem zoom, via clientX/clientY) pelo fator de zoom do body antes de
  // aplicá-las, senão o cursor visual "foge" do ponteiro real.
  function bodyZoom() {
    const z = parseFloat(getComputedStyle(document.body).zoom);
    return z && !isNaN(z) ? z : 1;
  }

  document.addEventListener('mousemove', e => {
    const z = bodyZoom();
    const x = e.clientX / z, y = e.clientY / z;
    curEl.classList.add('on');
    ringEl.classList.add('on');
    curEl.style.left = x + 'px';
    curEl.style.top  = y + 'px';
    setTimeout(() => {
      ringEl.style.left = x + 'px';
      ringEl.style.top  = y + 'px';
    }, 80);
  });

  function bindHoverTargets() {
    document.querySelectorAll('a, button, .fpill, .pcard:not(.out), .h-dot, .ithumb, [onclick]').forEach(el => {
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = '1';
      el.addEventListener('mouseenter', () => { curEl.classList.add('h'); ringEl.classList.add('h'); });
      el.addEventListener('mouseleave', () => { curEl.classList.remove('h'); ringEl.classList.remove('h'); });
    });
  }
  bindHoverTargets();
  // Recaptura elementos criados dinamicamente (catálogo, admin, etc.)
  new MutationObserver(bindHoverTargets).observe(document.body, { childList:true, subtree:true });

  // ─── CURSOR TRAIL (cauda longa e suave, some rápido) ───────────────────────
  if (window.matchMedia('(hover:none)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const TRAIL_LEN = 16;
  const trail = [];
  for (let i = 0; i < TRAIL_LEN; i++) {
    const d = document.createElement('div');
    d.className = 'trail-dot';
    d.style.setProperty('--op', (0.8 * (1 - i / TRAIL_LEN)).toFixed(2));
    document.body.appendChild(d);
    trail.push({ el: d, x: 0, y: 0 });
  }
  let mx = 0, my = 0, moved = false, fadeTimer = null;

  document.addEventListener('mousemove', e => {
    const z = bodyZoom();
    mx = e.clientX / z; my = e.clientY / z;
    if (!moved) { trail.forEach(t => { t.x = mx; t.y = my; }); moved = true; }
    trail.forEach(t => { t.el.style.opacity = 'var(--op)'; });
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => trail.forEach(t => { t.el.style.opacity = '0'; }), 260);
  });

  (function loop() {
    let tx = mx, ty = my;
    trail.forEach(t => {
      t.x += (tx - t.x) * 0.13;
      t.y += (ty - t.y) * 0.13;
      t.el.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%,-50%)`;
      tx = t.x; ty = t.y;
    });
    requestAnimationFrame(loop);
  })();
})();
