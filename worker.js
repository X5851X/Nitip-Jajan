/* Nitip Yuk: server kecil buat nyimpen catatan bareng.
   File statis (index.html, style.css, js/) langsung disajikan Cloudflare, yang masuk ke sini cuma /api/*.
   Semua catatan disimpan di satu Durable Object, jadi semua browser lihat papan yang sama.

   GET    /api/titipan              semua catatan
   PUT    /api/titipan/:id          tulis catatan (baru, atau ganti seluruhnya)
   PATCH  /api/titipan/:id          ubah sebagian pakai jalur bertitik: { ubah: { "orang.o1.lunas": true }, hapus: ["riwayat.r1"] }
   DELETE /api/titipan/:id          hapus catatan
   POST   /api/titipan/:id/pindah   catatan lama dari browser, disimpan cuma kalau ID-nya belum ada
   GET    /api/live                 WebSocket, dikabarin tiap ada catatan yang berubah */

import { DurableObject } from "cloudflare:workers";

const MAKS_CATATAN = 5000;
const MAKS_BODY = 100000;
const POLA_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TERLARANG = new Set(["__proto__", "constructor", "prototype"]);
const KUNCI_CATATAN = new Set(["tanggal", "waktu", "beli", "jenis", "pembeli", "warna", "orang", "dibuat", "diubah", "contoh", "riwayat", "transfer",
  "biaya", "hargaPembeli", "bulat"]);
const KUNCI_ORANG = new Set(["nama", "pesanan", "jumlah", "lunas", "urut"]);
const KUNCI_REKENING = new Set(["nama", "jenis", "nomor"]);
const KUNCI_BIAYA = new Set(["nama", "nilai", "persen", "kurang", "bagi"]);
const KUNCI_RIWAYAT = new Set(["t", "oleh", "teks"]);

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const papan = env.PAPAN.get(env.PAPAN.idFromName("papan"));
    if (req.method === "GET" || req.method === "HEAD") return papan.fetch(req);
    // Isinya dibaca di sini dulu (ada batasnya), baru diterusin ke Papan.
    const isi = await bacaIsi(req);
    if (isi === null) return jawab({ ok: false, kode: "invalid", pesan: "Isinya kegedean" }, 413);
    return papan.fetch(new Request(req.url, { method: req.method, headers: { "content-type": "application/json" }, body: isi }));
  },
};

async function bacaIsi(req) {
  if (!req.body) return "";
  const baca = req.body.getReader(), potongan = [];
  let total = 0;
  for (;;) {
    const { done, value } = await baca.read();
    if (done) break;
    total += value.byteLength;
    if (total <= MAKS_BODY) potongan.push(value); // lewat batas: tetap dibaca sampai habis, tapi dibuang
  }
  if (total > MAKS_BODY) return null;
  const semua = new Uint8Array(total);
  let i = 0;
  for (const p of potongan) { semua.set(p, i); i += p.byteLength; }
  return new TextDecoder().decode(semua);
}

class Ditolak extends Error {
  constructor(status, kode, pesan) { super(pesan); this.status = status; this.kode = kode; }
}
const jawab = (isi, status = 200) => new Response(JSON.stringify(isi), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const peta = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const teks = (x, min, maks) => typeof x === "string" && x.length >= min && x.length <= maks;
const angka = (x) => typeof x === "number" && Number.isFinite(x);
const idValid = (k) => POLA_ID.test(k) && !TERLARANG.has(k);
const boleh = (x, cek) => x === undefined || cek(x);
const kunciAman = (o, daftar) => Object.keys(o).every((k) => daftar.has(k));

/* Sama kayak firestore.rules: cuma jaga bentuk & ukuran datanya. Balikin pesan kalau ada yang salah. */
function cekCatatan(d) {
  if (!peta(d)) return "Catatannya kosong";
  if (!kunciAman(d, KUNCI_CATATAN)) return "Ada isian yang nggak dikenal";
  if (!teks(d.tanggal, 10, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) return "Tanggalnya nggak valid";
  if (!teks(d.beli, 1, 60)) return "Beli apa-nya kosong atau kepanjangan";
  if (!teks(d.pembeli, 1, 30)) return "Yang beli kosong atau kepanjangan";
  const pendek = (x) => x === null || teks(x, 0, 30);
  if (!boleh(d.waktu, pendek) || !boleh(d.jenis, pendek) || !boleh(d.warna, pendek) || !boleh(d.contoh, (x) => typeof x === "boolean"))
    return "Ada isian yang formatnya salah";
  if (!angka(d.dibuat) || !angka(d.diubah)) return "Waktu catatannya nggak valid";
  if (!peta(d.orang) || Object.keys(d.orang).length > 40) return "Yang nitip maksimal 40 orang";
  for (const [k, o] of Object.entries(d.orang)) {
    if (!idValid(k) || !peta(o) || !kunciAman(o, KUNCI_ORANG) || !teks(o.nama, 0, 60)
      || !boleh(o.pesanan, (x) => teks(x, 0, 200)) || !boleh(o.jumlah, (x) => x === null || angka(x))
      || !boleh(o.lunas, (x) => typeof x === "boolean") || !boleh(o.urut, angka)) return "Data yang nitip nggak valid";
  }
  if (d.riwayat !== undefined) {
    if (!peta(d.riwayat) || Object.keys(d.riwayat).length > 60) return "Riwayatnya kebanyakan";
    for (const [k, r] of Object.entries(d.riwayat)) {
      if (!idValid(k) || !peta(r) || !kunciAman(r, KUNCI_RIWAYAT) || !angka(r.t)
        || !boleh(r.oleh, (x) => teks(x, 0, 60)) || !teks(r.teks, 0, 500)) return "Riwayatnya nggak valid";
    }
  }
  if (d.transfer !== undefined) {
    if (!Array.isArray(d.transfer) || d.transfer.length > 3) return "Info transfer maksimal 3";
    for (const r of d.transfer) {
      if (!peta(r) || !kunciAman(r, KUNCI_REKENING) || !boleh(r.nama, (x) => teks(x, 0, 40))
        || !boleh(r.jenis, (x) => teks(x, 0, 30)) || !boleh(r.nomor, (x) => teks(x, 0, 40))) return "Info transfernya nggak valid";
    }
  }
  if (d.biaya !== undefined) {
    if (!Array.isArray(d.biaya) || d.biaya.length > 8) return "Biaya tambahan maksimal 8";
    const bool = (x) => typeof x === "boolean";
    for (const b of d.biaya) {
      if (!peta(b) || !kunciAman(b, KUNCI_BIAYA) || !boleh(b.nama, (x) => teks(x, 0, 40)) || !angka(b.nilai) || b.nilai < 0 || b.nilai > 1e9
        || !boleh(b.persen, bool) || !boleh(b.kurang, bool) || !boleh(b.bagi, (x) => x === "rata" || x === "harga")) return "Biaya tambahannya nggak valid";
    }
  }
  if (!boleh(d.hargaPembeli, (x) => x === null || (angka(x) && x >= 0 && x <= 1e9))) return "Harga pesanan yang beli nggak valid";
  if (!boleh(d.bulat, (x) => [1, 100, 500, 1000].includes(x))) return "Pembulatannya nggak valid";
  if (JSON.stringify(d).length > 60000) return "Catatannya kegedean";
  return "";
}

/* Terapkan perubahan jalur bertitik ke salinan catatan. */
function terapkan(asli, ubah, hapus) {
  if (!peta(ubah) || !Array.isArray(hapus) || Object.keys(ubah).length + hapus.length > 200)
    throw new Ditolak(400, "invalid", "Perubahannya nggak kebaca");
  const d = structuredClone(asli);
  const induk = (jalur, buat) => {
    const ks = typeof jalur === "string" ? jalur.split(".") : [];
    if (!ks.length || ks.length > 3 || !ks.every(idValid)) throw new Ditolak(400, "invalid", "Jalur perubahannya nggak valid");
    let o = d;
    for (const k of ks.slice(0, -1)) {
      if (!peta(o[k])) { if (!buat) return null; o[k] = {}; }
      o = o[k];
    }
    return [o, ks[ks.length - 1]];
  };
  for (const jalur of hapus) { const x = induk(jalur, false); if (x) delete x[0][x[1]]; }
  for (const [jalur, nilai] of Object.entries(ubah)) { const [o, k] = induk(jalur, true); o[k] = nilai; }
  return d;
}

function uraikan(isi) {
  if (isi.length > MAKS_BODY) throw new Ditolak(413, "invalid", "Isinya kegedean");
  let j = null;
  try { j = JSON.parse(isi); } catch { /* bukan JSON */ }
  if (!peta(j)) throw new Ditolak(400, "invalid", "Isinya nggak kebaca");
  return j;
}

export class Papan extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.catatan = new Map(); // id -> { v, d }; v = nomor versi, biar browser tahu mana kabar yang paling baru
    this.versi = 0;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.versi = (await ctx.storage.get("versi")) || 0;
      for (const [k, x] of await ctx.storage.list({ prefix: "t:" })) this.catatan.set(k.slice(2), x);
    });
  }

  async fetch(req) {
    try {
      // Isi request selalu dihabisin dulu sebelum jawab, biar nggak ada yang nyangkut.
      const isi = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
      return await this.layani(req, isi);
    } catch (e) {
      if (e instanceof Ditolak) return jawab({ ok: false, kode: e.kode, pesan: e.message }, e.status);
      throw e;
    }
  }

  async layani(req, isi) {
    const bagian = new URL(req.url).pathname.split("/").filter(Boolean); // ["api", "titipan", id, "pindah"]
    const [, apa, id, ekor] = bagian;
    if (apa === "live" && bagian.length === 2) return this.live(req);
    if (apa !== "titipan" || bagian.length > 4) throw new Ditolak(404, "not-found", "Alamatnya nggak ada");
    if (!id) {
      if (req.method !== "GET") throw new Ditolak(405, "invalid", "Cuma bisa dibaca");
      const catatan = [];
      for (const [i, x] of this.catatan) catatan.push({ id: i, v: x.v, data: x.d });
      return jawab({ ok: true, versi: this.versi, catatan });
    }
    if (!idValid(id)) throw new Ditolak(400, "invalid", "ID catatannya nggak valid");
    if (ekor === "pindah" && req.method === "POST") {
      const body = uraikan(isi);
      if (this.catatan.has(id)) return jawab({ ok: true, id, baru: false });
      return this.simpan(id, body.data);
    }
    if (ekor) throw new Ditolak(404, "not-found", "Alamatnya nggak ada");
    if (req.method === "PUT") return this.simpan(id, uraikan(isi).data);
    if (req.method === "PATCH") {
      const body = uraikan(isi);
      const x = this.catatan.get(id);
      if (!x) throw new Ditolak(404, "not-found", "Catatannya udah dihapus");
      return this.simpan(id, terapkan(x.d, body.ubah === undefined ? {} : body.ubah, body.hapus === undefined ? [] : body.hapus));
    }
    if (req.method === "DELETE") return this.hapus(id);
    throw new Ditolak(405, "invalid", "Caranya nggak didukung");
  }

  async simpan(id, d) {
    const salah = cekCatatan(d);
    if (salah) throw new Ditolak(400, "invalid", salah);
    if (!this.catatan.has(id) && this.catatan.size >= MAKS_CATATAN)
      throw new Ditolak(507, "resource-exhausted", "Papannya udah penuh, hapus catatan lama dulu ya");
    const v = ++this.versi;
    this.catatan.set(id, { v, d });
    await this.ctx.storage.put({ ["t:" + id]: { v, d }, versi: v });
    this.siarkan({ id, v, data: d });
    return jawab({ ok: true, id, v, data: d });
  }

  async hapus(id) {
    if (!this.catatan.has(id)) return jawab({ ok: true, id, v: this.versi, data: null });
    const v = ++this.versi;
    this.catatan.delete(id);
    await Promise.all([this.ctx.storage.delete("t:" + id), this.ctx.storage.put("versi", v)]);
    this.siarkan({ id, v, data: null });
    return jawab({ ok: true, id, v, data: null });
  }

  live(req) {
    if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") throw new Ditolak(426, "invalid", "Ini khusus WebSocket");
    const pasangan = new WebSocketPair();
    this.ctx.acceptWebSocket(pasangan[1]);
    return new Response(null, { status: 101, webSocket: pasangan[0] });
  }

  siarkan(isi) {
    const pesan = JSON.stringify(isi);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(pesan); } catch { /* koneksinya udah putus */ }
    }
  }

  webSocketMessage() { /* "ping" udah dijawab otomatis, selain itu diabaikan */ }
  webSocketClose(ws) { try { ws.close(1000, "dadah"); } catch { /* udah ketutup */ } }
  webSocketError() {}
}
