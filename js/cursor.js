// ═══════════════════════════════════════════════════════════════════════════
// CURSOR CUSTOMIZADO — compartilhado entre index.html, looks.html e match.html
// Requer: <div class="cursor" id="cur"></div> e <div class="cursor-ring" id="ring"></div>
// já presentes logo após a abertura do <body>, e css/cursor.css incluído.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const curEl = document.getElementById('cur');
  const ringEl = document.getElementById('ring');
  if (!curEl || !ringEl) return;

  document.addEventListener('mousemove', e => {
    curEl.classList.add('on');
    ringEl.classList.add('on');
    curEl.style.left = e.clientX + 'px';
    curEl.style.top  = e.clientY + 'px';
    setTimeout(() => {
      ringEl.style.left = e.clientX + 'px';
      ringEl.style.top  = e.clientY + 'px';
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
    mx = e.clientX; my = e.clientY;
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
      tx = t.x; ty