/* ---------- Codeknacker: geheimen Farbcode erraten, 1 gegen 1 ---------- */
const CK = { LEN: 4, COLORS: 6, MAX: 10 };
const CK_COL = [["#ff5a5a", "Rot"], ["#ff9f1c", "Orange"], ["#ffd23f", "Gelb"], ["#3ddc84", "Grün"], ["#4ea8ff", "Blau"], ["#b07cff", "Lila"]];
// Rückmeldung: exakt = richtige Farbe am richtigen Platz, nah = richtige Farbe am falschen Platz
function ckFeedback(secret, guess){
  const s = secret.split(""), g = guess.split(""); let exact = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === g[i]) { exact++; s[i] = g[i] = null; }
  let near = 0;
  for (let i = 0; i < g.length; i++) { if (g[i] === null) continue; const k = s.indexOf(g[i]); if (k >= 0) { near++; s[k] = null; } }
  return { exact, near };
}
const ckRandom = () => Array.from({ length: CK.LEN }, () => rand(CK.COLORS)).join("");
const ckPeg = (c, small) => `<span class="peg${small ? " sm" : ""}" style="--g:${CK_COL[c]?.[0] || "transparent"}" ${c === undefined || c === "" ? 'data-empty="1"' : ""} aria-label="${CK_COL[c]?.[1] || "leer"}"></span>`;
const ckPins = ({ exact, near }) => `<span class="pins" aria-label="${exact} exakt, ${near} nah">${Array.from({ length: CK.LEN }, (_, i) => `<i class="${i < exact ? "ex" : i < exact + near ? "nr" : ""}"></i>`).join("")}</span>`;

// Ein Rateboard: bisherige Versuche mit Rückmeldung
function ckRows(secret, guesses){
  return `<div class="ckrows">${guesses.map((gs, n) => `<div class="ckrow"><span class="muted n">${n + 1}</span><span class="pegs">${gs.split("").map(c => ckPeg(+c)).join("")}</span>${ckPins(ckFeedback(secret, gs))}</div>`).join("")}</div>`;
}
// Eingabezeile mit Farbpalette
const ck = { cur: [] };
function ckInput(label, btn){
  return `<div class="card" style="gap:12px"><span class="label">${label}</span>
    <div class="pegs big" id="ckCur">${Array.from({ length: CK.LEN }, (_, i) => `<button data-slot="${i}" aria-label="Platz ${i + 1} leeren">${ckPeg(ck.cur[i] ?? "")}</button>`).join("")}</div>
    <div class="palette">${CK_COL.map((c, i) => `<button data-col="${i}" aria-label="${c[1]}">${ckPeg(i)}</button>`).join("")}</div>
    <button class="btn block" id="ckOk" ${ck.cur.filter(x => x !== undefined).length === CK.LEN ? "" : "disabled"}>${btn}</button></div>`;
}
function ckWireInput(onDone, rerender){
  app.querySelectorAll("[data-col]").forEach(b => b.onclick = () => { const k = [...Array(CK.LEN).keys()].find(i => ck.cur[i] === undefined); if (k === undefined) return; ck.cur[k] = +b.dataset.col; rerender(); });
  app.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => { ck.cur[+b.dataset.slot] = undefined; rerender(); });
  $("#ckOk").onclick = () => { if (ck.cur.filter(x => x !== undefined).length !== CK.LEN) return; const code = ck.cur.join(""); ck.cur = []; onDone(code); };
}
const ckLegend = `<p class="muted" style="font-size:.88rem">Volle Punkte: richtige Farbe am richtigen Platz. Ringe: richtige Farbe, aber falscher Platz. Farben dürfen mehrfach vorkommen. Höchstens ${CK.MAX} Versuche.</p>`;
const ckSolved = (secret, guesses) => guesses.includes(secret);
const ckDone = (secret, guesses) => ckSolved(secret, guesses) || guesses.length >= CK.MAX;

/* --- Online: zwei Plätze, jeder legt einen Code für den anderen fest, dann raten beide gleichzeitig --- */
function oCode(){
  const room = on.room, host = isHost(), c = room.code || {}, seats = [c.p1, c.p2];
  const mySeat = c.p1 === me ? "p1" : c.p2 === me ? "p2" : null, opp = s => s === "p1" ? "p2" : "p1";
  const nm = s => c[s] ? esc(pname(room, c[s])) : "frei";
  const secret = c.secret || {}, guesses = { p1: gsArr(c.guesses?.p1), p2: gsArr(c.guesses?.p2) };
  // Code, den Spieler s knacken muss = Code, den der Gegner festgelegt hat
  const target = s => secret[opp(s)] || "";
  const reset = () => up({ code: { p1: c.p1 || null, p2: c.p2 || null, secret: null, guesses: null, wins: c.wins || { p1: 0, p2: 0 } } });
  const wins = c.wins || { p1: 0, p2: 0 };
  const score = `<div class="score"><div><span class="label">${nm("p1")}</span><b style="color:var(--sky)">${wins.p1}</b></div><div><span class="label">Siege</span><b>:</b></div><div><span class="label">${nm("p2")}</span><b style="color:var(--coral)">${wins.p2}</b></div></div>`;
  const rerender = () => renderRoom();

  // 1. Plätze besetzen
  if (!c.p1 || !c.p2 || !room.players[c.p1] || !room.players[c.p2]) {
    app.innerHTML = roomBar("Codeknacker") + `<p class="muted">Jeder denkt sich einen geheimen Farbcode aus, dann versucht ihr gleichzeitig, den Code des anderen zu knacken. Wer weniger Versuche braucht, gewinnt.</p>
      <div class="row">${["p1", "p2"].map(s => c[s] && room.players[c[s]] ? `<div class="card" style="flex:1"><span class="label">Spieler ${s === "p1" ? 1 : 2}</span><h3>${nm(s)}${c[s] === me ? " (du)" : ""}</h3></div>` : !mySeat ? `<button class="btn${s === "p2" ? " coral" : ""}" data-seat="${s}">Als Spieler ${s === "p1" ? 1 : 2} mitspielen</button>` : `<div class="card" style="flex:1"><span class="label">Spieler ${s === "p1" ? 1 : 2}</span><h3 class="muted">wartet …</h3></div>`).join("")}</div>
      ${mySeat ? `<button class="btn ghost block" id="ckLeave">Platz freigeben</button>` : `<p class="muted">Alle anderen schauen zu.</p>`}`;
    app.querySelectorAll("[data-seat]").forEach(b => b.onclick = () => up({ [`code/${b.dataset.seat}`]: me, "code/secret": null, "code/guesses": null }));
    $("#ckLeave") && ($("#ckLeave").onclick = () => up({ [`code/${mySeat}`]: null, "code/secret": null, "code/guesses": null }));
    return;
  }
  // 2. Geheimcodes festlegen
  if (!secret.p1 || !secret.p2) {
    const mine = mySeat && secret[mySeat];
    app.innerHTML = roomBar("Codeknacker") + score + (mySeat && !mine
      ? `<div class="turn"><span class="label">Geheim</span><h2>Leg deinen Code fest</h2><span class="muted">${nm(opp(mySeat))} muss ihn knacken. Lass niemanden auf dein Handy schauen.</span></div>${ckInput("Dein Geheimcode", "Code festlegen")}`
      : `<div class="note" style="text-align:center">${mySeat ? `Dein Code steht. Warte auf ${nm(opp(mySeat))}.` : `${nm("p1")} und ${nm("p2")} legen gerade ihre Geheimcodes fest.`}</div>`);
    if (mySeat && !mine) ckWireInput(code => up({ [`code/secret/${mySeat}`]: code }), rerender);
    return;
  }
  // 3. Raten
  const over = ckDone(target("p1"), guesses.p1) && ckDone(target("p2"), guesses.p2);
  const board = s => {
    const sol = ckSolved(target(s), guesses[s]), done = ckDone(target(s), guesses[s]);
    return `<div class="card" style="gap:10px;border-top:4px solid ${s === "p1" ? "var(--sky)" : "var(--coral)"}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h3 style="font-weight:800">${s === mySeat ? "Du knackst" : `${nm(s)} knackt`} den Code von ${opp(s) === mySeat ? "dir" : nm(opp(s))}</h3><span class="pill" style="margin:0">${guesses[s].length}/${CK.MAX}</span></div>
      ${guesses[s].length ? ckRows(target(s), guesses[s]) : `<p class="muted">Noch kein Versuch.</p>`}
      ${sol ? `<p style="color:var(--mint);font-weight:700">Geknackt mit ${guesses[s].length} ${guesses[s].length === 1 ? "Versuch" : "Versuchen"}!</p>` : done ? `<p style="color:var(--coral);font-weight:700">Keine Versuche mehr.</p>` : ""}
      ${over || (done && s === mySeat) ? `<div style="display:flex;gap:8px;align-items:center"><span class="label">Code war</span><span class="pegs">${target(s).split("").map(x => ckPeg(+x)).join("")}</span></div>` : ""}
    </div>`;
  };
  let result = "";
  if (over) {
    const a = ckSolved(target("p1"), guesses.p1) ? guesses.p1.length : 99, b = ckSolved(target("p2"), guesses.p2) ? guesses.p2.length : 99;
    const w = a === b ? null : a < b ? "p1" : "p2";
    result = `<div class="reveal word" style="min-height:0"><span class="label">Ergebnis</span><span class="big">${w ? `${nm(w)} gewinnt` : "Unentschieden"}</span><span class="muted">${w ? `${nm(opp(w))} trinkt einen Schluck.` : "Beide trinken."}</span></div>
      ${mySeat || host ? `<div class="row"><button class="btn" id="ckAgain">Neue Runde</button><button class="btn ghost" id="ckSeats">Plätze freigeben</button></div>` : ""}`;
    if (!c.counted && (mySeat === "p1" || (!mySeat && host))) up({ "code/counted": true, ...(w ? { [`code/wins/${w}`]: (wins[w] || 0) + 1 } : {}) });
  }
  const myTurn = mySeat && !ckDone(target(mySeat), guesses[mySeat]);
  const order = mySeat ? [mySeat, opp(mySeat)] : ["p1", "p2"];
  app.innerHTML = roomBar("Codeknacker") + score + result + board(order[0]) + (myTurn ? ckInput(`Versuch ${guesses[mySeat].length + 1}`, "Raten") : "") + board(order[1]) + ckLegend;
  if (myTurn) ckWireInput(code => up({ [`code/guesses/${mySeat}`]: [...guesses[mySeat], code] }), rerender);
  $("#ckAgain") && ($("#ckAgain").onclick = () => up({ "code/secret": null, "code/guesses": null, "code/counted": null }));
  $("#ckSeats") && ($("#ckSeats").onclick = () => up({ code: { wins: { p1: 0, p2: 0 } } }));
}

/* --- Auf einem Handy --- */
const ckLocal = { secret: null, guesses: [], hidden: false, setting: false };
function codeknacker(){
  const back = `<div class="bar"><a href="#duelle" class="back" style="color:inherit;text-decoration:none">← Duelle</a><h3>Codeknacker</h3></div>`, L = ckLocal;
  if (L.setting) {
    app.innerHTML = back + `<div class="turn"><span class="label">Geheim</span><h2>Leg den Code fest</h2><span class="muted">Danach gibst du das Handy weiter.</span></div>${ckInput("Geheimcode", "Code festlegen")}`;
    ckWireInput(code => { Object.assign(L, { secret: code, guesses: [], setting: false }); codeknacker(); }, codeknacker);
    return;
  }
  if (!L.secret) {
    app.innerHTML = back + `<p class="muted">Knackt einen geheimen Code aus ${CK.LEN} Farben. Nach jedem Versuch seht ihr, wie viele Farben am richtigen Platz sind und wie viele nur stimmen.</p>
      <button class="btn block" id="ckRnd">Handy denkt sich einen Code aus</button>
      <button class="btn ghost block" id="ckSet">Einer legt den Code fest, der andere rät</button>
      <p class="muted" style="font-size:.9rem">Gegeneinander mit eigenen Handys geht es über „Zusammen spielen“.</p>`;
    $("#ckRnd").onclick = () => { Object.assign(L, { secret: ckRandom(), guesses: [] }); codeknacker(); };
    $("#ckSet").onclick = () => { ck.cur = []; L.setting = true; codeknacker(); };
    return;
  }
  const sol = ckSolved(L.secret, L.guesses), done = ckDone(L.secret, L.guesses);
  app.innerHTML = back + `<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between"><h3 style="font-weight:800">Versuche</h3><span class="pill" style="margin:0">${L.guesses.length}/${CK.MAX}</span></div>
    ${L.guesses.length ? ckRows(L.secret, L.guesses) : `<p class="muted">Noch kein Versuch.</p>`}</div>
    ${done ? `<div class="reveal word" style="min-height:0"><span class="label">${sol ? "Geknackt" : "Nicht geschafft"}</span><span class="big">${sol ? `${L.guesses.length} ${L.guesses.length === 1 ? "Versuch" : "Versuche"}` : "Code war"}</span><span class="pegs">${L.secret.split("").map(x => ckPeg(+x)).join("")}</span></div>
      <button class="btn block" id="ckNew">Nochmal</button>` : ckInput(`Versuch ${L.guesses.length + 1}`, "Raten")}${ckLegend}`;
  if (!done) ckWireInput(code => { L.guesses.push(code); codeknacker(); }, codeknacker);
  $("#ckNew") && ($("#ckNew").onclick = () => { Object.assign(L, { secret: null, guesses: [] }); codeknacker(); });
}
