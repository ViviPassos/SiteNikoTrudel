// item-simples.js
import { db, ref, get, set, update, requireAuth, logout, uploadImagem, showToast, slugify } from './firebase-config.js';
import { renderSidebar, initSidebarLogout } from './sidebar.js';

const params     = new URLSearchParams(location.search);
const editKey    = params.get('key');
let existingData = null;
let imgFile      = null;

requireAuth().then(() => {
  const titulo = editKey ? 'Editar Item Simples' : 'Novo Item Simples';
  document.getElementById('app').innerHTML = renderSidebar('itens') + `
    <div style="flex:1">
      <div class="topbar"><span class="topbar-title">${titulo}</span></div>
      <main class="main">
        <button class="back-btn" id="btnBack"><i class="bi bi-arrow-left"></i> Voltar</button>
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h1 class="page-title">${titulo}</h1>
            <p class="page-subtitle">Itens exibidos como cards no cardápio</p>
          </div>
        </div>
        <div class="form-card">
          <div class="form-group">
            <label class="form-label">Imagem do produto</label>
            <div class="img-preview" id="imgPreview">
              <i class="bi bi-image"></i>
              <span>Clique para adicionar imagem</span>
              <div class="overlay"><i class="bi bi-camera" style="font-size:24px;color:white;"></i><span>Trocar imagem</span></div>
            </div>
            <input type="file" id="imgInput" accept="image/*" style="display:none" />
            <div style="margin-top:8px;">
              <label class="form-label" style="margin-bottom:4px;">Ou cole uma URL de imagem</label>
              <input class="form-control" id="imgUrl" placeholder="https://..." />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="nome" placeholder="Ex: Trudel com Confetes" />
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-control" id="descricao" rows="3" placeholder="Descreva o item..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Preço (R$) *</label>
              <input class="form-control" id="preco" type="number" step="0.01" min="0" placeholder="0.00" />
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
          <div class="form-group">
            <label class="form-label">Ordem de exibição</label>
            <input class="form-control" id="ordem" type="number" value="0" />
          </div>
          <div class="form-toggle-row">
            <span class="form-toggle-label">Disponível</span>
            <label class="toggle"><input type="checkbox" id="ativo" checked /><span class="toggle-slider"></span></label>
          </div>
          <div class="form-toggle-row">
            <span class="form-toggle-label">Destaque</span>
            <label class="toggle"><input type="checkbox" id="destaque" /><span class="toggle-slider"></span></label>
          </div>
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
  document.getElementById('imgPreview').addEventListener('click', () => document.getElementById('imgInput').click());
  document.getElementById('imgInput').addEventListener('change', onImgFileChange);
  document.getElementById('imgUrl').addEventListener('input', e => { if (e.target.value) { showImgPreview(e.target.value); imgFile = null; } });
  document.getElementById('categoria').addEventListener('change', loadSubcats);
  document.getElementById('btnSalvar').addEventListener('click', salvar);

  loadCats();
  if (editKey) loadItem();
});

function loadCats() {
  get(ref(db, 'categorias')).then(snap => {
    const cats   = snap.val() || {};
    const sel    = document.getElementById('categoria');
    Object.entries(cats).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0)).forEach(([k, c]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = c.nome; sel.appendChild(o);
    });
    if (existingData) { sel.value = existingData.categoria || ''; loadSubcats(); }
  });
}

function loadSubcats() {
  const catKey = document.getElementById('categoria').value;
  const sel    = document.getElementById('subcategoria');
  sel.innerHTML = '<option value="">Nenhuma</option>';
  get(ref(db, 'subcategorias')).then(snap => {
    const subs = snap.val() || {};
    Object.entries(subs).filter(([, s]) => s.categoria === catKey)
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0))
      .forEach(([k, s]) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = s.nome; sel.appendChild(o);
      });
    if (existingData?.subcategoria) sel.value = existingData.subcategoria;
  });
}

function loadItem() {
  get(ref(db, `produtos/${editKey}`)).then(snap => {
    existingData = snap.val();
    if (!existingData) return;
    document.getElementById('nome').value       = existingData.nome      || '';
    document.getElementById('descricao').value  = existingData.descricao || '';
    document.getElementById('preco').value      = existingData.preco     || '';
    document.getElementById('ordem').value      = existingData.ordem     || 0;
    document.getElementById('ativo').checked    = existingData.ativo !== false;
    document.getElementById('destaque').checked = !!existingData.destaque;
    if (existingData.imagem) { document.getElementById('imgUrl').value = existingData.imagem; showImgPreview(existingData.imagem); }
    if (document.getElementById('categoria').options.length > 1) {
      document.getElementById('categoria').value = existingData.categoria || '';
      loadSubcats();
    }
  });
}

function onImgFileChange(e) {
  imgFile = e.target.files[0];
  if (!imgFile) return;
  const reader = new FileReader();
  reader.onload = ev => showImgPreview(ev.target.result);
  reader.readAsDataURL(imgFile);
  document.getElementById('imgUrl').value = '';
}

function showImgPreview(src) {
  const prev = document.getElementById('imgPreview');
  let img    = prev.querySelector('img');
  if (!img) { img = document.createElement('img'); prev.appendChild(img); }
  img.src = src;
  prev.querySelector('i').style.display    = 'none';
  prev.querySelector('span').style.display = 'none';
}

async function salvar() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) { showToast('Nome é obrigatório.', 'error'); return; }

  document.getElementById('loadingOverlay').classList.add('show');

  let imagem = document.getElementById('imgUrl').value.trim() || existingData?.imagem || '';
  if (imgFile) {
    try { imagem = await uploadImagem(imgFile, `produtos/${Date.now()}_${imgFile.name}`); }
    catch { showToast('Erro ao fazer upload.', 'error'); document.getElementById('loadingOverlay').classList.remove('show'); return; }
  }

  const subcategoria = document.getElementById('subcategoria').value || null;
  const data = {
    nome, imagem,
    descricao:   document.getElementById('descricao').value.trim(),
    preco:       parseFloat(document.getElementById('preco').value) || 0,
    categoria:   document.getElementById('categoria').value,
    ordem:       parseInt(document.getElementById('ordem').value) || 0,
    ativo:       document.getElementById('ativo').checked,
    destaque:    document.getElementById('destaque').checked,
    tipo:        'simples',
    ...(subcategoria && { subcategoria })
  };

  try {
    if (editKey) await update(ref(db, `produtos/${editKey}`), data);
    else         await set(ref(db, `produtos/${slugify(nome)}_${Date.now()}`), data);
    window.location.href = 'itens.html?toast=' + encodeURIComponent('Item salvo com sucesso!');
  } catch {
    showToast('Erro ao salvar.', 'error');
    document.getElementById('loadingOverlay').classList.remove('show');
  }
}
