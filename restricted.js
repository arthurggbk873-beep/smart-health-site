/* Smart Health - área restrita.
   Login (unidade e gestão), painel da unidade (RF07), alertas (RF09),
   demanda e picos (RF08), avisos (RF06) e importação de histórico (RF10). */
(() => {
  const SH = window.SH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = SH.escapeHtml;
  const S = () => SH.state;
  const pad2 = (n) => String(n).padStart(2, "0");
  const DAY = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const WEEK = [1, 2, 3, 4, 5, 6, 0];
  const FIRST = SHData.FIRST_HOUR;
  const HASH_1234 = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
  const sess = { role: null, unitId: null };

  const unitOf = () => S().units.find((u) => u.id === sess.unitId);
  const fmtWait = (m) => (m === 0 ? "Sem espera" : m >= 60 ? `${Math.floor(m / 60)}h${pad2(m % 60)}` : `${m} min`);
  const pct = (u) => Math.round(SH.ratio(u) * 100);
  const kpi = (mark, label, value, note, tone = "") =>
    `<article class="kpi"><span class="kpi-mark">${mark}</span><span class="kpi-label">${label}</span><div class="kpi-value">${value}</div><span class="kpi-note ${tone}">${note}</span></article>`;

  /* ---------- gráficos simples (HTML + CSS) ---------- */
  function bars(items, { h = 180, labelEvery = 1, showVals = true } = {}) {
    const max = Math.max(...items.map((i) => i.v), 1);
    return `<div class="bars" style="--h:${h}px">${items
      .map((i, n) => `<div class="bar-col" title="${esc(i.title || `${i.label}: ${i.v}`)}">${showVals ? `<span class="bar-val">${i.v}</span>` : ""}<div class="bar${i.cls ? " " + i.cls : ""}" style="height:${Math.max(2, (i.v / max) * 80)}%"></div><span class="bar-lab">${n % labelEvery === 0 ? i.label : ""}</span></div>`)
      .join("")}</div>`;
  }
  function pairBars(now, avg, h = 170) {
    const max = Math.max(...now, ...avg, 1);
    return `<div class="bars pair" style="--h:${h}px">${now
      .map((v, i) => `<div class="bar-col" title="${FIRST + i}h · hoje ${v} · média ${Math.round(avg[i])}"><div class="bar avg" style="height:${Math.max(2, (avg[i] / max) * 100)}%"></div><div class="bar now" style="height:${Math.max(2, (v / max) * 100)}%"></div><span class="bar-lab">${i % 2 === 0 ? FIRST + i + "h" : ""}</span></div>`)
      .join("")}</div><div class="chart-legend"><span><i class="lg avg"></i>Média dos últimos dias</span><span><i class="lg now"></i>Hoje</span></div>`;
  }
  const dateKeys = (unitId) => {
    const st = S();
    const ids = unitId === "all" ? st.units.map((u) => u.id) : [unitId];
    const m = {};
    ids.forEach((id) => Object.entries(st.demand[id] || {}).forEach(([d, arr]) => (m[d] = (m[d] || 0) + arr.reduce((a, b) => a + b, 0))));
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  };
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  function avgSeries(unitId) {
    const days = Object.values(S().demand[unitId] || {});
    return Array.from({ length: SHData.SLOTS }, (_, i) => (days.length ? days.reduce((a, d) => a + d[i], 0) / days.length : 0));
  }
  function matrix(unitId) {
    const st = S();
    const ids = unitId === "all" ? st.units.map((u) => u.id) : [unitId];
    const sum = Array.from({ length: 7 }, () => Array(SHData.SLOTS).fill(0));
    const seen = Array.from({ length: 7 }, () => new Set());
    ids.forEach((id) =>
      Object.entries(st.demand[id] || {}).forEach(([date, arr]) => {
        const w = new Date(`${date}T12:00:00`).getDay();
        arr.forEach((v, i) => (sum[w][i] += v));
        seen[w].add(date);
      }),
    );
    return sum.map((row, w) => row.map((v) => (seen[w].size ? v / seen[w].size : 0)));
  }

  /* ---------- login (área restrita) ---------- */
  async function sha(s) {
    try {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return null;
    }
  }
  async function passOk(p) {
    const h = await sha(p);
    return h ? h === HASH_1234 : p === "1234";
  }
  function openLogin() {
    const units = S().units;
    SH.openModal(`<h2>Área restrita</h2><p class="modal-subtitle">Acesso para unidades de saúde e gestão municipal.</p><form id="loginForm" autocomplete="off"><div class="form-grid"><div class="form-field full"><label>Perfil</label><div class="seg" id="roleSeg"><button type="button" data-role="unidade" class="active">Unidade de saúde</button><button type="button" data-role="gestao">Gestão municipal</button></div></div><div class="form-field full" id="unitField"><label for="loginUnit">Unidade</label><select id="loginUnit">${units.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("")}</select></div><div class="form-field full" id="passField"><label for="loginPass">Senha</label><input id="loginPass" type="password" autocomplete="off" required></div><div class="form-field full" id="codeField" hidden><label for="loginCode">Código de verificação (2ª etapa)</label><input id="loginCode" inputmode="numeric" maxlength="6" autocomplete="off"></div></div><p class="hint" id="loginHint">Demonstração: a senha é <b>1234</b>. A gestão confirma com um código em duas etapas.</p><p class="form-error" id="loginError" hidden></p><div class="modal-actions"><button type="button" class="button secondary" data-modal-cancel>Cancelar</button><button class="button primary" id="loginGo">Entrar</button></div></form>`);
    let role = "unidade", step = 1;
    const err = (m) => {
      $("#loginError").textContent = m;
      $("#loginError").hidden = !m;
    };
    $("#roleSeg").addEventListener("click", (e) => {
      const b = e.target.closest("[data-role]");
      if (!b || step === 2) return;
      role = b.dataset.role;
      $$("#roleSeg button").forEach((x) => x.classList.toggle("active", x === b));
      $("#unitField").hidden = role !== "unidade";
    });
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      err("");
      if (step === 1) {
        if (!(await passOk($("#loginPass").value))) return err("Senha incorreta.");
        if (role === "unidade") return enter("unidade", $("#loginUnit").value);
        step = 2;
        $("#passField").hidden = true;
        $("#unitField").hidden = true;
        $("#codeField").hidden = false;
        $("#loginHint").innerHTML = "Segunda etapa: informe o código de verificação. Demonstração: <b>123456</b>.";
        $("#loginGo").textContent = "Verificar";
        $("#loginCode").focus();
      } else {
        if ($("#loginCode").value.trim() !== "123456") return err("Código inválido.");
        enter("gestao", null);
      }
    });
    $("#loginPass").focus();
  }
  function enter(role, unitId, silent) {
    sess.role = role;
    sess.unitId = unitId;
    try {
      sessionStorage.setItem("sh-sess", JSON.stringify(sess));
    } catch (e) {}
    SH.closeModal();
    document.body.dataset.area = "restricted";
    document.body.dataset.role = role;
    const u = unitOf();
    $("#brandSub").textContent = role === "unidade" ? "Unidade de saúde" : "Gestão municipal";
    $("#profileAvatar").textContent = role === "unidade" ? (u ? u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "UN") : "AM";
    $("#profileName").textContent = role === "unidade" ? (u ? u.name : "Unidade") : "Admin Municipal";
    $("#profileRole").textContent = role === "unidade" ? "Recepção" : "Gestor da rede";
    SH.switchView(role === "unidade" ? "unit" : "dashboard");
    renderRestricted();
    if (!silent) SH.toast(role === "unidade" ? "Bem-vindo(a) ao painel da unidade." : "Bem-vindo(a) ao painel da gestão.");
  }
  function logout() {
    sess.role = null;
    sess.unitId = null;
    try {
      sessionStorage.removeItem("sh-sess");
    } catch (e) {}
    document.body.dataset.area = "public";
    document.body.dataset.role = "";
    window.scrollTo({ top: 0 });
  }

  /* ---------- painel da unidade (RF07) ---------- */
  function afterUnitChange(u, title, text) {
    if (u.status !== "closed") u.status = SH.ratio(u) > 0.75 ? "attention" : "open";
    SH.addHistory(title, `${u.name}: ${text}`);
    SH.save();
    SH.renderAll();
  }
  function movePatient(p, to) {
    const u = S().units.find((x) => x.id === p.unitId);
    if (!u) return;
    const from = p.status;
    if (from === "queue") u.waiting = Math.max(0, u.waiting - 1);
    if (from === "inService") u.inService = Math.max(0, u.inService - 1);
    if (to === "inService") u.inService += 1;
    if (to === "done") u.finishedToday += 1;
    p.status = to;
    p.log.push({ status: to, time: SH.now() });
    const label = { inService: "entrou em atendimento", done: "finalizou o atendimento", referred: "foi encaminhado(a)", left: "saiu da fila" }[to];
    afterUnitChange(u, "Status do atendimento", `${p.name} (${p.code}) ${label}.`);
  }
  function arrive(name) {
    const u = unitOf(), st = S();
    let code;
    do code = `SH-${1000 + Math.floor(Math.random() * 9000)}`;
    while (st.patients.some((p) => p.code === code));
    const t = SH.now();
    st.patients.push({ id: SH.uid(), code, name: name || "Paciente", unitId: u.id, status: "queue", log: [{ status: "registered", time: t }, { status: "queue", time: t }] });
    st.patients = st.patients.slice(-40);
    u.waiting += 1;
    u.arrivedToday += 1;
    afterUnitChange(u, "Chegada registrada", `${name || "Paciente"} entrou na fila (código ${code}).`);
    SH.toast(`Chegada registrada. Código ${code}.`);
  }
  function callNext() {
    const u = unitOf();
    if (!u.waiting) return SH.toast("Não há ninguém aguardando.");
    const p = S().patients.find((x) => x.unitId === u.id && x.status === "queue");
    if (p) return movePatient(p, "inService");
    u.waiting -= 1;
    u.inService += 1;
    afterUnitChange(u, "Próximo chamado", "uma pessoa foi chamada para atendimento.");
  }
  function finishOne() {
    const u = unitOf();
    if (!u.inService) return SH.toast("Não há atendimento em andamento.");
    const p = S().patients.find((x) => x.unitId === u.id && x.status === "inService");
    if (p) return movePatient(p, "done");
    u.inService -= 1;
    u.finishedToday += 1;
    afterUnitChange(u, "Atendimento finalizado", "um atendimento foi concluído.");
  }
  function renderUnitPanel() {
    if (sess.role !== "unidade") return;
    const u = unitOf();
    const box = $("#unitPanel");
    if (!u) {
      box.innerHTML = '<div class="empty-state"><strong>Unidade não encontrada</strong><span>Saia e entre novamente.</span></div>';
      return;
    }
    const closed = u.status === "closed";
    const today = SHData.todaySeries(u);
    const avg = avgSeries(u.id);
    const days = dateKeys(u.id).slice(-7).map(([d, v]) => ({ label: dm(d), v }));
    const mine = S().patients.filter((p) => p.unitId === u.id).slice(-8).reverse();
    const counter = (key, label, val) => `<article class="panel counter"><span>${label}</span><div><button class="round" data-count="${key}" data-d="-1" aria-label="Diminuir ${label}">−</button><strong>${val}</strong><button class="round" data-count="${key}" data-d="1" aria-label="Aumentar ${label}">+</button></div></article>`;
    const stLabel = { queue: "Na fila", inService: "Em atendimento", done: "Finalizado", referred: "Encaminhado", left: "Desistiu" };
    box.innerHTML = `<div class="page-heading"><div><p class="eyebrow">RECEPÇÃO · ${SH.typeLabels[u.type].toUpperCase()}</p><h1>Smart Health · ${esc(u.name)}</h1><p class="muted">Atualize os números da unidade. Espera, lotação e alertas são recalculados na hora.</p></div><label class="switch"><input type="checkbox" id="unitOpen" ${closed ? "" : "checked"}><span>Unidade aberta</span></label></div>
      <div class="kpi-grid">${kpi("◷", "Espera", closed ? "–" : fmtWait(SH.waitMin(u)), "Estimativa atual", SH.waitMin(u) > 30 ? "warn" : "good")}${kpi("▥", "Ocupação", `${pct(u)}%`, `Lotação ${SH.LV[SH.lvl(u)].label.toLowerCase()}`, ["alta", "lotada"].includes(SH.lvl(u)) ? "warn" : "good")}${kpi("✓", "Finalizados hoje", u.finishedToday, "Atendimentos concluídos")}${kpi("→", "Chegados hoje", u.arrivedToday, "Pessoas registradas")}</div>
      <section class="panel pad"><h2>Registrar atendimento</h2><div class="btn-row"><button class="button primary btn-md" id="uArrive" ${closed ? "disabled" : ""}>+ Registrar chegada</button><button class="button secondary btn-md" id="uNext" ${closed ? "disabled" : ""}>Chamar próximo</button><button class="button secondary btn-md" id="uFinish" ${closed ? "disabled" : ""}>✓ Finalizar atendimento</button></div></section>
      <div class="counter-grid">${counter("waiting", "Aguardando", u.waiting)}${counter("inService", "Em atendimento", u.inService)}${counter("professionals", "Profissionais", u.professionals)}${counter("capacity", "Capacidade por hora", u.capacity)}</div>
      <div class="grid-2"><section class="panel"><div class="panel-header"><div><h2>Demanda de hoje × média</h2><p>Chegadas por hora</p></div></div><div class="pad-body">${pairBars(today, avg)}</div></section><section class="panel"><div class="panel-header"><div><h2>Últimos 7 dias</h2><p>Atendimentos por dia</p></div></div><div class="pad-body">${bars(days, { h: 170 })}</div></section></div>
      <section class="panel table-panel"><div class="panel-header"><div><h2>Pacientes registrados</h2><p>Quem recebe o código acompanha o status pelo site</p></div></div><div class="table-scroll"><table><thead><tr><th>Paciente</th><th>Código</th><th>Status</th><th></th></tr></thead><tbody>${mine.length ? mine.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.code)}</td><td><span class="st-pill st-${p.status}">${stLabel[p.status]}</span></td><td><div class="row-actions">${p.status === "queue" ? `<button class="small-button" data-pt="${esc(p.id)}" data-to="inService">Chamar</button><button class="small-button" data-pt="${esc(p.id)}" data-to="left">Desistiu</button>` : ""}${p.status === "inService" ? `<button class="small-button" data-pt="${esc(p.id)}" data-to="done">Finalizar</button><button class="small-button" data-pt="${esc(p.id)}" data-to="referred">Encaminhar</button>` : ""}</div></td></tr>`).join("") : '<tr><td colspan="4"><div class="empty-state">Nenhum paciente registrado ainda.</div></td></tr>'}</tbody></table></div></section>`;
  }

  /* ---------- alertas de sobrecarga (RF09) ---------- */
  function renderAlerts() {
    const st = S();
    const active = st.alerts.filter((a) => !a.resolvedAt);
    const top = [...st.units].filter((u) => u.status !== "closed").sort((a, b) => SH.ratio(b) - SH.ratio(a))[0];
    $("#alertSummary").innerHTML =
      kpi("△", "Alertas ativos", active.length, active.length ? active.map((a) => esc(a.unitName)).join(", ") : "Rede sem sobrecarga", active.length ? "warn" : "good") +
      kpi("≡", "Alertas registrados", st.alerts.length, "No histórico") +
      kpi("%", "Limite do alerta", `${Math.round(st.settings.overload * 100)}%`, "Da capacidade planejada") +
      kpi("⌂", "Maior ocupação agora", top ? `${pct(top)}%` : "–", top ? esc(top.name) : "Sem unidades");
    $("#alertTable").innerHTML = `<table><thead><tr><th>Quando</th><th>Unidade</th><th>Ocupação</th><th>Fila / capacidade</th><th>Situação</th></tr></thead><tbody>${st.alerts.length ? st.alerts.map((a) => {
      const dur = a.resolvedAt ? Math.max(1, Math.round((new Date(a.resolvedAt) - new Date(a.time)) / 60000)) : null;
      return `<tr><td>${SH.formatDate(a.time)}</td><td><strong>${esc(a.unitName)}</strong></td><td>${a.ratio}%</td><td>${a.waiting} / ${a.capacity}</td><td>${a.resolvedAt ? `<span class="st-pill st-done">Resolvido em ${dur} min</span>` : '<span class="st-pill st-alert">Ativo</span>'}</td></tr>`;
    }).join("") : '<tr><td colspan="5"><div class="empty-state">Nenhum alerta registrado.</div></td></tr>'}</tbody></table>`;
  }

  /* ---------- demanda e picos (RF08) ---------- */
  function renderAnalytics() {
    const st = S();
    const sel = $("#anUnit");
    if (sel.dataset.n !== String(st.units.length)) {
      const cur = sel.value || "all";
      sel.innerHTML = '<option value="all">Toda a rede</option>' + st.units.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("");
      sel.value = st.units.some((u) => u.id === cur) ? cur : "all";
      sel.dataset.n = String(st.units.length);
    }
    const id = sel.value || "all";
    const active = st.units.filter((u) => u.status !== "closed");
    const waiting = active.reduce((a, u) => a + u.waiting, 0);
    const cap = active.reduce((a, u) => a + u.capacity, 0);
    const avgWait = Math.round(active.reduce((a, u) => a + SH.waitMin(u), 0) / (active.length || 1));
    const high = active.filter((u) => ["alta", "lotada"].includes(SH.lvl(u)));
    $("#anKpis").innerHTML =
      kpi("≡", "Aguardando na rede", waiting, "Pessoas em fila agora") +
      kpi("◷", "Espera média", fmtWait(avgWait), "Nas unidades abertas", avgWait > 30 ? "warn" : "good") +
      kpi("%", "Ocupação da rede", `${cap ? Math.round((waiting / cap) * 100) : 0}%`, "Fila sobre capacidade/h") +
      kpi("△", "Unidades em alta", high.length, high.length ? high.map((u) => esc(u.name)).join(", ") : "Nenhuma", high.length ? "warn" : "good");
    // padrões
    const m = matrix(id);
    let best = { v: -1, w: 1, i: 0 };
    m.forEach((row, w) => row.forEach((v, i) => v > best.v && (best = { v, w, i })));
    const wt = m.map((row) => row.reduce((a, b) => a + b, 0));
    const order = WEEK.slice().sort((a, b) => wt[b] - wt[a]);
    const hourSum = Array.from({ length: SHData.SLOTS }, (_, i) => m.reduce((a, row) => a + row[i], 0));
    let calm = 2;
    for (let i = 2; i <= 11; i++) if (hourSum[i] < hourSum[calm]) calm = i;
    const lead = [...active].sort((a, b) => SH.ratio(b) - SH.ratio(a))[0];
    const pat = (icon, t) => `<div class="pattern"><span>${icon}</span><p>${t}</p></div>`;
    $("#anPatterns").innerHTML = best.v > 0
      ? pat("▲", `Pico da semana: <b>${DAY[best.w]}, às ${FIRST + best.i}h</b>, com média de ${Math.round(best.v)} atendimentos por hora.`) +
        pat("◔", `Dia mais movimentado: <b>${DAY[order[0]]}</b>. Dia mais calmo: <b>${DAY[order[order.length - 1]]}</b>.`) +
        pat("▽", `Menor procura no horário comercial: <b>${FIRST + calm}h</b>. Boa janela para orientar a população a ir nesse horário.`) +
        (lead && id === "all" ? pat("⌂", `Maior ocupação agora: <b>${esc(lead.name)}</b>, com ${pct(lead)}% da capacidade.`) : "")
      : '<div class="empty-state">Sem histórico para esta unidade.</div>';
    // mapa
    const mapUnits = id === "all" ? st.units : st.units.filter((u) => u.id === id);
    const selId = SH._anSel && mapUnits.some((u) => u.id === SH._anSel) ? SH._anSel : (mapUnits[0] || {}).id;
    const su = mapUnits.find((u) => u.id === selId);
    $("#anMap").innerHTML = su ? `<div class="map-wrap">${SH.mapSVG(mapUnits, { selected: selId, w: 600, h: 360 })}${SH.mapLegend()}${SH.mapCard({ u: su, wait: SH.waitMin(su), dist: null })}</div>` : '<div class="empty-state">Sem unidades.</div>';
    // histórico
    const hist = dateKeys(id).slice(-28);
    $("#anHistory").innerHTML = hist.length ? bars(hist.map(([d, v]) => ({ label: dm(d), v, title: `${dm(d)} · ${v} atendimentos` })), { h: 190, labelEvery: hist.length > 16 ? 3 : 1, showVals: hist.length <= 16 }) + `<p class="hint">${hist.length} dias no histórico · ${hist.reduce((a, [, v]) => a + v, 0).toLocaleString("pt-BR")} atendimentos</p>` : '<div class="empty-state">Sem histórico.</div>';
    // comparação
    const rows = [...active].sort((a, b) => SH.ratio(b) - SH.ratio(a));
    $("#anCompare").innerHTML = rows.length ? rows.map((u) => `<div class="hbar"><span>${esc(u.name)}</span><div class="bar-track"><span class="bar-fill ${SH.LV[SH.lvl(u)].cls}" style="width:${Math.min(100, pct(u))}%"></span></div><b>${pct(u)}%</b></div>`).join("") + SH.mapLegend() : '<div class="empty-state">Sem unidades abertas.</div>';
    // horários de pico (dia x hora)
    const mx = Math.max(...m.flat(), 1);
    const tops = m.flatMap((row, w) => row.map((v, i) => [v, w, i])).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => `${x[1]}-${x[2]}`);
    $("#anHeat").innerHTML = `<div class="heat" style="--cols:${SHData.SLOTS}"><span></span>${Array.from({ length: SHData.SLOTS }, (_, i) => `<span class="hh">${i % 2 === 0 ? FIRST + i : ""}</span>`).join("")}${WEEK.map((w) => `<span class="dd">${DAYS[w]}</span>` + m[w].map((v, i) => `<span class="cell${tops.includes(`${w}-${i}`) ? " top" : ""}" style="background:hsl(197 62% 38% / ${(0.07 + 0.93 * (v / mx)).toFixed(2)})" title="${DAYS[w]} ${FIRST + i}h · média ${Math.round(v)}"></span>`).join("")).join("")}</div><div class="chart-legend"><span>Menos</span><i class="ramp"></i><span>Mais atendimentos</span><span class="hint">Horas de 6h a 21h · contorno = 3 maiores picos</span></div>`;
    // indicadores por unidade
    $("#anTable").innerHTML = `<table><thead><tr><th>Unidade</th><th>Lotação</th><th>Fila</th><th>Espera</th><th>Cap./h</th><th>Atend. hoje</th><th>Pico histórico</th><th>Alertas</th></tr></thead><tbody>${st.units.map((u) => {
      const a = avgSeries(u.id);
      const pk = a.indexOf(Math.max(...a));
      return `<tr><td><strong>${esc(u.name)}</strong></td><td>${SH.lvlBadge(u)}</td><td>${u.waiting}</td><td>${u.status === "closed" ? "–" : fmtWait(SH.waitMin(u))}</td><td>${u.capacity}</td><td>${u.finishedToday}</td><td>${Math.max(...a) > 0 ? FIRST + pk + "h" : "–"}</td><td>${st.alerts.filter((x) => x.unitId === u.id).length}</td></tr>`;
    }).join("")}</tbody></table>`;
  }
  function deliver(name, text, mime) {
    if (window.SH_ARTIFACT) {
      SH.openModal(`<h2>${esc(name)}</h2><p class="modal-subtitle">Este ambiente não baixa arquivos. Copie o conteúdo e cole em uma planilha ou no Bloco de Notas.</p><div class="form-grid"><div class="form-field full"><textarea id="dlText" rows="10" readonly style="width:100%;font:12px ui-monospace,monospace;border:1px solid var(--line);border-radius:5px;padding:8px;background:var(--surface);color:var(--text)"></textarea></div></div><div class="modal-actions"><button class="button secondary" data-modal-cancel>Fechar</button><button class="button primary" id="dlCopy">Copiar</button></div>`);
      $("#dlText").value = text;
      $("#dlCopy").addEventListener("click", () => {
        $("#dlText").select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e) {}
        SH.toast(ok ? "Conteúdo copiado." : "Selecione o texto e copie com Ctrl+C.");
      });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }
  function exportCsv() {
    const st = S();
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const out = ["Smart Health - relatório de demanda (dados de demonstração)", "", "Indicadores por unidade", "unidade;tipo;lotação;fila;espera (min);capacidade/h;atendimentos hoje;alertas"];
    st.units.forEach((u) => out.push([q(u.name), SH.typeLabels[u.type], SH.LV[SH.lvl(u)].label, u.waiting, SH.waitMin(u), u.capacity, u.finishedToday, st.alerts.filter((a) => a.unitId === u.id).length].join(";")));
    out.push("", "Histórico diário de atendimentos", "data;" + st.units.map((u) => q(u.name)).join(";") + ";total");
    dateKeys("all").forEach(([d]) => {
      const vals = st.units.map((u) => (st.demand[u.id]?.[d] || []).reduce((a, b) => a + b, 0));
      out.push([d, ...vals, vals.reduce((a, b) => a + b, 0)].join(";"));
    });
    deliver(`smart-health-relatorio-${SHData.dayKey(new Date())}.csv`, out.join("\r\n"), "text/csv;charset=utf-8");
    SH.toast("Relatório exportado em CSV.");
  }

  /* ---------- avisos por WhatsApp ou SMS (RF06) ---------- */
  const KINDS = {
    "Ausência de médico": (n) => `Hoje a ${n} está sem médico para atendimento. Veja outra unidade no Smart Health.`,
    "Mudança no atendimento": (n) => `${n}: o atendimento de hoje mudou. Confira os horários no Smart Health.`,
    "Campanha de vacinação": (n) => `Campanha de vacinação na ${n}, das 8h às 16h. Leve o cartão de vacinação.`,
    Informativo: () => "",
  };
  const ALL_KINDS = {
    "Ausência de médico": "Algumas unidades estão sem médico hoje. Veja onde há atendimento no Smart Health.",
    "Mudança no atendimento": "O atendimento de algumas unidades mudou hoje. Confira no Smart Health.",
    "Campanha de vacinação": "Campanha de vacinação nas unidades da rede, das 8h às 16h. Leve o cartão de vacinação.",
  };
  let composerSig = "";
  let lastTpl = "";
  const recipientsFor = (unitId) => S().subscribers.filter((s) => unitId === "all" || s.unitIds.includes("all") || s.unitIds.includes(unitId)).length;
  function renderNotices() {
    const st = S();
    const fixed = sess.role === "unidade" ? unitOf() : null;
    const sig = `${sess.role}|${sess.unitId}|${st.units.length}`;
    if (sig !== composerSig && sess.role) {
      composerSig = sig;
      $("#noticeComposer").innerHTML = `<form class="panel pad" id="noticeForm"><h2>Novo aviso</h2>${fixed ? `<div class="field"><span>Unidade</span><b class="fixed">${esc(fixed.name)}</b></div>` : `<label class="field"><span>Unidade</span><select id="nUnit"><option value="all">Toda a rede</option>${st.units.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("")}</select></label>`}<label class="field"><span>Tipo de aviso</span><select id="nKind">${Object.keys(KINDS).map((k) => `<option>${k}</option>`).join("")}</select></label><div class="field"><span>Canal</span><div class="seg" id="nChannel" role="group"><button type="button" data-ch="WhatsApp" class="active">WhatsApp</button><button type="button" data-ch="SMS">SMS</button></div></div><label class="field"><span>Mensagem</span><textarea id="nText" rows="4" maxlength="240" required></textarea></label><div class="preview" id="nPreview"></div><button class="button primary btn-md">Enviar aviso</button><p class="hint" id="nHint"></p></form>`;
      lastTpl = "";
      fillTemplate();
    }
    $("#noticeLog").innerHTML = st.notices.length
      ? st.notices.map((n) => `<article class="bubble ${n.channel === "SMS" ? "sms" : "wa"}"><div class="bubble-head"><b>${n.channel}</b><span>${esc(n.unitName)} · ${esc(n.kind)}</span><time>${SH.formatDate(n.time)}</time></div><p>${esc(n.text)}</p><small>Enviado para ${n.recipients} ${n.recipients === 1 ? "inscrito" : "inscritos"} (entrega simulada)</small></article>`).join("")
      : '<div class="empty-state">Nenhum aviso enviado.</div>';
    updatePreview();
  }
  function noticeUnit() {
    const st = S();
    if (sess.role === "unidade") {
      const u = unitOf();
      return { id: u.id, name: u.name };
    }
    const id = ($("#nUnit") || {}).value || "all";
    return id === "all" ? { id: "all", name: "Toda a rede" } : { id, name: (st.units.find((u) => u.id === id) || {}).name || "" };
  }
  function fillTemplate() {
    if (!$("#nText")) return;
    const un = noticeUnit();
    const kind = $("#nKind").value;
    const tpl = un.id === "all" && kind !== "Informativo" ? ALL_KINDS[kind] : KINDS[kind](un.name);
    if (!$("#nText").value || $("#nText").value === lastTpl) $("#nText").value = tpl;
    lastTpl = tpl;
    updatePreview();
  }
  function updatePreview() {
    if (!$("#nPreview")) return;
    const ch = ($("#nChannel .active") || {}).dataset?.ch || "WhatsApp";
    const un = noticeUnit();
    $("#nPreview").className = `preview bubble ${ch === "SMS" ? "sms" : "wa"}`;
    $("#nPreview").innerHTML = `<div class="bubble-head"><b>${ch}</b><span>${esc(un.name)}</span></div><p>${esc($("#nText").value || "Digite a mensagem para ver a prévia.")}</p>`;
    $("#nHint").textContent = `Chega para ${recipientsFor(un.id)} ${recipientsFor(un.id) === 1 ? "inscrito" : "inscritos"} (simulado).`;
  }

  /* ---------- importar histórico (RF10) ---------- */
  const imp = { name: "", rows: [], errors: [], ask: false, done: null };
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function parseCsv(text, name) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    const rows = [], errors = [];
    const st = S();
    lines.forEach((line, n) => {
      const c = line.split(/[;,]/).map((x) => x.trim().replace(/^"|"$/g, ""));
      if (n === 0 && /data/i.test(c[0])) return;
      const [d, un, h, v] = c;
      let date = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) date = d;
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) date = `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
      const unit = st.units.find((u) => norm(u.name) === norm(un || ""));
      const hour = Number(h), val = Number(v);
      const why = !date ? "data inválida" : !unit ? "unidade não cadastrada" : !(Number.isInteger(hour) && hour >= FIRST && hour < FIRST + SHData.SLOTS) ? "hora fora de 6h–21h" : !(Number.isInteger(val) && val >= 0) ? "quantidade inválida" : "";
      if (why) errors.push({ line: n + 1, text: line, why });
      else rows.push({ date, unitId: unit.id, unitName: unit.name, hour, value: val });
    });
    Object.assign(imp, { name, rows, errors, ask: false, done: null });
    renderImport();
  }
  function sampleCsv() {
    const st = S();
    const out = ["data;unidade;hora;atendimentos"];
    for (let k = 16; k <= 18; k++) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - k);
      st.units.forEach((u) => {
        const arr = SHData.genDay(u, d, "legado");
        arr.forEach((v, i) => v > 0 && out.push(`${SHData.dayKey(d)};${u.name};${FIRST + i};${v}`));
      });
    }
    out.push(`${SHData.dayKey(new Date())};UBS Santo Antônio;9;12`);
    return out.join("\n");
  }
  function runImport() {
    const st = S();
    imp.rows.forEach((r) => {
      st.demand[r.unitId] ||= {};
      st.demand[r.unitId][r.date] ||= Array(SHData.SLOTS).fill(0);
      st.demand[r.unitId][r.date][r.hour - FIRST] = r.value;
    });
    const days = new Set(imp.rows.map((r) => r.date)).size;
    st.imports.unshift({ id: SH.uid(), time: SH.now(), file: imp.name, ok: imp.rows.length, bad: imp.errors.length, days });
    SH.addHistory("Histórico importado", `${imp.rows.length} registros de ${imp.name} (${days} dias) entraram na base.`);
    imp.done = { ok: imp.rows.length, bad: imp.errors.length, days };
    imp.rows = [];
    imp.errors = [];
    imp.ask = false;
    SH.save();
    SH.renderAll();
    SH.toast("Importação concluída.");
  }
  function renderImport() {
    const box = $("#importBox");
    if (!box) return;
    const st = S();
    const hour = new Date().getHours();
    const business = hour >= 8 && hour < 18;
    const ready = imp.rows.length > 0;
    box.innerHTML = `<div class="steps3">
      <section class="panel pad step"><span class="n">1</span><h2>Escolher o arquivo</h2><p class="muted">CSV com as colunas <code>data;unidade;hora;atendimentos</code>.</p><div class="btn-row"><label class="button secondary btn-md file-btn">Escolher arquivo<input type="file" id="impFile" accept=".csv,text/csv" hidden></label><button class="button secondary btn-md" id="impSample">Usar arquivo de exemplo</button><button class="text-button" id="impModel">Baixar modelo</button></div>${imp.name ? `<p class="hint">Arquivo: <b>${esc(imp.name)}</b></p>` : ""}</section>
      <section class="panel pad step"><span class="n">2</span><h2>Conferir</h2>${imp.name ? `<div class="chk"><span class="ok-pill">${imp.done ? imp.done.ok : imp.rows.length} linhas válidas</span><span class="${(imp.done ? imp.done.bad : imp.errors.length) ? "bad-pill" : "ok-pill"}">${imp.done ? imp.done.bad : imp.errors.length} com erro</span></div>${imp.rows.length ? `<table class="mini"><thead><tr><th>Data</th><th>Unidade</th><th>Hora</th><th>Atend.</th></tr></thead><tbody>${imp.rows.slice(0, 5).map((r) => `<tr><td>${r.date.split("-").reverse().join("/")}</td><td>${esc(r.unitName)}</td><td>${r.hour}h</td><td>${r.value}</td></tr>`).join("")}</tbody></table>` : ""}${imp.errors.slice(0, 3).map((e) => `<p class="err-line">Linha ${e.line}: ${esc(e.why)} (${esc(e.text.slice(0, 40))})</p>`).join("")}` : '<p class="muted">Escolha um arquivo para ver a conferência.</p>'}</section>
      <section class="panel pad step"><span class="n">3</span><h2>Importar</h2><p class="muted">O ideal é rodar fora do horário comercial, de madrugada, para não sobrecarregar os servidores da prefeitura.</p>${business && ready && imp.ask ? '<div class="info-banner warn-banner"><span class="info-symbol">!</span><div><strong>Agora é horário comercial</strong><p>Quer importar mesmo assim?</p></div></div>' : ""}<div class="btn-row"><button class="button primary btn-md" id="impRun" ${ready ? "" : "disabled"}>${imp.ask ? "Importar mesmo assim" : "Importar agora"}</button></div>${imp.done ? `<p class="ok-line">✓ ${imp.done.ok} registros importados (${imp.done.days} dias). ${imp.done.bad ? imp.done.bad + " linhas ignoradas." : ""}</p>` : ""}</section></div>
      <section class="panel mt"><div class="panel-header"><div><h2>Importações anteriores</h2><p>Registro das cargas feitas na base</p></div></div><div class="pad-body">${st.imports.length ? st.imports.map((i) => `<div class="imp-row"><b>${esc(i.file)}</b><span>${i.ok} registros · ${i.days} dias${i.bad ? ` · ${i.bad} ignorados` : ""}</span><time>${SH.formatDate(i.time)}</time></div>`).join("") : '<div class="empty-state">Nenhuma importação feita ainda.</div>'}</div></section>`;
  }

  /* ---------- eventos ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.closest("#openLogin")) return openLogin();
    if (e.target.closest("#logoutButton")) return logout();
    const mk = e.target.closest("#anMap [data-map-id]");
    if (mk) {
      SH._anSel = mk.dataset.mapId;
      return renderAnalytics();
    }
    if (e.target.closest("#exportCsv")) return exportCsv();
    if (e.target.closest("#uArrive"))
      return SH.openModal(`<h2>Registrar chegada</h2><p class="modal-subtitle">A pessoa entra na fila e recebe um código para a família acompanhar.</p><form id="arriveForm"><div class="form-grid"><div class="form-field full"><label for="arName">Nome do paciente (opcional)</label><input id="arName" placeholder="Ex.: Maria" autocomplete="off"></div></div><div class="modal-actions"><button type="button" class="button secondary" data-modal-cancel>Cancelar</button><button class="button primary">Registrar chegada</button></div></form>`) || setTimeout(() => $("#arName")?.focus(), 30);
    if (e.target.closest("#uNext")) return callNext();
    if (e.target.closest("#uFinish")) return finishOne();
    const cnt = e.target.closest("[data-count]");
    if (cnt) {
      const u = unitOf(), key = cnt.dataset.count, d = Number(cnt.dataset.d);
      const min = key === "capacity" ? 1 : 0;
      const next = Math.max(min, u[key] + d);
      if (next === u[key]) return;
      u[key] = next;
      const label = { waiting: "fila", inService: "atendimentos em andamento", professionals: "profissionais", capacity: "capacidade por hora" }[key];
      return afterUnitChange(u, "Dados da unidade atualizados", `${label} agora é ${next}.`);
    }
    const pt = e.target.closest("[data-pt]");
    if (pt) {
      const p = S().patients.find((x) => x.id === pt.dataset.pt);
      if (p) movePatient(p, pt.dataset.to);
      return;
    }
    const ch = e.target.closest("#nChannel [data-ch]");
    if (ch) {
      $$("#nChannel button").forEach((x) => x.classList.toggle("active", x === ch));
      return updatePreview();
    }
    if (e.target.closest("#impSample")) return parseCsv(sampleCsv(), "historico-exemplo.csv");
    if (e.target.closest("#impModel")) return deliver("modelo-importacao.csv", "data;unidade;hora;atendimentos\r\n2026-01-05;UBS Centro;8;12\r\n", "text/csv");
    if (e.target.closest("#impRun")) {
      const hour = new Date().getHours();
      if (hour >= 8 && hour < 18 && !imp.ask) {
        imp.ask = true;
        return renderImport();
      }
      return runImport();
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "arriveForm") {
      e.preventDefault();
      const name = $("#arName").value.trim();
      SH.closeModal();
      arrive(name);
    }
    if (e.target.id === "noticeForm") {
      e.preventDefault();
      const st = S(), un = noticeUnit();
      const n = { id: SH.uid(), time: SH.now(), unitId: un.id, unitName: un.name, kind: $("#nKind").value, channel: $("#nChannel .active").dataset.ch, text: $("#nText").value.trim(), recipients: recipientsFor(un.id) };
      if (!n.text) return SH.toast("Escreva a mensagem do aviso.");
      st.notices.unshift(n);
      st.notices = st.notices.slice(0, 30);
      SH.addHistory("Aviso enviado", `${n.kind} · ${n.unitName} · ${n.channel} · ${n.recipients} inscritos.`);
      SH.save();
      lastTpl = "";
      $("#nText").value = "";
      fillTemplate();
      SH.renderAll();
      SH.toast(`Aviso enviado por ${n.channel} para ${n.recipients} inscritos (simulado).`);
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "unitOpen") {
      const u = unitOf();
      u.status = t.checked ? (SH.ratio(u) > 0.75 ? "attention" : "open") : "closed";
      return afterUnitChange(u, "Status atualizado", `agora está ${t.checked ? "aberta" : "fechada"}.`);
    }
    if (t.id === "anUnit") return renderAnalytics();
    if (t.id === "nKind" || t.id === "nUnit") return fillTemplate();
    if (t.id === "overloadSelect") {
      S().settings.overload = Number(t.value);
      SH.addHistory("Limite de alerta alterado", `Alertas de sobrecarga agora a partir de ${Math.round(S().settings.overload * 100)}% da capacidade.`);
      SH.save();
      return SH.renderAll();
    }
    if (t.id === "impFile" && t.files[0]) {
      const f = t.files[0];
      const r = new FileReader();
      r.onload = () => parseCsv(String(r.result), f.name);
      r.readAsText(f);
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "nText") updatePreview();
  });

  function renderRestricted() {
    const sel = $("#overloadSelect");
    if (sel) sel.value = String(S().settings.overload);
    if (!sess.role) return;
    renderUnitPanel();
    renderAlerts();
    renderAnalytics();
    renderNotices();
    renderImport();
  }
  SH.hooks.push(renderRestricted);
  SH.logout = logout;
  try {
    const saved = JSON.parse(sessionStorage.getItem("sh-sess") || "null");
    if (saved && saved.role) enter(saved.role, saved.unitId, true);
  } catch (e) {}
  renderRestricted();
})();
