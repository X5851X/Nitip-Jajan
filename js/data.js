"use strict";
/* State halaman dan semua hitungan: siapa nitip berapa, yang masih nyangkut, pesan reminder. */

const hariIni = new Date();
const S = {
  store: null, catatanStore: "", galat: "",
  docs: [], loaded: false,
  tglPilih: isoLokal(hariIni),
  bulan: [hariIni.getFullYear(), hariIni.getMonth()],
  aku: lsGet("nitipdong.aku") || "",
  editing: null,   // {id, lineId, value}    : isi nominal langsung di note
  bayar: null,     // {id, lineId, value}    : kotak ± "dibayar berapa" di note
  join: null,      // {id, nama, pesan, nom} : form "aku nitip juga"
  confirm: null,   // {kind:"hapus", id} | {kind:"lunasin", c, d}
  form: null,      // {mode:"baru"|"ubah", id, asal}
  salin: null,     // {orang, edited, ids}   : kotak copas pengingat lagi kebuka
  tiket: null,     // Set(id) tiket pilihan sendiri; null = otomatis 3 teratas
  riwayatBuka: new Set(), // id catatan yang riwayatnya lagi dibuka
  tandaOk: false,  // diisi jagaTanda(); tanpa ini web nggak nampilin apa-apa
  bukaCatatan: "",  // id catatan dari link (#tanggal/id) yang mau langsung disorot pas data masuk
  fokus: null,     // {id, fk}
  baruId: null, scrollTo: null, rebuilding: false, unsub: null,
  foto: [],        // foto yang ditempel di papan: [{id, data}]
  fotoNaik: [],    // foto yang lagi dikirim: [{id, tanggal, url, file}]
  fotoLokal: new Map(), // id -> alamat sementara, biar foto yang baru dikirim nggak perlu diunduh lagi
  fotoKenal: new Set(), fotoBaru: new Set(), // buat animasi foto "lagi jadi" pas baru nongol
  fotoBuka: null,  // id foto yang lagi dibuka gede
};
const bolehNulis = () => !!S.store && !S.galat;
function setAku(nama) { S.aku = rapikan(nama); lsSet("nitipdong.aku", S.aku); }
const cariDoc = (id) => S.docs.find((d) => d.id === id);

/* Data bersama itu input orang lain: selalu dibaca hati-hati. */
const angka = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
/* Baris yang nitip. `harga` = nominal yang diketik, `jumlah` = tagihan akhirnya (harga + bagian biaya tambahan),
   `sisa` = yang masih harus dibayar, `lunas` = udah beres (termasuk kalau ketutup kelebihan bayar di catatan lain).
   `lunasAsli` & `bayar` = yang beneran kesimpen, buat ditulis balik. */
function baris(d) {
  const o = d && d.orang && typeof d.orang === "object" && !Array.isArray(d.orang) ? d.orang : {};
  const ls = Object.entries(o)
    .filter(([, v]) => v && typeof v === "object" && rapikan(v.nama))
    .map(([id, v]) => ({
      id, nama: rapikan(v.nama).slice(0, 30), pesanan: rapikan(v.pesanan).slice(0, 80),
      harga: angka(v.jumlah), jumlah: angka(v.jumlah), lunas: v.lunas === true, lunasAsli: v.lunas === true, bayar: angka(v.bayar), urut: Number(v.urut) || 0,
    }))
    .sort((a, b) => a.urut - b.urut || a.id.localeCompare(b.id));
  const tg = hitungTagihan(d);
  if (tg) for (const l of ls) if (tg.tagihan.has(l.id)) l.jumlah = tg.tagihan.get(l.id);
  const buku = bukuBayar().perCatatan.get(d);
  for (const l of ls) {
    const b = buku && buku.get(l.id);
    if (b) { l.masuk = b.masuk; l.ketutup = b.ketutup; l.sisa = b.sisa; l.kurangLalu = b.kurangLalu; l.simpanan = b.pasangan.simpanan; }
    else { // bukan catatan di papan (form) atau punya yang beli sendiri
      l.masuk = l.bayar != null ? l.bayar : l.lunasAsli && l.jumlah != null ? l.jumlah : 0;
      l.ketutup = 0; l.kurangLalu = 0; l.simpanan = 0;
      l.sisa = l.jumlah == null ? null : Math.max(0, l.jumlah - l.masuk);
    }
    if (l.jumlah > 0) l.lunas = l.sisa === 0;
  }
  return ls;
}

/* ---------- buku bayar: kelebihan & kekurangan bayar ----------
   Uang yang masuk (`bayar`, atau tanda lunas = pas sama tagihan) dicatat per baris, dan dihitung per pasangan yang nitip → yang beli.
   Tiap baris makan uangnya sendiri dulu, lebihnya nutup kekurangan dari catatan paling lama, sisanya jadi simpanan di yang beli
   dan otomatis kepotong ke tagihan berikutnya. Kalau nggak ada yang pakai `bayar`, hasilnya sama persis kayak tanda lunas biasa. */
function bagiBayar(list) {
  let lebih = 0;
  for (const b of list) {
    b.kebayar = b.tagihan == null ? 0 : Math.min(b.masuk, b.tagihan);
    lebih += b.masuk - b.kebayar;
  }
  for (const b of list) {
    if (b.tagihan == null) { b.ketutup = 0; b.sisa = null; continue; }
    const kurang = b.tagihan - b.kebayar;
    b.ketutup = Math.min(kurang, lebih);
    lebih -= b.ketutup;
    b.sisa = kurang - b.ketutup;
  }
  return lebih;
}
let bukuCache = null;
function bukuBayar() {
  if (bukuCache && bukuCache.docs === S.docs) return bukuCache;
  const pasangan = new Map(), perCatatan = new WeakMap();
  const urut = S.docs.slice().sort((a, b) => String(a.data.tanggal || "").localeCompare(String(b.data.tanggal || ""))
    || urutWaktu(a.data.waktu) - urutWaktu(b.data.waktu) || (Number(a.data.dibuat) || 0) - (Number(b.data.dibuat) || 0));
  for (const { id, data: d } of urut) {
    const pb = rapikan(d.pembeli), pk = kunci(pb);
    if (!pk) continue;
    const o = d.orang && typeof d.orang === "object" && !Array.isArray(d.orang) ? d.orang : {};
    const tg = hitungTagihan(d), m = new Map();
    perCatatan.set(d, m);
    for (const [lineId, v] of Object.entries(o)) {
      if (!v || typeof v !== "object" || !rapikan(v.nama)) continue;
      const dk = kunci(v.nama);
      if (dk === pk) continue;
      const harga = angka(v.jumlah), tagihan = tg && tg.tagihan.has(lineId) ? tg.tagihan.get(lineId) : harga, bayar = angka(v.bayar);
      let p = pasangan.get(dk + "\u0000" + pk);
      if (!p) { p = { key: dk, pk, nama: "", pembeli: "", baris: [], simpanan: 0 }; pasangan.set(dk + "\u0000" + pk, p); }
      p.nama = rapikan(v.nama); p.pembeli = pb;
      const b = { docId: id, lineId, tagihan, masuk: bayar != null ? bayar : v.lunas === true && tagihan != null ? tagihan : 0, pasangan: p };
      p.baris.push(b);
      m.set(lineId, b);
    }
  }
  const simpanan = [];
  for (const p of pasangan.values()) {
    p.simpanan = bagiBayar(p.baris);
    let lalu = 0;
    for (const b of p.baris) {
      b.kurangLalu = lalu;
      if (b.masuk > 0 && b.sisa > 0) lalu += b.sisa; // kurangan dari yang udah sempat bayar sebagian
    }
    if (p.simpanan > 0) simpanan.push(p);
  }
  simpanan.sort((a, b) => b.simpanan - a.simpanan || a.nama.localeCompare(b.nama));
  bukuCache = { docs: S.docs, perCatatan, simpanan };
  return bukuCache;
}
/* Tampilan satu catatan juga tergantung catatan lain (kurangan & simpanan), jadi ikut jadi kunci cache-nya. */
function sigBuku(d) {
  const m = bukuBayar().perCatatan.get(d);
  if (!m) return "";
  let s = "";
  for (const [id, b] of m) s += `${id}:${b.sisa},${b.ketutup},${b.kurangLalu},${b.pasangan.simpanan};`;
  return s;
}
/* Kalau baris ini dibayar `x`, gimana hasilnya? Buat tulisan di kotak ±, sebelum disimpan. */
function simulasiBayar(d, lineId, x) {
  const m = bukuBayar().perCatatan.get(d), asli = m && m.get(lineId);
  if (!asli) return null;
  const p = asli.pasangan, i = p.baris.indexOf(asli);
  const list = p.baris.map((b) => ({ tagihan: b.tagihan, masuk: b === asli ? x : b.masuk }));
  const simpanan = bagiBayar(list);
  const lalu = list.slice(0, i).reduce((s, b) => s + (b.masuk > 0 && b.sisa > 0 ? b.sisa : 0), 0);
  return { simpanan, ini: list[i], lalu, pembeli: p.pembeli };
}
function teksHarusBayar(d, lineId) {
  const s = simulasiBayar(d, lineId, 0);
  if (!s) return "";
  const harus = s.ini.sisa + s.lalu;
  if (s.lalu > 0) return `Harusnya ${rp(harus)}: ${rp(s.ini.sisa)} + kurangan sebelumnya ${rp(s.lalu)}.`;
  if (s.ini.ketutup > 0) return `Harusnya ${rp(harus)}, udah kepotong simpanan ${rp(s.ini.ketutup)}.`;
  return `Harusnya ${rp(harus)}.`;
}
function ramalBayar(d, lineId, x) {
  const s = simulasiBayar(d, lineId, x);
  if (!s) return { teks: "", jenis: "" };
  if (s.ini.sisa > 0) return { teks: `Kurang ${rp(s.ini.sisa + s.lalu)}, ntar nyangkut buat dibayar nanti.`, jenis: "kurang" };
  if (s.simpanan > 0) return { teks: `Lebih ${rp(s.simpanan)}, jadi simpanan di ${s.pembeli}.`, jenis: "lebih" };
  if (s.lalu > 0) return { teks: `Pas buat catatan ini, kurangan sebelumnya ${rp(s.lalu)} masih nyangkut.`, jenis: "kurang" };
  if (x > s.ini.tagihan) return { teks: `Pas! Lebihnya ${rp(x - s.ini.tagihan)} nutup tagihan lain.`, jenis: "ok" };
  return { teks: "Pas!", jenis: "ok" };
}
/* Tulisan di kotak ± dari isi kolomnya. */
function ramalTeks(d, lineId, nilai) {
  const x = parseNominal(nilai);
  if (Number.isNaN(x)) return { teks: "Nominalnya gak kebaca.", jenis: "kurang" };
  return x ? ramalBayar(d, lineId, x) : { teks: "", jenis: "" };
}

/* ---------- biaya tambahan: ongkir, PPN, diskon, dll ----------
   Persen & "sesuai harga" dibagi sebanding harga pesanan, "rata" dibagi sama rata per orang.
   Kalau pesanan yang beli sendiri diisi, dia ikut kebagian juga (biar cocok sama nota). Tagihan dibulatin ke atas (default Rp100).
   Selama masih ada yang nominalnya kosong, biaya belum dibagi (bagiannya tergantung semua harga). */
const MAKS_BIAYA = 8;
const BULATAN = [100, 500, 1000, 1];
function daftarBiaya(d) {
  const a = d && Array.isArray(d.biaya) ? d.biaya : [];
  return a.filter((b) => b && typeof b === "object" && angka(b.nilai) > 0)
    .slice(0, MAKS_BIAYA)
    .map((b) => ({
      nama: rapikan(b.nama).slice(0, 40) || (b.kurang === true ? "Potongan" : "Biaya lain"),
      nilai: b.nilai, persen: b.persen === true, kurang: b.kurang === true, bagi: b.bagi === "rata" ? "rata" : "harga",
    }));
}
const bulatanCatatan = (d) => (BULATAN.includes(d && d.bulat) ? d.bulat : 100);
function hitungTagihan(d) {
  const biaya = daftarBiaya(d);
  if (!biaya.length) return null;
  const o = d.orang && typeof d.orang === "object" && !Array.isArray(d.orang) ? d.orang : {};
  const pk = kunci(d.pembeli), ikut = [];
  let hp = angka(d.hargaPembeli) || 0, tunggu = false;
  for (const [id, v] of Object.entries(o)) {
    if (!v || typeof v !== "object" || !rapikan(v.nama)) continue;
    const h = angka(v.jumlah);
    if (kunci(v.nama) === pk) { hp += h || 0; continue; } // "punya sendiri" = pesanan yang beli
    if (h == null) tunggu = true;
    else if (h > 0) ikut.push([id, h]); // 0 = ditraktir, nggak ikut nanggung
  }
  const subtotal = ikut.reduce((s, [, h]) => s + h, 0), dasar = subtotal + hp, n = ikut.length + (hp > 0 ? 1 : 0);
  const rinci = biaya.map((b) => ({ ...b, rp: b.persen ? (dasar * b.nilai) / 100 : b.nilai }));
  const out = { biaya: rinci, subtotal, hp, dasar, tunggu, unit: bulatanCatatan(d), tagihan: new Map(), bagianPembeli: hp };
  if (tunggu || !subtotal) return out;
  const bagian = (h) => rinci.reduce((s, b) => s + (b.kurang ? -1 : 1) * (b.persen || b.bagi === "harga" ? (b.rp * h) / dasar : b.rp / n), 0);
  for (const [id, h] of ikut) out.tagihan.set(id, Math.ceil(Math.max(0, Math.round(h + bagian(h))) / out.unit) * out.unit);
  // Total bayar = total di nota. Bagian yang beli = nota − yang ditagih, jadi selalu pas: ditagih + bagian yang beli = total bayar.
  out.nota = Math.max(0, Math.round(dasar + rinci.reduce((s, b) => s + (b.kurang ? -1 : 1) * b.rp, 0)));
  out.ditagih = [...out.tagihan.values()].reduce((s, x) => s + x, 0);
  if (hp > 0) out.bagianPembeli = Math.max(0, out.nota - out.ditagih);
  return out;
}
/* Buat pesan reminder: "Udah termasuk Ongkir, PPN, Diskon." */
function ketBiaya(d) {
  const tg = hitungTagihan(d);
  return tg && tg.tagihan.size ? `Udah termasuk ${tg.biaya.map((b) => b.nama).join(", ")}.` : "";
}
function jenisNote(d) {
  if (jenisValid(d.jenis)) return d.jenis;
  return deteksi(d.beli) || baris(d).map((l) => deteksi(l.pesanan)).find(Boolean) || "lainnya";
}
function hitung(d) {
  const ls = baris(d), pk = kunci(d.pembeli);
  let total = 0, balik = 0, nyangkut = 0, pending = 0, orangNyangkut = 0;
  for (const l of ls) {
    if (kunci(l.nama) === pk) continue;
    if (l.jumlah == null) { pending++; continue; }
    total += l.jumlah;
    balik += l.jumlah - l.sisa;
    if (l.sisa > 0) { nyangkut += l.sisa; orangNyangkut++; }
  }
  const st = !ls.length ? "kosong" : pending ? "pending" : nyangkut > 0 ? "owe" : "paid";
  return { ls, total, balik, nyangkut, pending, orangNyangkut, st };
}
const urutWaktu = (k) => { const i = WAKTU.findIndex((w) => w.k === k); return i < 0 ? 9 : i; };
function catatanPerTanggal() {
  const m = new Map();
  for (const d of S.docs) {
    const t = parseTgl(d.data.tanggal) ? d.data.tanggal : "";
    if (!m.has(t)) m.set(t, []);
    m.get(t).push(d);
  }
  for (const list of m.values()) list.sort((a, b) =>
    urutWaktu(a.data.waktu) - urutWaktu(b.data.waktu) || (Number(a.data.dibuat) || 0) - (Number(b.data.dibuat) || 0));
  return m;
}
function namaDikenal() {
  const m = new Map();
  const tambah = (nama) => {
    const k = kunci(nama); if (!k) return;
    const x = m.get(k) || { nama: rapikan(nama), key: k, n: 0 };
    x.n++; x.nama = rapikan(nama); m.set(k, x);
  };
  const lama = S.docs.slice().sort((a, b) => (Number(a.data.dibuat) || 0) - (Number(b.data.dibuat) || 0));
  for (const { data } of lama) { tambah(data.pembeli); for (const l of baris(data)) tambah(l.nama); }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nama.localeCompare(b.nama));
}
function rekap() {
  const per = new Map(), pend = [], owed = new Map();
  const urut = S.docs.slice().sort((a, b) => String(a.data.tanggal || "").localeCompare(String(b.data.tanggal || "")));
  for (const { id, data } of urut) {
    const pb = rapikan(data.pembeli), pk = kunci(pb);
    if (!pk) continue;
    const s = hitung(data);
    if (s.pending) pend.push({ id, data, n: s.pending });
    for (const l of s.ls) {
      const dk = kunci(l.nama);
      if (dk === pk || l.jumlah == null || !l.sisa) continue;
      let c = per.get(pk);
      if (!c) { c = { nama: pb, key: pk, total: 0, debitur: new Map() }; per.set(pk, c); }
      let x = c.debitur.get(dk);
      if (!x) { x = { nama: l.nama, key: dk, total: 0, items: [] }; c.debitur.set(dk, x); }
      x.total += l.sisa;
      x.items.push({ docId: id, lineId: l.id, jumlah: l.sisa, beli: rapikan(data.beli) || "jajan", pesanan: l.pesanan, tanggal: data.tanggal });
      c.total += l.sisa;
      owed.set(dk + "\u0000" + pk, (owed.get(dk + "\u0000" + pk) || 0) + l.sisa);
    }
  }
  return { per: [...per.values()].sort((a, b) => b.total - a.total), pend, owed };
}

/* ---------- pesan reminder buat ditempel di grup ---------- */
const ketItem = (i) => (i.pesanan ? `${i.pesanan}, ` : "") + `${i.beli} ${tglPendek(i.tanggal)}`;
const labelCatatan = (d) => `${rapikan(d.beli) || "Jajan"} ${tglPendek(d.tanggal)}`;
const kapanCatatan = (d) => tglPendek(d.tanggal) + (waktuValid(d.waktu) ? `, ${labelWaktu(d.waktu).toLowerCase()}` : "");
/* Yang masih perlu ditagih di satu catatan: belum lunas, atau nominalnya belum diitung. */
function belumBeres(d) { const pk = kunci(d.pembeli); return baris(d).filter((l) => kunci(l.nama) !== pk && !l.lunas && l.jumlah !== 0); }
const isiBaris = (l) => (l.jumlah == null ? "belum diitung" : rp(l.sisa) + (l.sisa < l.jumlah ? ` (sisa dari ${rp(l.jumlah)})` : "")) + (l.pesanan ? ` (${l.pesanan})` : "");
/* "Transfer ke mana?": maks 3 rekening/e-wallet per catatan, isinya ditulis bebas (BCA, DANA, GoPay, dst). */
const MAKS_REKENING = 3;
function rekening(d) {
  const a = d && Array.isArray(d.transfer) ? d.transfer : [];
  return a.filter((r) => r && typeof r === "object")
    .map((r) => ({ nama: rapikan(r.nama).slice(0, 40), jenis: rapikan(r.jenis).slice(0, 30), nomor: rapikan(r.nomor).slice(0, 40) }))
    .filter((r) => r.jenis || r.nomor)
    .slice(0, MAKS_REKENING);
}
const teksRekening = (r) => [r.jenis, r.nomor].filter(Boolean).join(" ") + (r.nama ? ` a.n. ${r.nama}` : "");

/* Tiket = catatan yang masih ada tagihannya (belum lunas / belum diitung).
   Urut tanggal dari yang paling lama, terus pagi > siang > sore. */
function daftarTiket() {
  return S.docs.map((d) => ({ ...d, s: hitung(d.data) }))
    .filter((t) => t.s.st === "owe" || t.s.st === "pending")
    .sort((a, b) => String(a.data.tanggal || "").localeCompare(String(b.data.tanggal || ""))
      || urutWaktu(a.data.waktu) - urutWaktu(b.data.waktu)
      || (Number(a.data.dibuat) || 0) - (Number(b.data.dibuat) || 0));
}
/* Maks 3 tiket yang tampil: pilihan sendiri kalau ada, kalau nggak 3 teratas. */
const MAKS_TIKET = 3;
function tiketTampil(semua) {
  if (semua.length <= MAKS_TIKET) return semua;
  if (S.tiket) return semua.filter((t) => S.tiket.has(t.id));
  return semua.slice(0, MAKS_TIKET);
}
/* Orang yang masih punya titipan belum beres di tiket-tiket ini, buat pilihan "japri". */
function orangDiTiket(list) {
  const m = new Map();
  for (const t of list) for (const l of belumBeres(t.data)) if (!m.has(kunci(l.nama))) m.set(kunci(l.nama), l.nama);
  return [...m].map(([key, nama]) => ({ key, nama })).sort((a, b) => a.nama.localeCompare(b.nama));
}
/* Nomor urut catatan (buat "Tiket 03"), dari yang paling lama dibuat. */
function nomorCatatan() {
  const m = new Map();
  S.docs.slice().sort((a, b) => (Number(a.data.dibuat) || 0) - (Number(b.data.dibuat) || 0) || a.id.localeCompare(b.id))
    .forEach((d, i) => m.set(d.id, i + 1));
  return m;
}

/* ---------- riwayat per catatan: siapa ngapain, kapan ---------- */
/* Disimpan di catatannya sendiri sebagai map { rXXX: {t, oleh, teks} }, jadi aman ditambah barengan. */
const MAKS_RIWAYAT = 40;
const idRiwayat = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function entriRiwayat(teks, oleh) {
  return { t: Date.now(), oleh: rapikan(oleh == null ? S.aku : oleh).slice(0, 30), teks: rapikan(teks).slice(0, 240) };
}
function bacaRiwayat(d) {
  const o = d && d.riwayat && typeof d.riwayat === "object" && !Array.isArray(d.riwayat) ? d.riwayat : {};
  return Object.entries(o)
    .filter(([, e]) => e && typeof e === "object" && Number.isFinite(Number(e.t)) && rapikan(e.teks))
    .map(([id, e]) => ({ id, t: Number(e.t), oleh: rapikan(e.oleh).slice(0, 30), teks: rapikan(e.teks).slice(0, 240) }))
    .sort((a, b) => b.t - a.t);
}
/* Tambah satu baris riwayat ke paket update bertitik, sekalian buang yang paling lama kalau kebanyakan. */
function tambahRiwayat(paths, d, teks, oleh) {
  paths["riwayat." + idRiwayat()] = entriRiwayat(teks, oleh);
  for (const e of bacaRiwayat(d).slice(MAKS_RIWAYAT - 1)) paths["riwayat." + e.id] = HAPUS_FIELD;
  return paths;
}
/* Riwayat lama (dipangkas) + satu baris baru, buat simpan penuh pas edit. */
function riwayatPlus(d, teks, oleh) {
  const out = {};
  for (const e of bacaRiwayat(d).slice(0, MAKS_RIWAYAT - 1)) out[e.id] = { t: e.t, oleh: e.oleh, teks: e.teks };
  if (teks) out[idRiwayat()] = entriRiwayat(teks, oleh);
  return out;
}
/* Apa aja yang berubah pas catatan diedit, ditulis singkat buat riwayat. */
function bedaCatatan(lama, baru) {
  const out = [];
  if (rapikan(lama.beli) !== baru.beli) out.push(`ganti jajanan jadi ${baru.beli}`);
  if (kunci(lama.pembeli) !== kunci(baru.pembeli)) out.push(`ganti yang beli jadi ${baru.pembeli}`);
  if (lama.tanggal !== baru.tanggal) out.push(`pindah ke ${tglPendek(baru.tanggal)}`);
  if ((lama.waktu || "") !== (baru.waktu || "")) out.push(`waktu jadi ${(labelWaktu(baru.waktu) || "-").toLowerCase()}`);
  if ((lama.jenis || "") !== (baru.jenis || "")) out.push("ganti stiker");
  if ((lama.warna || "") !== (baru.warna || "")) out.push("ganti warna kertas");
  const L = new Map(baris(lama).map((l) => [kunci(l.nama), l]));
  const B = new Map(Object.values(baru.orang || {}).map((l) => [kunci(l.nama), l]));
  for (const [k, l] of B) {
    const o = L.get(k);
    if (!o) { out.push(`nambah ${l.nama}`); continue; }
    if (o.harga !== l.jumlah) out.push(l.jumlah == null ? `ngosongin nominal ${l.nama}` : `nominal ${l.nama} jadi ${rp(l.jumlah)}`);
    if (o.pesanan !== rapikan(l.pesanan)) out.push(`pesanan ${l.nama} jadi “${rapikan(l.pesanan) || "-"}”`);
    if (o.lunasAsli !== !!l.lunas) out.push(l.lunas ? `${l.nama} lunas` : `${l.nama} batal lunas`);
  }
  for (const [k, o] of L) if (!B.has(k)) out.push(`hapus ${o.nama}`);
  const sigBiaya = (d) => JSON.stringify([daftarBiaya(d), angka(d.hargaPembeli) || 0, bulatanCatatan(d)]);
  if (sigBiaya(lama) !== sigBiaya(baru)) {
    const bl = daftarBiaya(lama), bb = daftarBiaya(baru);
    out.push(!bl.length ? `nambah ${bb.map((b) => b.nama).join(", ")}` : !bb.length ? "hapus biaya tambahan" : "ganti biaya tambahan");
  }
  const tfLama = rekening(lama).map(teksRekening).join("|"), tfBaru = rekening(baru).map(teksRekening).join("|");
  if (tfLama !== tfBaru) out.push(!tfLama ? "nambah info transfer" : !tfBaru ? "hapus info transfer" : "ganti info transfer");
  return out.join(", ");
}
/* Reminder satu sticky note. Kalau belum ada yang nitip, jadinya ajakan nitip. */
function pesanCatatan(id) {
  const doc = cariDoc(id);
  if (!doc) return "";
  const d = doc.data, s = hitung(d);
  const pb = rapikan(d.pembeli) || "yang beli", beli = rapikan(d.beli) || "jajan";
  const kapan = tglPanjang(d.tanggal) + (waktuValid(d.waktu) ? `, ${labelWaktu(d.waktu).toLowerCase()}` : "");
  const link = linkCatatan(id, d);
  if (s.st === "kosong") return `${pb} mau beli ${beli} nih (${kapan}). Yang mau nitip, cus masukin nama di Nitip Yuk! 🙌\n${link}`;
  const belum = belumBeres(d);
  if (!belum.length) return `${beli} (${kapan}) dibeliin ${pb}: udah lunas semua. Makasih, gaes!\n${link}`;
  const out = ["Reminder titipan jajan 🙏", `${beli} · ${kapan}`, `Yang beli: ${pb}`, ""];
  for (const l of belum) out.push(`- ${l.nama}: ${isiBaris(l)}`);
  if (ketBiaya(d)) out.push(ketBiaya(d));
  out.push("");
  if (s.nyangkut > 0) out.push(`Total yang belum balik ${rp(s.nyangkut)}, transfer ke ${pb} ya.`);
  for (const r of rekening(d)) out.push(`💳 ${teksRekening(r)}`);
  if (s.pending) out.push("Yang belum diitung, nominalnya nyusul ya.");
  out.push("Makasih yaa!", `Cek di sini ya: ${link}`);
  return out.join("\n");
}
/* Link langsung ke satu catatan (#tanggal/id). Ngikutin alamat web yang lagi dibuka, jadi nanti otomatis link Vercel. */
function linkCatatan(id, d) {
  const dasar = typeof location !== "undefined" ? location.origin + location.pathname : "";
  return `${dasar}#${d.tanggal}/${id}`;
}
/* Reminder dari beberapa catatan yang dicentang. `dk` diisi = cuma buat satu orang (japri). */
function pesanGabungan(ids, dk) {
  const docs = ids.map(cariDoc).filter(Boolean).sort((a, b) =>
    String(a.data.tanggal || "").localeCompare(String(b.data.tanggal || "")) || urutWaktu(a.data.waktu) - urutWaktu(b.data.waktu));
  if (!docs.length) return "";
  if (dk) return pesanJapri(docs, dk);
  if (docs.length === 1) return pesanCatatan(docs[0].id);
  const out = ["Reminder titipan jajan nih 🙏", ""];
  let adaPending = false;
  for (const { id, data: d } of docs) {
    const s = hitung(d), pb = rapikan(d.pembeli) || "?";
    out.push(`${rapikan(d.beli) || "Jajan"} · ${kapanCatatan(d)} · yang beli ${pb}`);
    const belum = belumBeres(d);
    if (s.st === "kosong") out.push("Belum ada yang nitip. Yang mau, cus masukin nama!");
    else if (!belum.length) out.push("Udah lunas semua.");
    else {
      for (const l of belum) out.push(`- ${l.nama}: ${isiBaris(l)}`);
      if (ketBiaya(d)) out.push(ketBiaya(d));
      if (s.nyangkut > 0) out.push(`Transfer ke ${pb} ya, total ${rp(s.nyangkut)}.`);
      for (const r of rekening(d)) out.push(`💳 ${teksRekening(r)}`);
      if (s.pending) adaPending = true;
    }
    out.push(`Link: ${linkCatatan(id, d)}`, "");
  }
  if (adaPending) out.push("Yang belum diitung, nominalnya nyusul ya.");
  out.push("Makasih yaa! Yang udah transfer, skip aja 🙏");
  return out.join("\n");
}
function pesanJapri(docs, dk) {
  const kenal = namaDikenal().find((n) => n.key === dk);
  const nama = kenal ? kenal.nama : dk;
  const isi = [], kePembeli = new Set(), rek = [];
  let total = 0, adaPending = false;
  for (const { id, data: d } of docs) {
    const l = belumBeres(d).find((x) => kunci(x.nama) === dk);
    if (!l) continue;
    const pb = rapikan(d.pembeli) || "?";
    isi.push(`- ${labelCatatan(d)} (dibeliin ${pb}): ${isiBaris(l)}`);
    if (ketBiaya(d)) isi.push(`  ${ketBiaya(d)}`);
    isi.push(`  ${linkCatatan(id, d)}`);
    for (const r of rekening(d)) rek.push([pb, teksRekening(r)]);
    if (l.jumlah == null) adaPending = true;
    else { total += l.sisa; kePembeli.add(pb); }
  }
  if (!isi.length) return `Hai ${nama}, di catatan yang dipilih gak ada titipan kamu yang nyangkut. Aman!`;
  const out = [`Hai ${nama}, mau ngingetin titipan jajan nih 🙏`, "", ...isi, ""];
  if (total) out.push(kePembeli.size === 1 ? `Transfer ke ${[...kePembeli][0]} ya, total ${rp(total)}.` : `Total ${rp(total)}, transfer ke masing-masing yang beli ya.`);
  const satuPembeli = new Set(rek.map(([pb]) => kunci(pb))).size <= 1;
  for (const t of new Set(rek.map(([pb, x]) => (satuPembeli ? x : `${pb}: ${x}`)))) out.push(`💳 ${t}`);
  if (adaPending) out.push("Yang belum diitung, nominalnya nyusul ya.");
  out.push("Makasih yaa!");
  return out.join("\n");
}

/* ---------- tulis: satu tulisan per catatan dalam satu waktu ---------- */
const antre = new Map();
function tulis(id, fn) {
  const prev = antre.get(id) || Promise.resolve();
  const p = prev.catch(() => {}).then(async () => {
    try { return await fn(); }
    catch (e) {
      if (e && e.code === "unavailable") { await new Promise((r) => setTimeout(r, 500 + Math.random() * 800)); return fn(); }
      throw e;
    }
  });
  antre.set(id, p);
  p.catch(() => {}).finally(() => { if (antre.get(id) === p) antre.delete(id); });
  return p;
}
async function aman(id, fn, okMsg) {
  try { await tulis(id, fn); if (okMsg) toast(okMsg); return true; }
  catch (e) { gagal(e); return false; }
}
function gagal(e) {
  console.warn("Nitip Yuk: gagal nyimpen", e);
  const c = e && (e.code || e.name);
  if (c === "permission-denied") toast("Firebase nolak perubahannya. Cek rules Firestore-nya (ada di README).");
  else if (c === "resource-exhausted") toast("Penyimpanannya lagi penuh atau kuota hari ini abis. Coba lagi nanti ya.");
  else if (c === "not-found") toast("Yah, catatan ini udah dihapus orang lain.");
  else if (c === "invalid") toast("Isinya ditolak server, mungkin ada yang kepanjangan. Cek lagi ya.");
  else if (c === "QuotaExceededError") toast("Memori browser penuh. Hapus catatan lama dulu ya.");
  else toast("Gagal nyimpen nih. Cek koneksi terus coba lagi ya.");
}
let rowSeq = 0;
const idBaru = () => "o" + Date.now().toString(36) + (rowSeq++).toString(36) + Math.random().toString(36).slice(2, 5);
