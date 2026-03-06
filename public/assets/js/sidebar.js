// sidebar.js
export function renderSidebar(active) {
  const items = [
    { key: 'dashboard',   href: 'dashboard.html',  icon: 'bi-grid',              label: 'Dashboard' },
    { key: 'itens',       href: 'itens.html',       icon: 'bi-menu-button-wide',  label: 'Itens do Menu' },
    { key: 'categorias',  href: 'categorias.html',  icon: 'bi-folder',            label: 'Categorias' },
  ];

  const navLinks = items.map(it => `
    <a href="${it.href}" class="${active === it.key ? 'active' : ''}">
      <i class="bi ${it.icon}"></i> ${it.label}
    </a>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-avatar">NK</div>
        <div class="brand-info">
          <div class="brand-name">Niko Trudel</div>
          <div class="brand-role">Painel Admin</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-label">Menu</div>
        ${navLinks}
      </nav>
      <div class="sidebar-footer">
        <a href="index.html" target="_blank"><i class="bi bi-box-arrow-up-right"></i> Ver Cardápio</a>
        <a href="#" class="danger" id="btnSair"><i class="bi bi-box-arrow-right"></i> Sair</a>
      </div>
    </aside>
  `;
}

export function initSidebarLogout(logoutFn) {
  const btn = document.getElementById('btnSair');
  if (btn) btn.addEventListener('click', e => { e.preventDefault(); logoutFn(); });
}
