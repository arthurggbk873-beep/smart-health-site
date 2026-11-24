/* Smart Health - área do cidadão (sem login).
   RF01 consulta de fila e espera, RF02 recomendação, RF03 busca com filtros,
   RF04 mapa da rede, RF05 acompanhamento de familiar, RF06 avisos. */
(() => {
  const SH = window.SH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = SH.escapeHtml;
  const S = () => SH.state;

  const NEEDS = [
    { id: "", label: "Qualquer atendimento" },
    { id: "geral", label: "Consulta médica", match: ["Clínica geral", "Saúde da família", "Pronto atendimento"] },
    { id: "urgencia", label: "Urgência ou emergência", urgent: true },
    { id: "vacina", label: "Vacinação", match: ["Vacinação"] },
    { id: "pediatria", label: "Pediatria", match: ["Pediatria"] },
    { id: "odonto", label: "Odontologia", match: ["Odontologia"] },
    { id: "gineco", label: "Ginecologia", match: ["Ginecologia"] },
    { id: "enfermagem", label: "Enfermagem e curativos", match: ["Enfermagem", "Curativos"] },
    { id: "exames", label: "Exames e raio-X", match: ["Exames", "Raio-X"] },
  ];
  const ORIGINS = {
    centro: { name: "Centro", lat: -20.754, lng: -42.88 },
    bomjesus: { name: "Bom Jesus", lat: -20.76, lng: -42.886 },
    fatima: { name: "Fátima", lat: -20.749, lng: -42.876 },
    silvestre: { name: "Silvestre", lat: -20.769, lng: -42.8905 },
    norte: { name: "Zona Norte", lat: -20.744, lng: -42.8715 },
  };
  const STEPS = [
    ["registered", "Registrado"],
    ["queue", "Na fila"],
    ["inService", "Em atendimento"],
    ["done", "Finalizado"],
  ];
  const ui = { need: "", origin: "centro", type: "all", sort: "best", mode: "list", urgent: false, compare: [], selected: null, updatedAt: Date.now() };

  const isUrgent = (u) => u.type === "upa" || u.type === "hospital" || u.services.some((x) => /urg[eê]ncia|pronto atendimento/i.test(x));
  function matches(u, need, urgentOnly) {
    const n = NEEDS.find((x) => x.id === need) || NEEDS[0];
    if ((n.urgent || urgentOnly) && !isUrgent(u)) return false;
    if (n.match && !u.services.some((sv) => n.match.some((m) => sv.toLowerCase().includes(m.toLowerCase())))) return false;
    return true;
  }
  const rad = (d) => (d * Math.PI) / 180;
  function km(a, b, c, d) {
    const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  const fmtKm = (d) => `${d.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  const fmtWait = (m) => (m === 0 ? "Sem espera" : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`);
  const fmtTime = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const origin = () => ORIGINS[ui.origin] || ORIGINS.centro;
  const routeUrl = (u) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${u.address}, Viçosa, MG`)}`;

  function info(u) {
    const o = origin();
    const dist = km(o.lat, o.lng, u.lat, u.lng);
    const travel = Math.max(2, Math.round(dist * 4));
    const wait = SH.waitMin(u);
    return { u, dist, travel, wait, total: wait + travel, closed: u.status === "closed" };
  }
  function rank(need, urgentOnly, sort = "best") {
    const by = {
      best: (a, b) => a.total - b.total || a.dist - b.dist,
      wait: (a, b) => a.wait - b.wait || a.dist - b.dist,
      dist: (a, b) => a.dist - b.dist,
      queue: (a, b) => a.u.waiting - b.u.waiting || a.dist - b.dist,
    }[sort];
    return S()
      .units.filter((u) => matches(u, need, urgentOnly))
      .map(info)
      .sort((a, b) => (a.closed - b.closed) || by(a, b));
  }

  /* ---------- mapa esquemático (também usado pela gestão) ---------- */
  function mapSVG(units, { selected = null, user = null, w = 760, h = 430 } = {}) {
    const pts = units.map((u) => [u.lng, u.lat]).concat(user ? [[user.lng, user.lat]] : []);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const px = 90, py = 70;
    const sx = (v) => px + (maxX === minX ? 0.5 : (v - minX) / (maxX - minX)) * (w - 2 * px);
    const sy = (v) => py + (maxY === minY ? 0.5 : (maxY - v) / (maxY - minY)) * (h - 2 * py);
    const decor = `<rect class="map-bg" width="${w}" height="${h}" rx="12"/>
      <path class="map-river" d="M-10 ${h * 0.8} C ${w * 0.25} ${h * 0.55}, ${w * 0.45} ${h * 0.98}, ${w * 0.7} ${h * 0.72} S ${w * 0.95} ${h * 0.5}, ${w + 10} ${h * 0.6}"/>
      <g class="map-roads"><path d="M0 ${h * 0.35} L ${w} ${h * 0.2}"/><path d="M${w * 0.3} 0 L ${w * 0.45} ${h}"/><path d="M${w * 0.72} 0 L ${w * 0.62} ${h}"/><path d="M0 ${h * 0.62} L ${w} ${h * 0.5}"/><path class="thin" d="M0 ${h * 0.12} L ${w} ${h * 0.1}"/><path class="thin" d="M${w * 0.12} 0 L ${w * 0.1} ${h}"/><path class="thin" d="M${w * 0.9} 0 L ${w * 0.85} ${h}"/><path class="thin" d="M0 ${h * 0.9} L ${w} ${h * 0.88}"/></g>`;
    const marks = units
      .map((u) => {
        const lv = SH.LV[SH.lvl(u)];
        const r = u.status === "closed" ? 15 : 17 + Math.min(u.waiting, 40) * 0.22;
        const x = sx(u.lng), y = sy(u.lat);
        return `<g class="map-marker lv-${lv.cls}${selected === u.id ? " sel" : ""}" data-map-id="${esc(u.id)}" tabindex="0" role="button" aria-label="${esc(u.name)}, lotação ${lv.label}, ${u.waiting} na fila" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle class="halo" r="${(r + 7).toFixed(1)}"/><circle class="dot" r="${r.toFixed(1)}"/><text class="num" y="5">${u.status === "closed" ? "–" : u.waiting}</text><text class="lbl" y="${(r + 20).toFixed(1)}">${esc(u.name)}</text></g>`;
      })
      .join("");
    const you = user
      ? `<g class="map-user" transform="translate(${sx(user.lng).toFixed(1)} ${sy(user.lat).toFixed(1)})"><circle r="9"/><circle class="in" r="3.5"/><text x="13" y="-11">Você</text></g>`
      : "";
    return `<svg class="map-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mapa esquemático da rede de saúde com a lotação de cada unidade">${decor}${marks}${you}</svg>`;
  }
  const mapLegend = () =>
    `<div class="map-legend">${["baixa", "moderada", "alta", "lotada", "indisponivel"].map((k) => `<span><i class="lg lv-${SH.LV[k].cls}"></i>${SH.LV[k].label}</span>`).join("")}</div>`;
  function mapCard(i, extra = "") {
    const u = i.u;
    return `<div class="map-card"><div><strong>${esc(u.name)}</strong><span class="muted">${SH.typeLabels[u.type]} · ${u.waiting} na fila · espera ${fmtWait(i.wait)}${i.dist != null ? ` · ${fmtKm(i.dist)}` : ""}</span></div><div class="map-card-actions">${SH.lvlBadge(u)}${extra}<button class="small-button" data-action="view" data-id="${esc(u.id)}">Ver detalhes</button></div></div>`;
  }
  SH.mapSVG = mapSVG;
  SH.mapLegend = mapLegend;
  SH.mapCard = mapCard;

  /* ---------- seletores ---------- */
  function fillSelects() {
    const opts = NEEDS.map((n) => `<option value="${n.id}">${n.label}</option>`).join("");
    $("#needSelect").innerHTML = opts;
    $("#listNeed").innerHTML = opts;
    $("#originSelect").innerHTML =
      Object.entries(ORIGINS).map(([k, o]) => `<option value="${k}">${o.name}</option>`).join("") +
      '<option value="gps" hidden>Minha localização</option>';
    $("#needSelect").value = ui.need;
    $("#listNeed").value = ui.need;
    $("#originSelect").value = ui.origin;
  }

  /* ---------- início: busca e recomendação (RF01, RF02, RF03) ---------- */
  function renderHome() {
    const st = S();
    const active = st.units.filter((u) => u.status !== "closed");
    const queue = st.units.reduce((a, u) => a + Number(u.waiting), 0);
    const avg = Math.round(active.reduce((a, u) => a + SH.waitMin(u), 0) / (active.length || 1));
    $("#homeStats").innerHTML = `<div><strong>${active.length}/${st.units.length}</strong><small>unidades atendendo</small></div><div><strong>${queue}</strong><small>pessoas na fila</small></div><div><strong>${fmtWait(avg)}</strong><small>espera média</small></div><p class="hint">Atualizado às ${fmtTime(ui.updatedAt)} · a rede atualiza a cada 5 minutos</p>`;
    const list = rank(ui.need, false, "best").filter((i) => !i.closed);
    const need = NEEDS.find((n) => n.id === ui.need);
    if (!list.length) {
      $("#homeResult").innerHTML = `<div class="rec-card empty"><h2>Nenhuma unidade disponível</h2><p class="muted">Não encontramos unidade atendendo ${need && need.id ? `“${esc(need.label)}”` : "agora"}. Tente outro tipo de atendimento ou ligue 192 em caso de emergência.</p></div>`;
      return;
    }
    const best = list[0], u = best.u;
    const others = list.slice(1, 4);
    $("#homeResult").innerHTML = `<article class="rec-card">
        <span class="rec-tag">★ Recomendado agora</span>
        <h2>${esc(u.name)}</h2>
        <p class="muted">${SH.typeLabels[u.type]} · ${esc(u.address)}</p>
        <div class="rec-metrics"><div><strong>${fmtWait(best.wait)}</strong><small>de espera</small></div><div><strong>${fmtKm(best.dist)}</strong><small>de distância</small></div><div><strong>${u.waiting}</strong><small>na fila</small></div></div>
        <div class="rec-row">${SH.lvlBadge(u)}<span class="muted">Lotação ${SH.LV[SH.lvl(u)].label.toLowerCase()}</span></div>
        <p class="rec-why"><b>Por que esta?</b> Menor tempo total até o atendimento: ${fmtWait(best.wait)} de espera + ${best.travel} min de deslocamento, a partir de ${esc(origin().name)}.</p>
        <div class="rec-actions"><a class="button primary btn-lg" href="${routeUrl(u)}" target="_blank" rel="noopener">Como chegar</a><button class="button secondary btn-lg" data-detail="${esc(u.id)}">Ver detalhes</button></div>
      </article>
      ${others.length ? `<div class="alt-list"><h3>Outras boas opções</h3>${others.map((i) => `<div class="alt-row"><div><strong>${esc(i.u.name)}</strong><span class="muted">${fmtWait(i.wait)} de espera · ${fmtKm(i.dist)}</span></div>${SH.lvlBadge(i.u)}<button class="small-button" data-detail="${esc(i.u.id)}">Detalhes</button></div>`).join("")}<button class="text-button" data-pview="list">Ver todas as unidades →</button></div>` : ""}
      ${ui.need === "urgencia" ? '<p class="urgent-note">Em risco de vida, ligue 192. Não espere pela recomendação.</p>' : ""}`;
  }

  /* ---------- lista e mapa (RF03, RF04) ---------- */
  function renderList() {
    const infos = rank(ui.need, ui.urgent, ui.sort).filter((i) => ui.type === "all" || i.u.type === ui.type);
    $("#listTitle").textContent = ui.mode === "map" ? "Mapa da rede" : "Unidades de saúde";
    $("#listSub").textContent =
      ui.mode === "map"
        ? `Mapa esquemático da rede. Atualizado às ${fmtTime(ui.updatedAt)}, a cada 5 minutos.`
        : `${infos.length} ${infos.length === 1 ? "unidade encontrada" : "unidades encontradas"}. Compare filas, espera e lotação.`;
    $$(".seg [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === ui.mode));
    $$(".pub-nav [data-pview='list']").forEach((b) => b.classList.toggle("active", ui.view === "list" && b.dataset.mode === ui.mode));
    if (!infos.length) {
      $("#listBody").innerHTML = '<div class="empty-state"><strong>Nenhuma unidade encontrada</strong><span>Tente outro filtro.</span></div>';
      return renderCompareBar();
    }
    if (ui.mode === "map") {
      const sel = infos.find((i) => i.u.id === ui.selected) || infos.find((i) => !i.closed) || infos[0];
      ui.selected = sel.u.id;
      $("#listBody").innerHTML = `<div class="map-wrap">${mapSVG(infos.map((i) => i.u), { selected: sel.u.id, user: origin() })}${mapLegend()}${mapCard(sel, `<a class="small-button" href="${routeUrl(sel.u)}" target="_blank" rel="noopener">Como chegar</a>`)}</div>`;
    } else {
      $("#listBody").innerHTML = `<div class="pgrid">${infos
        .map((i) => {
          const u = i.u;
          return `<article class="pcard${i.closed ? " is-off" : ""}"><div class="pcard-head"><div><h3>${esc(u.name)}</h3><span class="tag">${SH.typeLabels[u.type]}${isUrgent(u) ? " · urgência" : ""}</span></div>${SH.lvlBadge(u)}</div><p class="muted">${esc(u.address)}</p><div class="pcard-metrics"><div><strong>${u.waiting}</strong><small>na fila</small></div><div><strong>${i.closed ? "–" : fmtWait(i.wait)}</strong><small>espera</small></div><div><strong>${fmtKm(i.dist)}</strong><small>de ${esc(origin().name)}</small></div></div><div class="tags">${u.services.map((x) => `<span class="service-tag">${esc(x)}</span>`).join("")}</div><div class="pcard-actions"><label class="check"><input type="checkbox" data-compare="${esc(u.id)}" ${ui.compare.includes(u.id) ? "checked" : ""}/> Comparar</label><span><a class="small-button" href="${routeUrl(u)}" target="_blank" rel="noopener">Rota</a> <button class="small-button" data-detail="${esc(u.id)}">Detalhes</button></span></div></article>`;
        })
        .join("")}</div>`;
    }
    renderCompareBar();
  }
  function renderCompareBar() {
    const bar = $("#compareBar");
    const n = ui.compare.length;
    bar.hidden = !(n > 0 && ui.view === "list" && ui.mode === "list");
    bar.innerHTML = `<span><b>${n}</b> ${n === 1 ? "selecionada" : "selecionadas"}${n < 2 ? " · escolha mais uma" : ""}</span><button class="button primary" data-do-compare ${n < 2 ? "disabled" : ""}>Comparar</button><button class="text-button" data-clear-compare>Limpar</button>`;
  }

  /* ---------- detalhes e comparação ---------- */
  function openDetail(id) {
    const u = S().units.find((x) => x.id === id);
    if (!u) return;
    const i = info(u);
    SH.openModal(`<h2>${esc(u.name)}</h2><p class="modal-subtitle">${SH.typeLabels[u.type]} · lotação ${SH.LV[SH.lvl(u)].label.toLowerCase()}</p><div class="detail-list"><div class="detail-row"><span>Endereço</span><strong>${esc(u.address)}</strong></div><div class="detail-row"><span>Telefone</span><strong>${esc(u.phone || "Não informado")}</strong></div><div class="detail-row"><span>Horário</span><strong>${esc(u.hours)}</strong></div><div class="detail-row"><span>Pessoas na fila</span><strong>${u.waiting}</strong></div><div class="detail-row"><span>Espera estimada</span><strong>${u.status === "closed" ? "Indisponível" : fmtWait(i.wait)}</strong></div><div class="detail-row"><span>Distância</span><strong>${fmtKm(i.dist)} de ${esc(origin().name)}</strong></div><div class="detail-row"><span>Atende urgência</span><strong>${isUrgent(u) ? "Sim" : "Não"}</strong></div><div class="detail-row"><span>Serviços</span><strong>${esc(u.services.join(", "))}</strong></div></div><div class="modal-actions"><button class="button secondary" data-modal-cancel>Fechar</button><a class="button primary" href="${routeUrl(u)}" target="_blank" rel="noopener">Como chegar</a></div>`);
  }
  function openCompare() {
    const a = ui.compare.map((id) => S().units.find((u) => u.id === id)).filter(Boolean).map(info);
    if (a.length < 2) return;
    const best = (f) => {
      const m = Math.min(...a.map(f));
      return a.map((x) => f(x) === m);
    };
    const rows = [
      ["Fila", (x) => x.u.waiting, (x) => `${x.u.waiting}`],
      ["Espera", (x) => x.wait, (x) => (x.closed ? "Indisponível" : fmtWait(x.wait))],
      ["Lotação", (x) => SH.ratio(x.u), (x) => SH.LV[SH.lvl(x.u)].label],
      ["Distância", (x) => x.dist, (x) => fmtKm(x.dist)],
      ["Urgência", null, (x) => (isUrgent(x.u) ? "Sim" : "Não")],
      ["Horário", null, (x) => x.u.hours],
    ];
    const body = rows
      .map(([lab, f, txt]) => {
        const b = f ? best(f) : a.map(() => false);
        return `<tr><th>${lab}</th>${a.map((x, k) => `<td class="${b[k] ? "best" : ""}">${txt(x)}${b[k] ? ' <span class="ok" title="Melhor valor">✓</span>' : ""}</td>`).join("")}</tr>`;
      })
      .join("");
    SH.openModal(`<h2>Comparação</h2><p class="modal-subtitle">Unidades lado a lado, a partir de ${esc(origin().name)}.</p><table class="cmp"><thead><tr><th></th>${a.map((x) => `<th>${esc(x.u.name)}<small>${SH.typeLabels[x.u.type]}</small></th>`).join("")}</tr></thead><tbody>${body}</tbody></table><p class="hint">✓ = melhor valor</p><div class="modal-actions"><button class="button secondary" data-modal-cancel>Fechar</button></div>`);
  }

  /* ---------- acompanhar familiar (RF05) ---------- */
  function renderFamily() {
    const st = S();
    const pts = st.links.map((code) => st.patients.find((p) => p.code === code)).filter(Boolean);
    if (!pts.length) {
      $("#familyList").innerHTML = '<div class="empty-state"><strong>Nenhum paciente vinculado</strong><span>Informe o código do atendimento ao lado.</span></div>';
      return;
    }
    $("#familyList").innerHTML = pts
      .map((p) => {
        const u = st.units.find((x) => x.id === p.unitId);
        const ended = p.status === "referred" || p.status === "left";
        const idx = ended ? 3 : STEPS.findIndex((s) => s[0] === p.status);
        const steps = STEPS.map(([k, label], n) => {
          const lab = n === 3 && ended ? (p.status === "referred" ? "Encaminhado" : "Desistiu") : label;
          const cls = n < idx || (n === idx && p.status === "done") ? "done" : n === idx ? (ended ? "end" : "now") : "";
          return `<li class="${cls}"><span>${n + 1}</span>${lab}</li>`;
        }).join("");
        const last = p.log[p.log.length - 1];
        const arrived = p.log[0];
        const note =
          p.status === "queue"
            ? `Chegou às ${fmtTime(arrived.time)}. Espera estimada da unidade: ${u ? fmtWait(SH.waitMin(u)) : "–"}.`
            : p.status === "inService"
              ? `Em atendimento desde ${fmtTime(last.time)}.`
              : p.status === "done"
                ? `Atendimento finalizado às ${fmtTime(last.time)}.`
                : `${p.status === "referred" ? "Encaminhado para outra unidade" : "Saiu da fila"} às ${fmtTime(last.time)}.`;
        return `<article class="panel pad pt-card"><div class="pt-head"><div><h3>${esc(p.name)}</h3><p class="muted">Código ${esc(p.code)} · ${esc(u ? u.name : "unidade removida")}</p></div><button class="text-button" data-unlink="${esc(p.code)}">Desvincular</button></div><ol class="stepper">${steps}</ol><p class="pt-note">${note}</p></article>`;
      })
      .join("") + '<p class="hint">O status muda sozinho quando a unidade registra a alteração.</p>';
  }

  /* ---------- avisos (RF06) ---------- */
  const meId = () => SH.store.get("sh-me");
  function renderInbox() {
    const st = S();
    const me = st.subscribers.find((s) => s.id === meId());
    const units = st.units;
    if (!$("#subUnits").dataset.ready || $("#subUnits").dataset.n !== String(units.length)) {
      $("#subUnits").innerHTML = `<label class="check"><input type="checkbox" value="all" checked/> Toda a rede</label>` + units.map((u) => `<label class="check"><input type="checkbox" value="${esc(u.id)}"/> ${esc(u.name)}</label>`).join("");
      $("#subUnits").dataset.ready = "1";
      $("#subUnits").dataset.n = String(units.length);
    }
    const mine = me ? st.notices.filter((n) => n.unitId === "all" || me.unitIds.includes("all") || me.unitIds.includes(n.unitId)) : st.notices;
    const head = me
      ? `<p class="subbed">✓ ${esc(me.name)} recebe avisos por ${me.channel}</p>`
      : '<p class="hint">Mostrando os avisos recentes da rede. Inscreva-se para receber no celular.</p>';
    $("#inbox").innerHTML =
      head +
      (mine.length
        ? mine.map((n) => `<article class="bubble ${n.channel === "SMS" ? "sms" : "wa"}"><div class="bubble-head"><b>${n.channel === "SMS" ? "SMS" : "WhatsApp"}</b><span>${esc(n.unitName)} · ${esc(n.kind)}</span><time>${fmtTime(n.time)}</time></div><p>${esc(n.text)}</p></article>`).join("")
        : '<div class="empty-state"><strong>Sem avisos por enquanto</strong><span>Quando uma unidade avisar algo, aparece aqui.</span></div>');
  }

  /* ---------- eventos ---------- */
  function setView(view, mode) {
    ui.view = view;
    if (mode) ui.mode = mode;
    $$(".pview").forEach((v) => v.classList.toggle("active", v.id === `pview-${view}`));
    $$(".pub-nav button").forEach((b) => {
      const on = b.dataset.pview === view && (view !== "list" || b.dataset.mode === ui.mode);
      b.classList.toggle("active", on);
    });
    renderPublic();
    window.scrollTo({ top: 0 });
  }
  function renderPublic() {
    renderHome();
    renderList();
    renderFamily();
    renderInbox();
  }
  document.addEventListener("click", (e) => {
    const pv = e.target.closest("[data-pview]");
    if (pv && pv.closest("#publicShell")) return setView(pv.dataset.pview, pv.dataset.mode);
    const modeBtn = e.target.closest(".seg [data-mode]");
    if (modeBtn && modeBtn.closest("#pview-list")) {
      ui.mode = modeBtn.dataset.mode;
      return setView("list", ui.mode);
    }
    const chip = e.target.closest("#typeChips [data-type]");
    if (chip) {
      ui.type = chip.dataset.type;
      $$("#typeChips button").forEach((b) => b.classList.toggle("active", b === chip));
      return renderList();
    }
    const det = e.target.closest("[data-detail]");
    if (det) return openDetail(det.dataset.detail);
    const mk = e.target.closest("[data-map-id]");
    if (mk && mk.closest("#listBody")) {
      ui.selected = mk.dataset.mapId;
      return renderList();
    }
    if (e.target.closest("[data-do-compare]")) return openCompare();
    if (e.target.closest("[data-clear-compare]")) {
      ui.compare = [];
      return renderList();
    }
    const un = e.target.closest("[data-unlink]");
    if (un) {
      const st = S();
      st.links = st.links.filter((c) => c !== un.dataset.unlink);
      SH.save();
      renderFamily();
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-compare]")) {
      const id = t.dataset.compare;
      ui.compare = t.checked ? [...ui.compare.filter((x) => x !== id), id].slice(-2) : ui.compare.filter((x) => x !== id);
      return renderList();
    }
    if (t.id === "needSelect" || t.id === "listNeed") {
      ui.need = t.value;
      $("#needSelect").value = ui.need;
      $("#listNeed").value = ui.need;
      return renderPublic();
    }
    if (t.id === "originSelect") {
      ui.origin = t.value;
      return renderPublic();
    }
    if (t.id === "listSort") {
      ui.sort = t.value;
      return renderList();
    }
    if (t.id === "listUrgent") {
      ui.urgent = t.checked;
      return renderList();
    }
  });
  $("#useLocation").addEventListener("click", () => {
    const fallback = (msg) => {
      SH.toast(msg);
      ui.origin = ui.origin === "gps" ? "centro" : ui.origin;
      $("#originSelect").value = ui.origin;
      renderPublic();
    };
    if (!navigator.geolocation) return fallback("Seu navegador não informa a localização. Escolha onde você está.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        if (km(lat, lng, -20.7546, -42.8825) > 40) {
          ui.origin = "centro";
          $("#originHint").textContent = "Você está fora de Viçosa. Usando o Centro na demonstração.";
        } else {
          ORIGINS.gps = { name: "Minha localização", lat, lng };
          ui.origin = "gps";
          $("#originHint").textContent = "Usando a localização do seu aparelho.";
        }
        $("#originSelect").value = ui.origin;
        renderPublic();
      },
      () => fallback("Não consegui acessar a localização. Escolha onde você está."),
      { timeout: 6000 },
    );
  });
  $("#pubLarge").addEventListener("click", () => {
    const on = document.documentElement.dataset.size !== "large";
    document.documentElement.dataset.size = on ? "large" : "";
    $("#pubLarge").setAttribute("aria-pressed", String(on));
    SH.store.set("sh-large", on ? "1" : "");
  });
  $("#pubTheme").addEventListener("click", SH.toggleTheme);
  $("#linkForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("#linkCode").value.trim().toUpperCase();
    const st = S();
    const p = st.patients.find((x) => x.code.toUpperCase() === code);
    if (!p) return SH.toast("Código não encontrado. Confira com a recepção.");
    if (!st.links.includes(p.code)) st.links.push(p.code);
    SH.save();
    $("#linkCode").value = "";
    renderFamily();
    SH.toast(`${p.name} vinculado(a). Você acompanha o status daqui.`);
  });
  $("#subChannel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ch]");
    if (!b) return;
    $$("#subChannel button").forEach((x) => x.classList.toggle("active", x === b));
  });
  $("#subUnits").addEventListener("change", (e) => {
    const all = $("#subUnits [value='all']");
    if (e.target === all && all.checked) $$("#subUnits input").forEach((i) => i !== all && (i.checked = false));
    else if (e.target !== all && e.target.checked) all.checked = false;
  });
  $("#subForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const unitIds = $$("#subUnits input:checked").map((i) => i.value);
    if (!unitIds.length) return SH.toast("Escolha pelo menos uma unidade.");
    const st = S();
    const sub = { id: SH.uid(), name: $("#subName").value.trim(), phone: $("#subPhone").value.trim(), channel: $("#subChannel .active").dataset.ch, unitIds };
    st.subscribers.push(sub);
    SH.store.set("sh-me", sub.id);
    SH.addHistory("Nova inscrição de avisos", `${sub.name} passou a receber avisos por ${sub.channel}.`);
    SH.save();
    renderInbox();
    SH.toast("Inscrição feita. Você receberá os avisos.");
  });

  fillSelects();
  if (SH.store.get("sh-large")) {
    document.documentElement.dataset.size = "large";
    $("#pubLarge").setAttribute("aria-pressed", "true");
  }
  SH.hooks.push(renderPublic);
  SH.publicView = setView;
  setInterval(() => {
    ui.updatedAt = Date.now();
    renderPublic();
  }, 300000);
  renderPublic();
})();
