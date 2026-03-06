import { db, ref, get } from './firebase-config.js';

/* =============================
   CONFIG
============================= */
const WHATSAPP_NUMERO = "5547992600250";

const formatarMoeda = (valor) =>
    Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

/* =============================
   ESTADO
============================= */
let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
let produtosCache = null;

/* =============================
   FIREBASE
============================= */
async function carregarProdutos() {
    if (produtosCache) return produtosCache;

    try {
        const snapshot = await get(ref(db, "produtos"));
        produtosCache = snapshot.val() || {};
        return produtosCache;
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        return {};
    }
}

/* =============================
   STORAGE
============================= */
function salvarCarrinho() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

/* =============================
   CONTADOR
============================= */
export function atualizarContadorCarrinho() {
    const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    const contadorEl = document.getElementById("carrinhoContador");
    if (contadorEl) contadorEl.textContent = totalItens;
}

/* =============================
   ADICIONAR ITEM
============================= */
export function adicionarAoCarrinho(prodId, quantidade = 1, opcoesSelecionadas = {}) {
    const itemBase = {
        prodId,
        quantidade,
        preco: Number(opcoesSelecionadas.precoFinal || opcoesSelecionadas.preco || 0),
        descricaoExtra: opcoesSelecionadas.saboresTexto ||
                        opcoesSelecionadas.descricaoAdicional ||
                        "Personalizado",
        opcoes: { ...opcoesSelecionadas }
    };

    delete itemBase.opcoes.precoFinal;
    delete itemBase.opcoes.preco;
    delete itemBase.opcoes.saboresTexto;
    delete itemBase.opcoes.descricaoAdicional;

    const itemExistente = carrinho.find(item =>
        item.prodId === prodId &&
        JSON.stringify(item.opcoes) === JSON.stringify(itemBase.opcoes)
    );

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        itemExistente.preco = itemBase.preco;
        itemExistente.descricaoExtra = itemBase.descricaoExtra;
    } else {
        carrinho.push(itemBase);
    }

    salvarCarrinho();
    atualizarContadorCarrinho();
}

/* =============================
   ABRIR / FECHAR
============================= */
export function abrirCarrinho() {
    document.getElementById("cartSidebar")?.classList.add("active");
    document.getElementById("cartOverlay")?.classList.add("active");
    renderCarrinho();
}

function fecharCarrinho() {
    document.getElementById("cartSidebar")?.classList.remove("active");
    document.getElementById("cartOverlay")?.classList.remove("active");
}

/* =============================
   ALTERAR QTD
============================= */
function alterarQtd(index, delta) {
    if (!carrinho[index]) return;
    carrinho[index].quantidade += delta;
    if (carrinho[index].quantidade <= 0) carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarContadorCarrinho();
    renderCarrinho();
}

function removerItem(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarContadorCarrinho();
    renderCarrinho();
}

/* =============================
   RENDER
============================= */
async function renderCarrinho() {
    const container = document.getElementById("cartItens");
    const totalEl   = document.getElementById("cartTotal");
    if (!container || !totalEl) return;

    const produtos = await carregarProdutos();
    container.innerHTML = "";
    let total = 0;

    carrinho.forEach((item, index) => {
        const prod = produtos[item.prodId];
        if (!prod) return;

        let preco    = 0;
        let subtotal = 0;
        let detalhesHTML = "";

        if (item.opcoes?.tipo === "festa") {
            preco    = Number(item.opcoes.precoUnitario) || 0;
            subtotal = preco * item.quantidade;
            total   += subtotal;

            detalhesHTML += `
                <div class="cart-festa-info">
                    <small><strong>${item.opcoes.quantidadeTotal} unidades</strong></small>
                </div>
            `;

            if (item.opcoes.sabores?.length) {
                item.opcoes.sabores.forEach(sabor => {
                    detalhesHTML += `
                        <div class="cart-sabor">
                            <small>${sabor.qtd} ${sabor.nome}</small>
                        </div>
                    `;
                });
            }
        } else {
            preco    = Number(prod.preco) || 0;
            subtotal = preco * item.quantidade;
            total   += subtotal;
        }

        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <div class="cart-item-header">
                <h6>${prod.nome}</h6>
                <button class="btn-remover" data-index="${index}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            ${detalhesHTML}
            <div class="cart-item-bottom">
                <div class="qty-box">
                    <button class="btn-menos" data-index="${index}">−</button>
                    <span>${item.quantidade}</span>
                    <button class="btn-mais" data-index="${index}">+</button>
                </div>
                <strong>${formatarMoeda(subtotal)}</strong>
            </div>
        `;
        container.appendChild(div);
    });

    totalEl.textContent = formatarMoeda(total);
    ativarEventosInternos();
}

/* =============================
   WHATSAPP
============================= */
async function finalizarWhatsApp() {
    if (!carrinho.length) { alert("Seu carrinho está vazio."); return; }

    const produtos = await carregarProdutos();
    let mensagem = "Olá! Quero fazer um pedido:\n\n";
    let total = 0;

    carrinho.forEach(item => {
        const prod = produtos[item.prodId];
        if (!prod) return;

        if (item.opcoes?.tipo === "festa") {
            const preco    = Number(item.opcoes.precoUnitario) || 0;
            const subtotal = preco * item.quantidade;
            total += subtotal;

            mensagem += `• ${prod.nome}\n`;
            mensagem += `  ${item.opcoes.quantidadeTotal} unidades\n`;
            item.opcoes.sabores?.forEach(s => { mensagem += `  ${s.qtd} ${s.nome}\n`; });
            mensagem += `  ${formatarMoeda(subtotal)}\n\n`;
        } else {
            const preco    = Number(prod.preco) || 0;
            const subtotal = preco * item.quantidade;
            total += subtotal;
            mensagem += `• ${item.quantidade}x ${prod.nome} - ${formatarMoeda(subtotal)}\n`;
        }
    });

    mensagem += `\nTotal: ${formatarMoeda(total)}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`, "_blank");
}

/* =============================
   EVENTOS INTERNOS
============================= */
function ativarEventosInternos() {
    document.querySelectorAll(".btn-remover").forEach(btn =>
        btn.addEventListener("click", () => removerItem(Number(btn.dataset.index))));
    document.querySelectorAll(".btn-menos").forEach(btn =>
        btn.addEventListener("click", () => alterarQtd(Number(btn.dataset.index), -1)));
    document.querySelectorAll(".btn-mais").forEach(btn =>
        btn.addEventListener("click", () => alterarQtd(Number(btn.dataset.index), 1)));
}

/* =============================
   INICIALIZAÇÃO
============================= */
document.addEventListener("DOMContentLoaded", () => {
    atualizarContadorCarrinho();

    document.getElementById("btnAbrirCarrinho")
        ?.addEventListener("click", abrirCarrinho);
    document.getElementById("btnFecharCarrinho")
        ?.addEventListener("click", fecharCarrinho);
    document.getElementById("cartOverlay")
        ?.addEventListener("click", fecharCarrinho);
    document.querySelector(".btn-finalizar")
        ?.addEventListener("click", finalizarWhatsApp);
    document.getElementById("btnLimparCarrinho")
        ?.addEventListener("click", () => {
            carrinho = [];
            salvarCarrinho();
            atualizarContadorCarrinho();
            renderCarrinho();
        });
});
