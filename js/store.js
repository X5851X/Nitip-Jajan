"use strict";
/* Tempat nyimpen catatan. Dua mode dengan cara pakai yang sama:
   - firebase: dipakai bareng satu tim (kalau config.js sudah diisi)
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
    }
  }
  return storeLokal(cfg);
}
