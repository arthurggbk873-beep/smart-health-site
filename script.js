(() => {
  const STORAGE_KEY = "smart-health-state-v3",
    uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    now = () => new Date().toISOString();
  const mem = {};
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return mem[k] ?? null;
      }
    },
    set(k, v) {
      mem[k] = v;
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    },
  };
  const hooks = [];
  const demoUnits = [
    {
      id: "ubs-centro",
      name: "UBS Centro",
      type: "ubs",
      address: "Praça Silviano Brandão, 92",
      phone: "(31) 3891-2040",
      capacity: 18,
      waiting: 14,
      status: "attention",
      services: ["Clínica geral", "Vacinação", "Enfermagem"],
    },
    {
      id: "ubs-bom-jesus",
      name: "UBS Bom Jesus",
      type: "ubs",
      address: "Rua Gomes Barbosa, 410",
      phone: "(31) 3891-2251",
      capacity: 20,
      waiting: 5,
      status: "open",
      services: ["Pediatria", "Odontologia", "Curativos"],
    },
    {
      id: "upa-vicosa",
      name: "UPA Viçosa",
      type: "upa",
      address: "Av. Marechal Castelo Branco, 1200",
      phone: "(31) 3891-1920",
      capacity: 30,
      waiting: 23,
      status: "attention",
      services: ["Urgência", "Observação", "Raio-X"],
    },
    {
      id: "hospital-sao-joao",
      name: "Hospital São João",
      type: "hospital",
      address: "Rua Dr. Brito, 155",
      phone: "(31) 3891-3000",
      capacity: 35,
      waiting: 8,
      status: "open",
      services: ["Pronto atendimento", "Internação", "Exames"],
    },
    {
      id: "ubs-silvestre",
      name: "UBS Silvestre",
      type: "ubs",
      address: "Rua dos Ipês, 36",
      phone: "(31) 3891-2180",
      capacity: 16,
      waiting: 0,
      status: "closed",
      services: ["Clínica geral", "Saúde da família"],
    },
    {
      id: "ubs-fatima",
      name: "UBS de Fátima",
      type: "ubs",
      address: "Rua José Lopes, 68",
      phone: "(31) 3891-2312",
      capacity: 16,
      waiting: 7,
      status: "open",
      services: ["Ginecologia", "Enfermagem", "Vacinação"],
    },
  ];
  const unitExtras = {
    "ubs-centro": { lat: -20.7535, lng: -42.8806, hours: "7h–17h", inService: 4, professionals: 4, finishedToday: 42, arrivedToday: 51 },
    "ubs-bom-jesus": { lat: -20.7612, lng: -42.8868, hours: "7h–17h", inService: 3, professionals: 3, finishedToday: 30, arrivedToday: 34 },
    "upa-vicosa": { lat: -20.7448, lng: -42.872, hours: "24h", inService: 7, professionals: 6, finishedToday: 88, arrivedToday: 97 },
    "hospital-sao-joao": { lat: -20.7562, lng: -42.8841, hours: "24h", inService: 6, professionals: 8, finishedToday: 61, arrivedToday: 64 },
    "ubs-silvestre": { lat: -20.7705, lng: -42.8915, hours: "7h–17h", inService: 0, professionals: 0, finishedToday: 0, arrivedToday: 0 },
    "ubs-fatima": { lat: -20.7482, lng: -42.8765, hours: "7h–17h", inService: 2, professionals: 3, finishedToday: 25, arrivedToday: 28 },
  };
  demoUnits.forEach((u) => Object.assign(u, unitExtras[u.id]));
  const freshState = () => {
    const units = demoUnits.map((u) => ({ ...u }));
    return {
      v: 3,
      units,
      history: [
        {
          id: uid(),
          time: now(),
          title: "Dados de demonstração carregados",
          description: "A rede municipal foi inicializada para apresentação do projeto.",
        },
      ],
      settings: { overload: 1 },
      alerts: SHData.seedAlerts(),
      patients: SHData.seedPatients(),
      notices: SHData.seedNotices(),
      subscribers: SHData.seedSubs(),
      links: [],
      imports: [],
      demand: SHData.genDemand(units),
    };
  };
  function loadState() {
    try {
      const saved = JSON.parse(store.get(STORAGE_KEY));
      if (saved?.units && saved.v === 3) return saved;
    } catch (e) {}
    const initial = freshState();
    store.set(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  let state = loadState();
  const savedTheme = store.get("smart-health-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    typeLabels = { ubs: "UBS", upa: "UPA", hospital: "Hospital" },
    statusLabels = { open: "Em atendimento", attention: "Atenção", closed: "Fechada" };
  const escapeHtml = (v = "") =>
    String(v).replace(
      /[&<>'"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c],
    );
  const waitTime = (u) =>
    u.waiting === 0 ? "Sem espera" : `${Math.max(5, Math.ceil((u.waiting / u.capacity) * 60))} min`;
  function save() {
    store.set(STORAGE_KEY, JSON.stringify(state));
  }
  function formatDate(v) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(v));
  }
  function addHistory(title, description) {
    state.history.unshift({ id: uid(), time: now(), title, description });
    state.history = state.history.slice(0, 40);
    save();
  }
  const statusBadge = (u) =>
    `<span class="status-badge ${u.status}"><span class="status-dot"></span>${statusLabels[u.status]}</span>`;
  const LV = {
    baixa: { label: "Baixa", cls: "low" },
    moderada: { label: "Moderada", cls: "medium" },
    alta: { label: "Alta", cls: "high" },
    lotada: { label: "Lotada", cls: "crit" },
    indisponivel: { label: "Indisponível", cls: "off" },
  };
  const ratio = (u) => (u.capacity ? u.waiting / u.capacity : 0);
  const lvl = (u) =>
    u.status === "closed"
      ? "indisponivel"
      : ratio(u) < 0.5
        ? "baixa"
        : ratio(u) < 0.75
          ? "moderada"
          : ratio(u) <= 0.9
            ? "alta"
            : "lotada";
  const lvlBadge = (u) =>
    `<span class="lvl-badge lvl-${LV[lvl(u)].cls}"><i></i>${LV[lvl(u)].label}</span>`;
  const isOverload = (u) => u.status !== "closed" && ratio(u) >= state.settings.overload;
  const waitMin = (u) => (u.waiting === 0 ? 0 : Math.max(5, Math.ceil(ratio(u) * 60)));
  function normalizeUnits() {
    state.settings ||= { overload: 1 };
    state.alerts ||= [];
    state.patients ||= [];
    state.notices ||= [];
    state.subscribers ||= [];
    state.links ||= [];
    state.imports ||= [];
    state.demand ||= {};
    state.units.forEach((u) => {
      const h = SHData.hash(u.id);
      if (u.lat == null) {
        u.lat = -20.7546 + ((h % 1000) / 1000 - 0.5) * 0.03;
        u.lng = -42.8825 + (((h >> 10) % 1000) / 1000 - 0.5) * 0.03;
      }
      u.hours ||= u.type === "ubs" ? "7h–17h" : "24h";
      u.inService ??= 0;
      u.professionals ??= 0;
      u.finishedToday ??= 0;
      u.arrivedToday ??= 0;
      if (!state.demand[u.id]) state.demand[u.id] = SHData.genDemand([u])[u.id];
    });
  }
  function checkAlerts() {
    let changed = false;
    state.units.forEach((u) => {
      const active = state.alerts.find((a) => a.unitId === u.id && !a.resolvedAt);
      if (isOverload(u) && !active) {
        const pct = Math.round(ratio(u) * 100);
        state.alerts.unshift({ id: uid(), time: now(), unitId: u.id, unitName: u.name, waiting: u.waiting, capacity: u.capacity, ratio: pct });
        state.alerts = state.alerts.slice(0, 60);
        addHistory("Alerta de sobrecarga", `${u.name} chegou a ${pct}% da capacidade planejada.`);
        changed = true;
        toast(`Alerta de sobrecarga: ${u.name}`);
      } else if (!isOverload(u) && active) {
        active.resolvedAt = now();
        changed = true;
      }
    });
    if (changed) save();
  }
  function renderDashboard() {
    const dd = $("#dashDate");
    if (dd)
      dd.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
        .format(new Date())
        .toUpperCase();
    const total = state.units.reduce((s, u) => s + Number(u.waiting), 0),
      open = state.units.filter((u) => u.status === "open").length,
      attention = state.units.filter((u) => u.status === "attention").length,
      active = state.units.filter((u) => u.status !== "closed"),
      avg =
        active.reduce((s, u) => s + Math.ceil((u.waiting / u.capacity) * 60), 0) /
        (active.length || 1);
    $("#kpiGrid").innerHTML = [
      ["Unidades monitoradas", state.units.length, "Rede municipal ativa", "▦", ""],
      ["Pessoas na fila", total, "Somatório atualizado", "≡", attention ? "warn" : "good"],
      [
        "Tempo médio de espera",
        `${Math.round(avg)} min`,
        "Nas unidades em atendimento",
        "◷",
        avg > 30 ? "warn" : "good",
      ],
      [
        "Unidades em atendimento",
        open,
        `${attention} em atenção`,
        "⌂",
        attention ? "warn" : "good",
      ],
    ]
      .map(
        ([a, b, c, d, e]) =>
          `<article class="kpi"><span class="kpi-mark">${d}</span><span class="kpi-label">${a}</span><div class="kpi-value">${b}</div><span class="kpi-note ${e}">${c}</span></article>`,
      )
      .join("");
    const queueUnits = state.units
        .filter((u) => u.status !== "closed")
        .sort((a, b) => a.waiting - b.waiting),
      max = Math.max(...queueUnits.map((u) => u.capacity), 1);
    $("#queueBars").innerHTML =
      queueUnits
        .map((u, index) => {
          const load = Math.round((u.waiting / u.capacity) * 100),
            level = LV[lvl(u)].cls;
          return `<div class="queue-row ${index === 0 ? "best" : ""}"><div class="queue-label"><span class="queue-rank">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(u.name)}</strong><small>${index === 0 ? "Menor fila no momento" : statusLabels[u.status]}</small></div></div><div class="queue-visual"><div class="bar-track"><span class="bar-fill ${level}" style="width:${Math.max(4, Math.min(load, 100))}%"></span></div><span class="queue-load ${level}">${load}%</span></div><div class="queue-number"><strong>${u.waiting}</strong><small>pessoas</small></div></div>`;
        })
        .join("") || '<div class="empty-state">Nenhuma unidade em atendimento.</div>';
    const alerts = state.units.filter(
      (u) => u.status === "attention" || u.waiting / u.capacity > 0.75,
    );
    $("#alertCounter").textContent = alerts.length;
    $("#notificationCount").textContent = alerts.length;
    $("#alertList").innerHTML = alerts.length
      ? alerts
          .map(
            (u) =>
              `<div class="alert-item"><span class="alert-severity ${isOverload(u) ? "danger" : ""}"></span><div><strong>${escapeHtml(u.name)} ${isOverload(u) ? "em sobrecarga" : "exige atenção"}</strong><p>${u.waiting} pessoas na fila, ocupação de ${Math.round((u.waiting / u.capacity) * 100)}% da capacidade.</p></div></div>`,
          )
          .join("")
      : '<div class="empty-state">Nenhum alerta operacional no momento.</div>';
    $("#dashboardUnitRows").innerHTML = state.units
      .slice(0, 6)
      .map(
        (u) =>
          `<tr><td><div class="unit-cell"><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.address)}</small></div></td><td>${typeLabels[u.type]}</td><td>${statusBadge(u)}</td><td><span class="queue-cell-value"><strong>${u.waiting}</strong> pessoas</span></td><td>${waitTime(u)}</td><td><div class="row-actions"><button class="small-button" data-action="view" data-id="${u.id}">Detalhes</button></div></td></tr>`,
      )
      .join("");
  }
  function filteredUnits() {
    const t = $("#unitSearch")?.value.toLowerCase().trim() || "",
      type = $("#unitTypeFilter")?.value || "all",
      status = $("#unitStatusFilter")?.value || "all";
    return state.units.filter(
      (u) =>
        (type === "all" || u.type === type) &&
        (status === "all" || u.status === status) &&
        (!t || `${u.name} ${u.address} ${u.services.join(" ")}`.toLowerCase().includes(t)),
    );
  }
  function renderUnits() {
    const units = filteredUnits();
    $("#unitResultsCount").textContent =
      `${units.length} ${units.length === 1 ? "unidade" : "unidades"}`;
    $("#unitGrid").innerHTML = units.length
      ? units
          .map(
            (u) =>
              `<article class="unit-card"><div class="unit-card-head"><div><h3>${escapeHtml(u.name)}</h3><span class="unit-card-type">${typeLabels[u.type]} · ${escapeHtml(u.phone)}</span></div>${statusBadge(u)}</div><div class="unit-address">${escapeHtml(u.address)}</div><div class="unit-metrics"><div class="metric"><strong>${u.waiting}</strong><small>na fila</small></div><div class="metric"><strong>${waitTime(u)}</strong><small>espera estimada</small></div><div class="metric"><strong>${u.capacity}</strong><small>capacidade/h</small></div></div><div class="unit-services">${u.services.map((s) => `<span class="service-tag">${escapeHtml(s)}</span>`).join("")}</div><div class="unit-card-actions"><button class="small-button" data-action="edit" data-id="${u.id}">Editar</button><button class="small-button" data-action="view" data-id="${u.id}">Ver detalhes</button><button class="small-button danger" data-action="delete" data-id="${u.id}">Excluir</button></div></article>`,
          )
          .join("")
      : '<div class="empty-state"><strong>Nenhuma unidade encontrada</strong><span>Ajuste os filtros ou cadastre uma nova unidade.</span></div>';
  }
  function renderQueue() {
    $("#queueManagement").innerHTML = state.units
      .map(
        (u) =>
          `<article class="panel queue-control"><div><h3>${escapeHtml(u.name)}</h3><p>${typeLabels[u.type]} · capacidade média de ${u.capacity} atendimentos/hora</p></div><input class="queue-input" type="number" min="0" max="999" value="${u.waiting}" data-queue-id="${u.id}" aria-label="Pessoas aguardando em ${escapeHtml(u.name)}"><div class="estimate"><strong>${waitTime(u)}</strong><small>estimativa de espera</small></div><button class="small-button" data-action="toggle-status" data-id="${u.id}">${u.status === "closed" ? "Reabrir unidade" : "Alterar status"}</button></article>`,
      )
      .join("");
  }
  function renderHistory() {
    $("#historyList").innerHTML = state.history.length
      ? state.history
          .map(
            (h) =>
              `<div class="history-item"><span class="history-dot"></span><div><strong>${escapeHtml(h.title)}</strong><p>${escapeHtml(h.description)}</p></div><time>${formatDate(h.time)}</time></div>`,
          )
          .join("")
      : '<div class="empty-state">Nenhuma alteração registrada.</div>';
  }
  function renderAll() {
    normalizeUnits();
    checkAlerts();
    renderDashboard();
    renderUnits();
    renderQueue();
    renderHistory();
    $("#lastSync").textContent = "Atualizado agora";
    hooks.forEach((fn) => fn());
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2800);
  }
  function closeModal() {
    $("#modalBackdrop").classList.remove("open");
    $("#modalBackdrop").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function openModal(html) {
    $("#modalContent").innerHTML = html;
    $("#modalBackdrop").classList.add("open");
    $("#modalBackdrop").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function openUnitModal(unit = null) {
    const editing = Boolean(unit);
    openModal(
      `<h2>${editing ? "Editar unidade" : "Nova unidade"}</h2><p class="modal-subtitle">Informe os dados operacionais da unidade de saúde.</p><form id="unitForm"><div class="form-grid"><div class="form-field full"><label for="name">Nome da unidade</label><input id="name" required value="${editing ? escapeHtml(unit.name) : ""}" placeholder="Ex.: UBS Santo Antônio"></div><div class="form-field"><label for="type">Tipo</label><select id="type"><option value="ubs" ${unit?.type === "ubs" ? "selected" : ""}>UBS</option><option value="upa" ${unit?.type === "upa" ? "selected" : ""}>UPA</option><option value="hospital" ${unit?.type === "hospital" ? "selected" : ""}>Hospital</option></select></div><div class="form-field"><label for="capacity">Capacidade por hora</label><input id="capacity" type="number" min="1" required value="${editing ? unit.capacity : 15}"></div><div class="form-field full"><label for="address">Endereço</label><input id="address" required value="${editing ? escapeHtml(unit.address) : ""}" placeholder="Rua, número, bairro"></div><div class="form-field"><label for="phone">Telefone</label><input id="phone" value="${editing ? escapeHtml(unit.phone) : ""}" placeholder="(31) 0000-0000"></div><div class="form-field"><label for="status">Status de atendimento</label><select id="status"><option value="open" ${unit?.status === "open" ? "selected" : ""}>Em atendimento</option><option value="attention" ${unit?.status === "attention" ? "selected" : ""}>Atenção</option><option value="closed" ${unit?.status === "closed" ? "selected" : ""}>Fechada</option></select></div><div class="form-field full"><label for="services">Serviços oferecidos</label><input id="services" value="${editing ? escapeHtml(unit.services.join(", ")) : ""}" placeholder="Separe os serviços por vírgula"></div></div><div class="modal-actions"><button type="button" class="button secondary" data-modal-cancel>Cancelar</button><button class="button primary">${editing ? "Salvar alterações" : "Cadastrar unidade"}</button></div></form>`,
    );
    $("#unitForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        name: $("#name").value.trim(),
        type: $("#type").value,
        capacity: Math.max(1, Number($("#capacity").value)),
        address: $("#address").value.trim(),
        phone: $("#phone").value.trim(),
        status: $("#status").value,
        services: $("#services")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        waiting: unit?.waiting || 0,
      };
      if (!data.name || !data.address) {
        toast("Preencha o nome e o endereço.");
        return;
      }
      if (editing) {
        Object.assign(unit, data);
        addHistory("Unidade atualizada", `${data.name} teve seus dados cadastrais alterados.`);
        toast("Unidade atualizada com sucesso.");
      } else {
        state.units.push({ ...data, id: uid() });
        addHistory("Nova unidade cadastrada", `${data.name} foi adicionada à rede municipal.`);
        toast("Unidade cadastrada com sucesso.");
      }
      save();
      closeModal();
      renderAll();
    });
  }
  function openDetail(u) {
    openModal(
      `<h2>${escapeHtml(u.name)}</h2><p class="modal-subtitle">${typeLabels[u.type]} · ${statusLabels[u.status]}</p><p class="modal-section-title">Resumo operacional</p><div class="detail-list"><div class="detail-row"><span>Endereço</span><strong>${escapeHtml(u.address)}</strong></div><div class="detail-row"><span>Telefone</span><strong>${escapeHtml(u.phone || "Não informado")}</strong></div><div class="detail-row"><span>Pessoas aguardando</span><strong>${u.waiting}</strong></div><div class="detail-row"><span>Espera estimada</span><strong>${waitTime(u)}</strong></div><div class="detail-row"><span>Capacidade média</span><strong>${u.capacity} atendimentos/h</strong></div><div class="detail-row"><span>Serviços</span><strong>${escapeHtml(u.services.join(", "))}</strong></div></div>${u.status === "attention" ? '<div class="modal-alert">A unidade está em atenção. Considere redistribuir a demanda ou atualizar a equipe responsável.</div>' : ""}<div class="modal-actions"><button class="button secondary" data-modal-cancel>Fechar</button><button class="button primary" data-modal-edit="${u.id}">Editar unidade</button></div>`,
    );
  }
  function handleAction(action, id) {
    const u = state.units.find((x) => x.id === id);
    if (!u) return;
    if (action === "view") openDetail(u);
    if (action === "edit") openUnitModal(u);
    if (
      action === "delete" &&
      confirm(`Excluir ${u.name}? Esta ação será registrada no histórico.`)
    ) {
      state.units = state.units.filter((x) => x.id !== id);
      addHistory("Unidade excluída", `${u.name} foi removida do cadastro.`);
      save();
      renderAll();
      toast("Unidade excluída.");
    }
    if (action === "toggle-status") {
      u.status = u.status === "closed" ? "open" : "closed";
      addHistory(
        "Status atualizado",
        `${u.name} agora está ${statusLabels[u.status].toLowerCase()}.`,
      );
      save();
      renderAll();
      toast("Status atualizado.");
    }
  }
  function switchView(view) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    $$(".nav-link[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === view),
    );
    $("#breadcrumbTitle").textContent = $(`#view-${view}`)?.dataset.title || "Visão geral";
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  $$("[data-view-target]").forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.viewTarget)),
  );
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("click", (event) => {
    if (
      window.innerWidth <= 800 &&
      $("#sidebar").classList.contains("open") &&
      !event.target.closest("#sidebar") &&
      !event.target.closest("#mobileMenu")
    ) {
      $("#sidebar").classList.remove("open");
    }
  });
  $("#openUnitButton").addEventListener("click", () => openUnitModal());
  $("#openUnitFromDashboard").addEventListener("click", () => openUnitModal());
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (a) handleAction(a.dataset.action, a.dataset.id);
    if (e.target.closest("[data-modal-cancel]")) closeModal();
    const edit = e.target.closest("[data-modal-edit]");
    if (edit) {
      closeModal();
      openUnitModal(state.units.find((u) => u.id === edit.dataset.modalEdit));
    }
  });
  $("#unitSearch").addEventListener("input", renderUnits);
  $("#unitTypeFilter").addEventListener("change", renderUnits);
  $("#unitStatusFilter").addEventListener("change", renderUnits);
  $("#clearFilters").addEventListener("click", () => {
    $("#unitSearch").value = "";
    $("#unitTypeFilter").value = "all";
    $("#unitStatusFilter").value = "all";
    renderUnits();
  });
  $("#queueManagement").addEventListener("change", (e) => {
    if (!e.target.matches("[data-queue-id]")) return;
    const u = state.units.find((x) => x.id === e.target.dataset.queueId),
      v = Math.max(0, Number(e.target.value) || 0);
    if (u) {
      u.waiting = v;
      if (u.status !== "closed") u.status = v / u.capacity > 0.75 ? "attention" : "open";
      addHistory("Fila atualizada", `${u.name} passou a ter ${v} pessoa(s) aguardando.`);
      save();
      renderAll();
      toast("Fila atualizada e indicadores recalculados.");
    }
  });
  $("#clearHistory").addEventListener("click", () => {
    if (confirm("Limpar todo o histórico de alterações?")) {
      state.history = [];
      save();
      renderHistory();
      toast("Histórico limpo.");
    }
  });
  $("#refreshButton").addEventListener("click", () => {
    renderAll();
    toast("Dados atualizados a partir do armazenamento local.");
  });
  $("#notificationButton").addEventListener("click", () => {
    switchView("alerts");
  });
  $("#resetDemo").addEventListener("click", () => {
    if (confirm("Restaurar os dados demonstrativos? Os cadastros atuais serão substituídos.")) {
      state = freshState();
      save();
      renderAll();
      toast("Dados de demonstração restaurados.");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("smart-health-theme", next);
    $("#themeToggle").title = next === "dark" ? "Usar tema claro" : "Usar tema escuro";
    toast(next === "dark" ? "Tema escuro ativado." : "Tema claro ativado.");
  }
  $("#themeToggle").addEventListener("click", toggleTheme);
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      state = JSON.parse(e.newValue);
      renderAll();
    } catch (err) {}
  });
  window.SH = {
    get state() {
      return state;
    },
    save,
    addHistory,
    toast,
    openModal,
    closeModal,
    escapeHtml,
    waitTime,
    waitMin,
    switchView,
    renderAll,
    hooks,
    LV,
    lvl,
    lvlBadge,
    ratio,
    isOverload,
    formatDate,
    typeLabels,
    statusLabels,
    statusBadge,
    uid,
    now,
    store,
    toggleTheme,
  };
  renderAll();
})();
