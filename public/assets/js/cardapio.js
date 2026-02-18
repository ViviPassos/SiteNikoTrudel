import { database, storage } from "./firebase-config.js";
import { ref as dbRef, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let categorias = {};
let produtos = {};
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

document.addEventListener("DOMContentLoaded", () => {
    carregarCategorias();
    carregarProdutos();
    atualizarContadorCarrinho();
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

function normalizarNome(nome) {
    return nome
        ?.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "e")
        .replace(/\+/g, "")
        .replace(/-/g, "")
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .toLowerCase()
        .trim();
}

// NOVA FUNÇÃO PARA EXIBIÇÃO BONITA
function formatarNomeExibicao(nome) {
    if (!nome) return "Outros";

    return nome
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, letra => letra.toUpperCase());
}

async function renderProdutos(categoriaSelecionada = null) {

    const container = document.getElementById("produtosContainer");
    container.innerHTML = "";

    // ======== ABA TODOS =========
    if (!categoriaSelecionada) {

        const categoriasOrdenadas = Object.entries(categorias)
            .filter(([id, cat]) => cat.ativa)
            .sort((a, b) => a[1].ordem - b[1].ordem);

        for (const [catId, cat] of categoriasOrdenadas) {

            const produtosDaCategoria = Object.entries(produtos)
                .filter(([id, prod]) =>
                    prod.ativo &&
                    prod.categoria === catId
                );

            if (produtosDaCategoria.length === 0) continue;

            const section = document.createElement("div");
            section.className = "categoria-section";

            const titulo = document.createElement("h2");
            titulo.className = "titulo-categoria";
            titulo.textContent = cat.nome;

            const grid = document.createElement("div");
            grid.className = "categoria-grid";

            for (const [id, prod] of produtosDaCategoria) {
                const card = await criarCardProduto(id, prod);
                grid.appendChild(card);
            }

            section.appendChild(titulo);
            section.appendChild(grid);
            container.appendChild(section);
        }

        return;
    }
    const agrupados = {};

    const usaSubcategoria = prodsFiltrados.some(([id, prod]) =>
        prod.subcategoria && prod.subcategoria.trim() !== ""
    );

    for (const [id, prod] of prodsFiltrados) {

        let nomeDivisao = "";
        let ehMonte = false;

        if (usaSubcategoria) {
            nomeDivisao = prod.subcategoria?.trim() || "Outros";
        } else {

            const nome = prod.nome?.trim() || "";

            // Detecta monte
            if (nome.toLowerCase().includes("monte")) {
                ehMonte = true;
            }

            // Se tiver hífen
            if (nome.includes(" - ")) {
                nomeDivisao = nome.split(" - ")[0].trim();
            } else {
                // Remove palavras de monte do final
                nomeDivisao = nome
                    .replace(/monte.*$/i, "")
                    .trim();

                // Se ainda tiver mais de uma palavra, pega só a primeira
                if (nomeDivisao.includes(" ")) {
                    nomeDivisao = nomeDivisao.split(" ")[0];
                }
            }

            if (!nomeDivisao) {
                nomeDivisao = nome; // fallback final
            }
        }

        const key = normalizarNome(nomeDivisao);

        if (!agrupados[key]) {
            agrupados[key] = {
                nomeExibicao: formatarNomeExibicao(nomeDivisao),
                produtos: [],
                ehMonteGrupo: ehMonte
            };
        }

        agrupados[key].produtos.push({
            id,
            prod,
            ehMonte
        });
    }


    // ===== ORDENAR DIVISÕES CORRETAMENTE =====

    const divisoesOrdenadas = Object.keys(agrupados)
        .sort((a, b) => {

            const grupoA = agrupados[a];
            const grupoB = agrupados[b];

            // 🔥 Monte sempre depois
            if (grupoA.ehMonteGrupo && !grupoB.ehMonteGrupo) return 1;
            if (!grupoA.ehMonteGrupo && grupoB.ehMonteGrupo) return -1;

            return grupoA.nomeExibicao.localeCompare(grupoB.nomeExibicao);
        });


    // ===== RENDERIZAR =====

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
            grid.appendChild(card);
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

    // Aqui vamos adicionar listeners para calcular preço total depois
    // Por enquanto só abre o modal
    new bootstrap.Modal(modal).show();
}

// ======================
// CARRINHO (básico)
// ======================
function adicionarAoCarrinho(prodId, quantidade = 1, opcoesSelecionadas = {}) {
    const itemExistente = carrinho.find(item => item.prodId === prodId && JSON.stringify(item.opcoes) === JSON.stringify(opcoesSelecionadas));
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({ prodId, quantidade, opcoes: opcoesSelecionadas });
    }
    salvarCarrinho();
    atualizarContadorCarrinho();
    alert("Adicionado ao carrinho!"); // temporário
}

function salvarCarrinho() {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
}

function atualizarContadorCarrinho() {
    const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    // Você pode criar um elemento <span id="carrinhoContador"> no header
    const contadorEl = document.getElementById("carrinhoContador");
    if (contadorEl) contadorEl.textContent = totalItens;
}