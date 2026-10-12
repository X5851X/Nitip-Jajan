"use strict";
/* Semua yang kejadian pas orang klik/ngetik: pilih tanggal, catatan baru, ikut nitip, isi nominal, lunas, hapus, tiket & copas pengingat. */

/* ---------- form "catatan baru" / "edit" (dialog sticky note) ---------- */
function setRadio(name, value) { for (const r of $$(`input[name="${name}"]`)) r.checked = r.value === value; }
function getRadio(name) { const r = $(`input[name="${name}"]:checked`); return r ? r.value : ""; }
function tambahBaris(o = {}) {
  const id = o.id || idBaru();
  const nom = o.jumlah == null ? "" : String(o.jumlah);
  const pv = previewNominal(nom);
  const row = h("div", { class: "row", "data-id": id, "data-lunas": o.lunas ? "1" : "0" },
    h("input", { class: "r-nama", id: "r-nama-" + id, type: "text", maxlength: "30", autocomplete: "off", placeholder: "nama, misal: kelinci", "aria-label": "Nama yang nitip", value: o.nama || "" }),
    h("input", { class: "r-pesan", id: "r-pesan-" + id, type: "text", maxlength: "80", autocomplete: "off", placeholder: "nitip apa (opsional)", "aria-label": "Nitip apa", value: o.pesanan || "" }),
    h("div", { class: "r-nom-wrap" },
      h("input", { class: "r-nom", id: "r-nom-" + id, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "nominal (nyusul)", "aria-label": "Nominal", value: nom }),
      h("span", { class: "r-preview" + (pv.err ? " err" : "") }, pv.text)),
    h("button", { type: "button", class: "r-hapus", "aria-label": "Hapus baris ini" }, "×"));
  $("#rows").append(row);
  return row;
}
/* Baris "Transfer ke mana?": nama | bank/e-wallet | nomor, semuanya isian bebas. */
function tambahRekening(r = {}) {
  const id = idBaru();
  const row = h("div", { class: "tf-row" },
    h("input", { class: "t-nama", id: "t-nama-" + id, type: "text", maxlength: "40", autocomplete: "off", placeholder: "nama (a.n.)", "aria-label": "Atas nama", value: r.nama || "" }),
    h("input", { class: "t-jenis", id: "t-jenis-" + id, type: "text", maxlength: "30", autocomplete: "off", placeholder: "bank / e-wallet", "aria-label": "Bank atau e-wallet", value: r.jenis || "" }),
    h("input", { class: "t-nomor", id: "t-nomor-" + id, type: "text", inputmode: "tel", maxlength: "40", autocomplete: "off", placeholder: "no. rek / no. HP", "aria-label": "Nomor rekening atau nomor HP", value: r.nomor || "" }),
    h("button", { type: "button", class: "r-hapus", "aria-label": "Hapus rekening ini" }, "×"));
  $("#tf-rows").append(row);
  updTf();
  return row;
}
function updTf() { $("#btn-tambah-tf").hidden = $("#tf-rows").children.length >= MAKS_REKENING; }
function updForm() {
  const tgl = $("#f-tanggal").value;
  $("#form-tgl").textContent = parseTgl(tgl) ? tglPanjang(tgl) : "";
  const pilihan = $("#f-jenis").value;
  const auto = deteksi($("#f-beli").value) || $$(".r-pesan", $("#rows")).map((i) => deteksi(i.value)).find(Boolean) || "lainnya";
  const jenis = jenisValid(pilihan) ? pilihan : auto;
  const holder = $("#form-stk");
  if (holder.dataset.jenis !== jenis) { holder.replaceChildren(stiker(jenis, 60)); holder.dataset.jenis = jenis; }
  $("#f-jenis").options[0].textContent = `Auto (${labelJenis(auto)})`;
  $("#jenis-tebakan").textContent = jenisValid(pilihan) && pilihan !== auto ? `Auto-nya sih ${labelJenis(auto)}, tapi kamu pilih ${labelJenis(pilihan)}.` : "";
  $("#form").style.setProperty("--note", kertasBg(getRadio("warna")));
}
function formError(msg, el) {
  const p = $("#form-error");
  p.textContent = msg || ""; p.hidden = !msg;
  if (el) el.focus();
}
function bukaForm(mode, id) {
  if (!bolehNulis()) return;
  const doc = mode === "ubah" ? cariDoc(id) : null;
  if (mode === "ubah" && !doc) return;
  const d = doc ? doc.data : null;
  S.form = { mode, id: doc ? id : null, asal: new Set(d ? baris(d).map((l) => l.id) : []) };
  $("#form-judul").textContent = d ? "Edit catatan" : "Catatan jajan baru";
  $("#btn-simpan").textContent = d ? "Simpan perubahan" : "Tempel catatan!";
  $("#f-pembeli").value = d ? rapikan(d.pembeli) : "";
  $("#f-beli").value = d ? rapikan(d.beli) : "";
  $("#f-jenis").value = d && jenisValid(d.jenis) ? d.jenis : "";
  $("#f-tanggal").value = d && parseTgl(d.tanggal) ? d.tanggal : S.tglPilih;
  setRadio("waktu", d && waktuValid(d.waktu) ? d.waktu : waktuSekarang());
  setRadio("warna", d && kertasValid(d.warna) ? d.warna : kertasAcak());
  $("#rows").replaceChildren();
  if (d) for (const l of baris(d)) tambahBaris(l);
  if (!$("#rows").children.length) tambahBaris();
  $("#tf-rows").replaceChildren();
  for (const r of rekening(d)) tambahRekening(r);
  if (!$("#tf-rows").children.length) tambahRekening();
  formError("");
  updForm();
  const dlg = $("#dlg");
  if (!dlg.open) dlg.showModal();
  ($("#f-pembeli").value ? $("#f-beli") : $("#f-pembeli")).focus();
}
function tutupForm() {
  S.form = null;
  const dlg = $("#dlg");
  if (dlg.open) dlg.close();
}
async function simpanForm(ev) {
  ev.preventDefault();
  if (!S.form || !bolehNulis()) return;
  const pembeli = rapikan($("#f-pembeli").value).slice(0, 30);
  const beli = rapikan($("#f-beli").value).slice(0, 60);
  const tanggal = parseTgl($("#f-tanggal").value) ? $("#f-tanggal").value : S.tglPilih;
  if (!pembeli) return formError("Yang beli siapa nih? Isi dulu ya.", $("#f-pembeli"));
  if (!beli) return formError("Belinya apa? Isi dulu, misal Kopi Kenangan atau mie ayam.", $("#f-beli"));
  const orang = {}, seen = new Set();
  let urut = 0;
  for (const row of $("#rows").children) {
    const iNama = $(".r-nama", row), iNom = $(".r-nom", row);
    const nama = rapikan(iNama.value).slice(0, 30);
    const pesanan = rapikan($(".r-pesan", row).value).slice(0, 80);
    if (!nama && !iNom.value.trim() && !pesanan) continue;
    if (!nama) return formError("Ada yang namanya masih kosong tuh.", iNama);
    const k = kunci(nama);
    if (k === kunci(pembeli)) return formError(`${nama} kan yang beli, gak usah masuk daftar nitip.`, iNama);
    if (seen.has(k)) return formError(`${nama} ketulis dua kali nih, gabungin aja jadi satu.`, iNama);
    seen.add(k);
    const j = parseNominal(iNom.value);
    if (Number.isNaN(j)) return formError(`Nominal “${iNom.value.trim()}” gak kebaca. Coba tulis 25000 atau 25k.`, iNom);
    orang[row.dataset.id] = { nama, pesanan, jumlah: j, lunas: j != null && j > 0 && row.dataset.lunas === "1", urut: ++urut };
  }
  const transfer = [];
  for (const row of $("#tf-rows").children) {
    const r = { nama: rapikan($(".t-nama", row).value).slice(0, 40), jenis: rapikan($(".t-jenis", row).value).slice(0, 30), nomor: rapikan($(".t-nomor", row).value).slice(0, 40) };
    if (!r.nama && !r.jenis && !r.nomor) continue;
    if (!r.jenis && !r.nomor) return formError("Transfer ke mana? Isi bank/e-wallet atau nomornya dulu ya.", $(".t-jenis", row));
    transfer.push(r);
  }
  const isi = {
    tanggal, waktu: getRadio("waktu"), beli, jenis: jenisValid($("#f-jenis").value) ? $("#f-jenis").value : "",
    pembeli, warna: getRadio("warna") || "kuning", orang,
  };
  if (transfer.length) isi.transfer = transfer.slice(0, MAKS_REKENING);
  const now = Date.now();
  const btn = $("#btn-simpan");
  btn.disabled = true;
  try {
    let id, ok;
    if (S.form.mode === "ubah") {
      id = S.form.id;
      const lama = cariDoc(id);
      if (!lama) return formError("Yah, catatan ini udah dihapus orang lain.");
      // Orang yang ikut nitip pas form ini lagi kebuka jangan sampai ilang.
      for (const l of baris(lama.data)) {
        if (!S.form.asal.has(l.id) && !orang[l.id] && !seen.has(kunci(l.nama)))
          orang[l.id] = { nama: l.nama, pesanan: l.pesanan, jumlah: l.jumlah, lunas: l.lunas, urut: ++urut };
      }
      const beda = bedaCatatan(lama.data, isi);
      const body = { ...isi, dibuat: Number(lama.data.dibuat) || now, diubah: now, riwayat: riwayatPlus(lama.data, beda ? `ngedit: ${beda}` : "") };
      if (lama.data.contoh === true) body.contoh = true;
      ok = await aman(id, () => S.store.set(id, body), "Sip, udah kesimpen!");
    } else {
      id = S.store.newId();
      S.baruId = id;
      const riwayat = { [idRiwayat()]: entriRiwayat("bikin catatan") };
      ok = await aman(id, () => S.store.set(id, { ...isi, dibuat: now, diubah: now, riwayat }), "Catatan udah nempel!");
      if (!ok) S.baruId = null;
      else setTimeout(() => { if (S.baruId === id) S.baruId = null; }, 1500);
    }
    if (ok) {
      const d = parseTgl(tanggal);
      S.tglPilih = tanggal; S.bulan = [d.getFullYear(), d.getMonth()];
      S.scrollTo = id;
      tutupForm();
      renderSemua();
    }
  } finally { btn.disabled = false; }
}

/* ---------- kalender ---------- */
function pilihTanggal(iso, gulir) {
  const d = parseTgl(iso);
  if (!d) return;
  S.tglPilih = iso; S.join = null; S.editing = null;
  S.bulan = [d.getFullYear(), d.getMonth()];
  try { history.replaceState(null, "", "#" + iso); } catch { /* abaikan */ }
  renderKalender();
  renderPapan();
  if (gulir && matchMedia("(max-width: 1023px)").matches)
    $("#papan-wrap").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
}
function geserBulan(n) {
  const d = new Date(S.bulan[0], S.bulan[1] + n, 1);
  S.bulan = [d.getFullYear(), d.getMonth()];
  renderKalender();
}
/* `langsung` = lompat tanpa animasi (dipakai pas web baru kebuka dari link catatan). */
function lihatCatatan(id, langsung) {
  const doc = cariDoc(id);
  if (!doc) return;
  pilihTanggal(doc.data.tanggal, false);
  const el = $(`#papan .note[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: langsung || reduceMotion() ? "auto" : "smooth", block: "center" });
  el.classList.remove("sorot"); void el.offsetWidth; el.classList.add("sorot");
  setTimeout(() => el.classList.remove("sorot"), 1500);
  const t = el.querySelector(".isi, [data-act]");
  if (t) t.focus({ preventScroll: true });
}

/* ---------- aksi di sticky note ---------- */
function cariBaris(id, lineId) { const d = cariDoc(id); return d ? baris(d.data).find((l) => l.id === lineId) : null; }
function fokusDi(id, fk) {
  const note = $(`#papan .note[data-id="${CSS.escape(id)}"]`);
  const el = note && $$("[data-fk]", note).find((e) => e.dataset.fk === fk);
  if (el) el.focus();
}
function mulaiEditNom(id, lineId) {
  const l = cariBaris(id, lineId);
  if (!l || !bolehNulis()) return;
  S.editing = { id, lineId, value: l.jumlah == null ? "" : String(l.jumlah) };
  S.fokus = { id, fk: "nom:" + lineId };
  renderPapan();
}
function batalNom() {
  const ed = S.editing; if (!ed) return;
  S.editing = null;
  S.fokus = { id: ed.id, fk: "isi:" + ed.lineId };
  renderPapan();
}
function simpanNom(dariBlur) {
  const ed = S.editing; if (!ed) return;
  const j = parseNominal(ed.value);
  if (Number.isNaN(j)) {
    toast(`Nominal “${ed.value.trim()}” gak kebaca. Coba tulis 25000 atau 25k.`);
    if (dariBlur) { S.editing = null; renderPapan(); }
    return;
  }
  S.editing = null;
  const l = cariBaris(ed.id, ed.lineId);
  S.fokus = dariBlur ? null : { id: ed.id, fk: "isi:" + ed.lineId };
  renderPapan();
  if (!l || j === l.jumlah) return;
  const p = "orang." + ed.lineId + ".";
  const paths = { [p + "jumlah"]: j, diubah: Date.now() };
  if (j == null || j === 0) paths[p + "lunas"] = false;
  tambahRiwayat(paths, cariDoc(ed.id).data, j == null ? `ngosongin nominal ${l.nama}` : j === 0 ? `nandain ${l.nama} ditraktir`
    : `${l.jumlah == null ? "ngisi" : "ganti"} nominal ${l.nama}: ${rp(j)}`);
  aman(ed.id, () => S.store.update(ed.id, paths),
    j == null ? `Nominal ${l.nama} dikosongin` : j === 0 ? `${l.nama} ditraktir, asik!` : `Nominal ${l.nama} jadi ${rp(j)}`);
}
function toggleLunas(id, lineId) {
  const l = cariBaris(id, lineId);
  if (!l || l.jumlah == null || !bolehNulis()) return;
  const v = !l.lunas;
  S.fokus = { id, fk: "lunas:" + lineId };
  const paths = tambahRiwayat({ ["orang." + lineId + ".lunas"]: v, diubah: Date.now() }, cariDoc(id).data,
    v ? `nandain ${l.nama} lunas` : `batalin lunas ${l.nama}`);
  aman(id, () => S.store.update(id, paths), v ? `${l.nama} lunas, mantap!` : `${l.nama} balik ke belum lunas`);
}
function bukaJoin(id) {
  if (!bolehNulis()) return;
  S.join = { id, nama: S.aku || "", pesan: "", nom: "" };
  S.fokus = { id, fk: S.aku ? "j-pesan" : "j-nama" };
  renderPapan();
}
function tutupJoin(id) { S.join = null; S.fokus = { id, fk: "ikut" }; renderPapan(); }
async function simpanJoin(id) {
  const j = S.join;
  if (!j || j.id !== id) return;
  const doc = cariDoc(id);
  if (!doc) { S.join = null; renderPapan(); return; }
  const nama = rapikan(j.nama).slice(0, 30), pesanan = rapikan(j.pesan).slice(0, 80);
  if (!nama) { toast("Namamu siapa? Isi dulu ya."); fokusDi(id, "j-nama"); return; }
  const k = kunci(nama);
  if (k === kunci(doc.data.pembeli)) { toast(`${nama} kan yang beli, masa nitip ke diri sendiri, wkwk.`); fokusDi(id, "j-nama"); return; }
  if (baris(doc.data).some((l) => kunci(l.nama) === k)) { toast(`${nama} udah ada di sini. Nominalnya isi langsung di daftar aja.`); fokusDi(id, "j-nama"); return; }
  const jml = parseNominal(j.nom);
  if (Number.isNaN(jml)) { toast(`Nominal “${j.nom.trim()}” gak kebaca. Coba tulis 25000 atau 25k.`); fokusDi(id, "j-nom"); return; }
  const lineId = idBaru();
  if (!S.aku) setAku(nama);
  tutupJoin(id);
  const paths = tambahRiwayat({
    ["orang." + lineId]: { nama, pesanan, jumlah: jml, lunas: false, urut: Date.now() }, diubah: Date.now(),
  }, doc.data, `ikut nitip${pesanan ? ` (${pesanan})` : ""}${jml == null ? "" : jml === 0 ? ", ditraktir" : `, ${rp(jml)}`}`, nama);
  await aman(id, () => S.store.update(id, paths), `${nama} ikut nitip!`);
}
let confirmT;
function setConfirm(c) {
  S.confirm = c;
  clearTimeout(confirmT);
  if (c) confirmT = setTimeout(() => { if (S.confirm === c) { S.confirm = null; renderRekap(); renderPapan(); } }, 5000);
}
function mintaHapus(id) { setConfirm({ kind: "hapus", id }); S.fokus = { id, fk: "hapus-yakin" }; renderPapan(); }
async function hapus(id) {
  setConfirm(null);
  if (S.form && S.form.id === id) tutupForm();
  if (S.join && S.join.id === id) S.join = null;
  if (!(await aman(id, () => S.store.remove(id), "Catatan udah dicopot"))) renderPapan();
}

/* ---------- tiket "yang masih nyangkut" ---------- */
function pilihTiket(id) {
  const tampil = new Set(tiketTampil(daftarTiket()).map((t) => t.id));
  if (tampil.has(id)) tampil.delete(id);
  else if (tampil.size >= MAKS_TIKET) { toast(`Maks ${MAKS_TIKET} tiket ya, lepas satu dulu.`); return; }
  else tampil.add(id);
  S.tiket = tampil;
  renderRekap();
}
async function lunasinBaris(id, lineId) {
  const l = cariBaris(id, lineId);
  if (!l || l.jumlah == null || !bolehNulis()) return;
  const paths = tambahRiwayat({ ["orang." + lineId + ".lunas"]: true, diubah: Date.now() }, cariDoc(id).data, `nandain ${l.nama} lunas`);
  await aman(id, () => S.store.update(id, paths), `${l.nama} lunas, mantap!`);
}

/* ---------- copas pengingat ---------- */
async function keClipboard(teks) {
  try { await navigator.clipboard.writeText(teks); return true; } catch { return false; }
}
/* Buka kotak copas. `teksKhusus` diisi kalau copy otomatis gagal, biar bisa disalin manual. */
function bukaSalin(teksKhusus) {
  S.salin = { orang: "", edited: false, ids: "" };
  renderSalin(true);
  $("#salin-box").hidden = false;
  $("#btn-salin").setAttribute("aria-expanded", "true");
  if (teksKhusus) {
    const ta = $("#salin-teks");
    ta.value = teksKhusus;
    S.salin.edited = true;
    $("#salin-box").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    ta.focus({ preventScroll: true });
    ta.select();
  } else $("#salin-salin").focus();
}
function tutupSalin() {
  S.salin = null;
  $("#salin-box").hidden = true;
  $("#btn-salin").setAttribute("aria-expanded", "false");
}
async function salinDariBox() {
  const ta = $("#salin-teks");
  if (!ta.value.trim()) { toast("Belum ada tiket yang mau di-reminder."); return; }
  if (await keClipboard(ta.value)) { toast("Udah ke-copy! Tinggal paste di grup."); return; }
  ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  toast(ok ? "Udah ke-copy! Tinggal paste di grup." : "Pesannya udah diblok, tinggal Ctrl+C.");
}
async function ingetinCatatan(id) {
  const doc = cariDoc(id);
  if (!doc) return;
  const teks = pesanCatatan(id);
  const kosong = hitung(doc.data).st === "kosong";
  if (await keClipboard(teks)) toast(kosong ? "Ajakan nitip ke-copy! Tinggal paste di grup." : "Reminder catatan ini ke-copy! Tinggal paste di grup.");
  else bukaSalin(teks);
}

/* ---------- event ---------- */
function pasangEvent() {
  setRadio("tema", document.documentElement.dataset.theme || "light");
  for (const r of $$('input[name="tema"]')) r.addEventListener("change", () => {
    document.documentElement.dataset.theme = r.value;
    lsSet("nitipdong.tema", r.value);
  });

  $("#kal-grid").addEventListener("click", (e) => { const b = e.target.closest("[data-tgl]"); if (b) pilihTanggal(b.dataset.tgl, true); });
  $("#kal-grid").addEventListener("keydown", (e) => {
    const b = e.target.closest("[data-tgl]");
    const n = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!b || n == null) return;
    e.preventDefault();
    const d = parseTgl(b.dataset.tgl); d.setDate(d.getDate() + n);
    pilihTanggal(isoLokal(d), false);
    const nb = $(`#kal-grid [data-tgl="${isoLokal(d)}"]`);
    if (nb) nb.focus();
  });
  $("#kal-prev").addEventListener("click", () => geserBulan(-1));
  $("#kal-next").addEventListener("click", () => geserBulan(1));
  $("#kal-hariini").addEventListener("click", () => pilihTanggal(isoLokal(new Date()), false));

  const papan = $("#papan");
  papan.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    const note = b && b.closest(".note[data-id]");
    if (!note) return;
    const id = note.dataset.id, a = b.dataset.act;
    if (a === "edit-nom") mulaiEditNom(id, b.dataset.line);
    else if (a === "lunas") toggleLunas(id, b.dataset.line);
    else if (a === "ikut") bukaJoin(id);
    else if (a === "ikut-batal") tutupJoin(id);
    else if (a === "ingetin") ingetinCatatan(id);    else if (a === "riwayat") {
      if (S.riwayatBuka.has(id)) S.riwayatBuka.delete(id); else S.riwayatBuka.add(id);
      S.fokus = { id, fk: "riwayat" };
      renderPapan();
    }
    else if (a === "ubah") bukaForm("ubah", id);
    else if (a === "hapus") mintaHapus(id);
    else if (a === "hapus-yakin") hapus(id);
    else if (a === "hapus-batal") { setConfirm(null); S.fokus = { id, fk: "hapus" }; renderPapan(); }
  });
  papan.addEventListener("submit", (e) => { const f = e.target.closest(".n-join"); if (f) { e.preventDefault(); simpanJoin(f.dataset.id); } });
  papan.addEventListener("input", (e) => {
    const t = e.target;
    if (t.classList.contains("nom-edit")) { if (S.editing) S.editing.value = t.value; return; }
    if (!S.join) return;
    if (t.classList.contains("j-nama")) S.join.nama = t.value;
    else if (t.classList.contains("j-pesan")) S.join.pesan = t.value;
    else if (t.classList.contains("j-nom")) S.join.nom = t.value;
  });
  papan.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.classList.contains("nom-edit")) {
      if (e.key === "Enter") { e.preventDefault(); simpanNom(false); }
      else if (e.key === "Escape") { e.preventDefault(); batalNom(); }
    } else if (e.key === "Escape" && t.closest(".n-join")) { e.preventDefault(); tutupJoin(t.closest(".note").dataset.id); }
  });
  papan.addEventListener("focusout", (e) => { if (e.target.classList.contains("nom-edit") && S.editing && !S.rebuilding) simpanNom(true); });

  // Tiket "yang masih nyangkut"
  $("#rekap-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const { act, id, line } = b.dataset;
    if (act === "pilih-tiket") pilihTiket(id);
    else if (act === "lihat") lihatCatatan(id);
    else if (act === "copas") ingetinCatatan(id);
    else if (act === "isi") { lihatCatatan(id); mulaiEditNom(id, line); }
    else if (act === "lunasin" && bolehNulis()) {
      if (S.confirm && S.confirm.kind === "lunasin" && S.confirm.id === id && S.confirm.line === line) { setConfirm(null); lunasinBaris(id, line); }
      else setConfirm({ kind: "lunasin", id, line });
      renderRekap();
    }
  });
  $("#aku-select").addEventListener("change", (e) => { setAku(e.target.value); renderRekap(); });

  // Copas pengingat
  $("#btn-salin").addEventListener("click", () => (S.salin ? tutupSalin() : bukaSalin()));
  $("#salin-orang").addEventListener("change", (e) => {
    if (!S.salin) return;
    S.salin.orang = e.target.value; S.salin.edited = false;
    renderSalin(true);
  });
  $("#salin-teks").addEventListener("input", () => { if (S.salin) S.salin.edited = true; });
  $("#salin-salin").addEventListener("click", salinDariBox);
  $("#salin-tutup").addEventListener("click", () => { tutupSalin(); $("#btn-salin").focus(); });

  // Form catatan baru / edit
  $("#btn-baru").addEventListener("click", () => bukaForm("baru"));
  $("#btn-batal").addEventListener("click", tutupForm);
  $("#btn-x").addEventListener("click", tutupForm);
  // Klik di luar sticky note (latar gelap) = gak jadi. Cuma kalau klik-nya mulai & selesai di luar,
  // biar nge-blok teks terus mouse kelewat keluar nggak bikin form ketutup.
  let tekanDiLuar = false;
  $("#dlg").addEventListener("pointerdown", (e) => { tekanDiLuar = e.target === e.currentTarget; });
  $("#dlg").addEventListener("click", (e) => { if (e.target === e.currentTarget && tekanDiLuar) tutupForm(); tekanDiLuar = false; });
  $("#dlg").addEventListener("close", () => { if (!$("#dlg").open) S.form = null; });
  $("#form").addEventListener("submit", simpanForm);
  $("#f-beli").addEventListener("input", updForm);
  $("#f-jenis").addEventListener("change", updForm);
  $("#f-tanggal").addEventListener("input", updForm);
  $("#f-warna").addEventListener("change", updForm);
  $("#btn-tambah-baris").addEventListener("click", () => { $(".r-nama", tambahBaris()).focus(); });
  $("#rows").addEventListener("input", (e) => {
    const t = e.target;
    if (t.classList.contains("r-nom")) {
      const pv = previewNominal(t.value), out = $(".r-preview", t.parentElement);
      out.textContent = pv.text; out.classList.toggle("err", pv.err);
    } else if (t.classList.contains("r-pesan")) updForm();
  });
  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest(".r-hapus"); if (!b) return;
    const row = b.closest(".row"), next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    if (!$("#rows").children.length) tambahBaris();
    $(".r-nama", next || $("#rows").lastElementChild).focus();
    updForm();
  });
  $("#btn-tambah-tf").addEventListener("click", () => {
    if ($("#tf-rows").children.length < MAKS_REKENING) $(".t-nama", tambahRekening()).focus();
  });
  $("#tf-rows").addEventListener("click", (e) => {
    const b = e.target.closest(".r-hapus"); if (!b) return;
    const row = b.closest(".tf-row"), next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    if (!$("#tf-rows").children.length) tambahRekening();
    updTf();
    $(".t-nama", next || $("#tf-rows").lastElementChild).focus();
  });
}

/* ---------- nyambung ke penyimpanan ---------- */
function langganan() {
  if (S.unsub) S.unsub();
  S.unsub = S.store.subscribe((list) => {
    S.docs = list.map((d) => ({ id: d.id, data: d.data || {}, sig: JSON.stringify(d.data || {}) }));
    S.loaded = true;
    if (S.galat) { S.galat = ""; setStatus("ok", ""); setNotice(); }
    if (S.editing && !cariBaris(S.editing.id, S.editing.lineId)) S.editing = null;
    if (S.join && !cariDoc(S.join.id)) S.join = null;
    renderSemua();
    // Dibuka dari link catatan: langsung gulir & sorot catatannya (sekali aja)
    if (S.bukaCatatan) { const id = S.bukaCatatan; S.bukaCatatan = ""; if (cariDoc(id)) lihatCatatan(id, true); }
  }, (err) => {
    console.error("Nitip Yuk: gagal baca", err);
    S.galat = err && err.code === "permission-denied"
      ? "Firebase nolak akses nih. Cek rules Firestore-nya (ada di README)."
      : "Koneksinya lagi putus. Tunggu bentar atau coba refresh halamannya ya.";
    setStatus("error", "Gagal nyambung");
    setNotice(S.galat);
    renderSemua();
  });
}
function siapkanHalaman() {
  pasangPola();
  $("#parade").replaceChildren(...["matcha", "boba", "kopi", "sosis", "gorengan", "mie"].map((k, i) => stiker(k, 0, [-8, 6, -4, 8, -6, 5][i])));
  $("#f-jenis").replaceChildren(h("option", { value: "" }, "Auto"), ...JAJAN.map((j) => h("option", { value: j.k }, j.label)));
  $("#f-waktu").replaceChildren(...WAKTU.map((w) => h("label", { class: "pil" },
    h("input", { type: "radio", name: "waktu", value: w.k }), h("span", null, w.label))));
  $("#f-warna").replaceChildren(...KERTAS.map((k) => h("label", { class: "sw", title: k.label },
    h("input", { type: "radio", name: "warna", value: k.k, "aria-label": k.label }), h("span", { style: `--c:${k.bg}` }))));
}
async function mulai() {
  if (!jagaTanda()) return;
  // Link langsung ke tanggal atau ke satu catatan: .../#2026-10-06 atau .../#2026-10-06/ID_CATATAN
  const bacaLink = () => {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch { /* biarin */ }
    const m = /^(\d{4}-\d{2}-\d{2})(?:\/([\w-]+))?$/.exec(h);
    return m && parseTgl(m[1]) ? { tgl: m[1], id: m[2] || "" } : null;
  };
  const dariLink = bacaLink();
  if (dariLink) {
    const d = parseTgl(dariLink.tgl);
    S.tglPilih = dariLink.tgl; S.bulan = [d.getFullYear(), d.getMonth()]; S.bukaCatatan = dariLink.id;
  }
  window.addEventListener("hashchange", () => {
    const l = bacaLink();
    if (!l) return;
    if (l.id && cariDoc(l.id)) lihatCatatan(l.id);
    else if (l.tgl !== S.tglPilih) pilihTanggal(l.tgl, false);
  });
  siapkanHalaman();
  pasangEvent();
  renderSemua();
  S.store = await bukaStore();
  if (S.catatanStore) { setStatus("error", "Gagal nyambung ke Firebase"); setNotice(S.catatanStore); }
  langganan();
}
mulai();
