import { db, ref, get } from './firebase-config.js';

/* =============================
   CONFIG
============================= */
const WHATSAPP_NUMERO = "5547992600250";

const formatarMoeda = (valor) =>
    Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
        preco:  Number(opcoesSelecionadas.precoFinal || opcoesSelecionadas.preco || 0),
        opcoes: { ...opcoesSelecionadas }
    };
    delete itemBase.opcoes.precoFinal;
    delete itemBase.opcoes.preco;

    const itemExistente = carrinho.find(item =>
        item.prodId === prodId &&
        JSON.stringify(item.opcoes) === JSON.stringify(itemBase.opcoes)
    );

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        itemExistente.preco = itemBase.preco;
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
   HELPERS — resolve nomes das opções pelo banco
   Usado em tipo: opcional e montavel-simples
============================= */
function resolverDetalhesHTML(opcoes, prod) {
    if (!opcoes || typeof opcoes !== "object") return "";
    let html = "";
    for (const [gKey, val] of Object.entries(opcoes)) {
        if (!val || gKey === "tipo") continue;
        const grupo  = prod.grupos?.[gKey];
        const titulo = grupo?.titulo || gKey;
        const vals   = Array.isArray(val) ? val : [val];
        const nomes  = vals.map(k => grupo?.opcoes?.[k]?.nome || k).filter(Boolean);
        if (nomes.length) {
            html += `<div class="cart-sabor"><small><strong>${titulo}:</strong> ${nomes.join(", ")}</small></div>`;
        }
    }
    return html;
}

function resolverDetalhesTexto(opcoes, prod) {
    if (!opcoes || typeof opcoes !== "object") return "";
    let txt = "";
    for (const [gKey, val] of Object.entries(opcoes)) {
        if (!val || gKey === "tipo") continue;
        const grupo  = prod.grupos?.[gKey];
        const titulo = grupo?.titulo || gKey;
        const vals   = Array.isArray(val) ? val : [val];
        const nomes  = vals.map(k => grupo?.opcoes?.[k]?.nome || k).filter(Boolean);
        if (nomes.length) txt += `  ${titulo}: ${nomes.join(", ")}\n`;
    }
    return txt;
}

/* =============================
   RENDER CARRINHO
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
            // ── Niko Festas ──────────────────────────────────────────────────
            preco    = Number(item.opcoes.precoUnitario) || 0;
            subtotal = preco * item.quantidade;
            total   += subtotal;

            detalhesHTML += `<div class="cart-festa-info"><small><strong>${item.opcoes.quantidadeTotal} unidades</strong></small></div>`;

            // Grupos radio/checkbox simples (massa, base, topo…)
            item.opcoes.detalhes?.forEach(d => {
                detalhesHTML += `<div class="cart-sabor"><small><strong>${d.grupo}:</strong> ${d.valor}</small></div>`;
            });
            // Sabores com contador + topping inline
            item.opcoes.sabores?.forEach(sabor => {
                const top = sabor.topping ? ` + ${sabor.topping}` : "";
                detalhesHTML += `<div class="cart-sabor"><small>${sabor.qtd}x ${sabor.nome}${top}</small></div>`;
            });

        } else {
            // ── Opcional / Montável Simples / Simples ─────────────────────────
            preco    = Number(item.preco) || Number(prod.preco) || 0;
            subtotal = preco * item.quantidade;
            total   += subtotal;
            // Mostra adicionais escolhidos (ex: Trudel Dog + Bacon)
            detalhesHTML = resolverDetalhesHTML(item.opcoes, prod);
        }

        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <div class="cart-item-header">
                <h6>${prod.nome}</h6>
                <button class="btn-remover" data-index="${index}"><i class="bi bi-trash"></i></button>
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
            // ── Niko Festas ──────────────────────────────────────────────────
            const preco    = Number(item.opcoes.precoUnitario) || 0;
            const subtotal = preco * item.quantidade;
            total += subtotal;

            mensagem += `• ${prod.nome}\n`;
            mensagem += `  ${item.opcoes.quantidadeTotal} unidades\n`;
            item.opcoes.detalhes?.forEach(d => {
                mensagem += `  ${d.grupo}: ${d.valor}\n`;
            });
            item.opcoes.sabores?.forEach(s => {
                const top = s.topping ? ` + ${s.topping}` : "";
                mensagem += `  ${s.qtd}x ${s.nome}${top}\n`;
            });
            mensagem += `  ${formatarMoeda(subtotal)}\n\n`;

        } else {
            // ── Opcional / Montável Simples / Simples ─────────────────────────
            const preco    = Number(item.preco) || Number(prod.preco) || 0;
            const subtotal = preco * item.quantidade;
            total += subtotal;

            mensagem += `• ${item.quantidade}x ${prod.nome}\n`;
            const detalhes = resolverDetalhesTexto(item.opcoes, prod);
            if (detalhes) mensagem += detalhes;
            mensagem += `  ${formatarMoeda(subtotal)}\n\n`;
        }
    });

    mensagem += `Total: ${formatarMoeda(total)}`;
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
