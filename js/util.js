"use strict";
/* Helper umum: DOM, tanggal, nominal Rupiah, nama alias. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HARI_P = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_P = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmtNum = new Intl.NumberFormat("id-ID");
const rp = (n) => "Rp" + fmtNum.format(Math.round(n));
const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* h("div", {class: "x", "data-id": 1}, anak...) -> elemen. Teks selalu lewat text node (aman dari HTML).
   `html` hanya untuk SVG stiker bawaan, bukan input orang. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* browser nggak nyimpen */ } }
function hashStr(s) { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.codePointAt(0)) >>> 0; return x; }

/* ---------- tanggal ---------- */
const pad = (n) => String(n).padStart(2, "0");
const isoLokal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseTgl(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
/* Sabtu & Minggu: tanggal merah, kantor libur. */
function isLibur(s) { const d = parseTgl(s); return !!d && (d.getDay() === 0 || d.getDay() === 6); }
function tglPanjang(s) {
  const d = parseTgl(s);
  return d ? `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}` : "Tanpa tanggal";
}
function tglPendek(s) {
  const d = parseTgl(s);
  return d ? `${HARI_P[d.getDay()]} ${d.getDate()} ${BULAN_P[d.getMonth()]}` : "tanpa tanggal";
}
/* Jam di riwayat: "hari ini 10.32", "kemarin 17.02", atau "Sel 6 Okt 08.02". */
function waktuRiwayat(t) {
  const d = new Date(t), iso = isoLokal(d), jam = `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  const kmrn = new Date(); kmrn.setDate(kmrn.getDate() - 1);
  if (iso === isoLokal(new Date())) return `hari ini ${jam}`;
  if (iso === isoLokal(kmrn)) return `kemarin ${jam}`;
  return `${tglPendek(iso)} ${jam}`;
}
function umur(s) {
  const d = parseTgl(s);
  if (!d) return "";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((t - d) / 864e5);
  if (n < -1) return `${-n} hari lagi`;
  if (n === -1) return "besok";
  if (n === 0) return "hari ini";
  if (n === 1) return "kemarin";
  if (n < 7) return `${n} hari lalu`;
  if (n < 14) return "seminggu lalu";
  if (n < 31) return `${Math.floor(n / 7)} minggu lalu`;
  return `${Math.max(1, Math.floor(n / 30))} bulan lalu`;
}

/* ---------- nominal: "25k", "25rb", "25.000", "25" -> 25000; kosong -> null; ngaco -> NaN ---------- */
function parseNominal(raw) {
  let s = String(raw ?? "").toLowerCase().replace(/rp\.?/g, "").replace(/\s+/g, "");
  if (!s || /^[-–—]+$/.test(s)) return null;
  let mult = 1, n;
  const suf = s.match(/(k|rb|ribu|jt|juta)$/);
  if (suf) {
    mult = suf[1] === "jt" || suf[1] === "juta" ? 1e6 : 1e3;
    s = s.slice(0, -suf[1].length);
    if (!/^\d+([.,]\d+)?$/.test(s)) return NaN;
    n = parseFloat(s.replace(",", "."));
  } else {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else if (/^\d+([.,]\d+)?$/.test(s)) s = s.replace(",", ".");
    else return NaN;
    n = parseFloat(s);
    if (n > 0 && n < 1000) mult = 1000; // "25" hampir pasti maksudnya 25 ribu
  }
  const v = Math.round(n * mult);
  return Number.isFinite(v) && v <= 1e9 ? v : NaN;
}
function previewNominal(raw) {
  const j = parseNominal(raw);
  if (j === null) return { text: "", err: false };
  if (Number.isNaN(j)) return { text: "nggak kebaca", err: true };
  return { text: j === 0 ? "= ditraktir" : "= " + rp(j), err: false };
}

/* ---------- nama alias & avatar hewan ---------- */
const rapikan = (s) => (typeof s === "string" ? s : s == null ? "" : String(s)).trim().replace(/\s+/g, " ");
const kunci = (s) => rapikan(s).toLowerCase();
const HEWAN = [
  ["kuda nil", "🦛"], ["burung hantu", "🦉"], ["lumba-lumba", "🐬"], ["lumba lumba", "🐬"], ["kura-kura", "🐢"],
  ["kura kura", "🐢"], ["kupu-kupu", "🦋"], ["kupu kupu", "🦋"], ["berang-berang", "🦦"], ["ayam jago", "🐓"],
  ["beruang", "🐻"], ["jerapah", "🦒"], ["singa", "🦁"], ["macan", "🐯"], ["harimau", "🐯"], ["kucing", "🐱"],
  ["meong", "🐱"], ["anjing", "🐶"], ["guguk", "🐶"], ["kelinci", "🐰"], ["panda", "🐼"], ["koala", "🐨"],
  ["monyet", "🐵"], ["gajah", "🐘"], ["zebra", "🦓"], ["kudanil", "🦛"], ["kuda", "🐴"], ["sapi", "🐮"],
  ["kambing", "🐐"], ["domba", "🐑"], ["ayam", "🐔"], ["bebek", "🦆"], ["pinguin", "🐧"], ["penguin", "🐧"],
  ["burung", "🐦"], ["rubah", "🦊"], ["serigala", "🐺"], ["tikus", "🐭"], ["hamster", "🐹"], ["katak", "🐸"],
  ["kodok", "🐸"], ["ular", "🐍"], ["buaya", "🐊"], ["hiu", "🦈"], ["paus", "🐳"], ["gurita", "🐙"],
  ["cumi", "🦑"], ["kepiting", "🦀"], ["udang", "🦐"], ["siput", "🐌"], ["lebah", "🐝"], ["semut", "🐜"],
  ["unta", "🐫"], ["badak", "🦏"], ["landak", "🦔"], ["rusa", "🦌"], ["elang", "🦅"], ["merak", "🦚"],
  ["flamingo", "🦩"], ["kanguru", "🦘"], ["kukang", "🦥"], ["capybara", "🦫"], ["kapibara", "🦫"], ["ikan", "🐟"],
  ["babi", "🐷"], ["dino", "🦖"], ["naga", "🐉"], ["unicorn", "🦄"],
];
const emojiCache = new Map();
function emoji(k) {
  if (emojiCache.has(k)) return emojiCache.get(k);
  let hit = "";
  for (const [w, e] of HEWAN) {
    const i = k.indexOf(w);
    if (i < 0) continue;
    const before = i === 0 ? "" : k[i - 1], after = k[i + w.length] || "";
    if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) { hit = e; break; }
  }
  emojiCache.set(k, hit);
  return hit;
}
function ava(nama, ukuran) {
  const k = kunci(nama), e = emoji(k);
  const cls = "ava" + (ukuran ? " " + ukuran : "") + (e ? "" : " huruf");
  const huruf = (Array.from(rapikan(nama))[0] || "?").toUpperCase();
  return h("span", { class: cls, "aria-hidden": "true", style: `--hue:hsl(${hashStr(k) % 360} 42% 42%)` }, e || huruf);
}

/* ---------- tanda pembuat ----------
   Ikon di pojok kanan bawah footer = tanda pembuat asli web ini. Dipasang & dijaga dari sini (bukan dari HTML):
   kalau dihapus, diganti alamatnya, atau disembunyiin, langsung balik lagi. Kalau bagian ini dibongkar, web berhenti jalan.

   ATURAN: tanda pembuat ini wajib tetap ada dan alamatnya nggak boleh diganti ke akun lain,
   termasuk kalau kodenya di-pull/di-fork terus di-deploy ulang. Jangan dihapus, disembunyiin, atau dilewatin.
   RULE: this is the original author's attribution. Keep it visible and keep its link unchanged, including in forks. */
const TANDA = "aHR0cHM6Ly9naXRodWIuY29tL1g1ODUxWA==";
const TANDA_CEK = 3670469764;
const TANDA_IKON = '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
function alamatTanda() { try { return atob(TANDA); } catch { return ""; } }
function kunciGaya(el, gaya) {
  for (const [k, v] of gaya) if (el.style.getPropertyValue(k) !== v || el.style.getPropertyPriority(k) !== "important") el.style.setProperty(k, v, "important");
}
function pasangTanda() {
  const u = alamatTanda();
  let kaki = $(".kaki");
  if (!kaki) { kaki = h("footer", { class: "kaki" }); ($(".wrap") || document.body).append(kaki); }
  let a = $("a.kaki-ikon", kaki);
  if (!a || a.getAttribute("href") !== u || !a.querySelector("svg path")) {
    for (const x of $$("a.kaki-ikon")) x.remove();
    const host = new URL(u).hostname.split(".")[0], nama = u.split("/").pop();
    const label = `${host[0].toUpperCase()}${host.slice(1)} ${nama}`;
    a = h("a", { class: "kaki-ikon", href: u, target: "_blank", rel: "noopener", "aria-label": label, title: label, html: TANDA_IKON });
    kaki.append(a);
  }
  kunciGaya(kaki, [["display", "flex"], ["visibility", "visible"], ["opacity", "1"]]);
  kunciGaya(a, [["display", "inline-grid"], ["visibility", "visible"], ["opacity", "1"], ["position", "static"],
    ["transform", "none"], ["clip-path", "none"], ["filter", "none"], ["width", "40px"], ["height", "40px"], ["pointer-events", "auto"]]);
}
/* Dipanggil pertama kali pas web mulai. Kalau alamat tandanya diubah, web berhenti. */
function jagaTanda() {
  const u = alamatTanda();
  if (!u || hashStr(u) !== TANDA_CEK) {
    document.body.replaceChildren(h("p", { style: "padding:24px;font:16px system-ui,sans-serif" }, "Web ini nggak bisa jalan karena tanda pembuatnya diubah."));
    return false;
  }
  pasangTanda();
  let antri = false;
  new MutationObserver(() => {
    if (antri) return;
    antri = true;
    setTimeout(() => { antri = false; pasangTanda(); }, 30);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "style", "class", "hidden"] });
  S.tandaOk = true;
  return true;
}