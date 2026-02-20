import { database } from "./firebase-config.js";
import { ref as dbRef, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
        const snapshot = await get(dbRef(database, "produtos"));
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

    const itemExistente = carrinho.find(item =>
        item.prodId === prodId &&
        JSON.stringify(item.opcoes) === JSON.stringify(opcoesSelecionadas)
    );

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({
            prodId,
            quantidade,
            opcoes: opcoesSelecionadas
        });
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

    if (carrinho[index].quantidade <= 0) {
        carrinho.splice(index, 1);
    }

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
    const totalEl = document.getElementById("cartTotal");

    if (!container || !totalEl) return;

    const produtos = await carregarProdutos();

    container.innerHTML = "";
    let total = 0;

    carrinho.forEach((item, index) => {

        const prod = produtos[item.prodId];
        if (!prod) return;

        const preco = Number(prod.preco) || 0;
        const subtotal = preco * item.quantidade;
        total += subtotal;

        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
            <div class="cart-item-header">
                <h6>${prod.nome}</h6>
                <button class="btn-remover" data-index="${index}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>

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

    if (!carrinho.length) {
        alert("Seu carrinho está vazio.");
        return;
    }

    const produtos = await carregarProdutos();

    let mensagem = "Olá! Quero fazer um pedido:\n\n";
    let total = 0;

    carrinho.forEach(item => {

        const prod = produtos[item.prodId];
        if (!prod) return;

        const preco = Number(prod.preco) || 0;
        const subtotal = preco * item.quantidade;
        total += subtotal;

        mensagem += `• ${item.quantidade}x ${prod.nome} - ${formatarMoeda(subtotal)}\n`;
    });

    mensagem += `\nTotal: ${formatarMoeda(total)}`;

    const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;

    window.open(url, "_blank");
}

/* =============================
   EVENTOS
============================= */
function ativarEventosInternos() {

    document.querySelectorAll(".btn-remover").forEach(btn => {
        btn.addEventListener("click", () =>
            removerItem(Number(btn.dataset.index))
        );
    });

    document.querySelectorAll(".btn-menos").forEach(btn => {
        btn.addEventListener("click", () =>
            alterarQtd(Number(btn.dataset.index), -1)
        );
    });

    document.querySelectorAll(".btn-mais").forEach(btn => {
        btn.addEventListener("click", () =>
            alterarQtd(Number(btn.dataset.index), 1)
        );
    });
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