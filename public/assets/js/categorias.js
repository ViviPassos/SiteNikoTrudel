// categorias.js
import { db, ref, set, get, update, remove, onValue, requireAuth, logout, showToast, slugify } from './firebase-config.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

let cats      = {};
let editKey   = null;
let deleteKey = null;

requireAuth().then(() => {
  const app = document.getElementById('app');
  app.innerHTML = renderSidebar('categorias') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">Categorias</span></div>
      <main class="main">
        <div class="section-header">
          <div>
            <h1 class="page-title">Categorias</h1>
            <p class="page-subtitle" id="catCount">Carregando...</p>
          </div>
          <button class="btn-primary" id="btnNovaCat">
            <i class="bi bi-plus-lg"></i> Nova Categoria
          </button>
        </div>
        <div id="catList"></div>
      </main>
    </div>
  `;

  initSidebarLogout(logout);
  document.getElementById('btnNovaCat').addEventListener('click', openNew);
  bindModalEvents();
  loadCats();
});

// ── Firebase ──────────────────────────────────────────────────────────────────
function loadCats() {
  onValue(ref(db, 'categorias'), snap => {
    cats = snap.val() || {};
    renderCats();
  });
}

function renderCats() {
  const sorted = Object.entries(cats).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));
  const count  = sorted.length;
  document.getElementById('catCount').textContent =
    `${count} categoria${count !== 1 ? 's' : ''} cadastrada${count !== 1 ? 's' : ''}`;

  if (!count) {
    document.getElementById('catList').innerHTML =
      '<div class="empty-state"><i class="bi bi-folder"></i><p>Nenhuma categoria cadastrada</p></div>';
    return;
  }

  document.getElementById('catList').innerHTML = sorted.map(([key, cat]) => `
    <div class="cat-row" data-key="${key}">
      <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
      <div>
        <div class="cat-name">${cat.nome}</div>
        <div class="cat-order">Ordem: ${cat.ordem || 0}</div>
      </div>
      <div class="cat-actions">
        <button class="btn-icon edit" data-edit="${key}"><i class="bi bi-pencil"></i></button>
        <button class="btn-icon del"  data-del="${key}" data-nome="${cat.nome}"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openEdit(btn.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => askDelete(btn.dataset.del, btn.dataset.nome)));
}

// ── Modais ────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function bindModalEvents() {
  document.getElementById('closeModal').addEventListener('click',   () => closeModal('modalOverlay'));
  document.getElementById('cancelModal').addEventListener('click',  () => closeModal('modalOverlay'));
  document.getElementById('confirmCancel').addEventListener('click',() => closeModal('confirmOverlay'));

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); }));

  document.getElementById('catNome').addEventListener('input', function () {
    if (!editKey) document.getElementById('catSlug').value = slugify(this.value);
  });

  document.getElementById('saveModal').addEventListener('click', saveCategoria);
  document.getElementById('confirmOk').addEventListener('click', deleteCategoria);
}

function openNew() {
  editKey = null;
  document.getElementById('modalTitle').textContent = 'Nova Categoria';
  document.getElementById('catNome').value           = '';
  document.getElementById('catSlug').value           = '';
  document.getElementById('catOrdem').value          = Object.keys(cats).length + 1;
  document.getElementById('catSlug').readOnly        = false;
  openModal('modalOverlay');
}

function openEdit(key) {
  editKey = key;
  const cat = cats[key];
  document.getElementById('modalTitle').textContent = 'Editar Categoria';
  document.getElementById('catNome').value           = cat.nome  || '';
  document.getElementById('catSlug').value           = cat.slug  || key;
  document.getElementById('catOrdem').value          = cat.ordem || 0;
  document.getElementById('catSlug').readOnly        = true;
  openModal('modalOverlay');
}

async function saveCategoria() {
  const nome  = document.getElementById('catNome').value.trim();
  const slug  = document.getElementById('catSlug').value.trim();
  const ordem = parseInt(document.getElementById('catOrdem').value) || 0;

  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  const data = { nome, slug: slug || slugify(nome), ordem, ativa: true };

  if (editKey) {
    await update(ref(db, `categorias/${editKey}`), data);
    showToast('Categoria atualizada!');
  } else {
    const newKey = slug || slugify(nome);
    await set(ref(db, `categorias/${newKey}`), data);
    showToast('Categoria criada!');
  }
  closeModal('modalOverlay');
}

function askDelete(key, nome) {
  deleteKey = key;
  document.getElementById('confirmName').textContent = nome;
  openModal('confirmOverlay');
}

async function deleteCategoria() {
  if (!deleteKey) return;
  await remove(ref(db, `categorias/${deleteKey}`));
  showToast('Categoria excluída.');
  closeModal('confirmOverlay');
  deleteKey = null;
}
