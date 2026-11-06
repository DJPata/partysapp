/* Verbindung zwischen den Handys: Firebase Realtime Database, sonst lokaler Testmodus. */
(function(){
  const FB_VER = "10.12.2";
  const loadScript = src => new Promise((ok, err) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => err(new Error("Laden fehlgeschlagen: " + src)); document.head.appendChild(s); });

  function setPath(obj, path, val){
    const parts = path.split("/"); let o = obj;
    for (let i = 0; i < parts.length - 1; i++){ if (typeof o[parts[i]] !== "object" || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(val));
  }

  // Lokaler Testmodus: alle Tabs desselben Browsers teilen sich die Räume.
  const mock = {
    local: true,
    async init(){},
    _all(){ try { return JSON.parse(localStorage.getItem("mock:rooms")) || {}; } catch { return {}; } },
    _save(all){ localStorage.setItem("mock:rooms", JSON.stringify(all)); this._bc.postMessage(1); this._fire(); },
    _bc: ("BroadcastChannel" in window) ? new BroadcastChannel("mock-rooms") : { postMessage(){}, onmessage: null },
    _subs: new Set(),
    _fire(){ const all = this._all(); this._subs.forEach(s => s.cb(all[s.code] ?? null)); },
    async get(code){ return this._all()[code] ?? null; },
    sub(code, cb){ const s = { code, cb }; this._subs.add(s); setTimeout(() => cb(this._all()[code] ?? null)); return () => this._subs.delete(s); },
    async update(code, paths){ const all = this._all(); if (!all[code]) all[code] = {}; for (const [p, v] of Object.entries(paths)) setPath(all[code], p, v); if (!Object.keys(all[code]).length) delete all[code]; this._save(all); },
    async remove(code){ const all = this._all(); delete all[code]; this._save(all); }
  };
  mock._bc.onmessage = () => mock._fire();

  const fb = {
    local: false, db: null,
    async init(){
      if (this.db) return;
      await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`);
      firebase.initializeApp(window.FIREBASE_CONFIG);
      this.db = firebase.database();
    },
    ref(code){ return this.db.ref("rooms/" + code); },
    async get(code){ return (await this.ref(code).get()).val(); },
    sub(code, cb){ const r = this.ref(code); const h = s => cb(s.val()); r.on("value", h); return () => r.off("value", h); },
    async update(code, paths){ const p = {}; for (const [k, v] of Object.entries(paths)) p[k] = v === undefined ? null : v; await this.ref(code).update(p); },
    async remove(code){ await this.ref(code).remove(); }
  };

  window.net = (window.FIREBASE_CONFIG && !new URLSearchParams(location.search).has("test")) ? fb : mock;
})();
