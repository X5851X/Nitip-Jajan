"use strict";
/* Tempat nyimpen catatan. Tiga mode dengan cara pakai yang sama:
   - server:   dipakai bareng lewat worker.js di alamat yang sama (otomatis kalau servernya ada)
   - firebase: dipakai bareng lewat Firebase (kalau config.js diisi)
   - lokal:    mode coba, cuma tersimpan di browser ini
   Bentuk update pakai "jalur bertitik", misal { "orang.o1.lunas": true }. */

const HAPUS_FIELD = Symbol("hapus-field");
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

function muatScript(src) {
  return new Promise((ok, gagal) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => gagal(new Error("gagal memuat " + src));
    document.head.append(s);
  });
}

async function storeFirebase(cfg) {
  await muatScript(FIREBASE_SDK + "firebase-app-compat.js");
  await muatScript(FIREBASE_SDK + "firebase-firestore-compat.js");
  const fb = window.firebase;
  const app = fb.apps.length ? fb.app() : fb.initializeApp(cfg.firebase);
  const col = fb.firestore(app).collection(cfg.koleksi || "titipan-km");
  const siapkan = (paths) => {
    const o = {};
    for (const [k, v] of Object.entries(paths)) o[k] = v === HAPUS_FIELD ? fb.firestore.FieldValue.delete() : v;
    return o;
  };
  return {
    mode: "firebase",
    subscribe(next, error) {
      return col.onSnapshot((snap) => next(snap.docs.map((d) => ({ id: d.id, data: d.data() }))), error);
    },
    newId: () => col.doc().id,
    set: (id, data) => col.doc(id).set(data),
    update: (id, paths) => col.doc(id).update(siapkan(paths)),
    remove: (id) => col.doc(id).delete(),
  };
}

/* Mode server: catatan disimpan worker.js di alamat yang sama dengan web ini, jadi semua browser lihat papan yang sama.
   Perubahan dari browser lain dikabarin lewat WebSocket. Tiap catatan bawa nomor versi, biar kabar yang telat nggak nimpa yang baru. */
const alamatApi = (p) => new URL("api/" + p, location.href).href;

async function mintaApi(method, p, body) {
  let r;
  try {
    r = await fetch(alamatApi(p), {
      method, cache: "no-store",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw Object.assign(new Error("koneksi putus"), { code: "unavailable" }); }
  const j = await r.json().catch(() => null);
  if (r.ok && j && j.ok === true) return j;
  const code = (j && j.kode) || (r.status === 404 ? "not-found" : r.status === 429 ? "resource-exhausted" : r.status >= 500 ? "unavailable" : "invalid");
  throw Object.assign(new Error((j && j.pesan) || "server " + r.status), { code });
}

/* Ada server di alamat yang sama? 404 atau bukan JSON berarti hosting statis biasa. */
async function cariServer() {
  if (!/^https?:$/.test(location.protocol)) return null;
  try { return await mintaApi("GET", "titipan"); }
  catch (e) { return e.code === "not-found" || e.code === "invalid" ? null : { versi: 0, catatan: [], putus: true }; }
}

function storeServer(cfg, awal) {
  const subs = new Set();
  const docs = new Map(); // id -> { v, data }; data null = udah dihapus
  let ws = null, tunda = 1000, gagalBeruntun = 0, putus = !!awal.putus;

  const pasang = (id, v, data) => {
    const ada = docs.get(id);
    if (ada && ada.v >= v) return false;
    docs.set(id, { v, data: data || null });
    return true;
  };
  const isiSemua = (j) => {
    let berubah = false;
    const ada = new Set();
    for (const c of j.catatan) { ada.add(c.id); berubah = pasang(c.id, c.v, c.data) || berubah; }
    for (const [id, x] of docs) if (!ada.has(id) && x.data && x.v <= j.versi) { docs.set(id, { v: j.versi, data: null }); berubah = true; }
    return berubah;
  };
  const daftar = () => {
    const semua = [];
    for (const [id, x] of docs) if (x.data) semua.push({ id, data: x.data });
    return semua;
  };
  const kabari = () => { const semua = daftar(); for (const s of subs) s.next(semua); };
  const muatUlang = async () => {
    try {
      const berubah = isiSemua(await mintaApi("GET", "titipan"));
      gagalBeruntun = 0;
      if (berubah || putus) { putus = false; kabari(); }
    } catch (e) {
      if (++gagalBeruntun >= 2 && !putus) { putus = true; for (const s of subs) if (s.error) s.error(e); }
    }
  };
  const sambung = () => {
    if (ws || document.hidden || !window.WebSocket) return;
    let s;
    try { s = new WebSocket(alamatApi("live").replace(/^http/, "ws")); } catch { return; }
    ws = s;
    s.onopen = () => { tunda = 1000; muatUlang(); }; // kejar perubahan yang kelewat selama putus
    s.onmessage = (e) => {
      let m = null;
      try { m = JSON.parse(e.data); } catch { /* "pong" */ }
      if (m && typeof m.id === "string" && typeof m.v === "number" && pasang(m.id, m.v, m.data)) kabari();
    };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null;
      muatUlang();
      setTimeout(sambung, tunda);
      tunda = Math.min(tunda * 2, 60000);
    };
  };

  /* Sekali per browser: catatan yang dulu cuma kesimpen di browser ini ikut diunggah, pakai ID yang sama
     biar link yang udah sempat dibagi tetap kebuka. Catatan contoh nggak ikut. */
  const pindahDariBrowser = async () => {
    const KEY = "nitipdong.lokal." + (cfg.koleksi || "titipan-km"), tanda = KEY + ".pindah";
    if (lsGet(tanda)) return;
    let lama = {};
    try { lama = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { /* rusak, lewati */ }
    let beres = true;
    for (const [id, data] of Object.entries(lama)) {
      if (!data || typeof data !== "object" || data.contoh === true) continue;
      try {
        const j = await mintaApi("POST", "titipan/" + encodeURIComponent(id) + "/pindah", { data });
        if (j.data && pasang(j.id, j.v, j.data)) kabari();
      } catch (e) { if (e.code === "unavailable") beres = false; }
    }
    if (beres) lsSet(tanda, "1");
  };

  if (!putus) isiSemua(awal);
  sambung();
  setInterval(() => { if (ws && ws.readyState === 1) ws.send("ping"); }, 45000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    muatUlang();
    if (!ws) { tunda = 1000; sambung(); }
  });
  if (!putus) pindahDariBrowser();

  const jalur = (id) => "titipan/" + encodeURIComponent(id);
  const terima = (j) => { if (pasang(j.id, j.v, j.data)) kabari(); };
  return {
    mode: "server",
    subscribe(next, error) {
      const s = { next, error };
      subs.add(s);
      setTimeout(() => { if (!putus) next(daftar()); else if (error) error({ code: "unavailable" }); }, 0);
      return () => subs.delete(s);
    },
    newId: () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    set: async (id, data) => terima(await mintaApi("PUT", jalur(id), { data })),
    async update(id, paths) {
      const ubah = {}, hapus = [];
      for (const [k, v] of Object.entries(paths)) { if (v === HAPUS_FIELD) hapus.push(k); else ubah[k] = v; }
      terima(await mintaApi("PATCH", jalur(id), { ubah, hapus }));
    },
    remove: async (id) => terima(await mintaApi("DELETE", jalur(id))),
  };
}

function storeLokal(cfg) {
  const KEY = "nitipdong.lokal." + (cfg.koleksi || "titipan-km");
  const subs = new Set();
  const baca = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; }
    catch { return {}; }
  };
  const kirim = () => {
    const semua = Object.entries(baca()).map(([id, data]) => ({ id, data }));
    for (const f of subs) f(semua);
  };
  const simpan = (obj) => { localStorage.setItem(KEY, JSON.stringify(obj)); kirim(); };
  window.addEventListener("storage", (e) => { if (e.key === KEY) kirim(); });
  isiContohLokal(KEY, baca, simpan);
  gantiAliasSekali(KEY, baca, simpan);
  return {
    mode: "lokal",
    subscribe(next) { subs.add(next); setTimeout(kirim, 0); return () => subs.delete(next); },
    newId: () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    async set(id, data) { const all = baca(); all[id] = JSON.parse(JSON.stringify(data)); simpan(all); },
    async update(id, paths) {
      const all = baca(), doc = all[id];
      if (!doc) throw Object.assign(new Error("catatan nggak ada"), { code: "not-found" });
      for (const [p, v] of Object.entries(paths)) {
        const ks = p.split(".");
        let o = doc;
        for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
        const last = ks[ks.length - 1];
        if (v === HAPUS_FIELD) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
      }
      simpan(all);
    },
    async remove(id) { const all = baca(); delete all[id]; simpan(all); },
  };
}

/* Contoh dari obrolan awal (cuma di mode coba, sekali saja, ditandai "Contoh"). */
function isiContohLokal(KEY, baca, simpan) {
  if (lsGet(KEY + ".contoh") || Object.keys(baca()).length) return;
  const d = new Date();
  while (d.getDay() !== 2) d.setDate(d.getDate() - 1); // Selasa terakhir
  const tgl = isoLokal(d), t = d.getTime();
  try {
    simpan({
      "contoh-kopi": {
        tanggal: tgl, waktu: "pagi", beli: "Kopi", jenis: "", pembeli: "kucing", warna: "kuning", contoh: true,
        orang: {
          o1: { nama: "kelinci", pesanan: "", jumlah: 25000, lunas: false, urut: 1 },
          o2: { nama: "singa", pesanan: "", jumlah: 18000, lunas: false, urut: 2 },
          o3: { nama: "macan", pesanan: "", jumlah: 20000, lunas: false, urut: 3 },
        },
        dibuat: t, diubah: t,
      },
      "contoh-mie": {
        tanggal: tgl, waktu: "siang", beli: "Mie ayam", jenis: "", pembeli: "kelinci", warna: "krem", contoh: true,
        orang: {
          o1: { nama: "kucing", pesanan: "", jumlah: null, lunas: false, urut: 1 },
          o2: { nama: "macan", pesanan: "", jumlah: null, lunas: false, urut: 2 },
        },
        dibuat: t + 1, diubah: t + 1,
      },
    });
    lsSet(KEY + ".contoh", "1");
  } catch { /* browser nggak nyimpen, lewati contoh */ }
}

/* Sekali jalan di mode coba: alias "beruang" jadi "kucing", "jerapah" jadi "kelinci" (permintaan user).
   Ngubah yang beli, yang nitip, riwayat, dan pilihan "Aku yang mana?". Setelah jalan sekali, nggak ngapa-ngapain lagi. */
function gantiAliasSekali(KEY, baca, simpan) {
  const tanda = KEY + ".alias-kucing-kelinci";
  if (lsGet(tanda)) return;
  const peta = { beruang: "kucing", jerapah: "kelinci" };
  const ganti = (s) => peta[kunci(s)] || s;
  const gantiTeks = (t) => String(t || "").replace(/\b(beruang|jerapah)\b/gi, (m) => peta[m.toLowerCase()]);
  const semua = baca();
  for (const d of Object.values(semua)) {
    if (!d || typeof d !== "object") continue;
    if (d.pembeli) d.pembeli = ganti(d.pembeli);
    for (const o of Object.values(d.orang || {})) if (o && typeof o === "object") o.nama = ganti(o.nama);
    for (const r of Object.values(d.riwayat || {})) if (r && typeof r === "object") { r.oleh = ganti(r.oleh); r.teks = gantiTeks(r.teks); }
  }
  try { simpan(semua); lsSet(tanda, "1"); } catch { /* browser nggak nyimpen, coba lagi lain kali */ }
  if (peta[kunci(S.aku)]) setAku(peta[kunci(S.aku)]);
}
async function bukaStore() {
  const cfg = window.NITIP_CONFIG || {};
  if (cfg.firebase && cfg.firebase.projectId) {
    try { return await storeFirebase(cfg); }
    catch (e) {
      console.error("Nitip Yuk: Firebase gagal", e);
      S.catatanStore = "Gagal nyambung ke Firebase, jadi sementara catatan cuma kesimpen di browser ini. Cek config.js sama koneksi internetnya ya.";
      return storeLokal(cfg);
    }
  }
  const awal = await cariServer();
  return awal ? storeServer(cfg, awal) : storeLokal(cfg);
}
