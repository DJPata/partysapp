/* ---------- Tauschduell: Steine tauschen, Dreierreihen bilden, Team gegen Team ---------- */
// Alle Handys teilen dasselbe Brett. Nachfallende Steine kommen aus einem gemeinsamen Zufallsgenerator,
// deshalb kann jedes Handy einen Zug selbst nachspielen und animieren.
const M3 = { N: 7, C: 6 };
const M3_ZOO = ["#ff8a80", "#ffb74d", "#fff176", "#a5e887", "#90caf9", "#d1a6ff"].map((c, i) => [c, ["🐸", "🦊", "🐥", "🐢", "🐳", "🐙"][i]]);
const M3_GEMS = [["#ff5a5a", "●"], ["#ff9f1c", "▲"], ["#ffd23f", "★"], ["#3ddc84", "◆"], ["#4ea8ff", "■"], ["#b07cff", "✚"]];

function m3Rng(seed){
  const R = { s: seed | 0 };
  R.next = () => { R.s = (R.s + 0x6D2B79F5) | 0; let t = R.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  R.gem = () => Math.floor(R.next() * M3.C);
  return R;
}
function m3Matches(b){
  const N = M3.N, set = new Set(); let maxRun = 0;
  const scan = idx => { // idx(line, pos) -> Feldnummer
    for (let l = 0; l < N; l++) { let run = 1;
      for (let p = 1; p <= N; p++) {
        const same = p < N && b[idx(l, p)] >= 0 && b[idx(l, p)] === b[idx(l, p - 1)];
        if (same) run++; else { if (run >= 3) { for (let q = p - run; q < p; q++) set.add(idx(l, q)); maxRun = Math.max(maxRun, run); } run = 1; }
      }
    }
  };
  scan((r, c) => r * N + c); scan((c, r) => r * N + c);
  return { set, maxRun };
}
const m3Adj = (i, j) => { const N = M3.N; return (Math.abs(i - j) === 1 && Math.floor(i / N) === Math.floor(j / N)) || Math.abs(i - j) === N; };
function m3Swap(b, i, j){ const n = [...b]; [n[i], n[j]] = [n[j], n[i]]; return n; }
function m3Valid(b, i, j){ return m3Adj(i, j) && m3Matches(m3Swap(b, i, j)).set.size > 0; }
function m3HasMove(b){ const N = M3.N; for (let i = 0; i < N * N; i++) { if ((i % N) < N - 1 && m3Valid(b, i, i + 1)) return true; if (i + N < N * N && m3Valid(b, i, i + N)) return true; } return false; }
function m3Gen(R){
  for (;;) {
    const N = M3.N, b = [];
    for (let i = 0; i < N * N; i++) { let g; do { g = R.gem(); } while ((i % N >= 2 && b[i - 1] === g && b[i - 2] === g) || (i >= 2 * N && b[i - N] === g && b[i - 2 * N] === g)); b.push(g); }
    if (m3HasMove(b)) return b;
  }
}
// Spielt einen Zug durch: liefert Zwischenbilder für die Animation, Punkte und ob es einen Extrazug gibt
function m3Resolve(before, i, j, seed){
  const R = m3Rng(seed), N = M3.N; let b = m3Swap(before, i, j);
  const frames = [{ b: [...b], clear: [] }]; let pts = 0, bonus = false, chain = 0;
  for (;;) {
    const { set, maxRun } = m3Matches(b); if (!set.size) break;
    frames.push({ b: [...b], clear: [...set] });
    pts += set.size * (chain + 1); if (maxRun >= 4) bonus = true; chain++;
    set.forEach(k => b[k] = -1);
    for (let c = 0; c < N; c++) {
      const col = []; for (let r = N - 1; r >= 0; r--) if (b[r * N + c] >= 0) col.push(b[r * N + c]);
      for (let r = N - 1, q = 0; r >= 0; r--, q++) b[r * N + c] = q < col.length ? col[q] : R.gem();
    }
    frames.push({ b: [...b], clear: [] });
  }
  let shuffled = false;
  if (!m3HasMove(b)) { b = m3Gen(R); frames.push({ b: [...b], clear: [] }); shuffled = true; }
  if (chain >= 3) bonus = true;
  return { b, frames, pts, bonus, chain, shuffled, seed: R.s };
}
const m3Enc = b => b.join(""), m3Dec = s => String(s || "").split("").map(Number);

/* --- Spielstand --- */
function m3New(teams, rounds, zoo){
  const R = m3Rng(Math.floor(Math.random() * 2 ** 31)), b = m3Gen(R);
  return { id: Date.now(), zoo: !!zoo, phase: "play", teams, rounds, round: 1, k: 0, moves: 2, score: { A: 0, B: 0 }, b: m3Enc(b), seed: R.s, last: null, n: 0 };
}
function m3TurnsPerRound(g){ return 2 * Math.max(1, gsArr(g.teams?.A).length, gsArr(g.teams?.B).length); }
function m3Turn(g){
  const firstT = g.round % 2 === 1 ? "A" : "B", team = g.k % 2 === 0 ? firstT : otherTeam(firstT);
  const list = gsArr(g.teams?.[team]);
  return { team, who: list.length ? list[Math.floor(g.k / 2) % list.length] : null };
}
function m3Move(g, i, j, by){
  const before = m3Dec(g.b), r = m3Resolve(before, i, j, g.seed), { team } = m3Turn(g);
  const score = { ...g.score, [team]: g.score[team] + r.pts };
  let moves = g.moves - 1 + (r.bonus ? 1 : 0), k = g.k, round = g.round, phase = "play";
  if (moves <= 0) { moves = 2; k++; if (k >= m3TurnsPerRound(g)) { k = 0; round++; if (round > g.rounds) { phase = "over"; round = g.rounds; } } }
  const n = (g.n || 0) + 1;
  return { ...g, b: m3Enc(r.b), seed: r.seed, score, moves, k, round, phase, n, last: { n, before: g.b, i, j, seed: g.seed, by: by || "", t: team, pts: r.pts, bonus: r.bonus, chain: r.chain } };
}

/* --- Brett & Eingabe --- */
const m3 = { view: null, anim: null, seenN: null, sel: -1, drag: null };
function m3BoardHTML(){
  const v = m3.view; if (!v) return "";
  const fr = m3.anim ? m3.anim.frames[m3.anim.k] : { b: v.b, clear: [] }, clear = new Set(fr.clear);
  return fr.b.map((x, i) => {
    const [col, sym] = (v.zoo ? M3_ZOO : M3_GEMS)[x] || ["transparent", ""];
    return `<button class="gem${v.zoo ? " zoo" : ""}${clear.has(i) ? " pop" : ""}${!m3.anim && i === m3.sel ? " sel" : ""}" data-i="${i}" style="--g:${col}" aria-label="Stein ${i + 1}">${sym}</button>`;
  }).join("");
}
function m3Draw(){ const el = $("#m3board"); if (el) el.innerHTML = m3BoardHTML(); }
function m3Wire(view){
  m3.view = view; const el = $("#m3board"); m3Draw();
  const cellAt = e => { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-i]"); return t ? +t.dataset.i : -1; };
  el.onpointerdown = e => { if (!m3.view?.canMove || m3.anim) return; const i = cellAt(e); if (i < 0) return; m3.drag = { i, x: e.clientX, y: e.clientY }; el.setPointerCapture?.(e.pointerId); };
  el.onpointerup = e => {
    const d = m3.drag; m3.drag = null; if (!d || !m3.view?.canMove || m3.anim) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, N = M3.N;
    if (Math.hypot(dx, dy) > 18) { // Wischen
      const c = d.i % N, r = Math.floor(d.i / N);
      const j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < N - 1 ? d.i + 1 : -1) : (c > 0 ? d.i - 1 : -1)) : (dy > 0 ? (r < N - 1 ? d.i + N : -1) : (r > 0 ? d.i - N : -1));
      return m3Try(d.i, j);
    }
    // Antippen: erst auswählen, dann Nachbarn antippen
    if (m3.sel < 0 || m3.sel === d.i) { m3.sel = m3.sel === d.i ? -1 : d.i; return m3Draw(); }
    if (m3Adj(m3.sel, d.i)) return m3Try(m3.sel, d.i);
    m3.sel = d.i; m3Draw();
  };
  el.onpointercancel = () => { m3.drag = null; };
}
function m3Try(i, j){
  const v = m3.view; m3.sel = -1;
  if (j < 0 || !m3Valid(v.b, i, j)) { m3Draw(); const el = $("#m3board"); el?.classList.remove("shake"); void el?.offsetWidth; el?.classList.add("shake"); navigator.vibrate?.(60); return; }
  v.canMove = false; navigator.vibrate?.(20); v.onMove(i, j);
}
function m3Animate(g){
  const L = g.last;
  if (!L) { m3.seenN = 0; return; }
  if (L.n === m3.seenN) return;
  const first = m3.seenN === null; m3.seenN = L.n; if (first) return;
  const r = m3Resolve(m3Dec(L.before), L.i, L.j, L.seed);
  m3.anim = { frames: r.frames, k: 0 }; m3Draw();
  const step = () => {
    if (!m3.anim) return;
    if (++m3.anim.k >= m3.anim.frames.length) { m3.anim = null; m3.view?.afterAnim?.(); m3Draw(); return; }
    m3Draw(); m3.anim.t = setTimeout(step, m3.anim.frames[m3.anim.k].clear.length ? 380 : 240);
  };
  m3.anim.t = setTimeout(step, 260);
}

/* --- Gemeinsame Ansicht --- */
function m3Body(opt){
  const g = opt.g, { team, who } = m3Turn(g), T = TEAM[team];
  const box = `<div class="score"><div><span class="label">Team ${TEAM.A.name}</span><b style="color:${TEAM.A.col}">${g.score.A}</b></div><div><span class="label">Runde</span><b>${g.round}/${g.rounds}</b></div><div><span class="label">Team ${TEAM.B.name}</span><b style="color:${TEAM.B.col}">${g.score.B}</b></div></div>`;
  const L = g.last, lastTxt = L && !m3.anim ? `<p class="muted" style="text-align:center;font-size:.9rem">Letzter Zug: ${L.by ? esc(opt.nameOf(L.by)) : `Team ${TEAM[L.t].name}`} +${L.pts}${L.chain > 1 ? `, ${L.chain}er-Kette` : ""}${L.bonus ? ", Extrazug" : ""}</p>` : "";
  let info;
  if (g.phase === "over" && !opt.hold) {
    const w = g.score.A === g.score.B ? null : g.score.A > g.score.B ? "A" : "B";
    info = `<div class="reveal word" style="min-height:0"><span class="label">Spiel vorbei</span><span class="big" ${w ? `style="color:${TEAM[w].col}"` : ""}>${w ? `Team ${TEAM[w].name} gewinnt` : "Unentschieden"}</span><span class="muted">${w ? `${g.score[w]} zu ${g.score[otherTeam(w)]}. Team ${TEAM[otherTeam(w)].name} trinkt aus.` : "Beide Teams trinken."}</span></div>
      ${opt.canLead ? `<div class="row"><button class="btn" id="m3Again">Revanche</button><button class="btn ghost" id="m3Setup">Teams ändern</button></div>` : ""}`;
  } else if (opt.hold) {
    info = `<div class="turn"><span class="label">Team ${TEAM[L?.t || team].name}</span><h2>Steine fallen …</h2></div>`;
  } else {
    const nm = who ? opt.nameOf(who) : `Team ${T.name}`;
    info = `<div class="turn"><span class="label" style="color:${T.col}">Team ${T.name} · noch ${g.moves} ${g.moves === 1 ? "Zug" : "Züge"}</span>
      <h2>${opt.canMove && opt.mine ? "Du bist dran" : `${esc(nm)} ist dran`}</h2>
      <span class="muted">${opt.canMove ? "Wische einen Stein auf ein Nachbarfeld oder tippe zwei Nachbarn an. Es muss eine Reihe aus mindestens 3 gleichen entstehen." : "Schau zu, gleich bist du dran."}</span></div>`;
  }
  return box + info + `<div id="m3board" class="m3board" style="--n:${M3.N}"></div>` + lastTxt +
    `<p class="muted" style="font-size:.88rem">Jeder Spieler hat pro Runde 2 Züge. Jeder abgeräumte Stein bringt einen Punkt, Kettenreaktionen zählen doppelt, dreifach und so weiter. Eine Viererreihe oder eine Dreierkette gibt einen Extrazug.</p>`;
}
function m3Mount(opt){
  const g = opt.g;
  m3Wire({ zoo: !!g.zoo, b: m3Dec(g.b), canMove: g.phase === "play" && opt.canMove && !opt.hold, onMove: opt.onMove, afterAnim: opt.redraw });
  m3Animate(g);
  $("#m3Again") && ($("#m3Again").onclick = opt.onAgain);
  $("#m3Setup") && ($("#m3Setup").onclick = opt.onSetup);
}
const m3Pending = g => !!(g.last && m3.seenN !== null && g.last.n !== m3.seenN) || !!m3.anim;
const m3Settings = (rounds, zoo) => `<div class="field"><span class="label">Look</span><div class="chips"><button class="chip" data-zoo="0" aria-pressed="${!zoo}">◆ Steine</button><button class="chip" data-zoo="1" aria-pressed="${!!zoo}">🐸 Tiere</button></div></div><div class="field"><span class="label">Runden</span><div class="chips">${[3, 5, 8].map(n => `<button class="chip" data-rounds="${n}" aria-pressed="${rounds === n}">${n}</button>`).join("")}</div></div>`;

/* --- Teams wählen (online) --- */
function teamSetup(key, title, intro, settingsHTML, wireSettings, start){
  const room = on.room, ps = playersOf(room), host = isHost(), g = room[key] || {};
  const tA = gsArr(g.teams?.A).filter(id => room.players[id]), tB = gsArr(g.teams?.B).filter(id => room.players[id]);
  const none = ps.filter(p => !tA.includes(p.id) && !tB.includes(p.id)), myT = tA.includes(me) ? "A" : tB.includes(me) ? "B" : null;
  const col = (t, list) => `<div class="card" style="border-top:4px solid ${TEAM[t].col};gap:8px"><h3 style="color:${TEAM[t].col};font-weight:800">Team ${TEAM[t].name}</h3>${list.length ? list.map(id => `<span>${esc(pname(room, id))}${id === me ? " (du)" : ""}</span>`).join("") : `<span class="muted">noch leer</span>`}${myT !== t ? `<button class="btn ghost" data-join="${t}" style="padding:10px">Hierher</button>` : ""}</div>`;
  app.innerHTML = roomBar(title) + `<p class="muted">${intro}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${col("A", tA)}${col("B", tB)}</div>
    ${none.length ? `<p class="muted">Noch ohne Team: ${none.map(p => esc(p.name)).join(", ")}</p>` : ""}
    ${host ? `<div class="card">${settingsHTML(g)}<button class="btn ghost" id="tsMix">Teams zufällig mischen</button></div>
      <button class="btn block" id="tsGo" ${tA.length && tB.length ? "" : "disabled"}>Spiel starten</button>${tA.length && tB.length ? "" : `<p class="muted">Jedes Team braucht mindestens einen Spieler.</p>`}`
    : `<div class="note" style="text-align:center">${esc(pname(room, room.host))} startet, sobald die Teams stehen.</div>`}`;
  app.querySelectorAll("[data-join]").forEach(b => b.onclick = () => {
    const t = b.dataset.join, o = otherTeam(t);
    up({ [`${key}/teams/${t}`]: [...(t === "A" ? tA : tB).filter(id => id !== me), me], [`${key}/teams/${o}`]: (o === "A" ? tA : tB).filter(id => id !== me) });
  });
  if (host) {
    wireSettings(g);
    $("#tsMix").onclick = () => { const ids = shuffle(ps.map(p => p.id)); up({ [`${key}/teams`]: { A: ids.filter((_, i) => i % 2 === 0), B: ids.filter((_, i) => i % 2 === 1) } }); };
    $("#tsGo").onclick = () => { if (tA.length && tB.length) start(g, { A: tA, B: tB }); };
  }
}

/* --- Online --- */
function oM3(){
  const room = on.room, host = isHost(), g = room.m3 || {};
  if (g.phase === "setup" || !g.phase) return teamSetup("m3", "Tauschduell", "Tauscht abwechselnd Steine auf demselben Brett. 1 gegen 1, 2 gegen 2 oder größere Teams.",
    g => m3Settings(g.rounds || 5, g.zoo), () => { app.querySelectorAll("[data-rounds]").forEach(b => b.onclick = () => up({ "m3/rounds": +b.dataset.rounds })); app.querySelectorAll("[data-zoo]").forEach(b => b.onclick = () => up({ "m3/zoo": b.dataset.zoo === "1" })); },
    (g, teams) => up({ m3: m3New(teams, g.rounds || 5, g.zoo) }));
  const { team, who } = m3Turn(g), list = gsArr(g.teams?.[team]), absent = who && !room.players[who];
  const canMove = g.phase === "play" && (who === me || (absent && (list.includes(me) || host)));
  const toSetup = () => up({ m3: { phase: "setup", teams: g.teams, rounds: g.rounds, zoo: !!g.zoo } });
  const opt = {
    g, mine: who === me, canMove, canLead: host, nameOf: id => pname(room, id), hold: m3Pending(g), redraw: () => on.room?.game === "m3" && renderRoom(),
    onMove: (i, j) => up({ m3: m3Move(on.room.m3, i, j, me) }),
    onAgain: () => up({ m3: m3New(g.teams, g.rounds, g.zoo) }), onSetup: toSetup
  };
  app.innerHTML = roomBar("Tauschduell") + m3Body(opt) + (host && g.phase !== "over" ? `<button class="btn ghost block" id="m3Setup2">Teams ändern (Spiel neu)</button>` : "");
  m3Mount(opt);
  $("#m3Setup2") && ($("#m3Setup2").onclick = () => { const b = $("#m3Setup2"); if (b.dataset.sure) toSetup(); else { b.dataset.sure = 1; b.textContent = "Wirklich neu anfangen?"; } });
}

/* --- Auf einem Handy --- */
const m3Local = { g: null, rounds: 5, zoo: false };
function tauschduell(){
  const back = `<div class="bar"><a href="#duelle" class="back" style="color:inherit;text-decoration:none">← Duelle</a><h3>Tauschduell</h3></div>`, g = m3Local.g;
  if (!g) {
    app.innerHTML = back + `<p class="muted">Team Rot gegen Team Gelb auf einem Handy: Wer dran ist, nimmt das Handy und macht seine 2 Züge. Mit eigenen Handys geht es über „Zusammen spielen“.</p>
      <div class="card">${m3Settings(m3Local.rounds, m3Local.zoo)}</div><button class="btn block" id="m3Go">Spiel starten</button>`;
    app.querySelectorAll("[data-rounds]").forEach(b => b.onclick = () => { m3Local.rounds = +b.dataset.rounds; tauschduell(); });
    app.querySelectorAll("[data-zoo]").forEach(b => b.onclick = () => { m3Local.zoo = b.dataset.zoo === "1"; tauschduell(); });
    $("#m3Go").onclick = () => { m3.seenN = null; m3Local.g = m3New({ A: [], B: [] }, m3Local.rounds, m3Local.zoo); tauschduell(); };
    return;
  }
  const set = ng => { m3Local.g = ng; tauschduell(); };
  const opt = {
    g, mine: false, canMove: true, canLead: true, nameOf: () => "", hold: m3Pending(g), redraw: () => location.hash === "#tauschduell" && tauschduell(),
    onMove: (i, j) => set(m3Move(m3Local.g, i, j, "")), onAgain: () => set(m3New(g.teams, g.rounds, g.zoo)), onSetup: () => set(null)
  };
  app.innerHTML = back + m3Body(opt) + (g.phase !== "over" ? `<button class="btn ghost block" id="m3Setup2">Spiel abbrechen</button>` : "");
  m3Mount(opt);
  $("#m3Setup2") && ($("#m3Setup2").onclick = () => { const b = $("#m3Setup2"); if (b.dataset.sure) set(null); else { b.dataset.sure = 1; b.textContent = "Wirklich abbrechen?"; } });
}
