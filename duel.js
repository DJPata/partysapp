/* ---------- Brett-Duelle 1 gegen 1: Käsekästchen und Wendesteine ---------- */
// Gemeinsamer Rahmen: zwei Plätze (a, b), abwechselnde Züge, Siege werden gezählt.
const SIDE = { a: { name: "Blau", col: "var(--sky)", hex: "#6fd3ff" }, b: { name: "Rot", col: "var(--coral)", hex: "#ff6f61" } };
const otherSide = s => s === "a" ? "b" : "a";

/* --- Käsekästchen: Linien ziehen, wer ein Kästchen schließt, bekommt es und zieht nochmal --- */
const DOTS = {
  key: "dots", title: "Käsekästchen", glyph: "⊞",
  intro: "Zieht abwechselnd eine Linie zwischen zwei Punkten. Wer ein Kästchen schließt, bekommt es und ist gleich nochmal dran. Wer am Ende mehr Kästchen hat, gewinnt.",
  N: 5, // Kästchen pro Seite
  init(start){ const N = this.N; return { id: Date.now(), n: 0, turn: start, h: "0".repeat((N + 1) * N), v: "0".repeat(N * (N + 1)), box: "0".repeat(N * N), last: "" }; },
  score(st){ const c = { a: 0, b: 0 }; for (const x of st.box) if (x !== "0") c[x]++; return c; },
  result(st){ if (st.box.includes("0")) return null; const c = this.score(st); return c.a > c.b ? "a" : c.b > c.a ? "b" : "d"; },
  move(st, kind, idx){
    const N = this.N, side = st.turn, h = st[kind].split(""); if (h[idx] !== "0") return null;
    h[idx] = side; const ns = { ...st, [kind]: h.join(""), n: st.n + 1, last: kind + idx };
    const H = ns.h, V = ns.v, box = ns.box.split(""); let got = 0;
    const done = (r, c) => H[r * N + c] !== "0" && H[(r + 1) * N + c] !== "0" && V[r * (N + 1) + c] !== "0" && V[r * (N + 1) + c + 1] !== "0";
    const cand = kind === "h" ? [[Math.floor(idx / N) - 1, idx % N], [Math.floor(idx / N), idx % N]] : [[Math.floor(idx / (N + 1)), idx % (N + 1) - 1], [Math.floor(idx / (N + 1)), idx % (N + 1)]];
    for (const [r, c] of cand) if (r >= 0 && r < N && c >= 0 && c < N && box[r * N + c] === "0" && done(r, c)) { box[r * N + c] = side; got++; }
    ns.box = box.join(""); if (!got) ns.turn = otherSide(side);
    return ns;
  },
  board(st, can){
    const N = this.N, S = 60, P = 14, W = N * S + 2 * P, x = c => P + c * S;
    let svg = `<svg viewBox="0 0 ${W} ${W}" class="dotsvg" role="img" aria-label="Spielfeld Käsekästchen">`;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const o = st.box[r * N + c]; if (o !== "0") svg += `<rect x="${x(c) + 3}" y="${x(r) + 3}" width="${S - 6}" height="${S - 6}" rx="8" fill="${SIDE[o].hex}" opacity=".35"/><text x="${x(c) + S / 2}" y="${x(r) + S / 2 + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="${SIDE[o].hex}">${o === "a" ? "✕" : "○"}</text>`; }
    const line = (kind, i, x1, y1, x2, y2) => {
      const o = st[kind][i], last = st.last === kind + i;
      svg += o !== "0" ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SIDE[o].hex}" stroke-width="${last ? 8 : 6}" stroke-linecap="round"/>`
        : `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a3a5e" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/>${can ? `<rect class="hit" data-k="${kind}" data-i="${i}" x="${Math.min(x1, x2) - 13}" y="${Math.min(y1, y2) - 13}" width="${Math.abs(x2 - x1) + 26}" height="${Math.abs(y2 - y1) + 26}" fill="transparent"/>` : ""}`;
    };
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) line("h", r * N + c, x(c) + 6, x(r), x(c + 1) - 6, x(r));
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) line("v", r * (N + 1) + c, x(c), x(r) + 6, x(c), x(r + 1) - 6);
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) svg += `<circle cx="${x(c)}" cy="${x(r)}" r="5" fill="#f6eefc"/>`;
    return svg + "</svg>";
  },
  wire(st, apply){ app.querySelectorAll(".hit").forEach(el => el.addEventListener("click", () => { const ns = this.move(st, el.dataset.k, +el.dataset.i); if (ns) { navigator.vibrate?.(15); apply(ns); } })); }
};

/* --- Wendesteine: gegnerische Steine einkesseln und umdrehen --- */
const REV = {
  key: "rev", title: "Wendesteine", glyph: "◐",
  intro: "Setz deinen Stein so, dass du gegnerische Steine in einer Linie zwischen zwei eigenen einschließt. Die eingeschlossenen werden umgedreht. Wer am Ende mehr Steine hat, gewinnt. Wer nicht setzen kann, muss aussetzen.",
  N: 8, DIRS: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  init(start){ const N = this.N, b = Array(N * N).fill("0"); b[27] = b[36] = "a"; b[28] = b[35] = "b"; return { id: Date.now(), n: 0, turn: start, b: b.join(""), last: -1, passed: "" }; },
  flips(b, i, side){
    const N = this.N; if (b[i] !== "0") return [];
    const r0 = Math.floor(i / N), c0 = i % N, out = [];
    for (const [dr, dc] of this.DIRS) { const run = []; let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === otherSide(side)) { run.push(r * N + c); r += dr; c += dc; }
      if (run.length && r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === side) out.push(...run); }
    return out;
  },
  moves(b, side){ const m = []; for (let i = 0; i < b.length; i++) if (b[i] === "0" && this.flips(b, i, side).length) m.push(i); return m; },
  score(st){ const c = { a: 0, b: 0 }; for (const x of st.b) if (x !== "0") c[x]++; return c; },
  result(st){ if (st.over) { const c = this.score(st); return c.a > c.b ? "a" : c.b > c.a ? "b" : "d"; } return null; },
  move(st, i){
    const side = st.turn, b = st.b.split(""), f = this.flips(b, i, side); if (!f.length) return null;
    b[i] = side; f.forEach(k => b[k] = side);
    const ns = { ...st, b: b.join(""), n: st.n + 1, last: i, passed: "" }, o = otherSide(side);
    if (this.moves(ns.b, o).length) ns.turn = o;
    else if (this.moves(ns.b, side).length) { ns.turn = side; ns.passed = o; }
    else ns.over = true;
    return ns;
  },
  board(st, can){
    const hint = can ? new Set(this.moves(st.b, st.turn)) : new Set();
    return `<div class="revboard">${st.b.split("").map((x, i) => `<button class="rc" data-i="${i}" ${hint.has(i) ? 'data-ok="1"' : ""} aria-label="Feld ${i + 1}">${x !== "0" ? `<span class="disc${i === st.last ? " last" : ""}" style="background:${SIDE[x].hex}"></span>` : hint.has(i) ? `<span class="dot"></span>` : ""}</button>`).join("")}</div>`;
  },
  wire(st, apply){ app.querySelectorAll(".rc[data-ok]").forEach(el => el.onclick = () => { const ns = this.move(st, +el.dataset.i); if (ns) { navigator.vibrate?.(15); apply(ns); } }); }
};
const DUELS = { dots: DOTS, rev: REV };

/* --- Gemeinsame Anzeige --- */
function duelBody(G, st, names, mySide, can){
  const sc = G.score(st), res = G.result(st), w = res && res !== "d" ? res : null;
  const head = `<div class="score"><div><span class="label">${names.a}</span><b style="color:${SIDE.a.col}">${sc.a}</b></div><div><span class="label">${G.key === "rev" ? "Steine" : "Kästchen"}</span><b>:</b></div><div><span class="label">${names.b}</span><b style="color:${SIDE.b.col}">${sc.b}</b></div></div>`;
  const status = res ? `<div class="reveal word" style="min-height:0"><span class="label">Spiel vorbei</span><span class="big" ${w ? `style="color:${SIDE[w].col}"` : ""}>${w ? `${names[w]} ${names[w] === "Du" ? "gewinnst" : "gewinnt"}` : "Unentschieden"}</span><span class="muted">${w ? `${names[otherSide(w)]} ${names[otherSide(w)] === "Du" ? "trinkst" : "trinkt"} einen Schluck.` : "Beide trinken."}</span></div>`
    : `<div class="status"><span style="color:${SIDE[st.turn].col}">${mySide === st.turn ? "Du bist dran" : `${names[st.turn]} ist dran`}</span>${st.passed ? `<span class="muted" style="display:block;font-size:.9rem">${names[st.passed]} konnte nicht setzen und muss aussetzen.</span>` : ""}</div>`;
  return head + status + G.board(st, can && !res) + `<p class="muted" style="font-size:.88rem">${G.intro}</p>`;
}

/* --- Online --- */
function oDuel(key){
  const G = DUELS[key], room = on.room, host = isHost(), d = room[key] || {};
  const mySide = d.a === me ? "a" : d.b === me ? "b" : null, nm = s => d[s] ? esc(pname(room, d[s])) : "frei";
  const ready = d.a && d.b && room.players[d.a] && room.players[d.b];
  const wins = d.wins || { a: 0, b: 0, d: 0 };
  if (!ready || !d.st) {
    app.innerHTML = roomBar(G.title) + `<p class="muted">${G.intro}</p>
      <div class="row">${["a", "b"].map(s => d[s] && room.players[d[s]] ? `<div class="card" style="flex:1;border-top:4px solid ${SIDE[s].col}"><span class="label">${SIDE[s].name}</span><h3>${nm(s)}${d[s] === me ? " (du)" : ""}</h3></div>`
        : !mySide ? `<button class="btn${s === "b" ? " coral" : ""}" data-seat="${s}">Als ${SIDE[s].name} spielen</button>` : `<div class="card" style="flex:1"><span class="label">${SIDE[s].name}</span><h3 class="muted">wartet …</h3></div>`).join("")}</div>
      ${ready && (mySide || host) ? `<button class="btn block" id="dGo">Spiel starten</button>` : ""}
      ${mySide ? `<button class="btn ghost block" id="dLeave">Platz freigeben</button>` : `<p class="muted">Zwei spielen, alle anderen schauen zu.</p>`}`;
    app.querySelectorAll("[data-seat]").forEach(b => b.onclick = () => up({ [`${key}/${b.dataset.seat}`]: me }));
    $("#dLeave") && ($("#dLeave").onclick = () => up({ [`${key}/${mySide}`]: null, [`${key}/st`]: null }));
    $("#dGo") && ($("#dGo").onclick = () => up({ [`${key}/st`]: G.init(d.start || "a"), [`${key}/start`]: d.start || "a" }));
    return;
  }
  const st = d.st, res = G.result(st), names = { a: mySide === "a" ? "Du" : nm("a"), b: mySide === "b" ? "Du" : nm("b") };
  const can = mySide === st.turn && !res;
  app.innerHTML = roomBar(G.title) + `<div class="chips" style="justify-content:center"><span class="chip">Siege ${nm("a")} ${wins.a} : ${wins.b} ${nm("b")}${wins.d ? ` · ${wins.d} unent.` : ""}</span></div>` + duelBody(G, st, names, mySide, can)
    + `<div class="row">${res && (mySide || host) ? `<button class="btn" id="dNew">Revanche</button>` : ""}${mySide || host ? `<button class="btn ghost" id="dFree">Plätze freigeben</button>` : ""}</div>`;
  if (can) G.wire(st, ns => { const r = G.result(ns), p = { [`${key}/st`]: ns }; if (r) p[`${key}/wins/${r}`] = (wins[r] || 0) + 1; up(p); });
  $("#dNew") && ($("#dNew").onclick = () => { const s = otherSide(d.start || "a"); up({ [`${key}/st`]: G.init(s), [`${key}/start`]: s }); });
  $("#dFree") && ($("#dFree").onclick = () => { const b = $("#dFree"); if (b.dataset.sure) up({ [key]: { wins: { a: 0, b: 0, d: 0 } } }); else { b.dataset.sure = 1; b.textContent = "Wirklich?"; } });
}
const oDots = () => oDuel("dots"), oRev = () => oDuel("rev");

/* --- Auf einem Handy: Handy wird weitergegeben --- */
const duelLocal = { dots: null, rev: null, start: { dots: "a", rev: "a" } };
function duelLocalView(key){
  const G = DUELS[key], back = `<div class="bar"><a href="#duelle" class="back" style="color:inherit;text-decoration:none">← Duelle</a><h3>${G.title}</h3></div>`;
  if (!duelLocal[key]) duelLocal[key] = G.init(duelLocal.start[key]);
  const st = duelLocal[key], res = G.result(st);
  app.innerHTML = back + duelBody(G, st, { a: SIDE.a.name, b: SIDE.b.name }, null, true) + `<button class="btn ${res ? "" : "ghost "}block" id="dNew">${res ? "Nochmal" : "Neu anfangen"}</button>`;
  G.wire(st, ns => { duelLocal[key] = ns; duelLocalView(key); });
  $("#dNew").onclick = () => { duelLocal.start[key] = otherSide(duelLocal.start[key]); duelLocal[key] = G.init(duelLocal.start[key]); duelLocalView(key); };
}
const kaesekaestchen = () => duelLocalView("dots"), wendesteine = () => duelLocalView("rev");
