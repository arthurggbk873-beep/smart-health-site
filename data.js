/* Smart Health - dados de demonstração e utilitários de geração.
   Tudo aqui é fictício e serve só para apresentar o sistema. */
window.SHData = (() => {
  const SLOTS = 16; // horas 6h às 21h
  const FIRST_HOUR = 6;
  const PROFILE = [1, 5, 11, 14, 12, 9, 6, 7, 10, 12, 9, 6, 4, 3, 2, 1];
  const DOW = [0.4, 1.25, 1.1, 1.0, 0.95, 0.9, 0.5]; // domingo a sábado
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function openSlots(unit) {
    const h = unit.hours || "7h–17h";
    if (/24/.test(h)) return [0, SLOTS - 1];
    const m = h.match(/(\d+)h\D+(\d+)h/);
    if (!m) return [1, 11];
    return [Math.max(0, +m[1] - FIRST_HOUR), Math.min(SLOTS - 1, +m[2] - FIRST_HOUR)];
  }
  function genDay(unit, date, salt = "") {
    const r = rng(hash(`${unit.id}|${dayKey(date)}|${salt}`));
    const [a, b] = openSlots(unit);
    const scale = (unit.capacity || 18) / 18 * (unit.type === "ubs" ? 1 : 1.5);
    const f = DOW[date.getDay()] * (unit.type === "ubs" ? 1 : 0.8 + DOW[date.getDay()] * 0.2);
    return PROFILE.map((p, i) =>
      i < a || i > b ? 0 : Math.max(0, Math.round(p * scale * f * (0.8 + r() * 0.4))),
    );
  }
  function genDemand(units, days = 14) {
    const out = {};
    units.forEach((u) => {
      if (u.status === "closed" && !u.hours) return;
      out[u.id] = {};
      for (let i = 1; i <= days; i++) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        out[u.id][dayKey(d)] = genDay(u, d);
      }
    });
    return out;
  }
  function todaySeries(unit) {
    const d = new Date();
    const full = genDay(unit, d, "hoje");
    const hour = d.getHours();
    return full.map((v, i) => (FIRST_HOUR + i <= hour ? v : 0));
  }
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  function seedAlerts() {
    return [
      { id: "a1", time: ago(26 * 60 + 40), resolvedAt: ago(25 * 60 + 55), unitId: "upa-vicosa", unitName: "UPA Viçosa", waiting: 31, capacity: 30, ratio: 103 },
      { id: "a2", time: ago(50 * 60), resolvedAt: ago(48 * 60 + 30), unitId: "ubs-centro", unitName: "UBS Centro", waiting: 18, capacity: 18, ratio: 100 },
      { id: "a3", time: ago(75 * 60), resolvedAt: ago(74 * 60), unitId: "hospital-sao-joao", unitName: "Hospital São João", waiting: 36, capacity: 35, ratio: 103 },
    ];
  }
  function seedPatients() {
    return [
      { id: "p1", code: "SH-4821", name: "Osvaldo", unitId: "ubs-centro", status: "queue", log: [{ status: "registered", time: ago(32) }, { status: "queue", time: ago(32) }] },
      { id: "p2", code: "SH-3307", name: "Marlene", unitId: "upa-vicosa", status: "inService", log: [{ status: "registered", time: ago(58) }, { status: "queue", time: ago(58) }, { status: "inService", time: ago(11) }] },
      { id: "p3", code: "SH-1190", name: "Kaique", unitId: "hospital-sao-joao", status: "done", log: [{ status: "registered", time: ago(130) }, { status: "queue", time: ago(130) }, { status: "inService", time: ago(95) }, { status: "done", time: ago(60) }] },
    ];
  }
  function seedNotices() {
    return [
      { id: "n1", time: ago(150), unitId: "ubs-bom-jesus", unitName: "UBS Bom Jesus", kind: "Mudança no atendimento", channel: "WhatsApp", text: "Hoje não haverá atendimento odontológico na UBS Bom Jesus. Os atendimentos foram remarcados para amanhã às 8h.", recipients: 3 },
      { id: "n2", time: ago(26 * 60), unitId: "all", unitName: "Toda a rede", kind: "Campanha de vacinação", channel: "SMS", text: "Campanha de vacinação nas UBS, das 8h às 16h. Leve o cartão de vacinação.", recipients: 3 },
    ];
  }
  function seedSubs() {
    return [
      { id: "s1", name: "Assinante demonstração 1", phone: "(31) 9****-1111", channel: "WhatsApp", unitIds: ["all"] },
      { id: "s2", name: "Assinante demonstração 2", phone: "(31) 9****-2222", channel: "SMS", unitIds: ["all"] },
      { id: "s3", name: "Assinante demonstração 3", phone: "(31) 9****-3333", channel: "WhatsApp", unitIds: ["ubs-bom-jesus"] },
    ];
  }
  return { SLOTS, FIRST_HOUR, dayKey, genDay, genDemand, todaySeries, seedAlerts, seedPatients, seedNotices, seedSubs, hash };
})();
