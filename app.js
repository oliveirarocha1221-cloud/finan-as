const API_URL =
  "https://script.google.com/macros/s/AKfycbzMUWTU8FZMNpGzp_X-ctEnKB-r16jFH-TwaZWvaCaz33Ekk2-BAIxJ7xTIIgRcpUHY/exec"

let currentUser = null;
let financeChart = null;
let transactions = [];
let goals = [];

/* =====================
   API
===================== */

async function api(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return res.json();
}

/* =====================
   TOAST
===================== */

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = (type === "success" ? "✓ " : "✕ ") + msg;
  el.className = "toast show " + type;
  setTimeout(() => { el.className = "toast"; }, 3000);
}

/* =====================
   LOADING STATE
===================== */

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original || btn.innerHTML;
  }
}

/* =====================
   TELAS
===================== */

function showLogin() {
  document.getElementById("login-form").style.display = "flex";
  document.getElementById("register-form").style.display = "none";
  document.getElementById("tab-login").classList.add("active");
  document.getElementById("tab-register").classList.remove("active");
  document.getElementById("tab-indicator").classList.remove("right");
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "flex";
  document.getElementById("tab-register").classList.add("active");
  document.getElementById("tab-login").classList.remove("active");
  document.getElementById("tab-indicator").classList.add("right");
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(el => el.style.display = "none");
  document.getElementById(page + "-page").style.display = "block";
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const navBtn = document.getElementById("nav-" + page);
  if (navBtn) navBtn.classList.add("active");

  if (page === "dashboard") atualizarDashboard();
  if (page === "resumo") renderResumo();
}

/* =====================
   CADASTRO
===================== */

async function register() {
  const nome = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const senha = document.getElementById("register-password").value.trim();

  if (!nome || !email || !senha) { toast("Preencha todos os campos", "error"); return; }

  setLoading("btn-register", true);
  try {
    const dados = await api({ acao: "cadastro", nome, email, senha });
    if (dados.sucesso) {
      toast("Conta criada com sucesso!");
      showLogin();
    } else {
      toast(dados.mensagem || "Erro ao cadastrar", "error");
    }
  } catch (err) {
    console.error(err);
    toast("Erro de conexão", "error");
  } finally {
    setLoading("btn-register", false);
  }
}

/* =====================
   LOGIN
===================== */

async function login() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value.trim();

  if (!email || !senha) { toast("Preencha os campos", "error"); return; }

  setLoading("btn-login", true);
  try {
    const dados = await api({ acao: "login", email, senha });
    if (dados.sucesso) {
      currentUser = dados.usuario;
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").style.display = "flex";
      document.getElementById("user-name-display").textContent = currentUser.nome.split(" ")[0];
      document.getElementById("user-avatar").textContent = currentUser.nome.charAt(0).toUpperCase();
      document.getElementById("current-date").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
      carregarDashboard();
    } else {
      toast(dados.mensagem || "E-mail ou senha inválidos", "error");
    }
  } catch (err) {
    console.error(err);
    toast("Erro ao efetuar login", "error");
  } finally {
    setLoading("btn-login", false);
  }
}

/* =====================
   LOGOUT
===================== */

function logout() {
  currentUser = null;
  transactions = [];
  goals = [];
  if (financeChart) { financeChart.destroy(); financeChart = null; }
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}

/* =====================
   DASHBOARD
===================== */

async function carregarDashboard() {
  await Promise.all([
    carregarLancamentos(),
    carregarMetas()
  ]);
  atualizarDashboard();
  criarGrafico();
}

function criarGrafico() {
  const ctx = document.getElementById("financeChart");
  if (!ctx) return;
  if (financeChart) financeChart.destroy();

  const receitas = transactions.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = transactions.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);

  financeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Receitas", "Despesas"],
      datasets: [{
        data: [receitas || 0.01, despesas || 0.01],
        backgroundColor: ["#22d07a", "#ff5c7c"],
        borderColor: ["#18181f"],
        borderWidth: 3,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => " R$ " + ctx.raw.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
}

function atualizarDashboard() {
  const receitas = transactions.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = transactions.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
  const saldo = receitas - despesas;

  const fmt = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  document.getElementById("saldo-total").textContent = fmt(saldo);
  document.getElementById("total-receitas").textContent = fmt(receitas);
  document.getElementById("total-despesas").textContent = fmt(despesas);

  const trend = document.getElementById("saldo-trend");
  if (trend) {
    if (saldo > 0) { trend.textContent = "▲ Saldo positivo"; trend.style.color = "var(--green)"; }
    else if (saldo < 0) { trend.textContent = "▼ Saldo negativo"; trend.style.color = "var(--red)"; }
    else { trend.textContent = ""; }
  }

  renderRecentList();
  if (financeChart) {
    financeChart.data.datasets[0].data = [receitas || 0.01, despesas || 0.01];
    financeChart.update();
  }
}

function renderRecentList() {
  const el = document.getElementById("recent-list");
  if (!el) return;

  const recent = [...transactions].reverse().slice(0, 5);

  if (recent.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Nenhum lançamento ainda.<br>Adicione sua primeira transação.</p></div>`;
    return;
  }

  const catIcons = {
    "Alimentação": "🍽️", "Moradia": "🏠", "Transporte": "🚗",
    "Saúde": "💊", "Educação": "📚", "Lazer": "🎮", "Outros": "📦"
  };

  el.innerHTML = recent.map(tx => `
    <div class="recent-item">
      <div class="recent-icon ${tx.tipo}">${catIcons[tx.categoria] || "💰"}</div>
      <div class="recent-info">
        <div class="recent-desc">${tx.descricao}</div>
        <div class="recent-cat">${tx.categoria} · ${tx.data}</div>
      </div>
      <div class="recent-value ${tx.tipo}">
        ${tx.tipo === "despesa" ? "-" : "+"}R$ ${tx.valor.toFixed(2)}
      </div>
    </div>
  `).join("");
}

/* =====================
   LANÇAMENTOS
===================== */

let currentFilter = "all";

async function addTransaction() {
  if (!currentUser) { toast("Faça login", "error"); return; }

  const tipo = document.getElementById("tx-type").value;
  const descricao = document.getElementById("tx-description").value.trim();
  const valor = parseFloat(document.getElementById("tx-value").value);
  const categoria = document.getElementById("tx-category").value;
  const data = document.getElementById("tx-date").value;

  if (!descricao || !valor || !data) { toast("Preencha todos os campos", "error"); return; }

  // Optimistic UI: adiciona imediatamente com ID temporário
  const tempId = "temp_" + Date.now();
  const transacao = { id: tempId, usuario_id: currentUser.id, data, tipo, descricao, valor, categoria };
  transactions.push(transacao);
  renderTransactions();
  atualizarDashboard();
  limparFormulario();
  toast("Lançamento adicionado!");

  // Salva na API em background
  try {
    const dados = await api({ acao: "lancamento", ...transacao });
    if (dados.sucesso) {
      // Substitui o ID temporário pelo ID real da API
      const idx = transactions.findIndex(t => t.id === tempId);
      if (idx !== -1 && dados.id) transactions[idx].id = dados.id;
    } else {
      // Rollback: remove o item temporário
      transactions = transactions.filter(t => t.id !== tempId);
      renderTransactions();
      atualizarDashboard();
      toast("Erro ao salvar lançamento", "error");
    }
  } catch (err) {
    console.error(err);
    // Rollback silencioso — dado ficou em memória, tentará sincronizar depois
    // Deixa o item mas marca como pendente visualmente
    const idx = transactions.findIndex(t => t.id === tempId);
    if (idx !== -1) {
      const el = document.getElementById("tx-" + tempId);
      if (el) el.classList.add("pending");
    }
  }
}

function limparFormulario() {
  document.getElementById("tx-description").value = "";
  document.getElementById("tx-value").value = "";
  document.getElementById("tx-date").value = "";
}

function filterTransactions(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderTransactions();
}

function renderTransactions() {
  const lista = document.getElementById("transactions-list");
  if (!lista) return;

  const filtered = currentFilter === "all"
    ? transactions
    : transactions.filter(t => t.tipo === currentFilter);

  if (filtered.length === 0) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-icon">💸</div><p>Nenhum lançamento encontrado.</p></div>`;
    return;
  }

  const catIcons = {
    "Alimentação": "🍽️", "Moradia": "🏠", "Transporte": "🚗",
    "Saúde": "💊", "Educação": "📚", "Lazer": "🎮", "Outros": "📦"
  };

  lista.innerHTML = [...filtered].reverse().map(tx => `
    <div class="transaction ${tx.tipo}${tx.id && String(tx.id).startsWith('temp_') ? ' pending' : ''}" id="tx-${tx.id}">
      <div class="tx-info">
        <strong>${catIcons[tx.categoria] || ""} ${tx.descricao}</strong>
        <div class="tx-meta">
          <span class="tx-cat">${tx.categoria}</span>
          <span class="tx-date">${tx.data}</span>
          ${tx.id && String(tx.id).startsWith('temp_') ? '<span class="tx-pending">sincronizando…</span>' : ''}
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-value ${tx.tipo}">
          ${tx.tipo === "despesa" ? "−" : "+"}R$ ${tx.valor.toFixed(2)}
        </div>
        <button class="delete-btn" onclick="deleteTransaction('${tx.id}')" title="Excluir">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  `).join("");
}

async function deleteTransaction(id) {
  const confirmed = await confirmar("Excluir este lançamento?");
  if (!confirmed) return;

  // Bloqueia ID temporário (ainda sincronizando)
  if (String(id).startsWith("temp_")) {
    transactions = transactions.filter(t => String(t.id) !== String(id));
    renderTransactions();
    atualizarDashboard();
    toast("Lançamento removido");
    return;
  }

  // Optimistic: remove da UI imediatamente
  const backup = [...transactions];
  transactions = transactions.filter(t => String(t.id) !== String(id));
  renderTransactions();
  atualizarDashboard();

  try {
    const dados = await api({ acao: "excluir_lancamento", id: String(id), usuario_id: currentUser.id });
    console.log("deleteTransaction response:", dados);
    if (dados.sucesso) {
      toast("Lançamento excluído");
    } else {
      transactions = backup;
      renderTransactions();
      atualizarDashboard();
      toast(dados.mensagem || "Erro ao excluir", "error");
    }
  } catch (err) {
    console.error(err);
    transactions = backup;
    renderTransactions();
    atualizarDashboard();
    toast("Erro de conexão", "error");
  }
}

async function carregarLancamentos() {
  try {
    const dados = await api({ acao: "listar_lancamentos", usuario_id: currentUser.id });
    if (dados.sucesso) {
      transactions = dados.dados.map(item => ({ ...item, valor: Number(item.valor) }));
      renderTransactions();
    }
  } catch (err) { console.error(err); }
}

/* =====================
   METAS
===================== */

async function addGoal() {
  const nome = document.getElementById("goal-name").value.trim();
  const valorMeta = parseFloat(document.getElementById("goal-target").value);

  if (!nome || !valorMeta) { toast("Preencha os campos", "error"); return; }

  const meta = { usuario_id: currentUser.id, nome_meta: nome, valor_meta: valorMeta, valor_atual: 0 };

  try {
    const dados = await api({ acao: "meta", ...meta });
    console.log("addGoal response:", dados);
    if (dados.sucesso) {
      // Salva o ID real retornado pela API
      goals.push({ ...meta, id: dados.id });
      renderGoals();
      document.getElementById("goal-name").value = "";
      document.getElementById("goal-target").value = "";
      toast("Meta criada!");
    } else {
      toast(dados.mensagem || "Erro ao criar meta", "error");
    }
  } catch (err) { console.error(err); toast("Erro de conexão", "error"); }
}

function renderGoals() {
  const container = document.getElementById("goals-container");
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhuma meta criada ainda.<br>Defina seu primeiro objetivo financeiro.</p></div>`;
    return;
  }

  container.innerHTML = goals.map(meta => {
    const pct = Math.min((meta.valor_atual / meta.valor_meta) * 100, 100);
    const complete = pct >= 100;
    const falta = Math.max(meta.valor_meta - meta.valor_atual, 0);
    return `
      <div class="goal-card" id="goal-${meta.id}">
        <div class="goal-card-header">
          <h3>${complete ? "✅ " : "🎯 "}${meta.nome_meta}</h3>
          <button class="delete-btn" onclick="deleteGoal('${meta.id}')" title="Excluir meta">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
        <div class="goal-values-row">
          <div class="goal-val-item">
            <span class="goal-val-label">Guardado</span>
            <span class="goal-val-num saved">R$ ${meta.valor_atual.toLocaleString("pt-BR", {minimumFractionDigits:2})}</span>
          </div>
          <div class="goal-val-item">
            <span class="goal-val-label">Objetivo</span>
            <span class="goal-val-num">R$ ${meta.valor_meta.toLocaleString("pt-BR", {minimumFractionDigits:2})}</span>
          </div>
          <div class="goal-val-item">
            <span class="goal-val-label">Falta</span>
            <span class="goal-val-num falta">R$ ${falta.toLocaleString("pt-BR", {minimumFractionDigits:2})}</span>
          </div>
        </div>
        <div class="progress">
          <div class="progress-bar ${complete ? "complete" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="goal-footer">
          <span class="goal-percent">${pct.toFixed(1)}% concluído</span>
          ${!complete ? `
          <div class="goal-deposit">
            <input type="number" id="deposit-${meta.id}" class="deposit-input" placeholder="+ valor" min="0.01" step="0.01">
            <button class="btn-deposit" onclick="depositGoal('${meta.id}')">Adicionar</button>
          </div>` : `<span class="goal-complete-badge">🎉 Concluída!</span>`}
        </div>
      </div>
    `;
  }).join("");
}

async function depositGoal(id) {
  const input = document.getElementById("deposit-" + id);
  const valor = parseFloat(input.value);
  if (!valor || valor <= 0) { toast("Informe um valor válido", "error"); return; }

  const meta = goals.find(g => String(g.id) === String(id));
  if (!meta) return;

  const novoValor = meta.valor_atual + valor;

  // Optimistic UI
  meta.valor_atual = novoValor;
  renderGoals();
  toast("Valor adicionado!");

  try {
    const dados = await api({
      acao: "atualizar_meta",
      id: String(id),
      usuario_id: currentUser.id,
      valor_atual: novoValor
    });
    console.log("depositGoal response:", dados);
    if (!dados.sucesso) {
      // Rollback
      meta.valor_atual = novoValor - valor;
      renderGoals();
      toast(dados.mensagem || "Erro ao atualizar meta", "error");
    }
  } catch (err) {
    console.error(err);
    meta.valor_atual = novoValor - valor;
    renderGoals();
    toast("Erro de conexão", "error");
  }
}

async function deleteGoal(id) {
  const confirmed = await confirmar("Excluir esta meta?");
  if (!confirmed) return;

  try {
    const dados = await api({ acao: "excluir_meta", id: String(id), usuario_id: currentUser.id });
    if (dados.sucesso) {
      goals = goals.filter(g => String(g.id) !== String(id));
      renderGoals();
      toast("Meta excluída");
    } else {
      toast("Erro ao excluir", "error");
    }
  } catch (err) {
    console.error(err);
    toast("Erro de conexão", "error");
  }
}

async function carregarMetas() {
  try {
    const dados = await api({ acao: "listar_metas", usuario_id: currentUser.id });
    if (dados.sucesso) {
      goals = dados.dados.map(item => ({
        ...item,
        valor_meta: Number(item.valor_meta),
        valor_atual: Number(item.valor_atual)
      }));
      renderGoals();
    }
  } catch (err) { console.error(err); }
}

/* =====================
   RESUMO MENSAL
===================== */

let resumoAno = new Date().getFullYear();
let resumoMes = new Date().getMonth(); // 0-indexed
let resumoBarChart = null;

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_PT_CURTO = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function resumoMesAnterior() {
  resumoMes--;
  if (resumoMes < 0) { resumoMes = 11; resumoAno--; }
  renderResumo();
}

function resumoMesProximo() {
  const now = new Date();
  if (resumoAno === now.getFullYear() && resumoMes >= now.getMonth()) return;
  resumoMes++;
  if (resumoMes > 11) { resumoMes = 0; resumoAno++; }
  renderResumo();
}

function txDoMes(ano, mes) {
  return transactions.filter(t => {
    const [y, m] = t.data.split("-").map(Number);
    return y === ano && m === mes + 1;
  });
}

function renderResumo() {
  const fmt = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Label do mês
  document.getElementById("resumo-mes-label").textContent = `${MESES_PT[resumoMes]} ${resumoAno}`;

  // Dados do mês selecionado
  const txMes = txDoMes(resumoAno, resumoMes);
  const receitas = txMes.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = txMes.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
  const saldo = receitas - despesas;

  document.getElementById("resumo-receitas").textContent = fmt(receitas);
  document.getElementById("resumo-despesas").textContent = fmt(despesas);
  document.getElementById("resumo-saldo").textContent = fmt(saldo);

  const trend = document.getElementById("resumo-saldo-trend");
  if (saldo > 0) { trend.textContent = "▲ Mês positivo"; trend.style.color = "var(--green)"; }
  else if (saldo < 0) { trend.textContent = "▼ Mês negativo"; trend.style.color = "var(--red)"; }
  else { trend.textContent = ""; }

  // Categorias mais gastas no mês
  renderResumoCategorias(txMes);

  // Gráfico de barras — últimos 6 meses
  renderResumoBarChart();

  // Tabela histórica
  renderResumoTabela();
}

function renderResumoCategorias(txMes) {
  const el = document.getElementById("resumo-categorias");
  document.getElementById("resumo-cat-mes").textContent = `${MESES_PT_CURTO[resumoMes]}/${resumoAno}`;

  const despesas = txMes.filter(t => t.tipo === "despesa");

  if (despesas.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:24px 0"><p>Sem despesas neste mês.</p></div>`;
    return;
  }

  // Agrupa por categoria
  const catMap = {};
  despesas.forEach(t => {
    catMap[t.categoria] = (catMap[t.categoria] || 0) + t.valor;
  });
  const total = Object.values(catMap).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const catIcons = {
    "Alimentação": "🍽️", "Moradia": "🏠", "Transporte": "🚗",
    "Saúde": "💊", "Educação": "📚", "Lazer": "🎮", "Outros": "📦"
  };

  el.innerHTML = sorted.map(([cat, val]) => {
    const pct = (val / total * 100).toFixed(1);
    return `
      <div class="cat-row">
        <div class="cat-row-top">
          <span class="cat-row-name">${catIcons[cat] || "📦"} ${cat}</span>
          <span class="cat-row-val">${val.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
        </div>
        <div class="progress" style="margin-bottom:2px">
          <div class="progress-bar" style="width:${pct}%; background: var(--red)"></div>
        </div>
        <div class="cat-row-pct">${pct}%</div>
      </div>
    `;
  }).join("");
}

function renderResumoBarChart() {
  // Monta os últimos 6 meses a partir do mês selecionado
  const labels = [], receitasData = [], despesasData = [];

  for (let i = 5; i >= 0; i--) {
    let m = resumoMes - i;
    let y = resumoAno;
    while (m < 0) { m += 12; y--; }
    const tx = txDoMes(y, m);
    labels.push(MESES_PT_CURTO[m]);
    receitasData.push(tx.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0));
    despesasData.push(tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0));
  }

  const ctx = document.getElementById("resumoBarChart");
  if (!ctx) return;
  if (resumoBarChart) resumoBarChart.destroy();

  resumoBarChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Receitas",
          data: receitasData,
          backgroundColor: "rgba(34,208,122,0.7)",
          borderColor: "rgba(34,208,122,1)",
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: "Despesas",
          data: despesasData,
          backgroundColor: "rgba(255,92,124,0.7)",
          borderColor: "rgba(255,92,124,1)",
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#8888a0", font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` R$ ${ctx.raw.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8888a0" }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: {
          ticks: {
            color: "#8888a0",
            callback: v => "R$ " + v.toLocaleString("pt-BR")
          },
          grid: { color: "rgba(255,255,255,0.04)" }
        }
      }
    }
  });
}

function renderResumoTabela() {
  const el = document.getElementById("resumo-tabela");
  const fmt = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Descobre todos os meses com transações
  const mesesSet = new Set();
  transactions.forEach(t => {
    const [y, m] = t.data.split("-").map(Number);
    mesesSet.add(`${y}-${String(m).padStart(2,"0")}`);
  });

  // Adiciona o mês atual mesmo que vazio
  const now = new Date();
  mesesSet.add(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);

  const mesesOrdenados = [...mesesSet].sort().reverse().slice(0, 12);

  if (mesesOrdenados.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>Nenhum dado disponível.</p></div>`;
    return;
  }

  const rows = mesesOrdenados.map(ym => {
    const [y, m] = ym.split("-").map(Number);
    const tx = txDoMes(y, m - 1);
    const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
    const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
    const saldo = rec - desp;
    const isSelected = y === resumoAno && m - 1 === resumoMes;
    return `
      <tr class="resumo-row ${isSelected ? "resumo-row-selected" : ""}" onclick="resumoIrMes(${y}, ${m-1})">
        <td class="resumo-td-mes">${MESES_PT[m-1]} ${y}</td>
        <td class="resumo-td green-text">${fmt(rec)}</td>
        <td class="resumo-td red-text">${fmt(desp)}</td>
        <td class="resumo-td ${saldo >= 0 ? "green-text" : "red-text"} bold-text">${fmt(saldo)}</td>
      </tr>
    `;
  }).join("");

  el.innerHTML = `
    <table class="resumo-table">
      <thead>
        <tr>
          <th>Mês</th>
          <th>Receitas</th>
          <th>Despesas</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function resumoIrMes(ano, mes) {
  resumoAno = ano;
  resumoMes = mes;
  renderResumo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =====================
   SIMULAÇÕES
===================== */

function simulateSavings() {
  const objetivo = parseFloat(document.getElementById("sim-goal-value").value);
  const mensal = parseFloat(document.getElementById("sim-monthly").value);

  if (!objetivo || !mensal) { toast("Preencha todos os campos", "error"); return; }

  const meses = Math.ceil(objetivo / mensal);

  document.getElementById("sim-result-1").innerHTML = `
    <div class="sim-result-box">
      <div class="sim-result-label">Tempo necessário</div>
      <div class="sim-result-value">${meses} meses</div>
      <div class="sim-result-sub">
        Guardando ${mensal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} por mês.
      </div>
    </div>
  `;
}

function simulateMonthly() {
  const valor = parseFloat(document.getElementById("sim-value2").value);
  const meses = parseInt(document.getElementById("sim-months2").value);

  if (!valor || !meses) { toast("Preencha todos os campos", "error"); return; }

  const resultado = valor / meses;

  document.getElementById("sim-result-2").innerHTML = `
    <div class="sim-result-box">
      <div class="sim-result-label">Valor mensal necessário</div>
      <div class="sim-result-value">
        ${resultado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
      </div>
      <div class="sim-result-sub">
        Para atingir o objetivo em ${meses} meses.
      </div>
    </div>
  `;
}

function simulateCompound() {
  const principal = parseFloat(document.getElementById("sim-principal").value);
  const rate = parseFloat(document.getElementById("sim-rate").value) / 100;
  const period = parseInt(document.getElementById("sim-period").value);

  if (!principal || !rate || !period) { toast("Preencha todos os campos", "error"); return; }

  const montante = principal * Math.pow(1 + rate, period);
  const lucro = montante - principal;

  document.getElementById("sim-result-3").innerHTML = `
    <div class="sim-result-box">
      <div class="sim-result-label">Montante após ${period} meses</div>
      <div class="sim-result-value">
        ${montante.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
      </div>
      <div class="sim-result-sub">
        Lucro de ${lucro.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
      </div>
    </div>
  `;
}

/* =====================
   DIALOG CUSTOMIZADO
===================== */

function confirmar(msg) {
  return new Promise(resolve => {
    // Remove dialog anterior se existir
    const old = document.getElementById("confirm-dialog");
    if (old) old.remove();

    const dialog = document.createElement("div");
    dialog.id = "confirm-dialog";
    dialog.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-box">
          <p>${msg}</p>
          <div class="confirm-btns">
            <button class="confirm-cancel" id="confirm-no">Cancelar</button>
            <button class="confirm-ok" id="confirm-yes">Excluir</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById("confirm-yes").onclick = () => { dialog.remove(); resolve(true); };
    document.getElementById("confirm-no").onclick  = () => { dialog.remove(); resolve(false); };
  });
}

/* =====================
   INÍCIO
===================== */

showLogin();
