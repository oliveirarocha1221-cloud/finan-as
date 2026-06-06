const API_URL =
  "https://script.google.com/macros/s/AKfycbwCzePanHdiNVqnz0TuJJl6J7vbRRMJRrfqoIOsIdhLqjFWF42eu_vyq-0z7NvT3OqI/exec"

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
}

/* =====================
   CADASTRO
===================== */

async function register() {
  const nome = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const senha = document.getElementById("register-password").value.trim();

  if (!nome || !email || !senha) { toast("Preencha todos os campos", "error"); return; }

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
  }
}

/* =====================
   LOGIN
===================== */

async function login() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value.trim();

  if (!email || !senha) { toast("Preencha os campos", "error"); return; }

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

  const transacao = { id: Date.now(), usuario_id: currentUser.id, data, tipo, descricao, valor, categoria };

  try {
    const dados = await api({ acao: "lancamento", ...transacao });
    if (dados.sucesso) {
  await carregarLancamentos();
  atualizarDashboard();
}
  } catch (err) {
    console.error(err);
    toast("Erro ao salvar", "error");
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
    <div class="transaction ${tx.tipo}" id="tx-${tx.id}">
      <div class="tx-info">
        <strong>${catIcons[tx.categoria] || ""} ${tx.descricao}</strong>
        <div class="tx-meta">
          <span class="tx-cat">${tx.categoria}</span>
          <span class="tx-date">${tx.data}</span>
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
  if (!confirm("Excluir este lançamento?")) return;

  try {
    const dados = await api({ acao: "excluir_lancamento", id: String(id), usuario_id: currentUser.id });
    if (dados.sucesso) {
      transactions = transactions.filter(t => String(t.id) !== String(id));
      renderTransactions();
      atualizarDashboard();
      toast("Lançamento excluído");
    } else {
      toast("Erro ao excluir", "error");
    }
  } catch (err) {
    console.error(err);
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
    if (dados.sucesso) {
      goals.push(meta);
      renderGoals();
      document.getElementById("goal-name").value = "";
      document.getElementById("goal-target").value = "";
      toast("Meta criada!");
    }
  } catch (err) { console.error(err); }
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
    return `
      <div class="goal-card" id="goal-${meta.id}">
        <div class="goal-card-header">
          <h3>${complete ? "✅ " : ""}${meta.nome_meta}</h3>
          <button class="delete-btn" onclick="deleteGoal('${meta.id}')" title="Excluir meta">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
        <div class="goal-amount">
          <strong>R$ ${meta.valor_atual.toFixed(2)}</strong> de R$ ${meta.valor_meta.toFixed(2)}
        </div>
        <div class="progress">
          <div class="progress-bar ${complete ? "complete" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="goal-percent">${pct.toFixed(1)}%</div>
      </div>
    `;
  }).join("");
}

async function deleteGoal(id) {
  if (!confirm("Excluir esta meta?")) return;

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
   SIMULAÇÕES
===================== */

function simulateSavings() {
  const objetivo = parseFloat(document.getElementById("sim-goal-value").value);
  const mensal = parseFloat(document.getElementById("sim-monthly").value);

  if (!objetivo || !mensal) {
    toast("Preencha todos os campos", "error");
    return;
  }

  const meses = Math.ceil(objetivo / mensal);

  document.getElementById("sim-result-1").innerHTML = `
    <div class="sim-result-box">
      <div class="sim-result-label">Tempo necessário</div>
      <div class="sim-result-value">${meses} meses</div>
      <div class="sim-result-sub">
        Guardando ${mensal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
        por mês.
      </div>
    </div>
  `;
}

function simulateMonthly() {
  const valor = parseFloat(document.getElementById("sim-value2").value);
  const meses = parseInt(document.getElementById("sim-months2").value);

  if (!valor || !meses) {
    toast("Preencha todos os campos", "error");
    return;
  }

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

  if (!principal || !rate || !period) {
    toast("Preencha todos os campos", "error");
    return;
  }

  const montante = principal * Math.pow(1 + rate, period);
  const lucro = montante - principal;

  document.getElementById("sim-result-3").innerHTML = `
    <div class="sim-result-box">
      <div class="sim-result-label">
        Montante após ${period} meses
      </div>
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
   INÍCIO
===================== */

showLogin();
