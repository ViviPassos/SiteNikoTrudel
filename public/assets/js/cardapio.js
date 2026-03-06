import { db, storage, ref, onValue } from "./firebase-config.js";
import { ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

import {
    adicionarAoCarrinho,
    atualizarContadorCarrinho,
    abrirCarrinho
} from "./carrinho.js";

let categorias = {};
let produtos = {};

document.addEventListener("DOMContentLoaded", () => {
    carregarCategorias();
    carregarProdutos();
    atualizarContadorCarrinho();

    document.getElementById("btnAbrirCarrinho")?.addEventListener("click", abrirCarrinho);
});

// ────────────────────────────────────────────────
// CATEGORIAS
// ────────────────────────────────────────────────
function carregarCategorias() {
    onValue(ref(db, "categorias"), (snap) => {
        categorias = snap.val() || {};
        renderizarCategorias();
    });
}

function renderizarCategorias() {
    const nav = document.getElementById("categoriasNav");
    if (!nav) return;

    nav.innerHTML = "";
    nav.appendChild(criarBotaoCategoria("Todos", null, true));

    Object.entries(categorias)
        .filter(([, cat]) => cat.ativa)
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .forEach(([id, cat]) => nav.appendChild(criarBotaoCategoria(cat.nome, id)));
}

function criarBotaoCategoria(texto, categoriaId, ativo = false) {
    const btn = document.createElement("button");
    btn.textContent = texto;
    if (categoriaId) btn.dataset.categoriaId = categoriaId;
    if (ativo) btn.classList.add("active");

    btn.addEventListener("click", () => {
        document.querySelectorAll("#categoriasNav button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderizarProdutos(categoriaId);
    });

    return btn;
}

// ────────────────────────────────────────────────
// PRODUTOS
// ────────────────────────────────────────────────
function carregarProdutos() {
    onValue(ref(db, "produtos"), (snap) => {
        produtos = snap.val() || {};
        renderizarProdutos(null);
    });
}

function normalizar(texto = "") {
    return texto.toString().trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function pertenceACategoria(prod, categoriaId) {
    if (!prod?.categoria || !categoriaId) return false;
    return normalizar(prod.categoria) === normalizar(categoriaId);
}

async function renderizarProdutos(categoriaSelecionada = null) {
    const container = document.getElementById("produtosContainer");
    if (!container) return;
    container.innerHTML = "";

    if (!categoriaSelecionada) {
        await renderizarAbaTodos(container);
    } else {
        await renderizarAbaCategoria(container, categoriaSelecionada);
    }
}

async function renderizarAbaTodos(container) {
    const catsOrdenadas = Object.entries(categorias)
        .filter(([, c]) => c.ativa)
        .sort((a, b) => a[1].ordem - b[1].ordem);

    for (const [catId, cat] of catsOrdenadas) {
        const prods = Object.entries(produtos)
            .filter(([, p]) => p.ativo && pertenceACategoria(p, catId));
        if (!prods.length) continue;

        const section = criarSecaoCategoria(cat.nome);
        const grid    = section.querySelector(".categoria-grid");
        for (const [id, prod] of prods) {
            const card = await criarCardProduto(id, prod);
            if (card) grid.appendChild(card);
        }
        container.appendChild(section);
    }
}

async function renderizarAbaCategoria(container, catId) {
    let filtroCategoria = catId;

    if (catId === "combos_promocoes") {
        filtroCategoria = p =>
            normalizar(p.categoria).includes("combo") ||
            normalizar(p.categoria).includes("promoc");
    }

    const prodsFiltrados = Object.entries(produtos).filter(([, p]) =>
        p.ativo && (typeof filtroCategoria === "function"
            ? filtroCategoria(p)
            : pertenceACategoria(p, filtroCategoria))
    );

    if (!prodsFiltrados.length) {
        container.innerHTML = "<p>Nenhum produto encontrado.</p>";
        return;
    }

    const agrupadosPorSub = agruparPorSubcategoriaOuNome(prodsFiltrados);

    for (const { nomeExibicao, produtos: lista } of agrupadosPorSub) {
        const section = criarSecaoCategoria(nomeExibicao);
        const grid    = section.querySelector(".categoria-grid");
        for (const [id, prod] of lista) {
            const card = await criarCardProduto(id, prod);
            if (card) grid.appendChild(card);
        }
        container.appendChild(section);
    }
}

function criarSecaoCategoria(titulo) {
    const section = document.createElement("div");
    section.className = "categoria-section";
    const h2 = document.createElement("h2");
    h2.className   = "titulo-categoria";
    h2.textContent = titulo;
    const grid = document.createElement("div");
    grid.className = "categoria-grid";
    section.append(h2, grid);
    return section;
}

function agruparPorSubcategoriaOuNome(entries) {
    const map = {};
    for (const [id, prod] of entries) {
        let chave = prod.subcategoria?.trim() || "";
        if (!chave) {
            const nome = prod.nome?.trim() || "";
            chave = nome.includes(" - ") ? nome.split(" - ")[0].trim() : nome.replace(/monte.*$/i, "").trim();
        }
        if (!chave) continue;
        const keyNorm = normalizar(chave);
        if (!map[keyNorm]) map[keyNorm] = { nomeExibicao: formatarNomeExibicao(chave), produtos: [] };
        map[keyNorm].produtos.push([id, prod]);
    }
    return Object.values(map).sort((a, b) => {
        const aMonte = a.produtos.every(([, p]) => p.nome?.toLowerCase().includes("monte"));
        const bMonte = b.produtos.every(([, p]) => p.nome?.toLowerCase().includes("monte"));
        if (aMonte && !bMonte) return 1;
        if (!aMonte && bMonte) return -1;
        return a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR", { sensitivity: "base" });
    });
}

function formatarNomeExibicao(nome) {
    if (!nome) return "";
    const mapa = { acai: "Açaí", "açaí": "Açaí", promocoes: "Promoções", "promoções": "Promoções" };
    let limpo = nome.replace(/_/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (mapa[limpo]) return mapa[limpo];
    return limpo.replace(/\b[\p{L}]/gu, l => l.toUpperCase());
}

// ────────────────────────────────────────────────
// CARD DO PRODUTO
// ────────────────────────────────────────────────
async function criarCardProduto(id, prod) {
    let imgUrl = "assets/img/placeholder.jpg";

    if (prod.imagemPath || prod.imagem) {
        try {
            const sRef = storageRef(storage, prod.imagemPath || prod.imagem);
            imgUrl = await getDownloadURL(sRef);
        } catch (err) {
            console.warn("Falha ao carregar imagem:", err);
        }
    }

    const card = document.createElement("div");
    card.className = "produto-card";
    card.innerHTML = `
        <div class="card-imagem">
            <img src="${imgUrl}" alt="${prod.nome || 'Produto'}">
            ${prod.destaque ? '<span class="tag-destaque">Destaque</span>' : ''}
        </div>
        <div class="card-conteudo">
            <h3>${prod.nome || ''}</h3>
            <p class="descricao">${prod.descricao || ''}</p>
            ${prod.preco ? `<div class="preco">R$ ${prod.preco.toFixed(2).replace('.', ',')}</div>` : ''}
            <button class="btn btn-primary btn-add" data-prod-id="${id}">
                ${prod.tipo === "simples" ? "Adicionar" : "Personalizar"}
            </button>
        </div>
    `;
    return card;
}

// ────────────────────────────────────────────────
// EVENTO DE CLIQUE NOS BOTÕES DE ADICIONAR
// ────────────────────────────────────────────────
document.addEventListener("click", e => {
    const btn = e.target.closest(".btn-add");
    if (!btn) return;
    const prodId = btn.dataset.prodId;
    const prod   = produtos[prodId];
    if (!prod) return;

    if (prod.tipo === "simples") {
        adicionarAoCarrinho(prodId, 1, {});
    } else {
        abrirModalPersonalizacao(prodId, prod);
    }
});

// ────────────────────────────────────────────────
// MODAL PERSONALIZAÇÃO
// ────────────────────────────────────────────────
function abrirModalPersonalizacao(prodId, prod) {
    let modalEl = document.getElementById("modalPersonalizacao");

    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.id        = "modalPersonalizacao";
        modalEl.className = "modal fade";
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <div class="preco-total">Total: <span id="precoTotalModal">R$ 0,00</span></div>
                        <button type="button" class="btn btn-success" id="btnAddCarrinhoModal" disabled>Adicionar ao Carrinho</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    modalEl.querySelector(".modal-title").textContent = prod.nome || "Personalizar";

    const body      = modalEl.querySelector(".modal-body");
    const btnAdd    = modalEl.querySelector("#btnAddCarrinhoModal");
    const precoSpan = modalEl.querySelector("#precoTotalModal");

    body.innerHTML  = "";
    btnAdd.disabled = true;
    btnAdd.onclick  = null;

    if (prod.tipo === "montavel") {
        renderizarModalMontavel(prodId, prod, body, btnAdd, precoSpan);
    } else {
        renderizarModalGruposNormais(prodId, prod, body, btnAdd, precoSpan);
    }

    new bootstrap.Modal(modalEl).show();
}

// ── Modal grupos normais ──────────────────────────────────────────────────────
function renderizarModalGruposNormais(prodId, prod, body, btnAdd, precoSpan) {
    Object.entries(prod.grupos || {})
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .forEach(([gKey, grupo]) => {
            const div = document.createElement("div");
            div.className = "grupo-opcoes mb-4";
            div.innerHTML = `<h6>${grupo.titulo}${grupo.obrigatorio ? " *" : ""}</h6>`;

            const container = document.createElement("div");
            container.className = "opcoes-list";

            Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                const label = document.createElement("label");
                label.className = "opcao-item";

                const input = document.createElement("input");
                input.id            = `opt-${gKey}-${oKey}`;
                input.dataset.preco = opt.preco || 0;
                input.type  = grupo.tipoSelecao === "radio" ? "radio" : "checkbox";
                input.name  = `grupo-${gKey}`;
                input.value = oKey;

                label.append(input, document.createTextNode(
                    `${opt.nome}${opt.preco ? ` (+ R$ ${opt.preco.toFixed(2)})` : ""}`
                ));
                container.appendChild(label);
            });

            div.appendChild(container);
            body.appendChild(div);
        });

    const atualizar = () => {
        const valido = validarFormularioGrupos(prod, body);
        const total  = calcularTotalGrupos(prod, body);
        precoSpan.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
        btnAdd.disabled = !valido;
    };

    body.addEventListener("change", atualizar);

    btnAdd.onclick = () => {
        if (btnAdd.disabled) return;
        adicionarAoCarrinho(prodId, 1, coletarSelecoesGrupos(prod, body));
        bootstrap.Modal.getInstance(document.getElementById("modalPersonalizacao")).hide();
    };

    atualizar();
}

function validarFormularioGrupos(prod, body) {
    for (const [gKey, grupo] of Object.entries(prod.grupos || {})) {
        const inputs  = body.querySelectorAll(`input[name="grupo-${gKey}"]`);
        const checked = Array.from(inputs).filter(i => i.checked).length;
        if (grupo.tipoSelecao === "radio") {
            if (grupo.obrigatorio && checked !== 1) return false;
        } else {
            const min = grupo.min ?? (grupo.obrigatorio ? 1 : 0);
            const max = grupo.max ?? Infinity;
            if (checked < min || checked > max) return false;
        }
    }
    return true;
}

function calcularTotalGrupos(prod, body) {
    let total = prod.preco || 0;
    body.querySelectorAll("input:checked").forEach(i => {
        total += Number(i.dataset.preco || 0);
    });
    return total;
}

function coletarSelecoesGrupos(prod, body) {
    const selecoes = {};
    for (const gKey of Object.keys(prod.grupos || {})) {
        const checked = body.querySelectorAll(`input[name="grupo-${gKey}"]:checked`);
        selecoes[gKey] = Array.from(checked).map(i => i.value);
    }
    return selecoes;
}

// ── Modal montável ────────────────────────────────────────────────────────────
function renderizarModalMontavel(prodId, prod, body, btnAdd, precoSpan) {
    const estado = { qtdTotalSelecionada: 0, precoBase: 0, quantidades: {} };
    const grupos = Object.entries(prod.grupos || {}).sort((a, b) => a[1].ordem - b[1].ordem);

    for (const [gKey, grupo] of grupos) {
        const div = document.createElement("div");
        div.className = "grupo-opcoes mb-4";
        div.innerHTML = `<h6>${grupo.titulo}${grupo.obrigatorio ? " *" : ""}</h6>`;

        const container = document.createElement("div");
        container.className = "opcoes-list";

        if (grupo.tipoSelecao === "radio") {
            Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                const label = document.createElement("label");
                label.className = "opcao-item d-block mb-2";
                const input = document.createElement("input");
                input.type  = "radio";
                input.name  = `grupo-${gKey}`;
                input.value = oKey;
                input.addEventListener("change", () => {
                    estado.qtdTotalSelecionada = Number(oKey);
                    estado.precoBase = Number(opt.preco || 0);
                    atualizarPrecoEValidacao();
                });
                label.append(input, document.createTextNode(` ${opt.nome}`));
                container.appendChild(label);
            });
        } else if (grupo.controleQuantidade) {
            Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                estado.quantidades[oKey] = 0;

                const row = document.createElement("div");
                row.className = "d-flex justify-content-between align-items-center mb-2";

                const nome = document.createElement("span");
                nome.textContent = opt.nome;

                const controls = document.createElement("div");
                controls.className = "d-flex align-items-center gap-2";

                const menos = document.createElement("button");
                menos.type = "button"; menos.className = "btn btn-sm btn-outline-secondary"; menos.textContent = "−";

                const qtdSpan = document.createElement("span");
                qtdSpan.textContent = "0";
                qtdSpan.style.cssText = "min-width:30px;text-align:center";

                const mais = document.createElement("button");
                mais.type = "button"; mais.className = "btn btn-sm btn-outline-secondary"; mais.textContent = "+";

                menos.onclick = () => alterarQuantidadeSabores(oKey, -grupo.incremento, qtdSpan, estado, grupo);
                mais.onclick  = () => alterarQuantidadeSabores(oKey,  grupo.incremento, qtdSpan, estado, grupo);

                controls.append(menos, qtdSpan, mais);
                row.append(nome, controls);
                container.appendChild(row);
            });
        }

        div.appendChild(container);
        body.appendChild(div);
    }

    function alterarQuantidadeSabores(key, delta, span, estado, grupo) {
        if (!estado.qtdTotalSelecionada) return;
        const atual    = estado.quantidades[key];
        let novo       = atual + delta;
        if (novo < 0) return;
        const somaAtual = Object.values(estado.quantidades).reduce((a, b) => a + b, 0);
        if (somaAtual - atual + novo > estado.qtdTotalSelecionada) return;
        if (delta > 0 && atual === 0 && grupo.minimoPorItem > 0) novo = grupo.minimoPorItem;
        const ativos = Object.values(estado.quantidades).filter(q => q > 0).length;
        if (grupo.maximoSabores && atual === 0 && novo > 0 && ativos >= grupo.maximoSabores) return;
        estado.quantidades[key] = novo;
        span.textContent = novo;
        atualizarPrecoEValidacao();
    }

    function atualizarPrecoEValidacao() {
        const valido = validarMontavel(prod.grupos, estado);
        precoSpan.textContent = `R$ ${estado.precoBase.toFixed(2).replace(".", ",")}`;
        btnAdd.disabled = !valido;
    }

    function validarMontavel(grupos, estado) {
        if (!estado.qtdTotalSelecionada) return false;
        for (const grupo of Object.values(grupos)) {
            if (!grupo.controleQuantidade) continue;
            const soma          = Object.values(estado.quantidades).reduce((a, b) => a + b, 0);
            const saboresAtivos = Object.values(estado.quantidades).filter(q => q > 0).length;
            if (grupo.somaDeveFecharQuantidade && soma !== estado.qtdTotalSelecionada) return false;
            if (grupo.maximoSabores && saboresAtivos > grupo.maximoSabores) return false;
            if (grupo.minimoPorItem) {
                for (const q of Object.values(estado.quantidades)) {
                    if (q > 0 && q < grupo.minimoPorItem) return false;
                }
            }
        }
        return true;
    }

    btnAdd.onclick = () => {
        if (btnAdd.disabled) return;
        const saboresArray = [];
        Object.entries(estado.quantidades).forEach(([key, qtd]) => {
            if (qtd > 0) {
                let nomeSabor = key;
                for (const grupo of Object.values(prod.grupos || {})) {
                    if (grupo.opcoes?.[key]?.nome) { nomeSabor = grupo.opcoes[key].nome; break; }
                }
                saboresArray.push({ qtd, nome: nomeSabor });
            }
        });
        adicionarAoCarrinho(prodId, 1, {
            tipo:            "festa",
            precoUnitario:   estado.precoBase,
            quantidadeTotal: estado.qtdTotalSelecionada,
            sabores:         saboresArray
        });
        bootstrap.Modal.getInstance(document.getElementById("modalPersonalizacao")).hide();
    };

    atualizarPrecoEValidacao();
}
