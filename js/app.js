"use strict";

/* =====================================================================
   Baralho de Interesses — lógica principal
   Estado persistido inteiro em localStorage, sob a chave STORAGE_KEY.
   ===================================================================== */

const STORAGE_KEY = "baralho-interesses:v1";
const THEME_KEY = "baralho-interesses:theme";

const DEFAULT_ITEM_NAMES = [
  "Videogames",
  "Anime",
  "Mangá",
  "Canto",
  "Microcontrolador (Arduino/ESP)",
  "Catequese",
  "Bíblia",
  "Xadrez",
  "Literatura",
  "Literatura Católica",
  "Filosofia",
  "Programação",
  "AI",
  "Idioma (Francês)",
  "Latim",
];

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */

function makeId() {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateHuman(dateKey) {
  if (!dateKey) return "—";
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("pt-BR", { weekday: "long" });
  const rest = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${rest}`;
}

function formatDateShort(dateKey) {
  if (!dateKey) return "—";
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ---------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------- */

function buildInitialState() {
  const today = todayKey();
  return {
    version: 1,
    items: DEFAULT_ITEM_NAMES.map((name) => ({
      id: makeId(),
      name,
      status: "available",
      createdAt: today,
    })),
    todayPick: null,
    history: [],
    cycles: {
      completed: 0,
      currentStart: today,
      log: [],
    },
    smash: {
      count: 0,
      log: [],
    },
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return buildInitialState();
    return parsed;
  } catch (e) {
    console.error("Falha ao carregar estado, iniciando do zero.", e);
    return buildInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------------------------------------------------------------
   Regras de negócio
   --------------------------------------------------------------------- */

function availableItems() {
  return state.items.filter((it) => it.status === "available");
}

function usedItems() {
  return state.items.filter((it) => it.status === "used");
}

function pickToday(itemId) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item || item.status !== "available") return;

  const today = todayKey();
  item.status = "used";

  state.todayPick = { itemId: item.id, itemName: item.name, date: today };
  state.history.unshift({ itemId: item.id, itemName: item.name, date: today });

  saveState();

  const cycleJustCompleted = maybeCompleteCycle();
  render();

  if (cycleJustCompleted) {
    const count = cycleJustCompleted.count;
    showModal(
      `🎉 Ciclo completo! ${count} interesse${count === 1 ? "" : "s"} explorado${count === 1 ? "" : "s"}. Novo ciclo começando.`,
      [{ label: "Bacana!", primary: true }]
    );
  } else {
    showToast(`Tema de hoje: ${item.name}`);
  }
}

function maybeCompleteCycle() {
  if (state.items.length === 0) return null;
  const stillAvailable = state.items.some((it) => it.status === "available");
  if (stillAvailable) return null;

  const today = todayKey();
  const completedCycle = {
    startDate: state.cycles.currentStart,
    endDate: today,
    count: state.items.length,
  };
  state.cycles.log.unshift(completedCycle);
  state.cycles.completed += 1;
  state.cycles.currentStart = today;

  state.items.forEach((it) => {
    it.status = "available";
  });

  saveState();
  return completedCycle;
}

function changeTodayPick() {
  if (!state.todayPick) return;
  const prevItem = state.items.find((it) => it.id === state.todayPick.itemId);
  if (prevItem) {
    prevItem.status = "available";
  }
  state.todayPick = null;
  saveState();
  render();
}

function addItem(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  state.items.push({
    id: makeId(),
    name: trimmed,
    status: "available",
    createdAt: todayKey(),
  });
  saveState();
  render();
}

function editItem(itemId, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return;
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  item.name = trimmed;
  if (state.todayPick && state.todayPick.itemId === itemId) {
    state.todayPick.itemName = trimmed;
  }
  saveState();
  render();
}

function deleteItem(itemId) {
  const idx = state.items.findIndex((it) => it.id === itemId);
  if (idx === -1) return;

  const wasToday = state.todayPick && state.todayPick.itemId === itemId;
  state.items.splice(idx, 1);

  if (wasToday) {
    state.todayPick = null;
  }

  saveState();
  render();

  if (wasToday) {
    showToast("Item excluído — era o tema de hoje. Escolha um novo tema.");
  } else {
    showToast("Item excluído.");
  }
}

function registerSmash() {
  const today = todayKey();
  state.smash.count += 1;
  state.smash.log.unshift({ date: today, ts: Date.now() });
  saveState();
  render();
  showToast("🥊 Sessão de Smash registrada!");
}

/* ---------------------------------------------------------------------
   Render
   --------------------------------------------------------------------- */

const el = (id) => document.getElementById(id);

function render() {
  renderTodaySection();
  renderChoiceSection();
  renderUsedSection();
  renderSmashSection();
  renderManageSection();
  renderHistorySection();
}

function renderTodaySection() {
  const highlight = el("today-highlight");
  const choiceSection = el("choice-section");

  const today = todayKey();
  const hasPickToday = state.todayPick && state.todayPick.date === today;

  if (hasPickToday) {
    highlight.classList.remove("hidden");
    choiceSection.classList.add("hidden");
    el("today-name").textContent = state.todayPick.itemName;
    el("today-date").textContent = formatDateHuman(today);
  } else {
    highlight.classList.add("hidden");
    choiceSection.classList.remove("hidden");
  }
}

function renderChoiceSection() {
  const today = todayKey();
  const hasPickToday = state.todayPick && state.todayPick.date === today;
  if (hasPickToday) return;

  const grid = el("choice-grid");
  const empty = el("choice-empty");
  const available = availableItems();

  el("available-count").textContent = `${available.length} disponível${available.length === 1 ? "" : "eis"}`;

  grid.innerHTML = "";
  if (available.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  available.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "deck-card";
    card.textContent = item.name;
    card.addEventListener("click", () => pickToday(item.id));
    grid.appendChild(card);
  });
}

function renderUsedSection() {
  const grid = el("used-grid");
  const used = usedItems();
  grid.innerHTML = "";
  used.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "used-chip";
    chip.textContent = item.name;
    grid.appendChild(chip);
  });
  const toggleLabel = el("toggle-used").querySelector("span");
  toggleLabel.textContent = `Usados neste ciclo (${used.length})`;
}

function renderSmashSection() {
  el("smash-count").textContent = state.smash.count;
  const last = state.smash.log[0];
  el("smash-last").textContent = last ? formatDateShort(last.date) : "—";
}

function renderManageSection() {
  const list = el("manage-list");
  list.innerHTML = "";

  if (state.items.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Nenhum item no baralho ainda. Adicione o primeiro acima.";
    list.appendChild(p);
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "manage-item" + (item.status === "used" ? " is-used" : "");

    const dot = document.createElement("span");
    dot.className = "manage-item-status";
    row.appendChild(dot);

    const name = document.createElement("span");
    name.className = "manage-item-name";
    name.textContent = item.name;
    row.appendChild(name);

    const actions = document.createElement("div");
    actions.className = "manage-item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.title = "Editar";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => startEditItem(row, item));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-delete";
    delBtn.title = "Excluir";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => confirmDeleteItem(item));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  });
}

function startEditItem(row, item) {
  row.innerHTML = "";
  row.classList.add("is-editing");

  const input = document.createElement("input");
  input.className = "manage-item-input";
  input.value = item.name;
  input.maxLength = 60;

  const actions = document.createElement("div");
  actions.className = "manage-item-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.title = "Salvar";
  saveBtn.textContent = "✅";
  const commit = () => {
    editItem(item.id, input.value || item.name);
  };
  saveBtn.addEventListener("click", commit);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.title = "Cancelar";
  cancelBtn.textContent = "✖️";
  cancelBtn.addEventListener("click", () => render());

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") render();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  row.appendChild(input);
  row.appendChild(actions);
  input.focus();
  input.select();
}

function confirmDeleteItem(item) {
  showModal(`Excluir "${item.name}" do baralho? Essa ação não pode ser desfeita.`, [
    { label: "Cancelar" },
    {
      label: "Excluir",
      danger: true,
      onClick: () => deleteItem(item.id),
    },
  ]);
}

let activeHistoryTab = "choices";

function renderHistorySection() {
  el("stat-cycles").textContent = state.cycles.completed;
  el("stat-choices").textContent = state.history.length;
  el("stat-smash").textContent = state.smash.count;

  const choicesEl = el("history-choices");
  choicesEl.innerHTML = "";
  if (state.history.length === 0) {
    choicesEl.innerHTML = '<p class="history-empty">Nenhuma escolha registrada ainda.</p>';
  } else {
    state.history.forEach((h) => {
      choicesEl.appendChild(
        historyRow(h.itemName, formatDateHuman(h.date), null)
      );
    });
  }

  const cyclesEl = el("history-cycles");
  cyclesEl.innerHTML = "";
  if (state.cycles.log.length === 0) {
    cyclesEl.innerHTML = '<p class="history-empty">Nenhum ciclo completo ainda.</p>';
  } else {
    state.cycles.log.forEach((c, i) => {
      const title = `Ciclo #${state.cycles.log.length - i}`;
      const sub = `${formatDateShort(c.startDate)} → ${formatDateShort(c.endDate)} · ${c.count} interesses`;
      cyclesEl.appendChild(historyRow(title, null, sub));
    });
  }

  const smashEl = el("history-smash");
  smashEl.innerHTML = "";
  if (state.smash.log.length === 0) {
    smashEl.innerHTML = '<p class="history-empty">Nenhuma sessão de Smash registrada ainda.</p>';
  } else {
    state.smash.log.forEach((s) => {
      smashEl.appendChild(historyRow("🥊 Sessão de Smash", formatDateHuman(s.date), null));
    });
  }
}

function historyRow(title, dateText, subText) {
  const row = document.createElement("div");
  row.className = "history-row";

  const left = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "history-row-title";
  titleEl.textContent = title;
  left.appendChild(titleEl);
  if (subText) {
    const subEl = document.createElement("div");
    subEl.className = "history-row-sub";
    subEl.textContent = subText;
    left.appendChild(subEl);
  }
  row.appendChild(left);

  if (dateText) {
    const dateEl = document.createElement("div");
    dateEl.className = "history-row-date";
    dateEl.textContent = dateText;
    row.appendChild(dateEl);
  }

  return row;
}

/* ---------------------------------------------------------------------
   Navegação entre telas
   --------------------------------------------------------------------- */

function showView(name) {
  el("view-today").classList.toggle("hidden", name !== "today");
  el("view-manage").classList.toggle("hidden", name !== "manage");
  el("view-history").classList.toggle("hidden", name !== "history");
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------
   Toast & Modal
   --------------------------------------------------------------------- */

let toastTimer = null;
function showToast(message, duration = 2600) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), duration);
}

function showModal(message, buttons) {
  const backdrop = el("modal-backdrop");
  const msgEl = el("modal-message");
  const actionsEl = el("modal-actions");

  msgEl.textContent = message;
  actionsEl.innerHTML = "";

  buttons.forEach((btn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + (btn.danger ? "btn-danger" : btn.primary ? "btn-primary" : "btn-ghost");
    b.textContent = btn.label;
    b.addEventListener("click", () => {
      closeModal();
      if (btn.onClick) btn.onClick();
    });
    actionsEl.appendChild(b);
  });

  backdrop.classList.remove("hidden");
}

function closeModal() {
  el("modal-backdrop").classList.add("hidden");
}

/* ---------------------------------------------------------------------
   Tema (dark / light)
   --------------------------------------------------------------------- */

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const isLight =
    theme === "light" ||
    (!theme && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  el("theme-toggle").textContent = isLight ? "☀️" : "🌙";
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY);
  const isLightNow =
    current === "light" ||
    (!current && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  const next = isLightNow ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/* ---------------------------------------------------------------------
   Event bindings
   --------------------------------------------------------------------- */

function bindEvents() {
  el("btn-change-today").addEventListener("click", () => {
    showModal("Trocar o tema de hoje? O item atual volta para a lista de disponíveis.", [
      { label: "Cancelar" },
      { label: "Trocar", primary: true, onClick: changeTodayPick },
    ]);
  });

  el("toggle-used").addEventListener("click", () => {
    el("used-section").classList.toggle("open");
  });

  el("btn-smash").addEventListener("click", registerSmash);

  el("nav-manage").addEventListener("click", () => showView("manage"));
  el("btn-back-from-manage").addEventListener("click", () => showView("today"));

  el("nav-history").addEventListener("click", () => showView("history"));
  el("btn-back-from-history").addEventListener("click", () => showView("today"));

  el("theme-toggle").addEventListener("click", toggleTheme);

  el("add-item-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el("new-item-name");
    addItem(input.value);
    input.value = "";
    input.focus();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeHistoryTab = btn.dataset.tab;
      el("history-choices").classList.toggle("hidden", activeHistoryTab !== "choices");
      el("history-cycles").classList.toggle("hidden", activeHistoryTab !== "cycles");
      el("history-smash").classList.toggle("hidden", activeHistoryTab !== "smash");
    });
  });
}

/* ---------------------------------------------------------------------
   Init
   --------------------------------------------------------------------- */

function init() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme);

  bindEvents();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        console.warn("Falha ao registrar service worker:", err);
      });
    });
  }
}

init();
