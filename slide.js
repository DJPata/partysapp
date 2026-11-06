/* ---------- Gleitstein: Steine übers Eis schnippen, Team gegen Team ---------- */
// Spielfeld in Feldeinheiten: 100 breit, 180 lang. Das Ziel (Haus) liegt oben, geworfen wird von unten.
const GS = { W: 100, L: 180, R: 4, HX: 50, HY: 38, HOUSE: 20, SX: 50, SY: 166, HOG: 118, DEC: 30, VMAX: 120, PULL: 42, DT: 1 / 120 };
const TEAM = { A: { name: "Rot", col: "#ff6f61", dark: "#8f2a20" }, B: { name: "Gelb", col: "#ffc247", dark: "#8a5a00" } };
const otherTeam = t => t === "A" ? "B" : "A";
const gsArr = x => Array.isArray(x) ? x : (x && typeof x === "object") ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]) : [];

/* --- Physik: deterministisch, damit alle Handys denselben Wurf sehen --- */
function gsSimStart(stones, vx, vy, team){
  const s = stones.map(o => ({ t: o.t, x: o.x, y: o.y, vx: 0, vy: 0 }));
  s.push({ t: team, x: GS.SX, y: GS.SY, vx, vy, thrown: true });
  return { s, steps: 0, done: false };
}
function gsStep(sim){
  const { s } = sim, R = GS.R, dv = GS.DEC * GS.DT;
  for (const o of s) {
    const sp = Math.hypot(o.vx, o.vy);
    if (sp > 0) { const ns = Math.max(0, sp - dv); o.vx *= ns / sp; o.vy *= ns / sp; }
    o.x += o.vx * GS.DT; o.y += o.vy * GS.DT;
  }
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i], b = s[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 2 * R || d === 0) continue;
    const nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) { const k = (1 + 0.92) * rv / 2; a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny; }
  }
  // Steine, die die Bande berühren oder hinten rausrutschen, sind raus
  sim.s = s.filter(o => o.x - R > 0 && o.x + R < GS.W && o.y > 0);
  sim.steps++;
  if (sim.steps > 120 * 40 || sim.s.every(o => o.vx === 0 && o.vy === 0)) {
    sim.done = true;
    // Ein geworfener Stein, der die Linie nicht überquert, wird weggenommen
    sim.s = sim.s.filter(o => !(o.thrown && o.y > GS.HOG));
  }
}
function gsSimulate(stones, vx, vy, team){
  const sim = gsSimStart(stones, vx, vy, team);
  while (!sim.done) gsStep(sim);
  return sim.s.map(o => ({ t: o.t, x: +o.x.toFixed(3), y: +o.y.toFixed(3) }));
}
function gsScore(stones){
  const lim = GS.HOUSE + GS.R, d = o => Math.hypot(o.x - GS.HX, o.y - GS.HY);
  const inH = stones.map((o, i) => ({ ...o, i, d: d(o) })).filter(o => o.d <= lim).sort((a, b) => a.d - b.d);
  if (!inH.length) return { team: null, pts: 0, ids: [] };
  const team = inH[0].t, opp = inH.find(o => o.t !== team), cut = opp ? opp.d : Infinity;
  const win = inH.filter(o => o.t === team && o.d < cut);
  return { team, pts: win.length, ids: win.map(o => o.i) };
}

/* --- Spielstand --- */
function gsNew(teams, ends, per){
  return { phase: "play", teams, ends, per, end: 1, score: { A: 0, B: 0 }, first: "A", k: 0, stones: [], shot: null, n: 0, res: null };
}
function gsTurn(g){
  const team = g.k % 2 === 0 ? g.first : otherTeam(g.first);
  const list = gsArr(g.teams?.[team]);
  const who = list.length ? list[(Math.floor(g.k / 2) + g.end - 1) % list.length] : null;
  return { team, who };
}
function gsThrow(g, vx, vy, by){
  const from = gsArr(g.stones), { team } = gsTurn(g), to = gsSimulate(from, vx, vy, team);
  const k = g.k + 1, n = (g.n || 0) + 1, last = k >= 2 * g.per;
  const ng = { ...g, stones: to, k, n, shot: { n, by: by || "", t: team, vx, vy, from } };
  if (last) {
    const res = gsScore(to); ng.res = res; ng.phase = "end";
    ng.score = { ...g.score }; if (res.team) ng.score[res.team] += res.pts;
  }
  return ng;
}
function gsNextEnd(g){
  const res = g.res || {};
  if (g.end >= g.ends && g.score.A !== g.score.B) return { ...g, phase: "over" };
  // Wer gepunktet hat, fängt an; der Gegner hat den letzten Stein
  const first = res.team ? res.team : otherTeam(g.first);
  return { ...g, phase: "play", end: g.end + 1, first, k: 0, stones: [], shot: null, res: null };
}

/* --- Zeichnen & Eingabe: eine Leinwand, die zwischen den Ansichten erhalten bleibt --- */
const gs = { cv: null, ctx: null, view: null, sim: null, simN: null, aim: null, raf: 0 };
function gsCanvas(){
  if (gs.cv) return gs.cv;
  const cv = document.createElement("canvas");
  cv.className = "ice"; cv.setAttribute("aria-label", "Eisbahn. Zum Werfen auf das Eis tippen, nach unten ziehen und loslassen.");
  gs.cv = cv; gs.ctx = cv.getContext("2d");
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * GS.W, y: (e.clientY - r.top) / r.height * GS.L }; };
  cv.addEventListener("pointerdown", e => {
    const v = gs.view; if (!v || !v.canThrow || gs.sim) return;
    cv.setPointerCapture(e.pointerId); const p = pt(e); gs.aim = { sx: p.x, sy: p.y, dx: 0, dy: 0 }; gsDraw();
  });
  cv.addEventListener("pointermove", e => { if (!gs.aim) return; const p = pt(e); gs.aim.dx = gs.aim.sx - p.x; gs.aim.dy = gs.aim.sy - p.y; gsDraw(); });
  const release = e => {
    const a = gs.aim; gs.aim = null; if (!a) return;
    const sh = gsShot(a); gsDraw();
    if (sh && gs.view?.canThrow) { gs.view.canThrow = false; navigator.vibrate?.(25); gs.view.onThrow(sh.vx, sh.vy); }
  };
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", () => { gs.aim = null; gsDraw(); });
  addEventListener("resize", () => gs.cv.isConnected && gsSize());
  return cv;
}
// Ziehen wie bei einer Schleuder: nach unten ziehen wirft nach oben
function gsShot(a){
  let { dx, dy } = a; if (dy > -1) return null;
  const maxSide = 0.38 * -dy; dx = Math.max(-maxSide, Math.min(maxSide, dx));
  const len = Math.hypot(dx, dy), pow = Math.min(1, len / GS.PULL);
  if (pow < 0.08) return null;
  const sp = pow * GS.VMAX;
  return { vx: dx / len * sp, vy: dy / len * sp, pow };
}
function gsSize(){
  const cv = gs.cv, slot = cv.parentElement; if (!slot) return;
  const maxW = slot.clientWidth, maxH = Math.max(320, innerHeight - 330);
  const w = Math.floor(Math.min(maxW, maxH * GS.W / GS.L)), h = Math.floor(w * GS.L / GS.W), dpr = devicePixelRatio || 1;
  cv.style.width = w + "px"; cv.style.height = h + "px";
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  gsDraw();
}
function gsDraw(){
  const cv = gs.cv, c = gs.ctx, v = gs.view; if (!cv || !v || !cv.width) return;
  const k = cv.width / GS.W; c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = "#eaf5fb"; c.fillRect(0, 0, GS.W, GS.L);
  // Haus
  [[GS.HOUSE, "#3a8fd0"], [13.5, "#eaf5fb"], [8, "#1f5f99"], [2.4, "#eaf5fb"]].forEach(([r, col]) => { c.beginPath(); c.arc(GS.HX, GS.HY, r, 0, 7); c.fillStyle = col; c.fill(); });
  c.lineWidth = 0.35; c.strokeStyle = "rgba(29,20,38,.35)";
  c.beginPath(); c.moveTo(GS.W / 2, 0); c.lineTo(GS.W / 2, GS.L); c.moveTo(0, GS.HY); c.lineTo(GS.W, GS.HY); c.stroke();
  c.lineWidth = 0.9; c.strokeStyle = "rgba(255,111,97,.7)"; c.beginPath(); c.moveTo(0, GS.HOG); c.lineTo(GS.W, GS.HOG); c.stroke();
  c.fillStyle = "rgba(29,20,38,.45)"; c.font = "600 3.2px Figtree,system-ui,sans-serif"; c.fillText("Stein muss über diese Linie", 3, GS.HOG - 1.6);
  c.lineWidth = 0.4; c.strokeStyle = "rgba(29,20,38,.25)"; c.beginPath(); c.arc(GS.SX, GS.SY, GS.R + 1.5, 0, 7); c.stroke();
  // Steine
  const hi = new Set(v.highlight || []);
  const list = gs.sim ? gs.sim.s : v.stones;
  list.forEach((o, i) => gsStone(c, o.x, o.y, o.t, !gs.sim && hi.has(i)));
  // Nächster Stein und Zielhilfe
  if (!gs.sim && v.next) {
    gsStone(c, GS.SX, GS.SY, v.next, false, !v.canThrow);
    const sh = gs.aim && gsShot(gs.aim);
    if (sh) {
      const len = 14 + sh.pow * 40, ux = sh.vx / Math.hypot(sh.vx, sh.vy), uy = sh.vy / Math.hypot(sh.vx, sh.vy);
      c.setLineDash([2, 1.6]); c.lineWidth = 0.9; c.strokeStyle = TEAM[v.next].dark;
      c.beginPath(); c.moveTo(GS.SX, GS.SY); c.lineTo(GS.SX + ux * len, GS.SY + uy * len); c.stroke(); c.setLineDash([]);
      c.fillStyle = "rgba(29,20,38,.85)"; c.fillRect(GS.SX + 8, GS.SY - 5, 22, 8);
      c.fillStyle = "#fff"; c.font = "700 4.4px Figtree,system-ui,sans-serif"; c.fillText(`${Math.round(sh.pow * 100)} %`, GS.SX + 10, GS.SY + 0.8);
    }
  }
}
function gsStone(c, x, y, t, glow, faded){
  const T = TEAM[t] || TEAM.A, R = GS.R;
  c.globalAlpha = faded ? 0.55 : 1;
  if (glow) { c.beginPath(); c.arc(x, y, R + 1.8, 0, 7); c.fillStyle = "rgba(124,240,180,.85)"; c.fill(); }
  c.beginPath(); c.arc(x + 0.4, y + 0.6, R, 0, 7); c.fillStyle = "rgba(29,20,38,.25)"; c.fill();
  c.beginPath(); c.arc(x, y, R, 0, 7); c.fillStyle = "#6d6577"; c.fill();
  c.beginPath(); c.arc(x, y, R * 0.72, 0, 7); c.fillStyle = T.col; c.fill();
  c.lineWidth = 1.1; c.lineCap = "round"; c.strokeStyle = T.dark; c.beginPath(); c.moveTo(x - 1.4, y); c.lineTo(x + 1.4, y); c.stroke();
  c.globalAlpha = 1;
}
function gsAnimate(g){
  const sh = g.shot;
  if (!sh) { gs.simN = 0; return; }
  if (sh.n === gs.simN) return;
  const first = gs.simN === null; gs.simN = sh.n;
  if (first) return; // beim Öffnen nicht den alten Wurf nachspielen
  cancelAnimationFrame(gs.raf);
  gs.sim = gsSimStart(gsArr(sh.from), sh.vx, sh.vy, sh.t);
  const tick = () => {
    if (!gs.sim) return;
    for (let i = 0; i < 3 && !gs.sim.done; i++) gsStep(gs.sim);
    if (gs.sim.done) { gs.sim = null; gsDraw(); gs.view?.afterAnim?.(); return; }
    gsDraw(); gs.raf = requestAnimationFrame(tick);
  };
  gs.raf = requestAnimationFrame(tick);
}
function gsMount(slot, view){
  gs.view = view; const cv = gsCanvas(); slot.appendChild(cv); gsSize();
}

/* --- Gemeinsame Ansicht (online und auf einem Handy) --- */
// opt: { g, nameOf(id), canThrow, onThrow(vx,vy), canLead, onNext(), myTeam }
function gsBody(opt){
  const g = opt.g, { team, who } = gsTurn(g), T = TEAM[team], left = 2 * g.per - g.k;
  const scoreBox = `<div class="score"><div><span class="label">Team ${TEAM.A.name}</span><b style="color:${TEAM.A.col}">${g.score.A}</b></div><div><span class="label">End</span><b>${g.end}/${g.ends}</b></div><div><span class="label">Team ${TEAM.B.name}</span><b style="color:${TEAM.B.col}">${g.score.B}</b></div></div>`;
  if (g.phase === "over") {
    const w = g.score.A > g.score.B ? "A" : "B";
    return scoreBox + `<div class="reveal word" style="min-height:0"><span class="label">Spiel vorbei</span><span class="big" style="color:${TEAM[w].col}">Team ${TEAM[w].name} gewinnt</span><span class="muted">${g.score[w]} zu ${g.score[otherTeam(w)]}. Team ${TEAM[otherTeam(w)].name} trinkt aus.</span></div>
      ${opt.canLead ? `<div class="row"><button class="btn" id="gsAgain">Revanche</button><button class="btn ghost" id="gsSetup">Teams ändern</button></div>` : ""}<div id="gsSlot" class="iceslot"></div>`;
  }
  let info;
  if (g.phase === "end" && opt.hold) {
    info = `<div class="turn"><span class="label">Letzter Stein im End</span><h2>Der Stein gleitet …</h2></div>`;
  } else if (g.phase === "end") {
    const r = g.res || {};
    info = r.team
      ? `<div class="turn"><span class="label">End ${g.end} vorbei</span><h2 style="color:${TEAM[r.team].col}">Team ${TEAM[r.team].name} +${r.pts}</h2><span class="muted">Team ${TEAM[otherTeam(r.team)].name} trinkt ${r.pts} ${r.pts === 1 ? "Schluck" : "Schlucke"}.</span></div>`
      : `<div class="turn"><span class="label">End ${g.end} vorbei</span><h2>Kein Stein im Haus</h2><span class="muted">Niemand punktet, alle trinken einen Schluck.</span></div>`;
    info += opt.canLead ? `<button class="btn block" id="gsNext">${g.end >= g.ends && g.score.A !== g.score.B ? "Ergebnis zeigen" : g.end >= g.ends ? "Gleichstand: Extra-End" : "Nächstes End"}</button>` : `<div class="note" style="text-align:center">Gleich geht es weiter.</div>`;
  } else {
    const nm = who ? opt.nameOf(who) : `Team ${T.name}`;
    info = `<div class="turn" style="border-color:${T.col}"><span class="label">Team ${T.name} · noch ${left} ${left === 1 ? "Stein" : "Steine"} im End</span>
      <h2>${opt.canThrow && opt.mine ? "Du bist dran" : `${esc(nm)} ist dran`}</h2>
      <span class="muted">${opt.canThrow ? "Irgendwo aufs Eis tippen und wie eine Schleuder nach unten ziehen. Seitlich ziehen lenkt, weiter ziehen wirft fester." : "Schau zu, wie der Stein gleitet."}</span></div>`;
  }
  return scoreBox + info + `<div id="gsSlot" class="iceslot"></div>
    <p class="muted" style="font-size:.88rem">Am Ende jedes Ends punktet das Team mit dem Stein am nächsten zur Mitte: einen Punkt für jeden eigenen Stein, der näher liegt als der beste gegnerische. Steine an der Bande oder hinter dem Feld sind raus.</p>`;
}
const gsPending = g => !!(g.shot && gs.simN !== null && g.shot.n !== gs.simN) || !!gs.sim;
function gsWire(opt){
  const g = opt.g;
  gsMount($("#gsSlot"), {
    stones: gsArr(g.stones), next: g.phase === "play" ? gsTurn(g).team : null,
    canThrow: g.phase === "play" && opt.canThrow, onThrow: opt.onThrow,
    highlight: g.phase === "end" && !opt.hold ? gsArr(g.res?.ids) : [],
    afterAnim: opt.hold ? opt.redraw : null
  });
  gsAnimate(g);
  $("#gsNext") && ($("#gsNext").onclick = opt.onNext);
  $("#gsAgain") && ($("#gsAgain").onclick = opt.onAgain);
  $("#gsSetup") && ($("#gsSetup").onclick = opt.onSetup);
}
const gsSettings = (ends, per) => `
  <div class="field"><span class="label">Ends (Runden)</span><div class="chips">${[2, 4, 6].map(n => `<button class="chip" data-ends="${n}" aria-pressed="${ends === n}">${n}</button>`).join("")}</div></div>
  <div class="field"><span class="label">Steine pro Team und End</span><div class="chips">${[2, 3, 4].map(n => `<button class="chip" data-per="${n}" aria-pressed="${per === n}">${n}</button>`).join("")}</div></div>`;

/* --- Online --- */
function oSlide(){
  const room = on.room, ps = playersOf(room), host = isHost(), g = room.slide || {};
  if (g.phase === "setup" || !g.phase) {
    const tA = gsArr(g.teams?.A).filter(id => room.players[id]), tB = gsArr(g.teams?.B).filter(id => room.players[id]);
    const none = ps.filter(p => !tA.includes(p.id) && !tB.includes(p.id));
    const myT = tA.includes(me) ? "A" : tB.includes(me) ? "B" : null;
    const col = (t, list) => `<div class="card" style="border-top:4px solid ${TEAM[t].col};gap:8px"><h3 style="color:${TEAM[t].col};font-weight:800">Team ${TEAM[t].name}</h3>${list.length ? list.map(id => `<span>${esc(pname(room, id))}${id === me ? " (du)" : ""}</span>`).join("") : `<span class="muted">noch leer</span>`}${myT !== t ? `<button class="btn ghost" data-join="${t}" style="padding:10px">Hierher</button>` : ""}</div>`;
    app.innerHTML = roomBar("Gleitstein") + `
    <p class="muted">Zwei Teams schnippen abwechselnd Steine übers Eis. Ideal 2 gegen 2, geht aber mit jeder Teamgröße.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${col("A", tA)}${col("B", tB)}</div>
    ${none.length ? `<p class="muted">Noch ohne Team: ${none.map(p => esc(p.name)).join(", ")}</p>` : ""}
    ${host ? `<div class="card">${gsSettings(g.ends || 4, g.per || 4)}<button class="btn ghost" id="gsMix">Teams zufällig mischen</button></div>
      <button class="btn block" id="gsGo" ${tA.length && tB.length ? "" : "disabled"}>Spiel starten</button>${tA.length && tB.length ? "" : `<p class="muted">Jedes Team braucht mindestens einen Spieler.</p>`}`
    : `<div class="note" style="text-align:center">${esc(pname(room, room.host))} startet, sobald die Teams stehen.</div>`}`;
    app.querySelectorAll("[data-join]").forEach(b => b.onclick = () => {
      const t = b.dataset.join, o = otherTeam(t);
      up({ [`slide/teams/${t}`]: [...(t === "A" ? tA : tB).filter(id => id !== me), me], [`slide/teams/${o}`]: (o === "A" ? tA : tB).filter(id => id !== me) });
    });
    if (host) {
      app.querySelectorAll("[data-ends]").forEach(b => b.onclick = () => up({ "slide/ends": +b.dataset.ends }));
      app.querySelectorAll("[data-per]").forEach(b => b.onclick = () => up({ "slide/per": +b.dataset.per }));
      $("#gsMix").onclick = () => { const ids = shuffle(ps.map(p => p.id)); up({ "slide/teams": { A: ids.filter((_, i) => i % 2 === 0), B: ids.filter((_, i) => i % 2 === 1) } }); };
      $("#gsGo").onclick = () => { if (!tA.length || !tB.length) return; up({ slide: gsNew({ A: tA, B: tB }, g.ends || 4, g.per || 4) }); };
    }
    return;
  }
  const { team, who } = gsTurn(g), list = gsArr(g.teams?.[team]);
  const absent = who && !room.players[who];
  const canThrow = g.phase === "play" && (who === me || (absent && (list.includes(me) || host)));
  const toSetup = () => up({ slide: { phase: "setup", teams: g.teams, ends: g.ends, per: g.per } });
  const opt = {
    g, mine: who === me, canThrow, canLead: host, nameOf: id => pname(room, id), hold: gsPending(g), redraw: () => on.room?.game === "slide" && renderRoom(),
    onThrow: (vx, vy) => up({ slide: gsThrow(on.room.slide, vx, vy, me) }),
    onNext: () => up({ slide: gsNextEnd(on.room.slide) }),
    onAgain: () => up({ slide: gsNew(g.teams, g.ends, g.per) }),
    onSetup: toSetup
  };
  app.innerHTML = roomBar("Gleitstein") + gsBody(opt) + (host && g.phase !== "over" ? `<button class="btn ghost block" id="gsSetup2">Teams ändern (Spiel neu)</button>` : "");
  gsWire(opt);
  $("#gsSetup2") && ($("#gsSetup2").onclick = () => { if ($("#gsSetup2").dataset.sure) toSetup(); else { $("#gsSetup2").dataset.sure = 1; $("#gsSetup2").textContent = "Wirklich neu anfangen?"; } });
}

/* --- Auf einem Handy: Handy wird zwischen den Teams weitergegeben --- */
const gsLocal = { g: null, ends: 4, per: 4 };
function gleiter(){
  const back = `<div class="bar"><a href="#" class="back" style="color:inherit;text-decoration:none">← Start</a><h3>Gleitstein</h3></div>`;
  const g = gsLocal.g;
  if (!g) {
    app.innerHTML = back + `
    <p class="muted">Zwei Teams, ein Handy: Wer dran ist, nimmt das Handy und schnippt seinen Stein. Mit eigenen Handys geht es über „Zusammen spielen“.</p>
    <div class="card">${gsSettings(gsLocal.ends, gsLocal.per)}</div>
    <button class="btn block" id="gsGo">Spiel starten</button>`;
    app.querySelectorAll("[data-ends]").forEach(b => b.onclick = () => { gsLocal.ends = +b.dataset.ends; gleiter(); });
    app.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { gsLocal.per = +b.dataset.per; gleiter(); });
    $("#gsGo").onclick = () => { gs.simN = null; gsLocal.g = gsNew({ A: [], B: [] }, gsLocal.ends, gsLocal.per); gleiter(); };
    return;
  }
  const set = ng => { gsLocal.g = ng; gleiter(); };
  const opt = {
    g, mine: false, canThrow: true, canLead: true, nameOf: () => "", hold: gsPending(g), redraw: () => location.hash === "#gleiter" && gleiter(),
    onThrow: (vx, vy) => set(gsThrow(gsLocal.g, vx, vy, "")),
    onNext: () => set(gsNextEnd(gsLocal.g)),
    onAgain: () => set(gsNew(g.teams, g.ends, g.per)),
    onSetup: () => set(null)
  };
  app.innerHTML = back + gsBody(opt) + (g.phase !== "over" ? `<button class="btn ghost block" id="gsSetup2">Spiel abbrechen</button>` : "");
  gsWire(opt);
  $("#gsSetup2") && ($("#gsSetup2").onclick = () => { if ($("#gsSetup2").dataset.sure) set(null); else { $("#gsSetup2").dataset.sure = 1; $("#gsSetup2").textContent = "Wirklich abbrechen?"; } });
}
