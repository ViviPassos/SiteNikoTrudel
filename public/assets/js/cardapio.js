import { database, storage } from "./firebase-config.js";
import { ref as dbRef, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

    const btnCarrinho = document.getElementById("btnAbrirCarrinho");
    if (btnCarrinho) {
        btnCarrinho.addEventListener("click", abrirCarrinho);
    }
});


// ======================
// CATEGORIAS
// ======================
function carregarCategorias() {
    const categoriasRef = dbRef(database, "categorias");
    onValue(categoriasRef, (snapshot) => {
        categorias = snapshot.val() || {};
        renderCategorias();
    });
}

function renderCategorias() {
    const nav = document.getElementById("categoriasNav");
    nav.innerHTML = "";

    // Botão "Todos"
    const btnTodos = document.createElement("button");
    btnTodos.textContent = "Todos";
    btnTodos.classList.add("active");
    btnTodos.onclick = () => {
        document.querySelectorAll(".menu-nav button").forEach(b => b.classList.remove("active"));
        btnTodos.classList.add("active");
        renderProdutos(null);
    };
    nav.appendChild(btnTodos);

    Object.entries(categorias)
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .forEach(([id, cat]) => {
            if (!cat.ativa) return;

            const btn = document.createElement("button");
            btn.textContent = cat.nome;
            btn.dataset.categoriaId = id;
            btn.onclick = () => {
                document.querySelectorAll(".menu-nav button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderProdutos(id);
            };
            nav.appendChild(btn);
        });
}

// ======================
// PRODUTOS
// ======================
function carregarProdutos() {
    const produtosRef = dbRef(database, "produtos");
    onValue(produtosRef, (snapshot) => {
        produtos = snapshot.val() || {};
        renderProdutos(null); // carrega "Todos" por default
    });
}

// ===============================
// NORMALIZAR TEXTO
// ===============================
function normalizar(texto) {
    return (texto || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ===============================
// VERIFICAR CATEGORIA DO PRODUTO
// ===============================
function categoriaEh(prod, categoriaSelecionada) {
    if (!prod?.categoria || !categoriaSelecionada) return false;

    return normalizar(prod.categoria) === normalizar(categoriaSelecionada);
}


// ===============================
// CARREGAR ABA TODOS
// ===============================
function carregarTodos(container, categorias, produtos) {

    container.innerHTML = "";

    Object.entries(categorias).forEach(([catId, cat]) => {

        const produtosDaCategoria = Object.entries(produtos)
            .filter(([_, prod]) =>
                prod.ativo && categoriaEh(prod, catId)
            );

        if (produtosDaCategoria.length === 0) return;

        const secao = document.createElement("section");
        secao.classList.add("categoria-bloco");

        const titulo = document.createElement("h2");

        // 🚀 NÃO formatar nome vindo do Firebase
        titulo.textContent = cat.nome;

        secao.appendChild(titulo);

        const grid = document.createElement("div");
        grid.classList.add("grid-produtos");

        produtosDaCategoria.forEach(([id, prod]) => {
            const card = criarCardProduto(id, prod);
            grid.appendChild(card);
        });

        secao.appendChild(grid);
        container.appendChild(secao);
    });
}

// ===============================
// CARREGAR ABA INDIVIDUAL
// ===============================
function carregarCategoria(container, categoriaSelecionada, produtos) {

    container.innerHTML = "";

    const prodsFiltrados = Object.entries(produtos)
        .filter(([_, prod]) =>
            prod.ativo && categoriaEh(prod, categoriaSelecionada)
        );

    if (prodsFiltrados.length === 0) {
        container.innerHTML = "<p>Nenhum produto encontrado.</p>";
        return;
    }

    const grid = document.createElement("div");
    grid.classList.add("grid-produtos");

    prodsFiltrados.forEach(([id, prod]) => {
        const card = criarCardProduto(id, prod);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}


function formatarNomeExibicao(nome) {
    if (!nome) return "";

    const mapaAcentos = {
        acai: "Açaí",
        açaí: "Açaí",
        promocoes: "Promoções",
        promoções: "Promoções"
    };

    const nomeLimpo = nome
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    // Se existir no mapa, retorna corrigido
    if (mapaAcentos[nomeLimpo]) {
        return mapaAcentos[nomeLimpo];
    }

    // Capitaliza corretamente com suporte a acentos
    return nomeLimpo.replace(
        /\b[\p{L}]/gu,
        letra => letra.toUpperCase()
    );
}


async function renderProdutos(categoriaSelecionada = null) {

    const container = document.getElementById("produtosContainer");
    container.innerHTML = "";

    // ======================
    // ABA TODOS
    // ======================
    if (!categoriaSelecionada) {

        const categoriasOrdenadas = Object.entries(categorias)
            .filter(([_, cat]) => cat.ativa)
            .sort((a, b) => a[1].ordem - b[1].ordem);

        for (const [catId, cat] of categoriasOrdenadas) {

            const produtosDaCategoria = Object.entries(produtos)
                .filter(([_, prod]) =>
                    prod.ativo && categoriaEh(prod, catId)
                );

            if (!produtosDaCategoria.length) continue;

            const section = document.createElement("div");
            section.className = "categoria-section";

            const titulo = document.createElement("h2");
            titulo.className = "titulo-categoria";
            titulo.textContent = cat.nome; // 🔥 não formatar

            const grid = document.createElement("div");
            grid.className = "categoria-grid";

            for (const [id, prod] of produtosDaCategoria) {
                const card = await criarCardProduto(id, prod);
                if (card) grid.appendChild(card);
            }

            section.appendChild(titulo);
            section.appendChild(grid);
            container.appendChild(section);
        }

        return;
    }

    // ======================
    // FILTRA PRODUTOS DA CATEGORIA (PADRONIZADO)
    // ======================
    const prodsFiltrados = Object.entries(produtos)
        .filter(([_, prod]) => {

            if (!prod.ativo) return false;

            // 🔥 Correção isolada só para combos_promocoes
            if (categoriaSelecionada === "combos_promocoes") {
                return normalizar(prod.categoria) === normalizar("Combos & Promoções")
                    || normalizar(prod.categoria) === normalizar("combos-promocoes")
                    || normalizar(prod.categoria) === normalizar("combos_promocoes");
            }

            return categoriaEh(prod, categoriaSelecionada);
        });



    if (!prodsFiltrados.length) {
        container.innerHTML = "<p>Nenhum produto encontrado.</p>";
        return;
    }

    const agrupados = {};

    // ======================
    // AGRUPAMENTO POR SUBCATEGORIA (mantido)
    // ======================
    for (const [id, prod] of prodsFiltrados) {

        let nomeDivisao = "";

        if (prod.subcategoria && prod.subcategoria.trim() !== "") {
            nomeDivisao = prod.subcategoria.trim();
        } else {
            const nomeOriginal = prod.nome?.trim() || "";
            if (!nomeOriginal) continue;

            if (nomeOriginal.includes(" - ")) {
                nomeDivisao = nomeOriginal.split(" - ")[0].trim();
            } else {
                nomeDivisao = nomeOriginal.replace(/monte.*$/i, "").trim();
            }
        }

        if (!nomeDivisao) continue;

        const key = normalizar(nomeDivisao);

        if (!agrupados[key]) {
            agrupados[key] = {
                nomeExibicao: formatarNomeExibicao(nomeDivisao),
                produtos: []
            };
        }

        agrupados[key].produtos.push({
            id,
            prod,
            ehMonte: prod.nome?.toLowerCase().includes("monte")
        });
    }

    // ======================
    // ORDENAÇÃO (Monte sempre último)
    // ======================
    const divisoesOrdenadas = Object.keys(agrupados)
        .sort((a, b) => {

            const grupoA = agrupados[a];
            const grupoB = agrupados[b];

            const todosMonteA = grupoA.produtos.every(p => p.ehMonte);
            const todosMonteB = grupoB.produtos.every(p => p.ehMonte);

            if (todosMonteA && !todosMonteB) return 1;
            if (!todosMonteA && todosMonteB) return -1;

            return grupoA.nomeExibicao.localeCompare(
                grupoB.nomeExibicao,
                "pt-BR",
                { sensitivity: "base" }
            );
        });

    // ======================
    // RENDER FINAL
    // ======================
    for (const key of divisoesOrdenadas) {

        const grupo = agrupados[key];

        const section = document.createElement("div");
        section.className = "categoria-section";

        const titulo = document.createElement("h2");
        titulo.className = "titulo-categoria";
        titulo.textContent = grupo.nomeExibicao;

        const grid = document.createElement("div");
        grid.className = "categoria-grid";

        for (const item of grupo.produtos) {
            const card = await criarCardProduto(item.id, item.prod);
            if (card) grid.appendChild(card);
        }

        section.appendChild(titulo);
        section.appendChild(grid);
        container.appendChild(section);
    }
}



async function criarCardProduto(id, prod) {
    let imagemURL = "assets/img/placeholder.jpg";

    if (prod.imagemPath || prod.imagem) {
        try {
            const path = prod.imagemPath || prod.imagem;
            const imgRef = storageRef(storage, path);
            imagemURL = await getDownloadURL(imgRef);
        } catch (err) {
            console.warn("Imagem não encontrada:", err);
        }
    }

    const card = document.createElement("div");
    card.className = "produto-card";
    card.innerHTML = `
        <div class="card-imagem">
            <img src="${imagemURL}" alt="${prod.nome}">
            ${prod.destaque ? '<span class="tag-destaque">Destaque</span>' : ''}
        </div>
        <div class="card-conteudo">
            <h3>${prod.nome}</h3>
            <p class="descricao">${prod.descricao || ''}</p>
            ${prod.preco ? `<div class="preco">R$ ${prod.preco.toFixed(2)}</div>` : ''}
            <button class="btn btn-primary btn-add" data-prod-id="${id}">
                ${prod.tipo === "simples" ? "Adicionar" : "Personalizar"}
            </button>
        </div>
    `;

    return card;
}

// Listener para botões de adicionar/personalizar
document.addEventListener("click", e => {
    if (!e.target.classList.contains("btn-add")) return;
    const prodId = e.target.dataset.prodId;
    const prod = produtos[prodId];
    if (!prod) return;

    if (prod.tipo === "simples") {
        adicionarAoCarrinho(prodId, 1, {});
    } else {
        abrirModalPersonalizacao(prodId);
    }
});

// ======================
// MODAL PERSONALIZAÇÃO (básico por enquanto)
// ======================
function abrirModalPersonalizacao(prodId) {
    const prod = produtos[prodId];
    if (!prod || !prod.grupos) return;

    let modal = document.getElementById("modalPersonalizacao");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modalPersonalizacao";
        modal.className = "modal fade";
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${prod.nome}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="modalBodyPersonalizacao"></div>
                    <div class="modal-footer">
                        <div class="preco-total">Total: <span id="precoTotalModal">R$ 0,00</span></div>
                        <button type="button" class="btn btn-success" id="btnAddCarrinhoModal">Adicionar ao Carrinho</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const body = document.getElementById("modalBodyPersonalizacao");
    body.innerHTML = "";

    // Render grupos
    Object.entries(prod.grupos)
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .forEach(([grupoKey, grupo]) => {
            const divGrupo = document.createElement("div");
            divGrupo.className = "grupo-opcoes mb-4";
            divGrupo.innerHTML = `<h6>${grupo.titulo}${grupo.obrigatorio ? ' *' : ''}</h6>`;

            const containerOpcoes = document.createElement("div");
            containerOpcoes.className = "opcoes-list";

            Object.entries(grupo.opcoes || {}).forEach(([optKey, opt]) => {
                const label = document.createElement("label");
                label.className = "opcao-item";

                let input;
                if (grupo.tipoSelecao === "radio") {
                    input = document.createElement("input");
                    input.type = "radio";
                    input.name = `grupo-${grupoKey}`;
                    input.value = optKey;
                } else if (grupo.tipoSelecao === "checkbox") {
                    input = document.createElement("input");
                    input.type = "checkbox";
                    input.value = optKey;
                }

                input.id = `opt-${grupoKey}-${optKey}`;
                input.dataset.preco = opt.preco || 0;

                const span = document.createElement("span");
                span.textContent = `${opt.nome}${opt.preco ? ` (+ R$ ${opt.preco.toFixed(2)})` : ''}`;

                label.appendChild(input);
                label.appendChild(span);
                containerOpcoes.appendChild(label);
            });

            divGrupo.appendChild(containerOpcoes);
            body.appendChild(divGrupo);
        });

    // ===============================
    // VALIDAÇÃO + CÁLCULO MONTE
    // ===============================

    const btnAdd = document.getElementById("btnAddCarrinhoModal");
    const precoTotalSpan = document.getElementById("precoTotalModal");

    function validarMonte() {
        let valido = true;

        Object.entries(prod.grupos).forEach(([grupoKey, grupo]) => {

            const inputs = body.querySelectorAll(
                `input[name="grupo-${grupoKey}"], 
             input[id^="opt-${grupoKey}-"]`
            );

            const selecionados = Array.from(inputs).filter(i => i.checked);

            const qtd = selecionados.length;

            // RADIO
            if (grupo.tipoSelecao === "radio") {
                if (grupo.obrigatorio && qtd !== 1) {
                    valido = false;
                }
            }

            // CHECKBOX
            if (grupo.tipoSelecao === "checkbox") {

                const min = grupo.min ?? (grupo.obrigatorio ? 1 : 0);
                const max = grupo.max ?? Infinity;

                if (qtd < min || qtd > max) {
                    valido = false;
                }
            }
        });

        btnAdd.disabled = !valido;
        return valido;
    }

    function calcularPrecoModal() {

        let total = prod.preco || 0;

        const inputs = body.querySelectorAll("input");

        inputs.forEach(input => {
            if (input.checked) {
                total += Number(input.dataset.preco || 0);
            }
        });

        precoTotalSpan.textContent =
            "R$ " + total.toFixed(2).replace(".", ",");

        return total;
    }

    // Bloqueio automático de excesso (MAX)
    body.addEventListener("change", e => {

        const input = e.target;
        if (!input.matches("input")) return;

        const grupoKey = input.name?.replace("grupo-", "")
            || input.id.split("-")[1];

        const grupo = prod.grupos[grupoKey];
        if (!grupo) return;

        if (grupo.tipoSelecao === "checkbox" && grupo.max) {

            const inputsGrupo = body.querySelectorAll(
                `input[id^="opt-${grupoKey}-"]`
            );

            const selecionados = Array.from(inputsGrupo)
                .filter(i => i.checked);

            if (selecionados.length > grupo.max) {
                input.checked = false;
                return;
            }
        }

        calcularPrecoModal();
        validarMonte();
    });

    // Inicializa
    calcularPrecoModal();
    validarMonte();

    // Botão adicionar
    btnAdd.onclick = () => {

        if (!validarMonte()) return;

        const selecionados = {};

        Object.entries(prod.grupos).forEach(([grupoKey]) => {

            const inputs = body.querySelectorAll(
                `input[name="grupo-${grupoKey}"], 
             input[id^="opt-${grupoKey}-"]`
            );

            const marcados = Array.from(inputs)
                .filter(i => i.checked)
                .map(i => i.value);

            selecionados[grupoKey] = marcados;
        });

        adicionarAoCarrinho(prodId, 1, selecionados);

        bootstrap.Modal.getInstance(modal).hide();
    };
    new bootstrap.Modal(modal).show();
}

