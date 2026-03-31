// item-montavel-simples.js
// Usado para: produtos tipo "opcional" — item com preço fixo + grupo de adicionais
// Exemplos: Trudel Dog, Brownie avulso com cobertura
import { db, storage, ref, get, set, update, requireAuth, logout, showToast, slugify } from './firebase-config.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

const params     = new URLSearchParams(location.search);
const editKey    = params.get('key');
let existingData = null;
let opcoes       = [];
let imagemPath   = '';

requireAuth().then(() => {
  const titulo = editKey ? 'Editar Item Opcional' : 'Novo Item Opcional';
  document.getElementById('app').innerHTML = renderSidebar('itens') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">${titulo}</span></div>
      <main class="main">
        <button class="back-btn" id="btnBack"><i class="bi bi-arrow-left"></i> Voltar</button>
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h1 class="page-title">${titulo}</h1>
            <p class="page-subtitle">Item com preço fixo e grupo de adicionais (ex: Trudel Dog com coberturas)</p>
          </div>
        </div>
        <div class="form-card">
          <div class="section-divider"><i class="bi bi-info-circle"></i> Informações Gerais</div>
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="nome" placeholder="Ex: Trudel Dog" />
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-control" id="descricao" rows="2" placeholder="Descreva o item..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Preço base (R$) *</label>
              <input class="form-control" id="preco" type="number" step="0.01" min="0" placeholder="0.00" />
              <div class="hint">Preço base do item (sem adicionais)</div>
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
          <div class="form-toggle-row">
            <span class="form-toggle-label">Destaque</span>
            <label class="toggle"><input type="checkbox" id="destaque" /><span class="toggle-slider"></span></label>
          </div>

          <div class="section-divider" style="margin-top:24px;"><i class="bi bi-plus-square"></i> Grupo de Adicionais</div>
          <p class="hint" style="margin-bottom:12px;">Opções que o cliente pode escolher ao pedir (ex: coberturas, extras).</p>
          <div class="form-row" style="margin-bottom:12px;">
            <div class="form-group">
              <label class="form-label">Título do grupo</label>
              <input class="form-control" id="grupoTitulo" placeholder="Ex: Cobertura adicional (+2,00)" />
            </div>
            <div class="form-group">
              <label class="form-label">Obrigatório?</label>
              <select class="form-control" id="grupoObrigatorio">
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </div>
          </div>
          <label class="form-label">Opções</label>
          <div id="opcoesContainer"></div>
          <button class="btn-add-opcao" id="btnAddOpcao"><i class="bi bi-plus"></i> Adicionar opção</button>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;">
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
  document.getElementById('btnAddOpcao').addEventListener('click', addOpcao);
  document.getElementById('btnSalvar').addEventListener('click', salvar);
  document.getElementById('imagem').addEventListener('change', previewImagem);

  loadCats();
  if (editKey) loadItem();
  else addOpcao();
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
  get(ref(db, `produtos/${editKey}`)).then(async snap => {
    existingData = snap.val();
    if (!existingData) return;
    document.getElementById('nome').value       = existingData.nome      || '';
    document.getElementById('descricao').value  = existingData.descricao || '';
    document.getElementById('preco').value      = existingData.preco     || '';
    document.getElementById('ordem').value      = existingData.ordem     || 0;
    document.getElementById('ativo').checked    = existingData.ativo !== false;
    document.getElementById('destaque').checked = !!existingData.destaque;

    imagemPath = existingData.imagemPath || existingData.imagem || '';
    if (imagemPath) {
      try {
        const url = await getDownloadURL(storageRef(storage, imagemPath));
        document.getElementById('imagemPreview').innerHTML =
          `<img src="${url}" style="max-height:120px;border-radius:8px;" />`;
      } catch { /* sem preview */ }
    }

    const firstGroup = Object.values(existingData.grupos || {})[0];
    if (firstGroup) {
      document.getElementById('grupoTitulo').value      = firstGroup.titulo || '';
      document.getElementById('grupoObrigatorio').value = firstGroup.obrigatorio ? 'true' : 'false';
      document.getElementById('opcoesContainer').innerHTML = '';
      opcoes = [];
      Object.entries(firstGroup.opcoes || {}).forEach(([k, op]) => {
        opcoes.push({ key: k, nome: op.nome, preco: op.preco || 0 });
        renderOpcao(opcoes.length - 1);
      });
    }
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
  const url = URL.createObjectURL(file);
  document.getElementById('imagemPreview').innerHTML =
    `<img src="${url}" style="max-height:120px;border-radius:8px;" />`;
}

async function uploadImagem(prodKey) {
  const file = document.getElementById('imagem').files[0];
  if (!file) return imagemPath;
  const path = `produtos/${prodKey}/${Date.now()}_${file.name}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file);
  return path;
}

// ── Opções ────────────────────────────────────────────────────────────────────
function addOpcao() {
  opcoes.push({ key: '', nome: '', preco: 0 });
  renderOpcao(opcoes.length - 1);
}

function renderOpcao(idx) {
  const row = document.createElement('div');
  row.className = 'opcao-row'; row.id = `op_${idx}`;
  row.innerHTML = `
    <input class="form-control" style="flex:2" placeholder="Nome da opção" value="${opcoes[idx].nome}" />
    <input class="form-control" style="flex:1;max-width:120px" type="number" step="0.01" min="0" placeholder="Preço (+)" value="${opcoes[idx].preco || ''}" />
    <button class="btn-remove" type="button"><i class="bi bi-trash"></i></button>
  `;
  row.querySelectorAll('input')[0].addEventListener('input', e => { opcoes[idx].nome  = e.target.value; });
  row.querySelectorAll('input')[1].addEventListener('input', e => { opcoes[idx].preco = parseFloat(e.target.value) || 0; });
  row.querySelector('.btn-remove').addEventListener('click', () => removeOpcao(idx));
  document.getElementById('opcoesContainer').appendChild(row);
}

function removeOpcao(idx) {
  opcoes.splice(idx, 1);
  document.getElementById('opcoesContainer').innerHTML = '';
  opcoes.forEach((_, i) => renderOpcao(i));
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function salvar() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  const opcsObj = {};
  opcoes.forEach(op => {
    if (!op.nome.trim()) return;
    opcsObj[op.key || slugify(op.nome)] = { nome: op.nome, preco: op.preco || 0 };
  });

  const prodKey    = editKey || `${slugify(nome)}_${Date.now()}`;
  const subcategoria = document.getElementById('subcategoria').value || null;

  document.getElementById('loadingOverlay').classList.add('show');
  try {
    const novaImagem = await uploadImagem(prodKey);
    const data = {
      nome,
      descricao:   document.getElementById('descricao').value.trim(),
      preco:       parseFloat(document.getElementById('preco').value) || 0,
      categoria:   document.getElementById('categoria').value,
      ordem:       parseInt(document.getElementById('ordem').value) || 0,
      ativo:       document.getElementById('ativo').checked,
      destaque:    document.getElementById('destaque').checked,
      tipo:        'opcional',
      ...(novaImagem  && { imagemPath: novaImagem }),
      ...(subcategoria && { subcategoria }),
      grupos: {
        adicional: {
          titulo:      document.getElementById('grupoTitulo').value.trim() || 'Adicionais',
          ordem:       1,
          obrigatorio: document.getElementById('grupoObrigatorio').value === 'true',
          tipoSelecao: 'radio',
          opcoes:      opcsObj
        }
      }
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
