// item-montavel-nikofesta.js
// Exclusivo para produtos Niko Festas.
//
// O cardápio detecta automaticamente o tipo pelo banco:
//   - Se algum grupo tem controleQuantidade:true → renderizarModalFesta
//
// Grupos suportados:
//   tipoSelecao:"radio" + chaves numéricas   → grupo quantidade (preço + qtdTotal)
//   tipoSelecao:"radio" outros               → radio normal (ex: massa)
//   gKey === "topping" + radio               → inline por recheio no cardápio (não vira seção)
//   tipoSelecao:"checkbox" + controleQtd     → contador +/− (recheio, sabor, tipo)
//   tipoSelecao:"checkbox" sem controleQtd   → checkboxes com limiteDinamicoPorQuantidade

import { db, storage, ref, get, set, update, requireAuth, logout, showToast, slugify } from './firebase-config.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

const params     = new URLSearchParams(location.search);
const editKey    = params.get('key');
let existingData = null;
let grupos       = [];
let imagemPath   = '';

requireAuth().then(() => {
  const titulo = editKey ? 'Editar Produto Niko Festas' : 'Novo Produto Niko Festas';
  document.getElementById('app').innerHTML = renderSidebar('itens') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">${titulo}</span></div>
      <main class="main">
        <button class="back-btn" id="btnBack"><i class="bi bi-arrow-left"></i> Voltar</button>
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h1 class="page-title">${titulo}</h1>
            <p class="page-subtitle">Produto de festa com quantidade mínima, contadores e topping por recheio</p>
          </div>
        </div>
        <div class="form-card">
          <div class="section-divider"><i class="bi bi-info-circle"></i> Informações Gerais</div>
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="nome" placeholder="Ex: Mini Trudel – Monte o Seu" />
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-control" id="descricao" rows="2"
              placeholder="Ex: Pedido mínimo de 30 unidades por recheio."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Preço base (R$)</label>
              <input class="form-control" id="preco" type="number" step="0.01" min="0" placeholder="0.00" />
              <div class="hint">Deixe 0 — o preço é definido pelo grupo de quantidade</div>
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
              <div class="hint">Ex: 30 para Mini Trudel, 25 para Diversos</div>
            </div>
            <div class="form-group">
              <label class="form-label">Ordem de exibição</label>
              <input class="form-control" id="ordem" type="number" value="0" />
            </div>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label">Imagem do produto</label>
            <input class="form-control" id="imagem" type="file" accept="image/*" />
            <div id="imagemPreview" style="margin-top:8px;"></div>
          </div>
          <div class="form-toggle-row">
            <span class="form-toggle-label">Disponível</span>
            <label class="toggle"><input type="checkbox" id="ativo" checked /><span class="toggle-slider"></span></label>
          </div>

          <div class="section-divider" style="margin-top:24px;"><i class="bi bi-layers"></i> Grupos de Opções</div>
          <ul class="hint" style="margin-bottom:16px;padding-left:16px;">
            <li>Radio com chaves numéricas (ex: "30", "50") → define preço e quantidade total</li>
            <li>Checkbox + Controle de Qtd → contador +/− por sabor</li>
            <li>Checkbox sem Controle → checkboxes com limite dinâmico (ex: base Diversos)</li>
            <li>Chave <strong>topping</strong> + radio → aparece inline por recheio no cardápio</li>
          </ul>
          <div id="gruposContainer"></div>
          <button class="btn-add-grupo" id="btnAddGrupo">
            <i class="bi bi-plus-circle"></i> Adicionar Grupo
          </button>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button class="btn-outline" id="btnCancel">Cancelar</button>
            <button class="btn-primary" id="btnSalvar"><i class="bi bi-check-lg"></i> Salvar</button>
          </div>
        </div>
      </main>
    </div>
  `;

  initSidebarLogout(logout);
  document.getElementById('btnBack').addEventListener('click',   () => history.back());
  document.getElementById('btnCancel').addEventListener('click', () => history.back());
  document.getElementById('categoria').addEventListener('change', loadSubcats);
  document.getElementById('btnAddGrupo').addEventListener('click', () => addGrupo());
  document.getElementById('btnSalvar').addEventListener('click', salvar);
  document.getElementById('imagem').addEventListener('change', previewImagem);

  loadCats();
  if (editKey) loadItem();
  else addGrupo();
});

// ── Firebase ──────────────────────────────────────────────────────────────────
function loadCats() {
  get(ref(db, 'categorias')).then(snap => {
    const sel = document.getElementById('categoria');
    Object.entries(snap.val() || {})
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .forEach(([k, c]) => {
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
    Object.entries(snap.val() || {})
      .filter(([, s]) => s.categoria === catKey)
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .forEach(([k, s]) => {
        const o = document.createElement('option'); o.value = k; o.textContent = s.nome; sel.appendChild(o);
      });
    if (existingData?.subcategoria) sel.value = existingData.subcategoria;
  });
}

function loadItem() {
  get(ref(db, `produtos/${editKey}`)).then(async snap => {
    existingData = snap.val();
    if (!existingData) return;
    document.getElementById('nome').value         = existingData.nome         || '';
    document.getElementById('descricao').value    = existingData.descricao    || '';
    document.getElementById('preco').value        = existingData.preco        || 0;
    document.getElementById('pedidoMinimo').value = existingData.pedidoMinimo || 0;
    document.getElementById('ordem').value        = existingData.ordem        || 0;
    document.getElementById('ativo').checked      = existingData.ativo !== false;

    imagemPath = existingData.imagemPath || existingData.imagem || '';
    if (imagemPath) {
      try {
        const url = await getDownloadURL(storageRef(storage, imagemPath));
        document.getElementById('imagemPreview').innerHTML =
          `<img src="${url}" style="max-height:120px;border-radius:8px;" />`;
      } catch { /* sem preview */ }
    }

    grupos = Object.entries(existingData.grupos || {})
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .map(([key, g]) => ({
        key,
        titulo:                      g.titulo                   || '',
        ordem:                       g.ordem                    || 1,
        obrigatorio:                 !!g.obrigatorio,
        tipoSelecao:                 g.tipoSelecao              || 'radio',
        controleQuantidade:          !!g.controleQuantidade,
        minimoPorItem:               g.minimoPorItem            || 0,
        incremento:                  g.incremento               || 1,
        maximoSabores:               g.maximoSabores            || 0,
        somaDeveFecharQuantidade:    !!g.somaDeveFecharQuantidade,
        limiteDinamicoPorQuantidade: g.limiteDinamicoPorQuantidade || null,
        opcoes: Object.entries(g.opcoes || {}).map(([k, op]) => ({
          key: k, nome: op.nome || '', preco: op.preco || 0
        })),
        _collapsed: false
      }));

    renderAllGrupos();
    if (document.getElementById('categoria').options.length > 1) {
      document.getElementById('categoria').value = existingData.categoria || '';
      loadSubcats();
    }
  });
}

// ── Imagem ────────────────────────────────────────────────────────────────────
function previewImagem(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('imagemPreview').innerHTML =
    `<img src="${URL.createObjectURL(file)}" style="max-height:120px;border-radius:8px;" />`;
}
async function uploadImagem(prodKey) {
  const file = document.getElementById('imagem').files[0];
  if (!file) return imagemPath;
  const path = `produtos/${prodKey}/${Date.now()}_${file.name}`;
  await uploadBytes(storageRef(storage, path), file);
  return path;
}

// ── Grupos UI ─────────────────────────────────────────────────────────────────
function addGrupo() {
  grupos.push({
    key: '', titulo: '', ordem: grupos.length + 1,
    obrigatorio: false, tipoSelecao: 'radio',
    controleQuantidade: false, minimoPorItem: 0, incremento: 1,
    maximoSabores: 0, somaDeveFecharQuantidade: false,
    limiteDinamicoPorQuantidade: null, opcoes: [], _collapsed: false
  });
  renderAllGrupos();
  document.getElementById('gruposContainer').lastElementChild
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function removeGrupo(idx) {
  if (!confirm('Remover este grupo?')) return;
  grupos.splice(idx, 1);
  renderAllGrupos();
}
function toggleCollapse(idx) {
  grupos[idx]._collapsed = !grupos[idx]._collapsed;
  document.getElementById(`gb_${idx}`).classList.toggle('collapsed', grupos[idx]._collapsed);
  document.getElementById(`gc_${idx}`).querySelector('i').className =
    `bi bi-chevron-${grupos[idx]._collapsed ? 'down' : 'up'}`;
}
function addOpcao(gIdx)         { grupos[gIdx].opcoes.push({ key: '', nome: '', preco: 0 }); renderAllGrupos(); }
function removeOpcao(gIdx, oIdx){ grupos[gIdx].opcoes.splice(oIdx, 1); renderAllGrupos(); }

function getQtdKeys() {
  const qtdGrupo = grupos.find(g =>
    g.tipoSelecao === 'radio' && g.opcoes.some(op => op.key !== '' && !isNaN(Number(op.key)))
  );
  return qtdGrupo ? qtdGrupo.opcoes.filter(op => op.key !== '' && !isNaN(Number(op.key))).map(op => op.key) : [];
}

function renderLimiteDinamicoFields(idx) {
  const container = document.getElementById(`ld_${idx}`);
  if (!container) return;
  const qtdKeys = getQtdKeys();
  if (!qtdKeys.length) {
    container.innerHTML = '<div class="hint" style="color:#92400E">Adicione o grupo de quantidade (radio, chaves numéricas) para configurar os limites.</div>';
    return;
  }
  const limites = grupos[idx].limiteDinamicoPorQuantidade || {};
  container.innerHTML = qtdKeys.map(k => `
    <div class="limite-row">
      <label>${k} unidades:</label>
      <input class="form-control" type="number" min="1" id="ld_${idx}_${k}"
        value="${limites[k] || ''}" placeholder="Máx. seleções" />
    </div>
  `).join('');
  qtdKeys.forEach(k => {
    document.getElementById(`ld_${idx}_${k}`)?.addEventListener('input', e => {
      if (!grupos[idx].limiteDinamicoPorQuantidade) grupos[idx].limiteDinamicoPorQuantidade = {};
      const v = parseInt(e.target.value);
      if (v > 0) grupos[idx].limiteDinamicoPorQuantidade[k] = v;
      else       delete grupos[idx].limiteDinamicoPorQuantidade[k];
    });
  });
}

function renderAllGrupos() {
  const container = document.getElementById('gruposContainer');
  container.innerHTML = '';

  grupos.forEach((g, idx) => {
    const isCheckbox   = g.tipoSelecao === 'checkbox';
    const hasContador  = isCheckbox && g.controleQuantidade;
    const hasLimiteDin = isCheckbox && !g.controleQuantidade;

    const card = document.createElement('div');
    card.className = 'grupo-card';
    card.innerHTML = `
      <div class="grupo-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="grupo-title-badge">Grupo ${idx + 1}</span>
          <span style="font-size:13.5px;font-weight:700;">${g.titulo || '(sem título)'}</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" id="gc_${idx}">
            <i class="bi bi-chevron-${g._collapsed ? 'down' : 'up'}"></i>
          </button>
          <button class="btn-icon del" id="gr_${idx}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div class="grupo-body ${g._collapsed ? 'collapsed' : ''}" id="gb_${idx}">
        <div class="grupo-form-row">
          <div class="form-group" style="margin:0">
            <label class="form-label">Chave do grupo *</label>
            <input class="form-control" id="gk_${idx}" placeholder="Ex: recheio, topping"
              value="${g.key}" />
            <div class="hint">Use "topping" para inline no cardápio</div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Título *</label>
            <input class="form-control" id="gt_${idx}" placeholder="Ex: Recheio" value="${g.titulo}" />
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

        ${isCheckbox ? `
          <div class="checkbox-config">
            <div class="form-label"><i class="bi bi-sliders"></i> Configurações de Quantidade</div>
            <div class="grupo-form-row">
              <div class="form-group" style="margin:0">
                <label class="form-label">Controle de Qtd?</label>
                <select class="form-control" id="gcq_${idx}">
                  <option value="false" ${!g.controleQuantidade ? 'selected' : ''}>Não (checkboxes)</option>
                  <option value="true"  ${g.controleQuantidade  ? 'selected' : ''}>Sim (+/− por item)</option>
                </select>
              </div>
              ${hasContador ? `
                <div class="form-group" style="margin:0">
                  <label class="form-label">Mínimo por item</label>
                  <input class="form-control" id="gm_${idx}" type="number" min="0" value="${g.minimoPorItem || 0}" />
                </div>
                <div class="form-group" style="margin:0">
                  <label class="form-label">Incremento</label>
                  <input class="form-control" id="gi_${idx}" type="number" min="1" value="${g.incremento || 1}" />
                </div>
                <div class="form-group" style="margin:0">
                  <label class="form-label">Máx. sabores</label>
                  <input class="form-control" id="gms_${idx}" type="number" min="0" value="${g.maximoSabores || 0}" />
                  <div class="hint">0 = sem limite</div>
                </div>
              ` : ''}
            </div>
            ${hasContador ? `
              <div class="form-toggle-row" style="padding:8px 0 0;border:none;">
                <span class="form-toggle-label" style="font-size:12.5px;">Soma deve fechar a quantidade total</span>
                <label class="toggle">
                  <input type="checkbox" id="gs_${idx}" ${g.somaDeveFecharQuantidade ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            ` : ''}
            ${hasLimiteDin ? `
              <div class="limite-dinamico-config">
                <div class="form-label"><i class="bi bi-diagram-3"></i> Limite dinâmico por quantidade</div>
                <div class="hint" style="color:#92400E;margin-bottom:8px;">
                  Quantas opções o cliente pode marcar conforme a quantidade escolhida
                </div>
                <div id="ld_${idx}"></div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <label class="form-label">Opções</label>
        <div id="oc_${idx}">
          ${g.opcoes.map((op, oIdx) => `
            <div class="opcao-row" id="op_${idx}_${oIdx}">
              <input class="form-control" style="flex:2" placeholder="Nome" value="${op.nome}"
                data-g="${idx}" data-o="${oIdx}" data-field="nome" />
              <input class="form-control" style="flex:1;max-width:110px" type="number" step="0.01" min="0"
                placeholder="Preço (R$)" value="${op.preco || ''}"
                data-g="${idx}" data-o="${oIdx}" data-field="preco" />
              <button class="btn-remove" data-g="${idx}" data-o="${oIdx}"><i class="bi bi-trash"></i></button>
            </div>
          `).join('')}
        </div>
        <button class="btn-add-opcao" id="bao_${idx}"><i class="bi bi-plus"></i> Adicionar opção</button>
      </div>
    `;
    container.appendChild(card);

    document.getElementById(`gc_${idx}`).addEventListener('click', () => toggleCollapse(idx));
    document.getElementById(`gr_${idx}`).addEventListener('click', () => removeGrupo(idx));
    document.getElementById(`gk_${idx}`).addEventListener('input', e => { grupos[idx].key = e.target.value.trim(); });
    document.getElementById(`gt_${idx}`).addEventListener('input', e => {
      grupos[idx].titulo = e.target.value;
      card.querySelector('.grupo-header span:nth-child(2)').textContent = e.target.value || '(sem título)';
    });
    document.getElementById(`gts_${idx}`).addEventListener('change', e => {
      grupos[idx].tipoSelecao = e.target.value; renderAllGrupos();
    });
    document.getElementById(`go_${idx}`).addEventListener('change',  e => { grupos[idx].obrigatorio = e.target.value === 'true'; });
    document.getElementById(`bao_${idx}`).addEventListener('click',  () => addOpcao(idx));

    if (isCheckbox) {
      document.getElementById(`gcq_${idx}`).addEventListener('change', e => {
        grupos[idx].controleQuantidade = e.target.value === 'true'; renderAllGrupos();
      });
      if (hasContador) {
        document.getElementById(`gm_${idx}`).addEventListener('input',  e => { grupos[idx].minimoPorItem = parseInt(e.target.value) || 0; });
        document.getElementById(`gi_${idx}`).addEventListener('input',  e => { grupos[idx].incremento    = parseInt(e.target.value) || 1; });
        document.getElementById(`gms_${idx}`).addEventListener('input', e => { grupos[idx].maximoSabores = parseInt(e.target.value) || 0; });
        document.getElementById(`gs_${idx}`).addEventListener('change', e => { grupos[idx].somaDeveFecharQuantidade = e.target.checked; });
      }
      if (hasLimiteDin) renderLimiteDinamicoFields(idx);
    }

    card.querySelectorAll('.opcao-row input').forEach(inp => {
      inp.addEventListener('input', e => {
        const gi = parseInt(e.target.dataset.g), oi = parseInt(e.target.dataset.o);
        if (e.target.dataset.field === 'nome') grupos[gi].opcoes[oi].nome  = e.target.value;
        else                                   grupos[gi].opcoes[oi].preco = parseFloat(e.target.value) || 0;
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
    const gKey    = (g.key || slugify(g.titulo || `grupo_${idx + 1}`)).trim();
    const opcsObj = {};
    g.opcoes.forEach(op => {
      if (!op.nome.trim()) return;
      opcsObj[op.key || slugify(op.nome)] = { nome: op.nome, ...(op.preco ? { preco: op.preco } : {}) };
    });
    const gData = { titulo: g.titulo, ordem: idx + 1, obrigatorio: g.obrigatorio, tipoSelecao: g.tipoSelecao, opcoes: opcsObj };
    if (g.tipoSelecao === 'checkbox') {
      gData.controleQuantidade       = g.controleQuantidade;
      gData.minimoPorItem            = g.minimoPorItem;
      gData.incremento               = g.incremento;
      gData.somaDeveFecharQuantidade = g.somaDeveFecharQuantidade;
      if (g.maximoSabores) gData.maximoSabores = g.maximoSabores;
      const ld = g.limiteDinamicoPorQuantidade;
      if (ld && Object.keys(ld).length) gData.limiteDinamicoPorQuantidade = ld;
    }
    gruposObj[gKey] = gData;
  });

  const prodKey      = editKey || `${slugify(nome)}_${Date.now()}`;
  const pedidoMinimo = parseInt(document.getElementById('pedidoMinimo').value) || 0;
  const subcategoria = document.getElementById('subcategoria').value || null;

  document.getElementById('loadingOverlay').classList.add('show');
  try {
    const novaImagem = await uploadImagem(prodKey);
    const data = {
      nome,
      descricao:  document.getElementById('descricao').value.trim(),
      preco:      parseFloat(document.getElementById('preco').value) || 0,
      categoria:  document.getElementById('categoria').value,
      ordem:      parseInt(document.getElementById('ordem').value) || 0,
      ativo:      document.getElementById('ativo').checked,
      tipo:       'montavel',
      subtipo:    'festa',
      grupos:     gruposObj,
      ...(novaImagem   && { imagemPath: novaImagem }),
      ...(subcategoria && { subcategoria }),
      ...(pedidoMinimo && { pedidoMinimo })
    };
    if (editKey) await update(ref(db, `produtos/${editKey}`), data);
    else         await set(ref(db, `produtos/${prodKey}`), data);
    window.location.href = 'itens.html?toast=' + encodeURIComponent('Item salvo com sucesso!');
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar.', 'error');
    document.getElementById('loadingOverlay').classList.remove('show');
  }
}
