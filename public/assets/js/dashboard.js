// dashboard.js
import { db, ref, get, requireAuth, logout, formatBRL, showToast } from './firebase-config.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

requireAuth().then(() => {
  const app = document.getElementById('app');
  app.innerHTML = renderSidebar('dashboard') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">Dashboard</span></div>
      <main class="main">
        <div class="section-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Resumo do seu cardápio</p>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-icon purple"><i class="bi bi-scissors"></i></div>
            <div><div class="stat-value" id="s-total">–</div><div class="stat-label">Total de Itens</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon yellow"><i class="bi bi-folder2-open"></i></div>
            <div><div class="stat-value" id="s-cats">–</div><div class="stat-label">Categorias</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber"><i class="bi bi-star"></i></div>
            <div><div class="stat-value" id="s-dest">–</div><div class="stat-label">Destaques</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red"><i class="bi bi-x-circle"></i></div>
            <div><div class="stat-value" id="s-indisp">–</div><div class="stat-label">Indisponíveis</div></div>
          </div>
        </div>

        <h2 style="font-size:16px;font-weight:800;margin:28px 0 12px;">Itens Recentes</h2>
        <div class="recent-list" id="recentList">
          <div class="empty-state"><i class="bi bi-clock-history"></i><p>Carregando...</p></div>
        </div>
      </main>
    </div>
  `;

  initSidebarLogout(logout);

  const p = new URLSearchParams(location.search);
  if (p.get('toast')) {
    showToast(decodeURIComponent(p.get('toast')));
    history.replaceState({}, '', 'dashboard.html');
  }

  Promise.all([
    get(ref(db, 'produtos')),
    get(ref(db, 'categorias'))
  ]).then(([prodSnap, catSnap]) => {
    const prods = prodSnap.val() || {};
    const cats  = catSnap.val()  || {};
    const arr   = Object.values(prods);

    document.getElementById('s-total').textContent  = arr.length;
    document.getElementById('s-cats').textContent   = Object.keys(cats).length;
    document.getElementById('s-dest').textContent   = arr.filter(p => p.destaque).length;
    document.getElementById('s-indisp').textContent = arr.filter(p => p.ativo === false).length;

    const recentes = arr.slice(-5).reverse();
    if (!recentes.length) {
      document.getElementById('recentList').innerHTML =
        '<div class="empty-state"><i class="bi bi-inbox"></i><p>Nenhum item cadastrado</p></div>';
      return;
    }

    document.getElementById('recentList').innerHTML = recentes.map(prod => `
      <div class="recent-item">
        <div class="item-thumb">
          ${prod.imagem ? `<img src="${prod.imagem}" />` : '<i class="bi bi-image" style="color:#ccc"></i>'}
        </div>
        <div class="recent-info">
          <div class="recent-name">${prod.nome || '–'}</div>
          <div class="recent-cat">${prod.categoria || ''}</div>
        </div>
        ${prod.preco ? `<div class="recent-price">${formatBRL(prod.preco)}</div>` : ''}
        <span class="badge-ativo">${prod.ativo !== false ? 'Ativo' : 'Inativo'}</span>
      </div>
    `).join('');
  });
});
