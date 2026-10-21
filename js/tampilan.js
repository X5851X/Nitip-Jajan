"use strict";
/* Semua yang ngegambar ke layar: kalender, papan sticky notes, tiket "yang masih nyangkut", ringkasan "aku", kotak copas pengingat. */

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 3000);
}
/* Status cuma nongol kalau ada masalah koneksi. */
function setStatus(state, text) {
  const el = $("#status");
  el.dataset.state = state;
  $("#status-text").textContent = text;
  el.hidden = state !== "error";
}
function setNotice(...isi) { const n = $("#notice"); n.replaceChildren(...isi); n.hidden = !isi.length; }

function renderSemua() {
  if (!S.tandaOk) return;
  renderNama();
  renderKalender();
  renderPapan();
  renderRekap();
}

/* Pindahin elemen ke urutan baru tanpa ngebuang yang nggak berubah (fokus & ketikan aman). */
function reconcile(parent, els) {
  S.rebuilding = true;
  try {
    let prev = null;
    for (const el of els) {
      const want = prev ? prev.nextSibling : parent.firstChild;
      if (want !== el) parent.insertBefore(el, want);
      prev = el;
    }
    while (prev && prev.nextSibling) parent.removeChild(prev.nextSibling);
  } finally { S.rebuilding = false; }
}
function pulihkanFokus(root, sel, fokus) {
  if (!fokus) return false;
  const box = root.querySelector(sel(fokus.id));
  const el = box && $$("[data-fk]", box).find((e) => e.dataset.fk === fokus.fk);
  if (el && document.activeElement !== el) {
    el.focus({ preventScroll: true });
    if (el.tagName === "INPUT" && el.classList.contains("nom-edit")) el.select();
  }
  return !!el || !box;
}

/* ---------- nama: datalist, pilihan "aku" ---------- */
function renderNama() {
  const names = namaDikenal();
  $("#dl-nama").replaceChildren(...names.map((n) => h("option", { value: n.nama })));
  const sel = $("#aku-select");
  const opts = [h("option", { value: "" }, "Pilih dulu ya")];
  const ada = new Set();
  for (const n of [...names].sort((a, b) => a.nama.localeCompare(b.nama))) { opts.push(h("option", { value: n.nama }, n.nama)); ada.add(n.key); }
  if (S.aku && !ada.has(kunci(S.aku))) opts.push(h("option", { value: S.aku }, S.aku));
  const sig = opts.map((o) => o.value).join("\u0000");
  if (sel.dataset.sig !== sig) { sel.replaceChildren(...opts); sel.dataset.sig = sig; }
  const cocok = [...sel.options].find((o) => kunci(o.value) === kunci(S.aku));
  sel.value = cocok ? cocok.value : "";
}

/* ---------- kalender ---------- */
function renderKalender() {
  const [y, m] = S.bulan;
  $("#kal-judul").textContent = `${BULAN[m]} ${y}`;
  const grid = $("#kal-grid");
  const fokusTgl = grid.contains(document.activeElement) ? document.activeElement.dataset.tgl : null;
  const per = S.loaded ? catatanPerTanggal() : new Map();
  const today = isoLokal(new Date());
  const awal = (new Date(y, m, 1).getDay() + 6) % 7; // minggu mulai Senin
  const jml = new Date(y, m + 1, 0).getDate();
  const sel = [];
  for (let i = 0; i < awal; i++) sel.push(h("div", { class: "kal-sel luar", "aria-hidden": "true" }));
  for (let d = 1; d <= jml; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const notes = per.get(iso) || [];
    const belum = notes.some((n) => { const st = hitung(n.data).st; return st === "owe" || st === "pending"; });
    const libur = isLibur(iso);
    sel.push(h("button", {
      type: "button", "data-tgl": iso, tabindex: iso === S.tglPilih ? "0" : "-1",
      class: "kal-sel" + (iso === today ? " hari-ini" : "") + (iso === S.tglPilih ? " dipilih" : "") + (libur ? " libur" : ""),
      "aria-pressed": String(iso === S.tglPilih),
      "aria-label": `${tglPanjang(iso)}${iso === today ? " (hari ini)" : ""}${libur ? ", tanggal merah" : ""}, ${notes.length ? notes.length + " catatan" : "belum ada catatan"}${belum ? ", ada yang belum lunas" : ""}`,
    },
      h("span", { class: "kal-tgl" }, String(d)),
      belum ? h("span", { class: "kal-dot", title: "Ada yang belum lunas" }) : null,
      notes.length ? h("span", { class: "kal-notes" },
        notes.slice(0, 3).map((n) => h("span", {
          class: "kal-mini", style: `--note:${kertasBg(n.data.warna)};--rot:${((hashStr(n.id) % 5) - 2) * 4}deg`,
          html: STIKER[jenisNote(n.data)] || STIKER.lainnya,
        })),
        notes.length > 3 ? h("span", { class: "kal-lebih" }, "+" + (notes.length - 3)) : null) : null));
  }
  while (sel.length % 7) sel.push(h("div", { class: "kal-sel luar", "aria-hidden": "true" }));
  grid.replaceChildren(...sel);
  if (fokusTgl) {
    const b = grid.querySelector(`[data-tgl="${fokusTgl}"]`) || grid.querySelector(".dipilih");
    if (b) b.focus({ preventScroll: true });
  }
}

/* ---------- papan sticky notes buat tanggal yang dipilih ---------- */
const noteCache = new Map();
function uiKey(id) {
  return [
    S.editing && S.editing.id === id ? "e:" + S.editing.lineId : "",
    S.join && S.join.id === id ? "j" : "",
    S.confirm && S.confirm.kind === "hapus" && S.confirm.id === id ? "c" : "",
    S.baruId === id ? "n" : "",
    S.riwayatBuka.has(id) ? "h" : "",
    bolehNulis() ? "w" : "r",
  ].join("|");
}
function kosongPapan() {
  if (S.galat) return h("div", { class: "kosong" }, stiker("lainnya", 72), h("strong", null, "Yah, catatannya gagal dimuat"), h("span", null, S.galat));
  if (!S.loaded) return h("div", { class: "kosong" }, stiker("matcha", 72), h("strong", null, "Bentar, lagi ngambil catatan…"), h("span", null, "Sticky notes jajan tanggal ini bakal nempel di sini."));
  if (isLibur(S.tglPilih)) return h("div", { class: "kosong" }, stiker("lainnya", 72),
    h("strong", null, "Weekend nih, kantor libur"),
    h("span", null, "Tanggal merah, gak ada yang masuk. Kalau ternyata ada yang lembur terus jajan, tetep bisa tempel catatan kok."));
  const pilih = ["matcha", "boba", "kopi", "sosis", "gorengan", "mie"];
  return h("div", { class: "kosong" }, stiker(pilih[hashStr(S.tglPilih) % pilih.length], 72),
    h("strong", null, "Belum ada yang jajan nih"),
    h("span", null, "Ada yang mau jajan? Klik “+ Catatan baru”, tulis siapa yang beli sama beli apa. Yang mau nitip tinggal nimbrung masukin nama."));
}
function buildLine(id, l, sendiri, ro) {
  const ed = S.editing && S.editing.id === id && S.editing.lineId === l.id;
  const beres = l.lunas || l.jumlah === 0;
  const li = h("li", { class: "n-line" + (l.jumlah == null ? " pending" : beres ? " lunas" : "") });
  li.append(h("div", { class: "n-who" }, ava(l.nama),
    h("span", { class: "n-text" }, h("span", { class: "n-nama" }, l.nama), l.pesanan ? h("span", { class: "n-pesan" }, l.pesanan) : null,
      l.harga != null && l.jumlah !== l.harga ? h("span", { class: "n-harga" }, `harga ${rp(l.harga)}`) : null)));
  const teks = l.jumlah === 0 ? "ditraktir" : l.jumlah == null ? "" : rp(l.jumlah);
  let nom;
  if (ed) nom = h("input", { class: "nom-edit", id: `nom-${id}-${l.id}`, "data-fk": "nom:" + l.id, inputmode: "decimal", autocomplete: "off", placeholder: "25k", value: S.editing.value, "aria-label": `Nominal ${l.nama}. Enter buat simpan, Esc buat batal.` });
  else if (ro) nom = h("span", { class: "n-nom" + (l.jumlah == null ? " belum" : "") }, l.jumlah == null ? "belum diitung" : teks);
  else if (l.jumlah == null) nom = h("button", { type: "button", class: "isi", "data-act": "edit-nom", "data-line": l.id, "data-fk": "isi:" + l.id, "aria-label": `Isi nominal ${l.nama}` }, "isi nominal");
  else nom = h("button", { type: "button", class: "nom-btn", "data-act": "edit-nom", "data-line": l.id, "data-fk": "isi:" + l.id, title: "Ganti nominal", "aria-label": `${teks}, ganti nominal ${l.nama}` }, teks);
  li.append(nom);
  if (sendiri) li.append(h("span", { class: "n-ket" }, "punya sendiri"));
  else if (l.jumlah === 0) li.append(h("span", { class: "n-ket ok" }, "aman"));
  else if (ro) li.append(h("span", { class: "n-ket" + (l.lunas ? " ok" : "") }, l.jumlah == null ? "" : l.lunas ? "✓ lunas" : "belum"));
  else li.append(h("button", {
    type: "button", class: "n-lunas", "aria-pressed": String(l.lunas), "data-act": "lunas", "data-line": l.id, "data-fk": "lunas:" + l.id,
    disabled: l.jumlah == null, title: l.jumlah == null ? "Isi nominalnya dulu ya" : l.lunas ? "Batalin tanda lunas" : "Tandain udah bayar",
    "aria-label": `${l.nama} lunas`,
  }, "Lunas"));
  return li;
}
function buildJoin(id) {
  const j = S.join;
  return h("form", { class: "n-join", "data-id": id, novalidate: true },
    h("div", { class: "j-row" },
      h("input", { class: "j-nama", id: `j-nama-${id}`, "data-fk": "j-nama", list: "dl-nama", maxlength: "30", autocomplete: "off", placeholder: "nama kamu", "aria-label": "Nama kamu", value: j.nama }),
      h("input", { class: "j-nom", id: `j-nom-${id}`, "data-fk": "j-nom", inputmode: "decimal", autocomplete: "off", placeholder: "nominal (nyusul)", "aria-label": "Nominal, boleh dikosongin dulu", value: j.nom })),
    h("input", { class: "j-pesan", id: `j-pesan-${id}`, "data-fk": "j-pesan", maxlength: "80", autocomplete: "off", placeholder: "nitip apa? misal: es kopi susu less sugar", "aria-label": "Nitip apa", value: j.pesan }),
    h("div", { class: "j-aksi" },
      h("button", { type: "submit", class: "btn small primary", "data-fk": "j-simpan" }, "Masukin aku!"),
      h("button", { type: "button", class: "btn small ghost", "data-act": "ikut-batal", "data-fk": "j-batal" }, "Gak jadi")));
}
function buildNote(n) {
  const { id, data } = n;
  const s = hitung(data);
  const jenis = jenisNote(data);
  const pb = rapikan(data.pembeli) || "?", pk = kunci(pb);
  const beli = rapikan(data.beli).slice(0, 60) || "Jajan";
  const ro = !bolehNulis();
  const rot = ((hashStr(id) % 7) - 3) * 0.6;
  const note = h("article", {
    class: "note" + (s.st === "paid" ? " is-lunas" : "") + (S.baruId === id ? " baru" : ""), "data-id": id,
    style: `--note:${kertasBg(data.warna)};--rot:${rot}deg`, "aria-label": `${beli}, dibeli ${pb}`,
  },
    h("span", { class: "tape", "aria-hidden": "true" }),
    h("header", { class: "n-head" },
      stiker(jenis, 54),
      h("div", { class: "n-title" },
        h("span", { class: "n-waktu" }, [labelWaktu(data.waktu), labelJenis(jenis)].filter(Boolean).join(" · ")),
        h("h3", { class: "n-beli" }, beli),
        h("div", { class: "n-pembeli" }, "Yang beli", ava(pb, "kecil"), h("b", null, pb),
          data.contoh === true ? h("span", { class: "tag-contoh", title: "Contoh dari obrolan awal. Hapus aja kalau udah gak perlu." }, "Contoh") : null))));
  note.append(h("div", { class: "n-sub" }, s.ls.length ? `Yang nitip (${s.ls.length})` : "Belum ada yang nitip nih"));
  if (s.ls.length) note.append(h("ul", { class: "n-orang" }, s.ls.map((l) => buildLine(id, l, kunci(l.nama) === pk, ro))));
  if (!ro) note.append(S.join && S.join.id === id ? buildJoin(id)
    : h("button", { type: "button", class: "n-ikut", "data-act": "ikut", "data-fk": "ikut" }, "+ Aku nitip juga ya!"));
  const tg = hitungTagihan(data);
  if (s.ls.length) {
    // Ada ongkir/PPN/diskon: rinciannya ditulis di atas total
    const rinci = !tg ? [] : [
      h("div", { class: "rinci" }, h("dt", null, "Harga pesanan"), h("dd", null, rp(tg.subtotal) + (tg.tunggu ? " + ?" : ""))),
      ...tg.biaya.map((b) => h("div", { class: "rinci" },
        h("dt", null, `${b.kurang ? "−" : "+"} ${b.nama}` + (b.persen ? ` ${String(b.nilai).replace(".", ",")}%` : b.bagi === "rata" ? " (bagi rata)" : "")),
        h("dd", null, b.persen && tg.tunggu ? "?" : (b.kurang ? "−" : "") + rp(b.rp)))),
    ];
    note.append(h("dl", { class: "n-total" + (tg ? " ada-biaya" : "") }, ...rinci,
      h("div", { class: "total" }, h("dt", null, "Total"), h("dd", null, s.total === 0 && s.pending ? "belum diitung" : rp(s.total) + (s.pending ? " + ?" : ""))),
      h("div", { class: "nyangkut" }, h("dt", null, "Masih nyangkut"), h("dd", null, s.nyangkut > 0 ? h("mark", null, rp(s.nyangkut)) : rp(0)))));
    if (tg && (tg.tunggu || tg.hp > 0)) note.append(h("p", { class: "n-biaya-ket" }, tg.tunggu
      ? "Ongkir, pajak & diskon kebagi setelah semua nominal keisi."
      : `Ikut dibagi juga ke yang beli (pesanannya sendiri ${rp(tg.hp)}).`));
  }
  const stTeks = { kosong: "Nunggu yang mau nitip", pending: `${s.pending} orang belum diitung`, owe: `Nunggu ${s.orangNyangkut} orang transfer`, paid: "Lunas semua, mantul!" }[s.st];
  const foot = h("footer", { class: "n-foot" }, h("span", { class: "n-state st-" + s.st }, stTeks));
  const rek = s.st === "paid" ? [] : rekening(data);
  if (rek.length) foot.append(h("div", { class: "n-tf" },
    h("span", { class: "n-tf-judul" }, "Transfer ke"),
    h("ul", null, rek.map((r) => h("li", null,
      h("div", { class: "tf-isi" },
        h("b", null, r.jenis || "Rekening"),
        r.nomor ? h("span", { class: "tf-nomor" }, r.nomor) : null,
        r.nama ? h("span", { class: "tf-an" }, "a.n. " + r.nama) : null))))));
  if (!ro) {
    const yakin = S.confirm && S.confirm.kind === "hapus" && S.confirm.id === id;
    foot.append(h("div", { class: "n-aksi" }, yakin
      ? [h("button", { type: "button", class: "btn small danger solid", "data-act": "hapus-yakin", "data-fk": "hapus-yakin" }, "Yakin, hapus!"),
         h("button", { type: "button", class: "btn small ghost", "data-act": "hapus-batal", "data-fk": "hapus-batal" }, "Gak jadi")]
      : [s.st !== "paid" ? h("button", {
           type: "button", class: "btn small ghost", "data-act": "ingetin", "data-fk": "ingetin",
           title: s.st === "kosong" ? "Copy ajakan nitip buat grup" : "Copy reminder catatan ini buat grup",
         }, s.st === "kosong" ? "Ajak nitip" : "Ingetin") : null,
         h("button", { type: "button", class: "btn small ghost", "data-act": "ubah", "data-fk": "ubah" }, "Edit"),
         h("button", { type: "button", class: "btn small ghost danger", "data-act": "hapus", "data-fk": "hapus", "aria-label": `Hapus catatan ${beli}` }, "Hapus")]));
  }
  note.append(foot);
  // Riwayat: siapa ngapain, kapan (terbaru di atas)
  const rw = bacaRiwayat(data);
  const buka = S.riwayatBuka.has(id);
  note.append(h("button", {
    type: "button", class: "n-riwayat-btn", "data-act": "riwayat", "data-fk": "riwayat", "aria-expanded": String(buka),
  }, `${buka ? "Tutup riwayat" : "Riwayat"} (${rw.length})`));
  if (buka) note.append(h("ol", { class: "n-riwayat", "aria-label": `Riwayat catatan ${beli}` },
    rw.length ? rw.map((e) => h("li", null,
      h("span", { class: "rw-waktu" }, waktuRiwayat(e.t)),
      h("span", null, h("b", null, e.oleh || "Seseorang"), " " + e.teks)))
      : h("li", { class: "rw-ket" }, "Belum ada riwayat. Catatan ini dibikin sebelum ada fitur riwayat."),
    S.aku ? null : h("li", { class: "rw-ket" }, "Pilih “Aku yang mana?” biar namamu kecatet di riwayat.")));
  if (s.st === "paid") note.append(h("div", { class: "stamp", "aria-hidden": "true" }, "LUNAS"));
  return note;
}
function renderPapan() {
  const tgl = S.tglPilih;
  const notes = S.loaded ? (catatanPerTanggal().get(tgl) || []) : [];
  const u = umur(tgl);
  $("#papan-judul").textContent = tglPanjang(tgl);
  $("#papan-sub").textContent = [u, S.loaded ? (notes.length ? `${notes.length} catatan` : "belum ada catatan") : ""].filter(Boolean).join(" · ");
  $("#btn-baru").hidden = !bolehNulis();

  const papan = $("#papan");
  const act = document.activeElement;
  const actNote = act && act.closest ? act.closest(".note[data-id]") : null;
  const fokus = S.fokus || (actNote && act.dataset.fk ? { id: actNote.dataset.id, fk: act.dataset.fk } : null);
  const els = !notes.length ? [kosongPapan()] : notes.map((n) => {
    const ui = uiKey(n.id), c = noteCache.get(n.id);
    if (c && c.sig === n.sig && c.ui === ui) return c.el;
    const el = buildNote(n);
    noteCache.set(n.id, { sig: n.sig, ui, el });
    return el;
  });
  reconcile(papan, els);
  const ids = new Set(S.docs.map((d) => d.id));
  for (const k of noteCache.keys()) if (!ids.has(k)) noteCache.delete(k);
  if (pulihkanFokus(papan, (id) => `.note[data-id="${CSS.escape(id)}"]`, fokus) && S.fokus) S.fokus = null;
  if (S.scrollTo) {
    const el = papan.querySelector(`.note[data-id="${CSS.escape(S.scrollTo)}"]`);
    if (el) { el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" }); S.scrollTo = null; }
  }
}

/* ---------- ringkasan "aku" ---------- */
function renderAku(r) {
  const box = $("#aku-ringkas");
  if (!S.aku) { box.replaceChildren(h("p", { class: "muted" }, "Pilih alias kamu, ntar keliatan kamu perlu balikin berapa ke siapa.")); return; }
  if (!S.loaded) { box.replaceChildren(h("p", { class: "muted" }, "Bentar, nunggu catatan…")); return; }
  const k = kunci(S.aku);
  const kamuKe = r.per.filter((c) => c.debitur.has(k)).map((c) => ({ nama: c.nama, total: c.debitur.get(k).total }));
  const keKamu = r.per.find((c) => c.key === k);
  const pendKamu = r.pend.filter((p) => kunci(p.data.pembeli) === k || baris(p.data).some((l) => kunci(l.nama) === k && l.jumlah == null)).length;
  const kids = [];
  if (kamuKe.length === 1) kids.push(h("p", null, "Kamu masih perlu balikin ", h("strong", null, rp(kamuKe[0].total)), ` ke ${kamuKe[0].nama}.`));
  else if (kamuKe.length > 1) {
    kids.push(h("p", null, "Kamu masih perlu balikin ", h("strong", null, rp(kamuKe.reduce((a, x) => a + x.total, 0))), " total:"));
    kids.push(h("ul", null, kamuKe.map((x) => h("li", null, `${rp(x.total)} ke ${x.nama}`))));
  } else kids.push(h("p", null, "Gak ada yang perlu kamu balikin. Aman, bestie!"));
  if (keKamu) kids.push(h("p", null, "Yang belum balikin ke kamu: ", h("strong", null, rp(keKamu.total)), ` dari ${keKamu.debitur.size} orang.`));
  if (pendKamu) kids.push(h("p", { class: "muted" }, `Ada ${pendKamu} catatan yang ada kamunya, tapi nominalnya belum diitung.`));
  // Saling nyangkut sama orang yang sama? Kasih tau bisa saling potong.
  for (const c of r.per) {
    if (c.key === k) continue;
    const a = c.debitur.has(k) ? c.debitur.get(k).total : 0; // kamu nitip ke c
    const b = r.owed.get(c.key + "\u0000" + k) || 0;         // c nitip ke kamu
    if (!a || !b) continue;
    kids.push(h("p", { class: "potong" }, a > b
      ? `Kamu sama ${c.nama} saling nyangkut. Saling potong aja, jadi kamu tinggal bayar ${rp(a - b)} ke ${c.nama}.`
      : a < b ? `Kamu sama ${c.nama} saling nyangkut. Saling potong aja, jadi ${c.nama} tinggal bayar ${rp(b - a)} ke kamu.`
      : `Kamu sama ${c.nama} sama-sama nyangkut ${rp(a)}. Saling potong aja, impas deh.`));
  }
  box.replaceChildren(...kids);
}

/* ---------- tiket "yang masih nyangkut": atas = jajanan & yang beli, sobekan = yang nitip ---------- */
function buildTiketBaris(id, l, ro) {
  const yakin = S.confirm && S.confirm.kind === "lunasin" && S.confirm.id === id && S.confirm.line === l.id;
  let aksi = h("span");
  if (!ro && l.jumlah == null) aksi = h("button", { type: "button", class: "mini", "data-act": "isi", "data-id": id, "data-line": l.id, "data-fk": `isi:${id}:${l.id}`, "aria-label": `Isi nominal ${l.nama}` }, "Isi");
  else if (!ro) aksi = h("button", {
    type: "button", class: "mini" + (yakin ? " yakin" : ""), "data-act": "lunasin", "data-id": id, "data-line": l.id, "data-fk": `lunasin:${id}:${l.id}`,
    "aria-label": yakin ? `Yakin, tandain ${l.nama} lunas` : `Tandain ${l.nama} lunas`,
  }, yakin ? "Yakin?" : "Lunasin");
  return h("li", { class: "t-baris" },
    ava(l.nama, "kecil"),
    h("span", { class: "d-id" }, h("span", { class: "d-nama" }, l.nama), l.pesanan ? h("span", { class: "d-ket" }, l.pesanan) : null),
    h("span", { class: "d-nom" + (l.jumlah == null ? " belum" : "") }, l.jumlah == null ? "belum diitung" : rp(l.jumlah)),
    aksi);
}
function buildTiket(t, no, ro) {
  const { id, data: d, s } = t;
  const pb = rapikan(d.pembeli) || "?", pk = kunci(pb), beli = rapikan(d.beli) || "Jajan";
  const belum = belumBeres(d);
  const lunasN = s.ls.filter((l) => kunci(l.nama) !== pk && (l.lunas || l.jumlah === 0)).length;
  const tg = parseTgl(d.tanggal);
  const kode = `NITIP ${tg ? pad(tg.getDate()) + pad(tg.getMonth() + 1) + String(tg.getFullYear()).slice(2) : "000000"} ${String(no).padStart(3, "0")}`;
  return h("article", { class: "tiket", style: `--note:${kertasBg(d.warna)}`, "aria-label": `Tiket ${beli}, ${tglPanjang(d.tanggal)}, yang beli ${pb}` },
    h("span", { class: "t-bingkai", "aria-hidden": "true" }),
    h("div", { class: "t-atas" },
      h("span", { class: "t-hiasan", "aria-hidden": "true" }, "✦ Tiket Nitip ✦"),
      stiker(jenisNote(d), 50),
      h("h3", { class: "t-judul" }, beli),
      h("span", { class: "t-meta" }, [tglPendek(d.tanggal), labelWaktu(d.waktu)].filter(Boolean).join(" · ")),
      h("span", { class: "t-beli" }, "Yang beli", ava(pb, "kecil"), h("b", null, pb))),
    h("ul", { class: "t-list" }, belum.map((l) => buildTiketBaris(id, l, ro))),
    h("p", { class: "t-ket" }, [`${belum.length} orang belum beres`, lunasN ? `${lunasN} udah lunas` : ""].filter(Boolean).join(" · ")),
    h("div", { class: "t-stub" },
      h("div", { class: "t-barcode", "aria-hidden": "true" }, h("span", { class: "t-bar" }), h("span", { class: "t-kode" }, kode)),
      h("div", { class: "t-total" }, h("span", { class: "t-lbl" }, "Nyangkut"), h("strong", null, s.nyangkut ? rp(s.nyangkut) : "belum diitung")),
      h("div", { class: "t-aksi" },
        h("button", { type: "button", class: "mini", "data-act": "lihat", "data-id": id, "data-fk": "lihat:" + id }, "Lihat note"),
        h("button", { type: "button", class: "mini", "data-act": "copas", "data-id": id, "data-fk": "copas:" + id, "aria-label": `Copas reminder ${beli}` }, "Copas"))));
}
function renderRekap() {
  const body = $("#rekap-body");
  const fk = body.contains(document.activeElement) ? document.activeElement.dataset.fk : null;
  if (!S.loaded) {
    $("#btn-salin").hidden = true;
    body.replaceChildren(h("p", { class: "muted" }, "Bentar, nunggu catatan…"));
    renderAku({ per: [], pend: [], owed: new Map() });
    return;
  }
  const semua = daftarTiket();
  const tampil = tiketTampil(semua);
  const ro = !bolehNulis();
  const no = nomorCatatan();
  $("#btn-salin").hidden = !semua.length;
  const kids = [];
  if (!semua.length) kids.push(h("p", { class: "muted" }, S.docs.length ? "Gak ada yang nyangkut. Lunas semua, mantul!" : "Belum ada catatan. Ntar tiket siapa nungguin siapa muncul di sini."));
  if (semua.length > MAKS_TIKET) {
    const on = new Set(tampil.map((t) => t.id));
    kids.push(h("div", { class: "t-pilih" },
      h("p", { class: "t-pilih-lbl" }, `Ada ${semua.length} tiket. Pilih maks ${MAKS_TIKET} yang mau ditampilin:`),
      h("div", { class: "chips" }, semua.map((t) => h("button", {
        type: "button", class: "chip t-chip" + (on.has(t.id) ? " on" : ""), "aria-pressed": String(on.has(t.id)),
        "data-act": "pilih-tiket", "data-id": t.id, "data-fk": "pilih:" + t.id, title: `${labelCatatan(t.data)}, yang beli ${rapikan(t.data.pembeli)}`,
      },
        h("span", { class: "si-stk kecil", style: `--note:${kertasBg(t.data.warna)}`, "aria-hidden": "true", html: STIKER[jenisNote(t.data)] || STIKER.lainnya }),
        labelCatatan(t.data))))));
  }
  if (semua.length && !tampil.length) kids.push(h("p", { class: "muted" }, "Pilih tiketnya di atas buat ditampilin."));
  if (tampil.length) kids.push(h("div", { class: "tiket-list" }, tampil.map((t) => buildTiket(t, no.get(t.id) || 0, ro))));
  body.replaceChildren(...kids);
  if (fk) { const el = $$("[data-fk]", body).find((e) => e.dataset.fk === fk); if (el) el.focus(); }
  renderAku(rekap());
  renderSalin(false);
}

/* ---------- kotak "copas pengingat": isinya tiket yang lagi ditampilin ---------- */
function renderSalin(regen) {
  if (!S.salin) return;
  const tampil = tiketTampil(daftarTiket());
  const sigIds = tampil.map((t) => t.id).join(",");
  if (S.salin.ids !== sigIds) { S.salin.ids = sigIds; regen = true; }
  $("#salin-ket").textContent = tampil.length
    ? `Isinya ${tampil.length} tiket yang lagi ditampilin: ${tampil.map((t) => rapikan(t.data.beli) || "Jajan").join(", ")}.`
    : "Belum ada tiket yang ditampilin.";
  const orang = orangDiTiket(tampil);
  if (S.salin.orang && !orang.some((o) => o.key === S.salin.orang)) { S.salin.orang = ""; regen = true; }
  const sel = $("#salin-orang");
  const sigO = orang.map((o) => o.key + "=" + o.nama).join("\u0000");
  if (sel.dataset.sig !== sigO) {
    sel.replaceChildren(h("option", { value: "" }, "Semua yang nitip (buat grup)"),
      ...orang.map((o) => h("option", { value: o.key }, `${o.nama} aja (buat japri)`)));
    sel.dataset.sig = sigO;
  }
  sel.value = S.salin.orang;
  if (regen || !S.salin.edited) {
    $("#salin-teks").value = pesanGabungan(tampil.map((t) => t.id), S.salin.orang);
    S.salin.edited = false;
  }
}
