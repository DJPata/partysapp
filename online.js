/* ---------- Online-Räume: jeder spielt mit dem eigenen Handy ---------- */
const arr = x => Array.isArray(x) ? x : (x && typeof x === "object") ? Object.keys(x).sort((a,b)=>a-b).map(k => x[k]) : [];
const me = (() => { const sp = new URLSearchParams(location.search), q = sp.has("test") && sp.get("pid"); if (q) return q; let id = store.get("pid", null); if (!id) { id = Math.random().toString(36).slice(2, 10); store.set("pid", id); } return id; })();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const on = { code: null, room: null, unsub: null, cardOpen: false, lastDice: "", rolling: false, tick: null };

function playersOf(room){ return Object.entries(room?.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.joined - b.joined); }
function pname(room, id){ return room?.players?.[id]?.name || "Weg"; }
const isHost = () => on.room && on.room.host === me;
const up = paths => net.update(on.code, paths);

function shareLink(){ return location.origin + location.pathname + "?raum=" + on.code; }

/* --- Start: Raum erstellen oder beitreten --- */
function raumStart(prefill){
  const name = store.get("myname", "");
  app.innerHTML = `
  <div class="bar"><a href="#" class="back" style="color:inherit;text-decoration:none">← Start</a><h3>Zusammen spielen</h3></div>
  ${net.local ? `<div class="note">Testmodus: Räume funktionieren nur in diesem Browser, bis die Firebase-Verbindung eingerichtet ist.</div>` : ""}
  <div class="card">
    <div class="field"><label class="label" for="myname">Dein Name</label><input type="text" id="myname" maxlength="16" placeholder="z. B. Patrick" value="${esc(name)}" autocomplete="nickname"></div>
  </div>
  <div class="card">
    <h3>Raum beitreten</h3>
    <div class="field"><label class="label" for="code">Raum-Code</label><input type="text" id="code" maxlength="4" placeholder="ABCD" value="${esc(prefill || "")}" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.3em;font-family:var(--display);font-size:1.6rem;font-weight:800"></div>
    <button class="btn block" id="join">Beitreten</button>
  </div>
  <div class="card">
    <h3>Neuen Raum erstellen</h3>
    <p class="muted">Du bekommst einen Code, mit dem die anderen auf ihren Handys beitreten.</p>
    <button class="btn ghost block" id="create">Raum erstellen</button>
  </div>
  <p class="status" id="err" style="color:var(--coral)"></p>`;
  const getName = () => { const n = $("#myname").value.trim(); if (!n) { $("#err").textContent = "Bitte gib zuerst deinen Namen ein."; $("#myname").focus(); return null; } store.set("myname", n); return n; };
  $("#join").onclick = async () => {
    const n = getName(); if (!n) return;
    const code = $("#code").value.trim().toUpperCase();
    if (code.length !== 4) { $("#err").textContent = "Der Code hat 4 Buchstaben."; return; }
    try { await net.init(); const r = await net.get(code);
      if (!r) { $("#err").textContent = `Raum ${code} gibt es nicht. Prüf den Code.`; return; }
      await net.update(code, { [`players/${me}`]: { name: n, joined: r.players?.[me]?.joined || Date.now() } });
      enterRoom(code);
    } catch (e) { $("#err").textContent = "Keine Verbindung. Prüf dein Internet und versuch es nochmal."; }
  };
  $("#create").onclick = async () => {
    const n = getName(); if (!n) return;
    try { await net.init();
      let code; do { code = Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join(""); } while (await net.get(code));
      await net.update(code, { created: Date.now(), host: me, game: null, [`players/${me}`]: { name: n, joined: Date.now() } });
      enterRoom(code);
    } catch (e) { $("#err").textContent = "Keine Verbindung. Prüf dein Internet und versuch es nochmal."; }
  };
}

function enterRoom(code){
  store.set("room", code);
  if (location.hash !== "#raum") { history.replaceState(null, "", location.pathname + "#raum"); }
  leaveSub();
  on.code = code; on.room = null;
  on.unsub = net.sub(code, room => {
    if (!room || !room.players?.[me]) { on.room = null; leaveSub(); store.set("room", null); raumStart(); if (room === null) $("#err").textContent = "Der Raum wurde geschlossen."; else $("#err").textContent = "Du bist nicht mehr im Raum."; return; }
    // Wenn der Host weg ist, übernimmt der nächste Spieler
    if (!room.players[room.host]) { const next = playersOf(room)[0]; if (next?.id === me) up({ host: me }); }
    on.room = room; renderRoom();
  });
}
function leaveSub(){ if (on.unsub) on.unsub(); on.unsub = null; clearInterval(on.tick); on.tick = null; }
async function leaveRoom(){
  const code = on.code, room = on.room; leaveSub(); store.set("room", null); on.code = null; on.room = null;
  const rest = playersOf(room).filter(p => p.id !== me);
  if (!rest.length) await net.remove(code); else await net.update(code, { [`players/${me}`]: null, ...(room.host === me ? { host: rest[0].id } : {}) });
  location.hash = "";
}

function roomBar(title){
  return `<div class="bar">${isHost() && on.room.game ? `<button class="back" id="tolobby">← Raum</button>` : `<button class="back" id="leave">Verlassen</button>`}<h3>${title}</h3><span class="pill" style="margin-left:auto">${on.code}</span></div>`;
}
function wireBar(){
  $("#tolobby") && ($("#tolobby").onclick = () => up({ game: null }));
  $("#leave") && ($("#leave").onclick = () => { if ($("#leave").dataset.sure) leaveRoom(); else { $("#leave").dataset.sure = 1; $("#leave").textContent = "Wirklich verlassen?"; } });
}

function renderRoom(){
  clearInterval(on.tick); on.tick = null;
  const g = on.room.game;
  const view = { imposter: oImposter, wuerfel: oDice, tictactoe: oTtt, nie: oNie }[g] || oLobby;
  // Eingaben nicht zerstören, während jemand tippt
  const a = document.activeElement; if (a && a.tagName === "INPUT" && a.type === "text" && app.contains(a)) return;
  view(); wireBar();
}

/* --- Lobby --- */
function oLobby(){
  const room = on.room, ps = playersOf(room), host = isHost();
  const games = [
    ["imposter", "?!", "Imposter", "Jeder sieht seine Karte auf dem eigenen Handy.", "t-imp", 3],
    ["wuerfel", "⚂⚄⚅", "Drei Würfel", "Jeder würfelt selbst, alle sehen live mit.", "t-dice", 2],
    ["tictactoe", "✕○", "Tic-Tac-Toe", "Zwei spielen, alle schauen zu.", "t-ttt", 2],
    ["nie", "!", "Ich hab noch nie", "Gemeinsame Karte für alle.", "t-nie", 1]
  ];
  app.innerHTML = roomBar("Raum") + `
  <div class="card" style="text-align:center;align-items:center">
    <span class="label">Raum-Code</span>
    <div style="font-family:var(--display);font-weight:800;font-size:3.4rem;letter-spacing:.18em;color:var(--marigold);line-height:1">${on.code}</div>
    <p class="muted">Die anderen öffnen die App, tippen auf „Zusammen spielen“ und geben den Code ein.</p>
    <button class="btn ghost" id="share">Einladungslink teilen</button>
  </div>
  <div class="field"><span class="label">Dabei (${ps.length})</span>
    <div class="hist">${ps.map(p => `<div><span>${esc(p.name)}${p.id === me ? " (du)" : ""}</span><span>${p.id === room.host ? `<span class="pill">Spielleitung</span>` : host ? `<button class="pill" data-kick="${p.id}">Entfernen</button>` : ""}</span></div>`).join("")}</div></div>
  ${host ? `<div class="field"><span class="label">Spiel auswählen</span><div class="tiles">${games.map(([id, gl, t, d, cls, min]) => `<button class="tile ${cls}" data-game="${id}" ${ps.length < min ? "disabled style=\"opacity:.5\"" : ""}><span class="glyph">${gl}</span><h3>${t}</h3><p>${ps.length < min ? `Ab ${min} Spielern` : d}</p></button>`).join("")}</div></div>`
  : `<div class="note" style="text-align:center">${esc(pname(room, room.host))} wählt gleich ein Spiel aus.</div>`}`;
  $("#share").onclick = async () => {
    const url = shareLink();
    try { if (navigator.share) { await navigator.share({ title: "Partyabend", text: `Komm in meinen Raum ${on.code}`, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); $("#share").textContent = "Link kopiert"; } catch { $("#share").textContent = url; }
  };
  app.querySelectorAll("[data-kick]").forEach(b => b.onclick = () => up({ [`players/${b.dataset.kick}`]: null }));
  app.querySelectorAll("[data-game]").forEach(b => b.onclick = () => startGame(b.dataset.game));
}

function startGame(g){
  const room = on.room, ps = playersOf(room);
  if (g === "imposter") {
    const s = room.imp?.settings || { imposters: 1, cats: Object.keys(WORDS), hint: true };
    return up({ game: g, "imp/settings": s, "imp/round": null });
  }
  if (g === "wuerfel") return up({ game: g, dice: newDiceRound(ps.map(p => p.id), 1) });
  if (g === "tictactoe") return up({ game: g, ttt: room.ttt || { b: ".........", turn: "X", start: "X", score: { X: 0, O: 0, D: 0 }, over: false } });
  if (g === "nie") return up({ game: g, nie: room.nie || { kind: "never", text: pick(NEVER), n: 1 } });
}

/* --- Imposter online --- */
function oImposter(){
  const room = on.room, ps = playersOf(room), host = isHost();
  const s = room.imp?.settings || { imposters: 1, cats: [], hint: true }, cats = arr(s.cats), r = room.imp?.round;
  const maxImp = Math.max(1, Math.floor((ps.length - 1) / 2));
  if (!r) {
    app.innerHTML = roomBar("Imposter") + (host ? `
    <div class="card">
      <div class="field"><span class="label">Imposter</span>
        <div class="stepper"><button data-imp="-1" aria-label="Weniger Imposter">−</button><output>${Math.min(s.imposters, maxImp)}</output><button data-imp="1" aria-label="Mehr Imposter">+</button></div></div>
      <div class="field"><span class="label">Kategorien</span>
        <div class="chips">${Object.keys(WORDS).map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${cats.includes(c)}">${esc(c)}</button>`).join("")}</div></div>
      <label class="toggle"><input type="checkbox" id="hint" ${s.hint ? "checked" : ""}> Imposter sieht die Kategorie</label>
    </div>
    <button class="btn block" id="go" ${ps.length < 3 ? "disabled" : ""}>Runde starten (${ps.length} Spieler)</button>
    ${ps.length < 3 ? `<p class="muted">Für Imposter braucht ihr mindestens 3 Spieler.</p>` : ""}`
    : `<div class="note" style="text-align:center">${esc(pname(room, room.host))} startet gleich die Runde. Halte dein Handy bereit.</div>`);
    if (host) {
      app.querySelectorAll("[data-imp]").forEach(b => b.onclick = () => up({ "imp/settings/imposters": Math.min(maxImp, Math.max(1, Math.min(s.imposters, maxImp) + +b.dataset.imp)) }));
      app.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { const c = b.dataset.cat; let n = cats.includes(c) ? cats.filter(x => x !== c) : [...cats, c]; if (!n.length) n = [c]; up({ "imp/settings/cats": n }); });
      $("#hint").onchange = e => up({ "imp/settings/hint": e.target.checked });
      $("#go").onclick = () => newImpRound();
    }
    return;
  }
  const inRound = !!r.who?.[me], isImp = !!r.imps?.[me];
  if (on.cardRound !== r.n) { on.cardRound = r.n; on.cardOpen = false; }
  const left = Math.max(0, Math.round(((r.endsAt || 0) - Date.now()) / 1000));
  const fmt = x => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
  app.innerHTML = roomBar(`Imposter · Runde ${r.n}`) + `
  ${!inRound ? `<div class="note">Diese Runde läuft schon ohne dich. In der nächsten Runde bist du dabei.</div>`
  : r.solved ? "" : on.cardOpen ? `
    <button class="reveal ${isImp ? "imp" : "word"}" id="card">
      <span class="label">Dein Begriff</span>
      <span class="big">${isImp ? "Du bist der Imposter" : esc(r.word)}</span>
      ${isImp && s.hint ? `<span class="muted">Kategorie: ${esc(r.cat)}</span>` : ""}${!isImp ? `<span class="muted">${esc(r.cat)}</span>` : ""}
      <span class="muted" style="font-size:.85rem">Tippen zum Verdecken</span>
    </button>` : `
    <button class="reveal cover" id="card"><span class="label">Deine Karte</span><span class="big">Aufdecken</span><span class="muted">Tippen, wenn niemand auf dein Handy schaut.</span></button>`}
  <div class="card" style="text-align:center">
    <span class="label">Los geht's</span>
    <h2>${esc(pname(room, r.starter))} fängt an</h2>
    <p class="muted">Reihum sagt jeder ein Wort zum Begriff. Danach stimmt ihr ab, wer der Imposter ist.</p>
  </div>
  ${r.endsAt ? `<div class="timer" id="t">${fmt(left)}</div>` : ""}
  ${r.solved ? `<div class="reveal imp" style="min-height:0"><span class="label">Imposter</span><span class="big" style="font-size:2rem">${Object.keys(r.imps || {}).map(id => esc(pname(room, id))).join(", ")}</span><span class="muted">Das Wort war <b style="color:var(--marigold)">${esc(r.word)}</b> (${esc(r.cat)})</span></div>` : ""}
  ${host ? `<div class="row">${!r.solved ? `<button class="btn ghost" id="timer">${r.endsAt ? "Timer neu starten" : "Timer 3:00 starten"}</button><button class="btn coral" id="solve">Auflösen</button>` : `<button class="btn" id="again">Neue Runde</button><button class="btn ghost" id="setup">Einstellungen</button>`}</div>` : ""}`;
  $("#card") && ($("#card").onclick = () => { on.cardOpen = !on.cardOpen; renderRoom(); });
  if (host) {
    $("#timer") && ($("#timer").onclick = () => up({ "imp/round/endsAt": Date.now() + 180000 }));
    $("#solve") && ($("#solve").onclick = () => up({ "imp/round/solved": true }));
    $("#again") && ($("#again").onclick = newImpRound);
    $("#setup") && ($("#setup").onclick = () => up({ "imp/round": null }));
  }
  if (r.endsAt && left > 0 && !r.solved) on.tick = setInterval(() => { const l = Math.max(0, Math.round((r.endsAt - Date.now()) / 1000)); const t = $("#t"); if (t) t.textContent = fmt(l); if (!l) { clearInterval(on.tick); navigator.vibrate?.(400); } }, 500);
}
function newImpRound(){
  const room = on.room, ps = playersOf(room), s = room.imp.settings, cats = arr(s.cats).length ? arr(s.cats) : Object.keys(WORDS);
  const maxImp = Math.max(1, Math.floor((ps.length - 1) / 2));
  const cat = pick(cats), word = pick(WORDS[cat]);
  const imps = {}; shuffle(ps.map(p => p.id)).slice(0, Math.min(s.imposters, maxImp)).forEach(id => imps[id] = true);
  const who = {}; ps.forEach(p => who[p.id] = true);
  up({ "imp/round": { n: (room.imp.round?.n || room.imp.lastN || 0) + 1, cat, word, imps, who, starter: pick(ps).id, endsAt: 0, solved: false }, "imp/lastN": (room.imp.round?.n || room.imp.lastN || 0) + 1 });
}

/* --- Drei Würfel online --- */
function newDiceRound(order, round){ return { round, order, cur: 0, max: 3, rolls: 0, v: [1, 1, 1], held: [false, false, false], flip: false, glass: true, results: [], phase: "play" }; }
function oDice(){
  const room = on.room, d = room.dice, order = arr(d.order), held = arr(d.held), v = arr(d.v), results = arr(d.results);
  if (d.phase === "end") return oDiceEnd();
  const curId = order[d.cur], mine = curId === me, first = d.cur === 0, s = diceScore(v), left = d.max - d.rolls;
  const sig = `${d.round}-${d.cur}-${d.rolls}`; const anim = on.lastDice && on.lastDice !== sig && d.rolls > 0 && !on.rolling; on.lastDice = sig;
  app.innerHTML = roomBar(`Drei Würfel · Runde ${d.round}`) + `
  ${d.glass ? `<div class="glass"><b>Runde ${d.round}:</b> ${d.round === 1 ? "Glas halb voll mit Bier füllen." : "Glas wieder halb voll füllen."}${isHost() || mine ? `<button class="btn ghost" id="gl">Erledigt</button>` : ""}</div>` : ""}
  <div class="turn"><span class="label">${first ? "Fängt an und legt die Würfe fest" : `Höchstens ${d.max} ${d.max === 1 ? "Wurf" : "Würfe"}`}</span>
    <h2>${mine ? "Du bist dran" : `${esc(pname(room, curId))} ist dran`}</h2>
    <span class="muted">Wurf ${d.rolls} von ${d.max}</span></div>
  <div class="dice" id="dice">${v.map((x, i) => dieHTML(x, i, held[i], !mine || !d.rolls || left <= 0)).join("")}</div>
  <div class="sum"><span class="label">Punkte</span><b>${d.rolls ? s.pts : "–"}</b></div>
  ${d.flip ? `<div class="glass" style="border-color:var(--sky)">Zwei Sechsen in einem Wurf: Eine 6 wurde zur 1 gedreht und festgehalten.</div>` : ""}
  ${d.rolls && s.name ? `<div class="special ${s.cls}"><b>${s.name}</b><span>${s.action}</span></div>` : ""}
  ${mine ? `<div class="row">
    ${left > 0 ? `<button class="btn" id="roll" style="font-size:1.2rem;padding:18px">${d.rolls ? "Nochmal würfeln" : "Würfeln"}</button>` : ""}
    ${d.rolls ? `<button class="btn ghost" id="done">${d.cur === order.length - 1 ? "Runde auswerten" : "Fertig"}</button>` : ""}
  </div>${d.rolls && left > 0 ? `<p class="muted" style="text-align:center;font-size:.9rem">Tippe auf einen Würfel, um ihn zurückzuhalten.</p>` : ""}`
  : isHost() && !room.players[curId] ? `<button class="btn ghost block" id="skip">${esc(pname(room, curId))} ist weg: überspringen</button>` : ""}
  ${results.length ? `<div class="field"><span class="label">Diese Runde</span><div class="hist">${results.map(r => `<div><span>${esc(pname(room, r.who))}</span><span>${arr(r.v).join(" · ")} = ${r.pts}</span></div>`).join("")}</div></div>` : ""}
  <div class="field"><span class="label">Reihenfolge</span><div class="chips">${order.map((id, i) => `<span class="chip" ${i === d.cur ? 'aria-pressed="true"' : ""}>${esc(pname(room, id))}</span>`).join("")}</div></div>`;
  if (anim) $("#dice").querySelectorAll(".die").forEach((el, i) => { if (!held[i] || d.flip) el.classList.add("roll"); });
  $("#gl") && ($("#gl").onclick = () => up({ "dice/glass": false }));
  if (mine) {
    $("#dice").querySelectorAll("[data-die]").forEach(el => el.onclick = () => { if (!d.rolls || left <= 0) return; const h = [...held]; h[el.dataset.die] = !h[el.dataset.die]; up({ "dice/held": h, "dice/flip": false }); });
    $("#roll") && ($("#roll").onclick = () => {
      if (held.every(Boolean)) return;
      on.rolling = true; $("#roll").disabled = true; let n = 0, nv = [...v];
      const iv = setInterval(() => {
        nv = nv.map((x, i) => held[i] ? x : 1 + rand(6));
        $("#dice").querySelectorAll(".die").forEach((el, i) => { if (!held[i]) el.outerHTML = dieHTML(nv[i], i, false, true); });
        if (++n > 6) { clearInterval(iv);
          const h = [...held], fresh = [0, 1, 2].filter(i => !h[i] && nv[i] === 6); let flip = false;
          if (fresh.length >= 2) { nv[fresh[0]] = 1; h[fresh[0]] = true; flip = true; }
          navigator.vibrate?.(30);
          up({ "dice/v": nv, "dice/held": h, "dice/flip": flip, "dice/rolls": d.rolls + 1, "dice/glass": false }).finally(() => { on.rolling = false; });
        }
      }, 60);
    });
    $("#done") && ($("#done").onclick = () => diceNext(true));
  }
  $("#skip") && ($("#skip").onclick = () => diceNext(false));
  if (mine && d.rolls && left <= 0 && !$("#done")) diceNext(true);
}
function diceNext(record){
  const d = on.room.dice, order = arr(d.order), results = arr(d.results), v = arr(d.v);
  const res = record ? [...results, { who: order[d.cur], v, ...diceScore(v) }] : results;
  const cur = d.cur + 1, max = d.cur === 0 && record ? d.rolls : d.max;
  up({ dice: { ...d, order, results: res, cur, max, rolls: 0, v: [1, 1, 1], held: [false, false, false], flip: false, glass: false, phase: cur >= order.length ? "end" : "play" } });
}
function oDiceEnd(){
  const room = on.room, d = room.dice, results = arr(d.results);
  if (!results.length) { app.innerHTML = roomBar("Drei Würfel") + `<p class="muted">Niemand hat gewürfelt.</p>${isHost() ? `<button class="btn block" id="next">Nächste Runde</button>` : ""}`; $("#next") && ($("#next").onclick = () => diceNewRoundOnline(null)); return; }
  const ranked = [...results].sort((a, b) => b.pts - a.pts);
  const min = ranked[ranked.length - 1].pts, losers = results.filter(r => r.pts === min);
  app.innerHTML = roomBar(`Drei Würfel · Runde ${d.round}`) + `
  <div class="turn"><span class="label">Runde ${d.round} ausgewertet</span><h2>${esc(pname(room, ranked[0].who))} hat den höchsten Wurf</h2></div>
  <div class="hist ranking">${ranked.map((r, i) => `<div><span>${i + 1}. ${esc(pname(room, r.who))}${r.cls ? ` <b class="c-${r.cls}">${r.name}</b>` : ""}</span><span>${arr(r.v).join(" · ")} = <b>${r.pts}</b></span></div>`).join("")}</div>
  <div class="special drink"><span class="label">Niedrigster Wurf · ${min} Punkte</span><b>${losers.map(r => esc(pname(room, r.who))).join(" & ")}</b><span>${losers.length > 1 ? "trinken das Glas" : "trinkt das Glas"}. Danach wird aufgefüllt und ${esc(pname(room, losers[0].who))} beginnt die nächste Runde.</span></div>
  ${results.filter(r => r.cls).map(r => `<div class="special ${r.cls}"><b>${r.name}</b><span style="font-weight:700">${esc(pname(room, r.who))}</span><span>${r.action}</span></div>`).join("")}
  ${isHost() ? `<button class="btn block" id="next">Nächste Runde</button>` : `<div class="note" style="text-align:center">${esc(pname(room, room.host))} startet die nächste Runde.</div>`}`;
  $("#next") && ($("#next").onclick = () => diceNewRoundOnline(losers[0].who));
}
function diceNewRoundOnline(starter){
  const ids = playersOf(on.room).map(p => p.id); let k = ids.indexOf(starter); if (k < 0) k = 0;
  up({ dice: newDiceRound(ids.map((_, i) => ids[(k + i) % ids.length]), on.room.dice.round + 1) });
}

/* --- Tic-Tac-Toe online --- */
function oTtt(){
  const room = on.room, t = room.ttt, b = t.b.split(""), mySeat = t.x === me ? "X" : t.o === me ? "O" : null;
  const win = LINES.find(l => b[l[0]] !== "." && l.every(i => b[i] === b[l[0]]));
  const full = b.every(c => c !== "."), seatName = s => t[s.toLowerCase()] ? esc(pname(room, t[s.toLowerCase()])) : "frei";
  const ready = t.x && t.o;
  app.innerHTML = roomBar("Tic-Tac-Toe") + `
  <div class="score"><div><span class="label">${seatName("X")}</span><b class="sx">✕ ${t.score.X}</b></div><div><span class="label">Unent.</span><b>${t.score.D}</b></div><div><span class="label">${seatName("O")}</span><b class="so">○ ${t.score.O}</b></div></div>
  ${!ready ? `<div class="row">${!t.x && !mySeat ? `<button class="btn" data-seat="x">Als ✕ spielen</button>` : ""}${!t.o && !mySeat ? `<button class="btn coral" data-seat="o">Als ○ spielen</button>` : ""}</div>
    <p class="muted" style="text-align:center">${mySeat ? "Warte auf deinen Gegner." : "Zwei Spieler setzen sich, alle anderen schauen zu."}</p>` : ""}
  <div class="status">${win ? `<span class="${b[win[0]] === "X" ? "sx" : "so"}">${seatName(b[win[0]])} gewinnt!</span>` : full ? "Unentschieden" : ready ? (t.turn === mySeat ? `<span class="${mySeat === "X" ? "sx" : "so"}">Du bist dran</span>` : `${seatName(t.turn)} ist dran`) : ""}</div>
  <div class="board">${b.map((c, i) => `<button class="cell ${c === "." ? "" : c.toLowerCase()}${win && win.includes(i) ? " win" : ""}" data-c="${i}" aria-label="Feld ${i + 1}">${c === "X" ? "✕" : c === "O" ? "○" : ""}</button>`).join("")}</div>
  <div class="row">${t.over ? `<button class="btn" id="new">Neue Runde</button>` : ""}${mySeat || isHost() ? `<button class="btn ghost" id="free">Plätze freigeben</button>` : ""}</div>`;
  app.querySelectorAll("[data-seat]").forEach(el => el.onclick = () => up({ [`ttt/${el.dataset.seat}`]: me }));
  app.querySelectorAll("[data-c]").forEach(el => el.onclick = () => {
    const i = +el.dataset.c; if (!ready || t.over || b[i] !== "." || t.turn !== mySeat) return;
    const nb = [...b]; nb[i] = mySeat; const p = { "ttt/b": nb.join("") };
    if (LINES.some(l => l.every(k => nb[k] === mySeat))) { p[`ttt/score/${mySeat}`] = t.score[mySeat] + 1; p["ttt/over"] = true; }
    else if (nb.every(c => c !== ".")) { p["ttt/score/D"] = t.score.D + 1; p["ttt/over"] = true; }
    else p["ttt/turn"] = mySeat === "X" ? "O" : "X";
    up(p);
  });
  $("#new") && ($("#new").onclick = () => { const st = t.start === "X" ? "O" : "X"; up({ "ttt/b": ".........", "ttt/turn": st, "ttt/start": st, "ttt/over": false }); });
  $("#free") && ($("#free").onclick = () => up({ ttt: { b: ".........", turn: "X", start: "X", score: { X: 0, O: 0, D: 0 }, over: false } }));
}

/* --- Ich hab noch nie online --- */
function oNie(){
  const n = on.room.nie, L = { never: "Ich hab noch nie", truth: "Wahrheit", dare: "Pflicht" };
  app.innerHTML = roomBar("Ich hab noch nie") + `
  <div class="prompt ${n.kind}"><span class="label">${L[n.kind]} · Karte ${n.n}</span><p class="q">${esc(n.text)}</p></div>
  <button class="btn block" data-k="never">Ich hab noch nie …</button>
  <div class="row"><button class="btn ghost" data-k="truth">Wahrheit</button><button class="btn coral" data-k="dare">Pflicht</button></div>
  <p class="muted" style="font-size:.9rem">Alle sehen dieselbe Karte. Jeder kann die nächste ziehen.</p>`;
  app.querySelectorAll("[data-k]").forEach(el => el.onclick = () => { const k = el.dataset.k, bank = { never: NEVER, truth: TRUTH, dare: DARE }[k]; let t; do { t = pick(bank); } while (t === n.text && bank.length > 1); up({ nie: { kind: k, text: t, n: n.n + 1 } }); });
}

/* ---------- Start & Routing ---------- */
function raum(){
  const q = new URLSearchParams(location.search).get("raum");
  if (on.code && on.room) return renderRoom();
  const saved = store.get("room", null);
  if (saved && !q) { net.init().then(() => net.get(saved)).then(r => { if (r?.players?.[me]) enterRoom(saved); else { store.set("room", null); raumStart(); } }).catch(() => raumStart()); app.innerHTML = `<p class="muted" style="padding-top:40px;text-align:center">Verbinde …</p>`; return; }
  if (q) history.replaceState(null, "", location.pathname + "#raum");
  raumStart(q ? q.toUpperCase() : "");
}
const routes = { "": home, imposter, wuerfel, tictactoe, nie, raum };
function route(){
  clearInterval(impTimer); impTimer = null;
  const h = location.hash.slice(1);
  if (h !== "raum" && on.code) { leaveSub(); on.code = null; on.room = null; }
  (routes[h] || home)(); window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
if (new URLSearchParams(location.search).get("raum")) history.replaceState(null, "", location.pathname + location.search + "#raum");
route();
