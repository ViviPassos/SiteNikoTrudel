import { db, storage, ref, onValue } from "./firebase-config.js";
import { ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
import { adicionarAoCarrinho, atualizarContadorCarrinho, abrirCarrinho } from "./carrinho.js";

let categorias = {};
let produtos   = {};

document.addEventListener("DOMContentLoaded", () => {
    carregarCategorias();
    carregarProdutos();
    atualizarContadorCarrinho();
    document.getElementById("btnAbrirCarrinho")?.addEventListener("click", abrirCarrinho);
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS
// ─────────────────────────────────────────────────────────────────────────────
function carregarCategorias() {
    onValue(ref(db, "categorias"), snap => {
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
        .filter(([, c]) => c.ativa)
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

// ─────────────────────────────────────────────────────────────────────────────
// PRODUTOS
// ─────────────────────────────────────────────────────────────────────────────
function carregarProdutos() {
    onValue(ref(db, "produtos"), snap => {
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
    if (!categoriaSelecionada) await renderizarAbaTodos(container);
    else                       await renderizarAbaCategoria(container, categoriaSelecionada);
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
    let filtro = catId;
    if (catId === "combos_promocoes") {
        filtro = p => normalizar(p.categoria).includes("combo") ||
                      normalizar(p.categoria).includes("promoc");
    }
    const filtrados = Object.entries(produtos).filter(([, p]) =>
        p.ativo && (typeof filtro === "function" ? filtro(p) : pertenceACategoria(p, filtro))
    );
    if (!filtrados.length) { container.innerHTML = "<p>Nenhum produto encontrado.</p>"; return; }
    for (const { nomeExibicao, produtos: lista } of agruparPorSub(filtrados)) {
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
    h2.className = "titulo-categoria"; h2.textContent = titulo;
    const grid = document.createElement("div");
    grid.className = "categoria-grid";
    section.append(h2, grid);
    return section;
}

function agruparPorSub(entries) {
    const map = {};
    for (const [id, prod] of entries) {
        let chave = prod.subcategoria?.trim() || "";
        if (!chave) {
            const nome = prod.nome?.trim() || "";
            chave = nome.includes(" - ") ? nome.split(" - ")[0].trim() : nome.replace(/monte.*$/i, "").trim();
        }
        if (!chave) continue;
        const key = normalizar(chave);
        if (!map[key]) map[key] = { nomeExibicao: formatarNome(chave), produtos: [] };
        map[key].produtos.push([id, prod]);
    }
    return Object.values(map).sort((a, b) => {
        const aMonte = a.produtos.every(([, p]) => p.nome?.toLowerCase().includes("monte"));
        const bMonte = b.produtos.every(([, p]) => p.nome?.toLowerCase().includes("monte"));
        if (aMonte && !bMonte) return 1;
        if (!aMonte && bMonte) return -1;
        return a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR", { sensitivity: "base" });
    });
}

function formatarNome(nome) {
    if (!nome) return "";
    const mapa = { acai: "Açaí", "açaí": "Açaí", promocoes: "Promoções", "promoções": "Promoções" };
    let limpo = nome.replace(/_/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    return mapa[limpo] || limpo.replace(/\b[\p{L}]/gu, l => l.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────
async function criarCardProduto(id, prod) {
    let imgUrl = "assets/img/placeholder.jpg";
    if (prod.imagemPath || prod.imagem) {
        try {
            imgUrl = await getDownloadURL(storageRef(storage, prod.imagemPath || prod.imagem));
        } catch { /* mantém placeholder */ }
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
            <button class="btn btn-primary btn-add" data-prod-id="${id}" data-img-url="${imgUrl}">
                ${prod.tipo === "simples" ? "Adicionar" : "Personalizar"}
            </button>
        </div>
    `;
    return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIQUE NOS CARDS
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("click", e => {
    const btn = e.target.closest(".btn-add");
    if (!btn) return;
    const prodId = btn.dataset.prodId;
    const prod   = produtos[prodId];
    if (!prod) return;
    if (prod.tipo === "simples") {
        adicionarAoCarrinho(prodId, 1, {});
    } else {
        abrirModalPersonalizacao(prodId, prod, btn.dataset.imgUrl);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — abre e detecta qual função usar
// ─────────────────────────────────────────────────────────────────────────────
function abrirModalPersonalizacao(prodId, prod, imgUrl = "") {
    let modalEl = document.getElementById("modalPersonalizacao");
    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.id = "modalPersonalizacao";
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
                        <button type="button" class="btn btn-success" id="btnAddCarrinhoModal" disabled>
                            Adicionar ao Carrinho
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }

    modalEl.querySelector(".modal-title").textContent = prod.nome || "Personalizar";
    const body      = modalEl.querySelector(".modal-body");
    const btnAdd    = modalEl.querySelector("#btnAddCarrinhoModal");
    const precoSpan = modalEl.querySelector("#precoTotalModal");
    body.innerHTML  = "";
    btnAdd.disabled = true;
    btnAdd.onclick  = null;

    // Imagem do produto no topo do modal
    const placeholder = "assets/img/placeholder.jpg";
    const src = imgUrl && imgUrl !== placeholder ? imgUrl : null;
    if (src) {
        const imgWrap = document.createElement("div");
        imgWrap.style.cssText = "text-align:center;margin-bottom:16px;";
        const img = document.createElement("img");
        img.src   = src;
        img.alt   = prod.nome || "";
        img.style.cssText = "max-height:200px;max-width:100%;border-radius:12px;object-fit:cover;";
        imgWrap.appendChild(img);
        body.appendChild(imgWrap);
    }

    const grupos = Object.values(prod.grupos || {});
    const isFesta = grupos.some(g => g.controleQuantidade === true);

    if (prod.tipo === "opcional") {
        renderizarModalOpcional(prodId, prod, body, btnAdd, precoSpan);
    } else if (isFesta) {
        renderizarModalFesta(prodId, prod, body, btnAdd, precoSpan);
    } else {
        renderizarModalMontavelSimples(prodId, prod, body, btnAdd, precoSpan);
    }

    new bootstrap.Modal(modalEl).show();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL OPCIONAL (tipo: "opcional") — grupos radio/checkbox com preço adicional
// ─────────────────────────────────────────────────────────────────────────────
function renderizarModalOpcional(prodId, prod, body, btnAdd, precoSpan) {
    Object.entries(prod.grupos || {})
        .sort((a, b) => a[1].ordem - b[1].ordem)
        .forEach(([gKey, grupo]) => {
            const div = document.createElement("div");
            div.className = "grupo-opcoes mb-4";
            div.innerHTML = `<h6>${grupo.titulo}${grupo.obrigatorio ? " *" : ""}</h6>`;
            const lista = document.createElement("div");
            lista.className = "opcoes-list";
            Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                const label = document.createElement("label");
                label.className = "opcao-item";
                const input = document.createElement("input");
                input.dataset.preco = opt.preco || 0;
                input.type  = grupo.tipoSelecao === "radio" ? "radio" : "checkbox";
                input.name  = `grupo-${gKey}`;
                input.value = oKey;
                label.append(input, document.createTextNode(
                    `${opt.nome}${opt.preco ? ` (+ R$ ${Number(opt.preco).toFixed(2).replace(".", ",")})` : ""}`
                ));
                lista.appendChild(label);
            });
            div.appendChild(lista);
            body.appendChild(div);
        });

    const calcularTotal = () => {
        let total = Number(prod.preco) || 0;
        body.querySelectorAll("input:checked").forEach(i => { total += Number(i.dataset.preco) || 0; });
        return total;
    };

    const validar = () => {
        for (const [gKey, grupo] of Object.entries(prod.grupos || {})) {
            const checked = Array.from(body.querySelectorAll(`input[name="grupo-${gKey}"]:checked`)).length;
            if (grupo.tipoSelecao === "radio" && grupo.obrigatorio && checked !== 1) return false;
            if (grupo.tipoSelecao === "checkbox") {
                const min = grupo.min ?? (grupo.obrigatorio ? 1 : 0);
                const max = grupo.max ?? Infinity;
                if (checked < min || checked > max) return false;
            }
        }
        return true;
    };

    const atualizar = () => {
        precoSpan.textContent = `R$ ${calcularTotal().toFixed(2).replace(".", ",")}`;
        btnAdd.disabled = !validar();
    };

    body.addEventListener("change", atualizar);
    atualizar();

    btnAdd.onclick = () => {
        if (btnAdd.disabled) return;
        const selecoes = {};
        for (const gKey of Object.keys(prod.grupos || {})) {
            selecoes[gKey] = Array.from(
                body.querySelectorAll(`input[name="grupo-${gKey}"]:checked`)
            ).map(i => i.value);
        }
        selecoes.precoFinal = calcularTotal();
        adicionarAoCarrinho(prodId, 1, selecoes);
        bootstrap.Modal.getInstance(document.getElementById("modalPersonalizacao")).hide();
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL MONTÁVEL SIMPLES — todos os grupos são radio button
// Usado em: Trudels, Massas, Sorvete, Brownie + Sorvete
// Lógica: escolhe uma opção por grupo, preço vem da opção selecionada
//         no grupo que tiver preco > 0 (normalmente o primeiro grupo)
// ─────────────────────────────────────────────────────────────────────────────
function renderizarModalMontavelSimples(prodId, prod, body, btnAdd, precoSpan) {
    const grupos = Object.entries(prod.grupos || {}).sort((a, b) => a[1].ordem - b[1].ordem);

    grupos.forEach(([gKey, grupo]) => {
        const section = document.createElement("div");
        section.className = "grupo-opcoes mb-4";
        const h6 = document.createElement("h6");
        h6.textContent = grupo.titulo + (grupo.obrigatorio ? " *" : "");
        section.appendChild(h6);

        const lista = document.createElement("div");
        lista.className = "opcoes-list";

        Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
            const label = document.createElement("label");
            label.className = "opcao-item d-block mb-1";
            const input = document.createElement("input");
            input.type  = "radio";
            input.name  = `grupo-${gKey}`;
            input.value = oKey;
            input.dataset.preco = opt.preco || 0;

            const precoTexto = opt.preco
                ? ` — R$ ${Number(opt.preco).toFixed(2).replace(".", ",")}`
                : "";
            label.append(input, document.createTextNode(` ${opt.nome}${precoTexto}`));
            lista.appendChild(label);
        });

        section.appendChild(lista);
        body.appendChild(section);
    });

    // Preço = soma de todos os radios marcados que têm preco
    const calcularTotal = () => {
        let total = Number(prod.preco) || 0;
        body.querySelectorAll("input[type=radio]:checked").forEach(i => {
            total += Number(i.dataset.preco) || 0;
        });
        return total;
    };

    const validar = () => {
        for (const [gKey, grupo] of grupos) {
            if (grupo.obrigatorio) {
                const checked = body.querySelectorAll(`input[name="grupo-${gKey}"]:checked`).length;
                if (checked !== 1) return false;
            }
        }
        return true;
    };

    const atualizar = () => {
        precoSpan.textContent = `R$ ${calcularTotal().toFixed(2).replace(".", ",")}`;
        btnAdd.disabled = !validar();
    };

    body.addEventListener("change", atualizar);
    atualizar();

    btnAdd.onclick = () => {
        if (btnAdd.disabled) return;
        const selecoes = {};
        for (const [gKey] of grupos) {
            const checked = body.querySelector(`input[name="grupo-${gKey}"]:checked`);
            if (checked) selecoes[gKey] = checked.value;
        }
        selecoes.precoFinal = calcularTotal();
        adicionarAoCarrinho(prodId, 1, selecoes);
        bootstrap.Modal.getInstance(document.getElementById("modalPersonalizacao")).hide();
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FESTA — produtos Niko Festas com contador +/−
// Usado em: Salgadinhos, Mini Trudel, Diversos, Brigadeiro
//
// Grupos detectados automaticamente:
//   radio + chaves numéricas   → qtdGrupo: define qtdTotal e preço
//   gKey === "topping" + radio → inline por recheio (Mini Trudel)
//   radio outros               → radio normal (ex: massa)
//   checkbox + controleQtd     → contador +/− (ex: recheio, sabor, tipo)
//   checkbox sem controleQtd   → checkboxes, respeita limiteDinamicoPorQuantidade (ex: base)
// ─────────────────────────────────────────────────────────────────────────────
function renderizarModalFesta(prodId, prod, body, btnAdd, precoSpan) {
    const grupos = Object.entries(prod.grupos || {}).sort((a, b) => a[1].ordem - b[1].ordem);

    // Grupo de quantidade: radio com chaves numéricas
    const qtdGrupoKey = grupos.find(([, g]) =>
        g.tipoSelecao === "radio" &&
        Object.keys(g.opcoes || {}).some(k => !isNaN(Number(k)))
    )?.[0] ?? null;

    // Grupo topping inline: gKey === "topping" com tipoSelecao radio
    // Não vira seção — aparece como <select> embaixo de cada recheio ativo
    const toppingEntry = grupos.find(([gKey, g]) =>
        gKey === "topping" && g.tipoSelecao === "radio"
    );
    const toppingGKey = toppingEntry?.[0] ?? null;
    const toppingOpts = toppingEntry ? Object.entries(toppingEntry[1].opcoes || {}) : [];

    // Estado
    const estado = {
        precoTotal:   0,
        qtdTotal:     0,
        radios:       {},
        quantidades:  {},
        checkboxes:   {},
        toppings:     {},
        _onQtdChange: []
    };

    const contadorWraps = {};

    // ── Renderiza grupos em ordem ─────────────────────────────────────────────
    for (const [gKey, grupo] of grupos) {

        if (gKey === toppingGKey) continue; // topping fica inline

        const section = document.createElement("div");
        section.className = "grupo-opcoes mb-4";
        const h6 = document.createElement("h6");
        h6.textContent = grupo.titulo + (grupo.obrigatorio ? " *" : "");
        section.appendChild(h6);

        // ── Radio ─────────────────────────────────────────────────────────────
        if (grupo.tipoSelecao === "radio") {
            const lista = document.createElement("div");
            lista.className = "opcoes-list";

            Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                const label = document.createElement("label");
                label.className = "opcao-item d-block mb-1";
                const input = document.createElement("input");
                input.type  = "radio";
                input.name  = `grupo-${gKey}`;
                input.value = oKey;

                input.addEventListener("change", () => {
                    estado.radios[gKey] = oKey;
                    if (gKey === qtdGrupoKey) {
                        estado.qtdTotal   = Number(oKey);
                        estado.precoTotal = Number(opt.preco || 0);
                        estado.toppings   = {};
                        // Reseta e re-renderiza contadores
                        for (const [dgKey, g2] of grupos) {
                            if (!g2.controleQuantidade) continue;
                            estado.quantidades[dgKey] = {};
                            Object.keys(g2.opcoes || {}).forEach(k => { estado.quantidades[dgKey][k] = 0; });
                            if (contadorWraps[dgKey]) renderizarContador(dgKey, g2, contadorWraps[dgKey]);
                        }
                        estado._onQtdChange.forEach(fn => fn());
                    }
                    atualizar();
                });

                const precoTexto = opt.preco
                    ? ` — R$ ${Number(opt.preco).toFixed(2).replace(".", ",")}`
                    : "";
                label.append(input, document.createTextNode(` ${opt.nome}${precoTexto}`));
                lista.appendChild(label);
            });

            section.appendChild(lista);

        // ── Checkbox contador +/− ─────────────────────────────────────────────
        } else if (grupo.controleQuantidade) {
            estado.quantidades[gKey] = {};
            Object.keys(grupo.opcoes || {}).forEach(k => { estado.quantidades[gKey][k] = 0; });
            const wrap = document.createElement("div");
            contadorWraps[gKey] = wrap;
            renderizarContador(gKey, grupo, wrap);
            section.appendChild(wrap);

        // ── Checkbox simples (ex: base do Diversos) ───────────────────────────
        } else if (grupo.tipoSelecao === "checkbox") {
            estado.checkboxes[gKey] = new Set();
            const lista = document.createElement("div");
            lista.className = "opcoes-list";
            const limDin = grupo.limiteDinamicoPorQuantidade;

            const renderCheckboxes = () => {
                lista.innerHTML = "";
                const limite   = limDin ? (limDin[String(estado.qtdTotal)] ?? Infinity) : Infinity;
                const marcados = estado.checkboxes[gKey].size;
                Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
                    const label = document.createElement("label");
                    label.className = "opcao-item d-block mb-1";
                    const input = document.createElement("input");
                    input.type    = "checkbox";
                    input.name    = `grupo-${gKey}`;
                    input.value   = oKey;
                    input.checked = estado.checkboxes[gKey].has(oKey);
                    if (!input.checked && marcados >= limite) input.disabled = true;
                    input.addEventListener("change", () => {
                        if (input.checked) {
                            if (estado.checkboxes[gKey].size >= limite) { input.checked = false; return; }
                            estado.checkboxes[gKey].add(oKey);
                        } else {
                            estado.checkboxes[gKey].delete(oKey);
                        }
                        renderCheckboxes();
                        atualizar();
                    });
                    label.append(input, document.createTextNode(` ${opt.nome}`));
                    lista.appendChild(label);
                });
            };

            renderCheckboxes();
            if (limDin) {
                estado._onQtdChange.push(() => {
                    const novoLimite = limDin[String(estado.qtdTotal)] ?? Infinity;
                    [...estado.checkboxes[gKey]].slice(novoLimite)
                        .forEach(k => estado.checkboxes[gKey].delete(k));
                    renderCheckboxes();
                });
            }
            section.appendChild(lista);
        }

        body.appendChild(section);
    }

    // ── Contador +/− ──────────────────────────────────────────────────────────
    function renderizarContador(gKey, grupo, wrap) {
        wrap.innerHTML = "";
        const inc        = grupo.incremento   || 1;
        const minItem    = grupo.minimoPorItem || 0;
        const maxSabores = grupo.maximoSabores || Infinity;

        const restEl = document.createElement("small");
        restEl.className = "text-muted d-block mb-2";
        restEl.id = `rest-${gKey}`;
        if (!estado.qtdTotal) {
            restEl.style.color = "#EF4444";
            restEl.textContent = "Escolha a quantidade primeiro.";
        } else {
            restEl.textContent = `Restam: ${estado.qtdTotal - somaGrupo(gKey)} unidades`;
        }
        wrap.appendChild(restEl);

        Object.entries(grupo.opcoes || {}).forEach(([oKey, opt]) => {
            const qtdAtual = estado.quantidades[gKey]?.[oKey] || 0;

            const row = document.createElement("div");
            row.className = "sabor-row mb-3";

            const mainRow = document.createElement("div");
            mainRow.className = "d-flex justify-content-between align-items-center";

            const nomeEl = document.createElement("span");
            nomeEl.className   = "fw-semibold";
            nomeEl.textContent = opt.nome;

            const ctls = document.createElement("div");
            ctls.className = "d-flex align-items-center gap-2";

            const menos = document.createElement("button");
            menos.type = "button";
            menos.className = "btn btn-sm btn-outline-secondary";
            menos.textContent = "−";

            const qtdSpan = document.createElement("span");
            qtdSpan.textContent   = qtdAtual;
            qtdSpan.style.cssText = "min-width:36px;text-align:center;font-weight:700";

            const mais = document.createElement("button");
            mais.type = "button";
            mais.className = "btn btn-sm btn-outline-secondary";
            mais.textContent = "+";

            // tWrap declarado aqui para ser acessível nos handlers
            const tWrap = document.createElement("div");
            tWrap.className = "mt-2 ms-1";

            menos.onclick = () => {
                let atual = estado.quantidades[gKey][oKey];
                if (atual <= 0) return;
                let novo = atual - inc;
                if (novo < minItem) novo = 0;
                estado.quantidades[gKey][oKey] = novo;
                qtdSpan.textContent = novo;
                if (novo === 0) delete estado.toppings[oKey];
                atualizarRestante(gKey);
                if (toppingOpts.length) renderToppingInline(oKey, tWrap, novo > 0);
                atualizar();
            };

            mais.onclick = () => {
                if (!estado.qtdTotal) return;
                const restante = estado.qtdTotal - somaGrupo(gKey);
                if (restante <= 0) return;
                const atual  = estado.quantidades[gKey][oKey];
                const ativos = Object.values(estado.quantidades[gKey]).filter(q => q > 0).length;
                if (atual === 0 && ativos >= maxSabores) return;
                const add  = (atual === 0 && minItem > 0) ? minItem : inc;
                const novo = Math.min(atual + add, atual + restante);
                if (novo === atual) return;
                estado.quantidades[gKey][oKey] = novo;
                qtdSpan.textContent = novo;
                atualizarRestante(gKey);
                if (toppingOpts.length) renderToppingInline(oKey, tWrap, true);
                atualizar();
            };

            ctls.append(menos, qtdSpan, mais);
            mainRow.append(nomeEl, ctls);
            row.appendChild(mainRow);

            // Topping inline — só se produto tem grupo gKey "topping"
            if (toppingOpts.length) renderToppingInline(oKey, tWrap, qtdAtual > 0);
            row.appendChild(tWrap);

            wrap.appendChild(row);
        });
    }

    // Select de topping embaixo de cada recheio ativo
    function renderToppingInline(itemKey, wrap, visivel) {
        wrap.innerHTML = "";
        if (!visivel || !toppingOpts.length) return;

        const lbl = document.createElement("label");
        lbl.style.cssText = "font-size:12px;display:block;margin-bottom:3px;color:#6B7280";
        lbl.textContent   = "Topping:";

        const sel = document.createElement("select");
        sel.className      = "form-select form-select-sm";
        sel.style.maxWidth = "260px";

        const ph = document.createElement("option");
        ph.value = ""; ph.textContent = "Escolha o topping...";
        sel.appendChild(ph);

        toppingOpts.forEach(([tKey, tOpt]) => {
            const o = document.createElement("option");
            o.value = tKey; o.textContent = tOpt.nome;
            if (estado.toppings[itemKey] === tKey) o.selected = true;
            sel.appendChild(o);
        });

        sel.addEventListener("change", () => {
            if (sel.value) estado.toppings[itemKey] = sel.value;
            else           delete estado.toppings[itemKey];
            atualizar();
        });

        wrap.append(lbl, sel);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function somaGrupo(gKey) {
        return Object.values(estado.quantidades[gKey] || {}).reduce((a, b) => a + b, 0);
    }

    function atualizarRestante(gKey) {
        const el = document.getElementById(`rest-${gKey}`);
        if (!el) return;
        el.style.color = "";
        el.textContent = `Restam: ${estado.qtdTotal - somaGrupo(gKey)} unidades`;
    }

    // ── Validação ─────────────────────────────────────────────────────────────
    function validar() {
        if (!estado.qtdTotal) return false;

        for (const [gKey, grupo] of grupos) {
            if (gKey === toppingGKey) continue;

            if (grupo.tipoSelecao === "radio" && grupo.obrigatorio) {
                if (!estado.radios[gKey]) return false;
            }

            if (grupo.tipoSelecao === "checkbox" && !grupo.controleQuantidade) {
                const size = estado.checkboxes[gKey]?.size || 0;
                if (grupo.obrigatorio && size === 0) return false;
                if (grupo.limiteDinamicoPorQuantidade) {
                    const limite = grupo.limiteDinamicoPorQuantidade[String(estado.qtdTotal)] ?? Infinity;
                    if (size > limite) return false;
                }
            }

            if (grupo.controleQuantidade) {
                const soma = somaGrupo(gKey);
                if (grupo.obrigatorio && soma === 0) return false;
                if (grupo.somaDeveFecharQuantidade && soma !== estado.qtdTotal) return false;
                if (grupo.minimoPorItem) {
                    for (const q of Object.values(estado.quantidades[gKey] || {})) {
                        if (q > 0 && q < grupo.minimoPorItem) return false;
                    }
                }
                // Cada recheio ativo precisa ter topping escolhido
                if (toppingOpts.length > 0) {
                    for (const [oKey, qtd] of Object.entries(estado.quantidades[gKey] || {})) {
                        if (qtd > 0 && !estado.toppings[oKey]) return false;
                    }
                }
            }
        }
        return true;
    }

    function atualizar() {
        precoSpan.textContent = `R$ ${Number(estado.precoTotal).toFixed(2).replace(".", ",")}`;
        btnAdd.disabled = !validar();
    }

    atualizar();

    // ── Confirmar ─────────────────────────────────────────────────────────────
    btnAdd.onclick = () => {
        if (btnAdd.disabled) return;

        const detalhes = [];
        for (const [gKey, grupo] of grupos) {
            if (gKey === toppingGKey || grupo.controleQuantidade) continue;
            if (grupo.tipoSelecao === "radio") {
                const oKey = estado.radios[gKey];
                if (oKey) detalhes.push({
                    grupo: grupo.titulo,
                    valor: grupo.opcoes?.[oKey]?.nome || oKey
                });
            }
            if (grupo.tipoSelecao === "checkbox") {
                const nomes = [...(estado.checkboxes[gKey] || [])]
                    .map(k => grupo.opcoes?.[k]?.nome || k);
                if (nomes.length) detalhes.push({ grupo: grupo.titulo, valor: nomes.join(", ") });
            }
        }

        const sabores = [];
        for (const [gKey, grupo] of grupos) {
            if (!grupo.controleQuantidade) continue;
            for (const [oKey, qtd] of Object.entries(estado.quantidades[gKey] || {})) {
                if (qtd <= 0) continue;
                const nomeSabor   = grupo.opcoes?.[oKey]?.nome || oKey;
                const toppingK    = estado.toppings[oKey];
                const nomeTopping = toppingK
                    ? (toppingEntry?.[1].opcoes?.[toppingK]?.nome || toppingK)
                    : null;
                sabores.push({ qtd, nome: nomeSabor, ...(nomeTopping && { topping: nomeTopping }) });
            }
        }

        adicionarAoCarrinho(prodId, 1, {
            tipo:            "festa",
            precoUnitario:   estado.precoTotal,
            quantidadeTotal: estado.qtdTotal || 1,
            sabores,
            detalhes
        });

        bootstrap.Modal.getInstance(document.getElementById("modalPersonalizacao")).hide();
    };
}
