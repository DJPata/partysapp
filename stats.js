/* ---------- Statistik: Ergebnisse der Online-Spiele werden auf diesem Handy gespeichert ---------- */
const ST_GAMES = { m3: "Tauschduell", slide: "Gleitstein", code: "Codeknacker", tictactoe: "Tic-Tac-Toe", dots: "Käsekästchen", rev: "Wendesteine" };
const stList = () => { const l = store.get("stats", []); return Array.isArray(l) ? l : []; };
function stAdd(rec){
  const l = stList(); if (l.some(r => r.id === rec.id)) return;
  l.unshift({ ...rec, t: Date.now() }); store.set("stats", l.slice(0, 1000));
}
// Wird bei jeder Aktualisierung im Raum aufgerufen und trägt ein beendetes Spiel genau einmal ein
function stCheck(room, code){
  if (!room) return;
  const g = room.game, base = `${code}:${room.created || 0}:${g}`, nm = id => pname(room, id);
  try {
    if (g === "m3" || g === "slide") {
      const o = room[g]; if (!o || o.phase !== "over") return;
      const A = gsArr(o.teams?.A), B = gsArr(o.teams?.B), myT = A.includes(me) ? "A" : B.includes(me) ? "B" : null; if (!myT) return;
      const mine = o.score[myT], theirs = o.score[otherTeam(myT)];
      const own = myT === "A" ? A : B, opp = myT === "A" ? B : A;
      stAdd({ id: `${base}:${o.id || `${o.n}-${o.score.A}-${o.score.B}`}`, game: g, res: mine > theirs ? "win" : mine < theirs ? "loss" : "draw", score: `${mine}:${theirs}`, with: own.filter(id => id !== me).map(nm), vs: opp.map(nm) });
    } else if (g === "code") {
      const c = room.code || {}, s = c.p1 === me ? "p1" : c.p2 === me ? "p2" : null; if (!s || !c.secret?.p1 || !c.secret?.p2) return;
      const o = s === "p1" ? "p2" : "p1", gu = { p1: gsArr(c.guesses?.p1), p2: gsArr(c.guesses?.p2) };
      const target = x => c.secret[x === "p1" ? "p2" : "p1"];
      if (!ckDone(target("p1"), gu.p1) || !ckDone(target("p2"), gu.p2)) return;
      const n = x => ckSolved(target(x), gu[x]) ? gu[x].length : 99, a = n(s), b = n(o);
      stAdd({ id: `${base}:${c.secret.p1}${c.secret.p2}:${gu.p1.join("")}:${gu.p2.join("")}`, game: g, res: a < b ? "win" : a > b ? "loss" : "draw", score: `${a === 99 ? "–" : a}:${b === 99 ? "–" : b} Versuche`, with: [], vs: [nm(c[o])] });
    } else if (g === "dots" || g === "rev") {
      const d = room[g] || {}, s = d.a === me ? "a" : d.b === me ? "b" : null, G = DUELS[g]; if (!s || !d.st) return;
      const r = G.result(d.st); if (!r) return; const sc = G.score(d.st), o = s === "a" ? "b" : "a";
      stAdd({ id: `${base}:${d.st.id}`, game: g, res: r === "d" ? "draw" : r === s ? "win" : "loss", score: `${sc[s]}:${sc[o]}`, with: [], vs: [nm(d[o])] });
    } else if (g === "tictactoe") {
      const t = room.ttt || {}, s = t.x === me ? "X" : t.o === me ? "O" : null; if (!s || !t.over) return;
      const b = String(t.b).split(""), w = LINES.find(l => b[l[0]] !== "." && l.every(i => b[i] === b[l[0]]));
      stAdd({ id: `${base}:${t.score.X}-${t.score.O}-${t.score.D}:${t.b}`, game: g, res: !w ? "draw" : b[w[0]] === s ? "win" : "loss", score: "", with: [], vs: [nm(s === "X" ? t.o : t.x)] });
    }
  } catch (e) { /* Statistik darf das Spiel nie stören */ }
}

/* --- Statistik-Seite --- */
const stFilter = { game: "" };
function statistik(){
  const all = stList(), list = stFilter.game ? all.filter(r => r.game === stFilter.game) : all;
  const cnt = l => ({ win: l.filter(r => r.res === "win").length, loss: l.filter(r => r.res === "loss").length, draw: l.filter(r => r.res === "draw").length });
  const tot = cnt(list), quote = list.length ? Math.round(tot.win / list.length * 100) : 0;
  // Bilanz pro Gegner
  const opp = {};
  list.forEach(r => (r.vs || []).forEach(n => { const o = opp[n] ||= { n, win: 0, loss: 0, draw: 0, last: 0 }; o[r.res]++; o.last = Math.max(o.last, r.t); }));
  const opps = Object.values(opp).sort((a, b) => (b.win + b.loss + b.draw) - (a.win + a.loss + a.draw) || b.last - a.last);
  const when = t => new Date(t).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const resTxt = { win: ["Sieg", "var(--mint)"], loss: ["Niederlage", "var(--coral)"], draw: ["Unentschieden", "var(--muted)"] };
  app.innerHTML = `<div class="bar"><a href="#" class="back" style="color:inherit;text-decoration:none">← Start</a><h3>Statistik</h3></div>
  <div class="chips"><button class="chip" data-g="" aria-pressed="${!stFilter.game}">Alle Spiele</button>${Object.entries(ST_GAMES).map(([k, v]) => `<button class="chip" data-g="${k}" aria-pressed="${stFilter.game === k}">${v}</button>`).join("")}</div>
  ${!list.length ? `<div class="note" style="text-align:center">Noch keine Ergebnisse. Sobald du online im Raum ein Duell zu Ende spielst, landet das Ergebnis hier.</div>` : `
  <div class="score"><div><span class="label">Siege</span><b style="color:var(--mint)">${tot.win}</b></div><div><span class="label">Quote</span><b>${quote} %</b></div><div><span class="label">Niederlagen</span><b style="color:var(--coral)">${tot.loss}</b></div></div>
  <p class="muted" style="text-align:center">${list.length} ${list.length === 1 ? "Spiel" : "Spiele"}${tot.draw ? `, davon ${tot.draw} unentschieden` : ""}</p>
  ${opps.length ? `<div class="field"><span class="label">Gegen wen</span><div class="hist">${opps.map(o => `<div><span>${esc(o.n)}</span><span><b style="color:var(--mint)">${o.win}</b> : <b style="color:var(--coral)">${o.loss}</b>${o.draw ? ` <span class="muted">(${o.draw} unent.)</span>` : ""}</span></div>`).join("")}</div></div>` : ""}
  <div class="field"><span class="label">Letzte Spiele</span><div class="hist">${list.slice(0, 50).map(r => `<div style="flex-direction:column;gap:2px">
    <span style="display:flex;justify-content:space-between;gap:8px"><b style="color:${resTxt[r.res][1]}">${resTxt[r.res][0]}</b><span class="muted">${when(r.t)}</span></span>
    <span>${ST_GAMES[r.game] || r.game}${r.score ? ` · ${esc(r.score)}` : ""}</span>
    <span class="muted" style="font-size:.9rem">gegen ${(r.vs || []).map(esc).join(", ") || "?"}${r.with?.length ? ` · mit ${r.with.map(esc).join(", ")}` : ""}</span></div>`).join("")}</div></div>`}
  <p class="muted" style="font-size:.88rem">Die Statistik wird auf diesem Handy gespeichert. Jeder Mitspieler hat seine eigene auf seinem Handy.</p>
  ${all.length ? `<button class="btn ghost block" id="stClear">Statistik löschen</button>` : ""}`;
  app.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { stFilter.game = b.dataset.g; statistik(); });
  $("#stClear") && ($("#stClear").onclick = () => { const b = $("#stClear"); if (b.dataset.sure) { store.set("stats", []); statistik(); } else { b.dataset.sure = 1; b.textContent = "Wirklich alles löschen?"; } });
}
