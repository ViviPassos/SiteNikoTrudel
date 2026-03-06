// item-montavel-grupo.js
import { db, ref, get, set, update, requireAuth, logout, showToast, slugify } from './firebase-config.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

const params     = new URLSearchParams(location.search);
const editKey    = params.get('key');
let existingData = null;
let grupos       = [];

requireAuth().then(() => {
  const titulo = editKey ? 'Editar Montável com Grupos' : 'Novo Montável com Grupos';
  document.getElementById('app').innerHTML = renderSidebar('itens') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">${titulo}</span></div>
      <main class="main">
        <button class="back-btn" id="btnBack"><i class="bi bi-arrow-left"></i> Voltar</button>
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h1 class="page-title">${titulo}</h1>
            <p class="page-subtitle">Item configurável com múltiplos grupos de opções</p>
          </div>
        </div>
        <div class="form-card">
          <div class="section-divider"><i class="bi bi-info-circle"></i> Informações Gerais</div>
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="nome" placeholder="Ex: Monte seu Trudel - Doce" />
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-control" id="descricao" rows="2" placeholder="Descreva o item..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Preço base (R$)</label>
              <input class="form-control" id="preco" type="number" step="0.01" min="0" placeholder="0.00" />
              <div class="hint">Deixe 0 se o preço é definido pelas opções</div>
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-control" id="categoria"><option value="">Selecione...</option></select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Subcategoria</label>
            <select class="form-control" id="subcategoria"><option value="">Selecione a categoria primeiro</option></select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Pedido mínimo (unidades)</label>
              <input class="form-control" id="pedidoMinimo" type="number" min="0" placeholder="0" />
              <div class="hint">Deixe 0 se não há mínimo</div>
            </div>
            <div class="form-group">
              <label class="form-label">Ordem de exibição</label>
              <input class="form-control" id="ordem" type="number" value="0" />
            </div>
          </div>
          <div class="form-toggle-row">
            <span class="form-toggle-label">Disponível</span>
            <label class="toggle"><input type="checkbox" id="ativo" checked /><span class="toggle-slider"></span></label>
          </div>

          <div class="section-divider" style="margin-top:24px;"><i class="bi bi-layers"></i> Grupos de Opções</div>
          <p class="hint" style="margin-bottom:16px;">Cada grupo representa uma etapa de escolha (ex: Massa, Recheio, Topping).</p>

          <div id="gruposContainer"></div>
          <button class="btn-add-grupo" id="btnAddGrupo"><i class="bi bi-plus-circle"></i> Adicionar Grupo</button>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button class="btn-outline" id="btnCancel">Cancelar</button>
            <button class="btn-primary" id="btnSalvar"><i class="bi bi-check-lg"></i> Salvar</button>
          </div>
        </div>
      </main>
    </div>
  `;

  initSidebarLogout(logout);
  document.getElementById('btnBack').addEventListener('click', () => history.back());
  document.getElementById('btnCancel').addEventListener('click', () => history.back());
  document.getElementById('categoria').addEventListener('change', loadSubcats);
  document.getElementById('btnAddGrupo').addEventListener('click', () => addGrupo());
  document.getElementById('btnSalvar').addEventListener('click', salvar);

  loadCats();
  if (editKey) loadItem();
  else addGrupo();
});

// ── Firebase helpers ──────────────────────────────────────────────────────────
function loadCats() {
  get(ref(db, 'categorias')).then(snap => {
    const sel = document.getElementById('categoria');
    Object.entries(snap.val() || {}).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0)).forEach(([k, c]) => {
      const o = document.createElement('option'); o.value = k; o.textContent = c.nome; sel.appendChild(o);
    });
    if (existingData) { sel.value = existingData.categoria || ''; loadSubcats(); }
  });
}

function loadSubcats() {
  const catKey = document.getElementById('categoria').value;
  const sel    = document.getElementById('subcategoria');
  sel.innerHTML = '<option value="">Nenhuma</option>';
  get(ref(db, 'subcategorias')).then(snap => {
    Object.entries(snap.val() || {}).filter(([, s]) => s.categoria === catKey)
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .forEach(([k, s]) => {
        const o = document.createElement('option'); o.value = k; o.textContent = s.nome; sel.appendChild(o);
      });
    if (existingData?.subcategoria) sel.value = existingData.subcategoria;
  });
}

function loadItem() {
  get(ref(db, `produtos/${editKey}`)).then(snap => {
    existingData = snap.val();
    if (!existingData) return;
    document.getElementById('nome').value          = existingData.nome         || '';
    document.getElementById('descricao').value     = existingData.descricao    || '';
    document.getElementById('preco').value         = existingData.preco        || 0;
    document.getElementById('pedidoMinimo').value  = existingData.pedidoMinimo || 0;
    document.getElementById('ordem').value         = existingData.ordem        || 0;
    document.getElementById('ativo').checked       = existingData.ativo !== false;

    grupos = Object.entries(existingData.grupos || {})
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .map(([key, g]) => ({
        key, titulo: g.titulo || '', ordem: g.ordem || 1,
        obrigatorio: !!g.obrigatorio, tipoSelecao: g.tipoSelecao || 'radio',
        controleQuantidade: !!g.controleQuantidade, minimoPorItem: g.minimoPorItem || 0,
        incremento: g.incremento || 1, somaDeveFecharQuantidade: !!g.somaDeveFecharQuantidade,
        opcoes: Object.entries(g.opcoes || {}).map(([k, op]) => ({ key: k, nome: op.nome || '', preco: op.preco || 0 })),
        _collapsed: false
      }));
    renderAllGrupos();

    if (document.getElementById('categoria').options.length > 1) {
      document.getElementById('categoria').value = existingData.categoria || ''; loadSubcats();
    }
  });
}

// ── Grupos ────────────────────────────────────────────────────────────────────
function addGrupo() {
  grupos.push({
    key: '', titulo: '', ordem: grupos.length + 1,
    obrigatorio: false, tipoSelecao: 'radio',
    controleQuantidade: false, minimoPorItem: 0, incremento: 1,
    somaDeveFecharQuantidade: false, opcoes: [], _collapsed: false
  });
  renderAllGrupos();
  document.getElementById('gruposContainer').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeGrupo(idx) {
  if (!confirm('Remover este grupo?')) return;
  grupos.splice(idx, 1); renderAllGrupos();
}

function toggleCollapse(idx) {
  grupos[idx]._collapsed = !grupos[idx]._collapsed;
  document.getElementById(`gb_${idx}`).classList.toggle('collapsed', grupos[idx]._collapsed);
  document.getElementById(`gc_${idx}`).className = `bi bi-chevron-${grupos[idx]._collapsed ? 'down' : 'up'}`;
}

function addOpcao(gIdx) { grupos[gIdx].opcoes.push({ key: '', nome: '', preco: 0 }); renderAllGrupos(); }

function removeOpcao(gIdx, oIdx) { grupos[gIdx].opcoes.splice(oIdx, 1); renderAllGrupos(); }

function renderAllGrupos() {
  const container = document.getElementById('gruposContainer');
  container.innerHTML = '';
  grupos.forEach((g, idx) => {
    const card = document.createElement('div');
    card.className = 'grupo-card';
    card.innerHTML = `
      <div class="grupo-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="grupo-title-badge">Grupo ${idx + 1}</span>
          <span style="font-size:13.5px;font-weight:700;">${g.titulo || '(sem título)'}</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" id="gc_${idx}"><i class="bi bi-chevron-${g._collapsed ? 'down' : 'up'}"></i></button>
          <button class="btn-icon del" id="gr_${idx}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div class="grupo-body ${g._collapsed ? 'collapsed' : ''}" id="gb_${idx}">
        <div class="grupo-form-row">
          <div class="form-group" style="margin:0">
            <label class="form-label">Título do grupo *</label>
            <input class="form-control" id="gt_${idx}" placeholder="Ex: Massa" value="${g.titulo}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Tipo de seleção</label>
            <select class="form-control" id="gts_${idx}">
              <option value="radio"    ${g.tipoSelecao === 'radio'    ? 'selected' : ''}>Radio (1 opção)</option>
              <option value="checkbox" ${g.tipoSelecao === 'checkbox' ? 'selected' : ''}>Checkbox (múltiplas)</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Obrigatório?</label>
            <select class="form-control" id="go_${idx}">
              <option value="false" ${!g.obrigatorio ? 'selected' : ''}>Não</option>
              <option value="true"  ${g.obrigatorio  ? 'selected' : ''}>Sim</option>
            </select>
          </div>
        </div>
        ${g.tipoSelecao === 'checkbox' ? `
          <div class="checkbox-config">
            <div class="form-label"><i class="bi bi-sliders"></i> Configurações de Quantidade</div>
            <div class="grupo-form-row">
              <div class="form-group" style="margin:0">
                <label class="form-label">Controle de Qtd?</label>
                <select class="form-control" id="gcq_${idx}">
                  <option value="false" ${!g.controleQuantidade ? 'selected' : ''}>Não</option>
                  <option value="true"  ${g.controleQuantidade  ? 'selected' : ''}>Sim</option>
                </select>
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Mínimo por item</label>
                <input class="form-control" id="gm_${idx}" type="number" min="0" value="${g.minimoPorItem || 0}" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Incremento</label>
                <input class="form-control" id="gi_${idx}" type="number" min="1" value="${g.incremento || 1}" />
              </div>
            </div>
            <div class="form-toggle-row" style="padding:8px 0 0;border:none;">
              <span class="form-toggle-label" style="font-size:12.5px;">Soma deve fechar a quantidade total</span>
              <label class="toggle">
                <input type="checkbox" id="gs_${idx}" ${g.somaDeveFecharQuantidade ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        ` : ''}
        <label class="form-label">Opções</label>
        <div id="oc_${idx}">
          ${g.opcoes.map((op, oIdx) => `
            <div class="opcao-row" id="op_${idx}_${oIdx}">
              <input class="form-control" style="flex:2" placeholder="Nome da opção" value="${op.nome}" data-g="${idx}" data-o="${oIdx}" data-field="nome" />
              <input class="form-control" style="flex:1;max-width:120px" type="number" step="0.01" min="0" placeholder="Preço" value="${op.preco || ''}" data-g="${idx}" data-o="${oIdx}" data-field="preco" />
              <button class="btn-remove" data-g="${idx}" data-o="${oIdx}"><i class="bi bi-trash"></i></button>
            </div>
          `).join('')}
        </div>
        <button class="btn-add-opcao" id="bao_${idx}"><i class="bi bi-plus"></i> Adicionar opção</button>
      </div>
    `;
    container.appendChild(card);

    // Bind events for this card
    document.getElementById(`gc_${idx}`).addEventListener('click', () => toggleCollapse(idx));
    document.getElementById(`gr_${idx}`).addEventListener('click', () => removeGrupo(idx));
    document.getElementById(`gt_${idx}`).addEventListener('input', e => {
      grupos[idx].titulo = e.target.value;
      card.querySelector('.grupo-header span:last-child').textContent = e.target.value || '(sem título)';
    });
    document.getElementById(`gts_${idx}`).addEventListener('change', e => { grupos[idx].tipoSelecao = e.target.value; renderAllGrupos(); });
    document.getElementById(`go_${idx}`).addEventListener('change',  e => { grupos[idx].obrigatorio = e.target.value === 'true'; });
    document.getElementById(`bao_${idx}`).addEventListener('click',  () => addOpcao(idx));

    if (g.tipoSelecao === 'checkbox') {
      document.getElementById(`gcq_${idx}`).addEventListener('change', e => { grupos[idx].controleQuantidade = e.target.value === 'true'; });
      document.getElementById(`gm_${idx}`).addEventListener('input',   e => { grupos[idx].minimoPorItem = parseInt(e.target.value) || 0; });
      document.getElementById(`gi_${idx}`).addEventListener('input',   e => { grupos[idx].incremento    = parseInt(e.target.value) || 1; });
      document.getElementById(`gs_${idx}`).addEventListener('change',  e => { grupos[idx].somaDeveFecharQuantidade = e.target.checked; });
    }

    // Opcao field bindings
    card.querySelectorAll('.opcao-row input').forEach(inp => {
      inp.addEventListener('input', e => {
        const g = parseInt(e.target.dataset.g), o = parseInt(e.target.dataset.o);
        if (e.target.dataset.field === 'nome') grupos[g].opcoes[o].nome  = e.target.value;
        else                                   grupos[g].opcoes[o].preco = parseFloat(e.target.value) || 0;
      });
    });
    card.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => removeOpcao(parseInt(btn.dataset.g), parseInt(btn.dataset.o)));
    });
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function salvar() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome)          { showToast('Nome é obrigatório.', 'error');           return; }
  if (!grupos.length) { showToast('Adicione pelo menos um grupo.', 'error'); return; }

  const gruposObj = {};
  grupos.forEach((g, idx) => {
    const gKey    = g.key || slugify(g.titulo || `grupo_${idx + 1}`);
    const opcsObj = {};
    g.opcoes.forEach(op => {
      if (!op.nome.trim()) return;
      opcsObj[op.key || slugify(op.nome)] = { nome: op.nome, preco: op.preco || 0 };
    });
    const gData = { titulo: g.titulo, ordem: idx + 1, obrigatorio: g.obrigatorio, tipoSelecao: g.tipoSelecao, opcoes: opcsObj };
    if (g.tipoSelecao === 'checkbox') {
      gData.controleQuantidade      = g.controleQuantidade;
      gData.minimoPorItem           = g.minimoPorItem;
      gData.incremento              = g.incremento;
      gData.somaDeveFecharQuantidade = g.somaDeveFecharQuantidade;
    }
    gruposObj[gKey] = gData;
  });

  const pedidoMinimo = parseInt(document.getElementById('pedidoMinimo').value) || 0;
  const subcategoria = document.getElementById('subcategoria').value || null;
  const data = {
    nome,
    descricao:  document.getElementById('descricao').value.trim(),
    preco:      parseFloat(document.getElementById('preco').value) || 0,
    categoria:  document.getElementById('categoria').value,
    ordem:      parseInt(document.getElementById('ordem').value) || 0,
    ativo:      document.getElementById('ativo').checked,
    tipo:       'montavel',
    grupos:     gruposObj,
    ...(subcategoria  && { subcategoria }),
    ...(pedidoMinimo  && { pedidoMinimo })
  };

  document.getElementById('loadingOverlay').classList.add('show');
  try {
    if (editKey) await update(ref(db, `produtos/${editKey}`), data);
    else         await set(ref(db, `produtos/${slugify(nome)}_${Date.now()}`), data);
    window.location.href = 'itens.html?toast=' + encodeURIComponent('Item salvo com sucesso!');
  } catch {
    showToast('Erro ao salvar.', 'error');
    document.getElementById('loadingOverlay').classList.remove('show');
  }
}
