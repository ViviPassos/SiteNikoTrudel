// itens.js
import { db, ref, get, update, remove, onValue, requireAuth, logout, formatBRL, showToast } from './firebase-config.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

let allItems   = {};
let allCats    = {};
let deleteKey  = null;
let filterCat  = 'all';
let searchTerm = '';

requireAuth().then(() => {
  const app = document.getElementById('app');
  app.innerHTML = renderSidebar('itens') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">Itens Do Menu</span></div>
      <main class="main">
        <div class="section-header">
          <div>
            <h1 class="page-title">Itens do Menu</h1>
            <p class="page-subtitle" id="itemCount">Carregando...</p>
          </div>
          <div class="add-menu">
            <button class="btn-primary" id="btnAdd">
              <i class="bi bi-plus-lg"></i> Novo Item
              <i class="bi bi-chevron-down" style="font-size:11px;"></i>
            </button>
            <div class="add-dropdown" id="addDropdown">
              <a href="item-simples.html"><i class="bi bi-card-image"></i> Item Simples (Card)</a>
              <a href="item-montavel-simples.html"><i class="bi bi-sliders"></i> Montável Simples</a>
              <a href="item-montavel-grupo.html"><i class="bi bi-collection"></i> Montável com Grupos</a>
            </div>
          </div>
        </div>

        <div class="filter-bar" id="filterBar">
          <div class="search-wrap" style="width:300px;">
            <i class="bi bi-search"></i>
            <input type="text" placeholder="Buscar por nome ou categoria..." id="searchInput" />
          </div>
          <button class="filter-btn active" id="filterAll">Todos</button>
        </div>

        <div class="table-wrapper">
          <div class="table-header items-cols">
            <span>ITEM</span><span>CATEGORIA</span><span>PREÇO</span>
            <span>DISPONÍVEL</span><span style="text-align:right">AÇÕES</span>
          </div>
          <div id="itemList">
            <div class="empty-state"><i class="bi bi-hourglass"></i><p>Carregando...</p></div>
          </div>
        </div>
      </main>
    </div>
  `;

  initSidebarLogout(logout);

  document.getElementById('btnAdd').addEventListener('click', () =>
    document.getElementById('addDropdown').classList.toggle('open'));

  document.addEventListener('click', e => {
    if (!e.target.closest('.add-menu'))
      document.getElementById('addDropdown')?.classList.remove('open');
  });

  document.getElementById('searchInput').addEventListener('input', function () {
    searchTerm = this.value.toLowerCase();
    renderItems();
  });

  document.getElementById('filterAll').addEventListener('click', function () {
    setFilter('all', this);
  });

  // Confirm delete bindings
  document.getElementById('confirmOk').addEventListener('click', async () => {
    if (!deleteKey) return;
    await remove(ref(db, `produtos/${deleteKey}`));
    showToast('Item excluído.');
    document.getElementById('confirmOverlay').classList.remove('open');
    deleteKey = null;
  });
  document.getElementById('confirmCancel').addEventListener('click', () =>
    document.getElementById('confirmOverlay').classList.remove('open'));

  const p = new URLSearchParams(location.search);
  if (p.get('toast')) {
    showToast(decodeURIComponent(p.get('toast')));
    history.replaceState({}, '', 'itens.html');
  }

  loadData();
});

// ── Load ──────────────────────────────────────────────────────────────────────
function loadData() {
  get(ref(db, 'categorias')).then(snap => {
    allCats = snap.val() || {};
    buildFilterBtns();
  });
  onValue(ref(db, 'produtos'), snap => {
    allItems = snap.val() || {};
    renderItems();
  });
}

function buildFilterBtns() {
  const bar    = document.getElementById('filterBar');
  const sorted = Object.entries(allCats).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));
  sorted.forEach(([key, cat]) => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn';
    btn.textContent = cat.nome;
    btn.addEventListener('click', () => setFilter(key, btn));
    bar.appendChild(btn);
  });
}

function setFilter(cat, el) {
  filterCat = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderItems();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderItems() {
  const filtered = Object.entries(allItems).filter(([, item]) => {
    const matchCat    = filterCat === 'all' || item.categoria === filterCat;
    const matchSearch = !searchTerm ||
      (item.nome      || '').toLowerCase().includes(searchTerm) ||
      (item.categoria || '').toLowerCase().includes(searchTerm);
    return matchCat && matchSearch;
  });

  const count = filtered.length;
  document.getElementById('itemCount').textContent =
    `${count} item${count !== 1 ? 's' : ''} cadastrado${count !== 1 ? 's' : ''}`;

  if (!count) {
    document.getElementById('itemList').innerHTML =
      '<div class="empty-state"><i class="bi bi-inbox"></i><p>Nenhum item encontrado</p></div>';
    return;
  }

  document.getElementById('itemList').innerHTML = filtered.map(([key, item]) => {
    const catNome    = allCats[item.categoria]?.nome || item.categoria || '–';
    const tipoBadge  = item.tipo === 'montavel'
      ? '<span class="tipo-badge tipo-montavel">Montável</span>'
      : item.tipo === 'opcional'
        ? '<span class="tipo-badge tipo-opcional">Opcional</span>'
        : '<span class="tipo-badge tipo-simples">Simples</span>';

    return `
      <div class="table-row items-cols">
        <div class="item-info">
          <div class="item-thumb">
            ${item.imagem ? `<img src="${item.imagem}" />` : '<i class="bi bi-image" style="color:#ccc"></i>'}
          </div>
          <div>
            <div class="item-name">${item.nome || '–'}</div>
            <div style="display:flex;gap:4px;margin-top:2px;">
              ${item.destaque ? '<span class="item-badge">Destaque</span>' : ''}
              ${tipoBadge}
            </div>
          </div>
        </div>
        <div class="item-category">${catNome}</div>
        <div class="item-price">${item.preco ? formatBRL(item.preco) : '–'}</div>
        <div class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" ${item.ativo !== false ? 'checked' : ''}
              data-key="${key}" class="toggle-ativo" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="actions-cell">
          <button class="btn-icon edit" data-key="${key}" data-tipo="${item.tipo || 'simples'}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-icon del" data-key="${key}" data-nome="${item.nome || 'item'}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind events after render
  document.querySelectorAll('.toggle-ativo').forEach(chk =>
    chk.addEventListener('change', () =>
      update(ref(db, `produtos/${chk.dataset.key}`), { ativo: chk.checked })));

  document.querySelectorAll('.actions-cell .edit').forEach(btn =>
    btn.addEventListener('click', () => editItem(btn.dataset.key, btn.dataset.tipo)));

  document.querySelectorAll('.actions-cell .del').forEach(btn =>
    btn.addEventListener('click', () => askDelete(btn.dataset.key, btn.dataset.nome)));
}

function editItem(key, tipo) {
  if (tipo === 'montavel')      window.location.href = `item-montavel-grupo.html?key=${key}`;
  else if (tipo === 'opcional') window.location.href = `item-montavel-simples.html?key=${key}`;
  else                          window.location.href = `item-simples.html?key=${key}`;
}

function askDelete(key, nome) {
  deleteKey = key;
  document.getElementById('confirmName').textContent = nome;
  document.getElementById('confirmOverlay').classList.add('open');
}
