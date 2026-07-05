// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO / ADMIN — lógica compartilhada entre index.html (Bags) e looks.html
// (Looks). Cada página continua definindo sua própria `CATS_LIST` (categorias
// padrão) e `lastCatFilter` antes deste script rodar; as funções aqui só leem
// essas variáveis globais na hora de serem chamadas, então a ordem de
// declaração não importa.
//
// Cores de modal usadas aqui vêm de variáveis CSS definidas no :root de cada
// página (com fallback para as cores que já eram usadas no My Favorite Bags):
//   --modal-backdrop-rgb   fundo escurecido atrás do modal, em "r,g,b"
//   --modal-title          cor do título dentro do modal
//   --modal-muted          cor do texto secundário dentro do modal
//   --modal-error          cor de mensagens de erro/exclusão
// ═══════════════════════════════════════════════════════════════════════════

// ─── STATUS DO CATÁLOGO (Disponível / Esgotado / Em Breve / Oculto) ─────────
const STATUS_LABEL = { available:'DISPONÍVEL', sold_out:'ESGOTADO', coming_soon:'EM BREVE', hidden:'OCULTO' };
const STATUS_BADGE = { available:'Disponível', sold_out:'Esgotado', coming_soon:'Em Breve', hidden:'Oculto' };
const STATUS_COLOR = {
  available:   { bg:'rgba(37,211,102,.1)',  border:'rgba(37,211,102,.4)', text:'#1a7a3e' },
  sold_out:    { bg:'rgba(184,50,50,.1)',   border:'rgba(184,50,50,.4)',  text:'#b83232' },
  coming_soon: { bg:'rgba(201,122,61,.12)', border:'rgba(201,122,61,.45)', text:'#C97A3D' },
  hidden:      { bg:'rgba(120,120,120,.14)', border:'rgba(120,120,120,.45)', text:'#6B6B6B' },
};
function statusBtnCss(st) {
  const c = STATUS_COLOR[st] || STATUS_COLOR.available;
  return `background:${c.bg};border:1px solid ${c.border};color:${c.text};`;
}
function nextStatus(st) {
  return st === 'available' ? 'sold_out' : st === 'sold_out' ? 'coming_soon' : st === 'coming_soon' ? 'hidden' : 'available';
}

// ─── CATEGORIAS (editáveis pelo admin) ──────────────────────────────────────
function catLabel(key) {
  const c = CATS_LIST.find(c => c.key === key);
  return c ? c.label : (key || '—');
}
function slugifyCat(name) {
  let base = name.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!base) base = 'cat';
  let slug = base, n = 2;
  while (CATS_LIST.some(c => c.key === slug)) { slug = `${base}-${n++}`; }
  return slug;
}
// Compat: código antigo que ainda referenciar CATS[x] continua funcionando
const CATS = new Proxy({}, { get: (_, key) => catLabel(key) });

function renderCatFilters() {
  const wrap = document.getElementById('catFilters');
  if (!wrap) return;
  if (!CATS_LIST.some(c => c.key === lastCatFilter)) lastCatFilter = 'all';
  wrap.innerHTML = `<button class="fpill${lastCatFilter==='all'?' on':''}" onclick="fp('all',this)">Todas</button>` +
    CATS_LIST.map(c => `<button class="fpill${lastCatFilter===c.key?' on':''}" onclick="fp('${c.key}',this)">${c.label}</button>`).join('');
  renderProducts(lastCatFilter);
}
function renderCatSelect() {
  const sel = document.getElementById('nc');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = CATS_LIST.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
  if (CATS_LIST.some(c => c.key === cur)) sel.value = cur;
  // Mantém o rótulo do botão customizado (substitui o <select> nativo) em dia
  const btnLabel = document.getElementById('ncBtnLabel');
  if (btnLabel) {
    const opt = sel.options[sel.selectedIndex];
    btnLabel.textContent = opt ? opt.textContent : 'Selecione';
  }
}

// ─── DROPDOWN CUSTOMIZADO DE CATEGORIA ──────────────────────────────────────
// Substitui o <select> nativo nas categorias (Adicionar Peça/Bolsa e
// Gerenciar Catálogo) para permitir estilizar o hover das opções — algo que
// o dropdown nativo do navegador não permite via CSS.
let _catPopupEl = null;

function closeCatPopup() {
  if (_catPopupEl) { _catPopupEl.remove(); _catPopupEl = null; }
  document.removeEventListener('mousedown', _catPopupOutsideHandler, true);
  window.removeEventListener('scroll', closeCatPopup, true);
  window.removeEventListener('resize', closeCatPopup);
  document.querySelectorAll('.csel-trigger.open').forEach(b => b.classList.remove('open'));
}
function _catPopupOutsideHandler(e) {
  if (_catPopupEl && !_catPopupEl.contains(e.target) && !e.target.closest('.csel-trigger')) {
    closeCatPopup();
  }
}
// Popup genérico: options = [{value, label}, ...]
function openSelectPopup(triggerBtn, options, currentValue, onPick) {
  const alreadyOpenForThis = _catPopupEl && triggerBtn.classList.contains('open');
  closeCatPopup();
  if (alreadyOpenForThis) return; // clique no próprio botão fecha o popup

  const r = triggerBtn.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'csel-popup';
  pop.style.cssText = `position:fixed;left:${r.left}px;top:${r.bottom + 4}px;width:${Math.max(r.width, 110)}px;z-index:9600;`;
  pop.innerHTML = options.map(o => `
    <div class="csel-opt${o.value === currentValue ? ' sel' : ''}" data-value="${o.value}">${o.label}</div>
  `).join('') || `<div class="csel-opt" style="cursor:default;">Sem opções</div>`;
  document.body.appendChild(pop);

  // Se o popup ultrapassar a borda inferior da tela, abre para cima do botão
  const popR = pop.getBoundingClientRect();
  if (popR.bottom > window.innerHeight - 8) {
    pop.style.top = (r.top - popR.height - 4) + 'px';
  }

  pop.querySelectorAll('.csel-opt[data-value]').forEach(opt => {
    opt.addEventListener('click', () => {
      onPick(opt.dataset.value);
      closeCatPopup();
    });
  });
  triggerBtn.classList.add('open');
  _catPopupEl = pop;
  setTimeout(() => {
    document.addEventListener('mousedown', _catPopupOutsideHandler, true);
    window.addEventListener('scroll', closeCatPopup, true);
    window.addEventListener('resize', closeCatPopup);
  }, 0);
}

// Atalho específico para categorias (usa CATS_LIST)
function openCatPopup(triggerBtn, currentKey, onPick) {
  openSelectPopup(triggerBtn, CATS_LIST.map(c => ({ value: c.key, label: c.label })), currentKey, onPick);
}

// ─── MODAIS DE CATEGORIA (Nova / Editar) ────────────────────────────────────
function openNewCategoryModal() {
  const wrap = document.createElement('div');
  wrap.id = 'catModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(var(--modal-backdrop-rgb),.65);display:flex;align-items:center;justify-content:center;';
  wrap.innerHTML = `
    <div style="background:var(--bg);border-radius:12px;padding:28px 32px;max-width:360px;width:92%;font-family:'Jost',sans-serif;">
      <p style="font-size:14px;font-weight:700;color:var(--modal-title);margin-bottom:4px;">Nova Categoria</p>
      <p style="font-size:12px;color:var(--modal-muted);margin-bottom:18px;">Digite o nome da nova categoria.</p>
      <input class="fi" id="newCatName" placeholder="Ex: Nova categoria" style="margin-bottom:14px;">
      <p id="newCatErr" style="font-size:12px;color:var(--modal-error);margin-bottom:10px;display:none;"></p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('catModal').remove()" style="padding:10px 20px;border:1px solid var(--line);background:none;cursor:pointer;font-size:12px;color:var(--modal-muted);">Cancelar</button>
        <button onclick="saveNewCategory()" style="padding:10px 20px;border:none;background:var(--rose-dark);color:#fff;cursor:pointer;font-size:12px;font-weight:700;border-radius:6px;">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('newCatName').focus();
}
function saveNewCategory() {
  const input = document.getElementById('newCatName');
  const name = input.value.trim();
  const err = document.getElementById('newCatErr');
  if (!name) { err.textContent = 'Digite um nome para a categoria.'; err.style.display = 'block'; return; }
  if (CATS_LIST.some(c => c.label.toLowerCase() === name.toLowerCase())) {
    err.textContent = 'Já existe uma categoria com esse nome.'; err.style.display = 'block'; return;
  }
  CATS_LIST.push({ key: slugifyCat(name), label: name });
  markDirty();
  renderCatSelect();
  renderCatFilters();
  const m = document.getElementById('catModal'); if (m) m.remove();
}

function openEditCategoryModal() {
  const wrap = document.createElement('div');
  wrap.id = 'catModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(var(--modal-backdrop-rgb),.65);display:flex;align-items:center;justify-content:center;';
  wrap.innerHTML = `
    <div style="background:var(--bg);border-radius:12px;padding:28px 32px;max-width:420px;width:92%;max-height:80vh;overflow-y:auto;font-family:'Jost',sans-serif;">
      <p style="font-size:14px;font-weight:700;color:var(--modal-title);margin-bottom:4px;">Editar Categorias</p>
      <p style="font-size:12px;color:var(--modal-muted);margin-bottom:18px;">Renomeie ou exclua uma categoria existente.</p>
      <div id="editCatList"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px;">
        <button onclick="document.getElementById('catModal').remove()" style="padding:10px 20px;border:1px solid var(--line);background:none;cursor:pointer;font-size:12px;color:var(--modal-muted);">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  renderEditCategoryList();
}
function renderEditCategoryList() {
  const box = document.getElementById('editCatList');
  if (!box) return;
  box.innerHTML = CATS_LIST.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);">
      <input class="fi" id="editCatName-${c.key}" value="${c.label}" style="flex:1;">
      <button onclick="saveCategoryRename('${c.key}')" title="Salvar novo nome"
        style="padding:9px 12px;border:1px solid var(--rose-dark);background:transparent;color:var(--rose-dark);cursor:pointer;font-size:12px;border-radius:4px;">Salvar</button>
      <button onclick="deleteCategory('${c.key}')" title="Excluir categoria"
        style="padding:9px 12px;border:1px solid #b83232;background:transparent;color:#b83232;cursor:pointer;font-size:12px;border-radius:4px;">Excluir</button>
    </div>`).join('') || `<p style="font-size:12px;color:var(--modal-muted);">Nenhuma categoria cadastrada.</p>`;
}
function saveCategoryRename(key) {
  const input = document.getElementById(`editCatName-${key}`);
  const name = input.value.trim();
  if (!name) return;
  const c = CATS_LIST.find(c => c.key === key);
  if (!c) return;
  c.label = name;
  markDirty();
  renderCatSelect();
  renderCatFilters();
  renderAdminList();
  renderProducts(lastCatFilter);
}
function deleteCategory(key) {
  const c = CATS_LIST.find(c => c.key === key);
  if (!c) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(var(--modal-backdrop-rgb),.7);display:flex;align-items:center;justify-content:center;';
  wrap.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;text-align:center;">
    <p style="font-size:14px;font-weight:700;color:var(--modal-title);margin-bottom:6px;">Excluir categoria "${c.label}"?</p>
    <p style="font-size:12px;color:var(--modal-muted);margin-bottom:22px;">A categoria some da lista e do site. Os itens cadastrados nela permanecem no catálogo.</p>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="catDelNo"  style="padding:10px 22px;border:1px solid #D4C5BA;border-radius:8px;background:none;cursor:pointer;font-size:12px;">Não, cancelar</button>
      <button id="catDelYes" style="padding:10px 22px;border:none;border-radius:8px;background:#b83232;color:#fff;cursor:pointer;font-size:12px;font-weight:700;">Sim, excluir</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#catDelNo').onclick  = () => wrap.remove();
  wrap.querySelector('#catDelYes').onclick = () => {
    wrap.remove();
    CATS_LIST = CATS_LIST.filter(c => c.key !== key);
    markDirty();
    renderCatSelect();
    renderCatFilters();
    renderEditCategoryList();
    renderAdminList();
    renderProducts(lastCatFilter);
  };
}
