"use strict";
/* Stiker kartun jajanan, warna kertas sticky note, dan tebak jenis jajanan dari teks. */

const INK = "#3B2A20";
function muka(cx, cy) {
  return `<g stroke="none"><circle cx="${cx - 5}" cy="${cy}" r="2" fill="${INK}"/><circle cx="${cx + 5}" cy="${cy}" r="2" fill="${INK}"/>` +
    `<circle cx="${cx - 4.3}" cy="${cy - 0.7}" r=".7" fill="#fff"/><circle cx="${cx + 5.7}" cy="${cy - 0.7}" r=".7" fill="#fff"/>` +
    `<ellipse cx="${cx - 9}" cy="${cy + 3.2}" rx="2.5" ry="1.5" fill="#FF8FA8" opacity=".85"/>` +
    `<ellipse cx="${cx + 9}" cy="${cy + 3.2}" rx="2.5" ry="1.5" fill="#FF8FA8" opacity=".85"/></g>` +
    `<path d="M${cx - 2.3} ${cy + 3} q2.3 2.4 4.6 0" fill="none" stroke-width="1.8"/>`;
}
const gambar = (isi) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${isi}</g></svg>`;

const STIKER = {
  matcha: gambar(
    `<path d="M11 27 C10.5 22 14 19.5 18 20.5 C19 15.5 24.5 13 29 15.5 C32 12.5 38.5 13 40.5 17.5 C45 16.5 50 19 51 23 C51.5 25 51.5 26 51 27 Z" fill="#B9D98A"/>` +
    `<g stroke="none" fill="${INK}"><circle cx="18" cy="24.5" r="1.3"/><circle cx="25" cy="21" r="1.3"/><circle cx="31" cy="24.5" r="1.3"/><circle cx="35" cy="19.5" r="1.3"/><circle cx="42" cy="23" r="1.3"/></g>` +
    `<path d="M6 27 H58 C58 42 47 51 32 51 C17 51 6 42 6 27 Z" fill="#FFE893"/>` +
    `<path d="M42 49 C37.5 48.5 33.5 45.5 32 41 C37 40.5 41 43.5 42 49 Z" fill="#B9D98A"/>` +
    `<path d="M42 49 C44 43 49.5 39 56.5 38.5 C55 44.5 49.5 48.5 42 49 Z" fill="#B9D98A"/>` +
    `<path d="M40.5 47 L35 43 M44 47 L52 41.5" fill="none" stroke-width="1.6"/>` + muka(21, 36)),
  boba: gambar(
    `<rect x="35" y="2" width="5" height="22" rx="2.5" fill="#FF7FA5" transform="rotate(14 37.5 13)"/>` +
    `<path d="M17 22 H47 L43 55 Q32 60 21 55 Z" fill="#EBC79E"/>` +
    `<g stroke="none" fill="#4A3326"><circle cx="25.5" cy="50" r="2.7"/><circle cx="32" cy="52.5" r="2.7"/><circle cx="38.5" cy="50" r="2.7"/><circle cx="28.5" cy="45" r="2.7"/><circle cx="35.5" cy="45" r="2.7"/></g>` +
    `<path d="M14 23 Q14 13 32 13 Q50 13 50 23 Z" fill="#FFFFFF"/>` +
    `<rect x="13" y="21" width="38" height="4" rx="2" fill="#FFFFFF"/>` + muka(32, 33)),
  kopi: gambar(
    `<path d="M27 10 q-3 -3 0 -6 M36 10 q-3 -3 0 -6" fill="none" stroke-width="2"/>` +
    `<rect x="24" y="11" width="16" height="6" rx="2" fill="#7A4E3A"/>` +
    `<path d="M19 22 H45 L41.5 57 Q32 59.5 22.5 57 Z" fill="#FFFFFF"/>` +
    `<path d="M20.2 31 H43.8 L42.5 45 H21.5 Z" fill="#E0AE7E"/>` +
    `<rect x="16" y="15" width="32" height="8" rx="3.5" fill="#7A4E3A"/>` + muka(32, 36)),
  sosis: gambar(
    `<rect x="29.5" y="40" width="5" height="22" rx="2.5" fill="#EBC889"/>` +
    `<rect x="20" y="4" width="24" height="40" rx="12" fill="#E0614F"/>` +
    `<path d="M22.5 17 q2.5 3 5 0 t5 0 t5 0 t5 0" fill="none" stroke="#FFD34D" stroke-width="2.6"/>` +
    `<path d="M25 37 l4 -3 M33 39 l5 -4" fill="none" stroke="#A33B2E" stroke-width="2"/>` + muka(32, 27)),
  gorengan: gambar(
    `<path d="M9 39 Q7 26 20 22 Q28 13 41 19 Q55 21 55 35 Q57 49 42 52 Q27 57 16 51 Q8 47 9 39 Z" fill="#F2B544"/>` +
    `<g stroke="none" fill="#D2872A"><circle cx="17" cy="31" r="1.6"/><circle cx="46" cy="28" r="1.6"/><circle cx="48" cy="43" r="1.4"/><circle cx="20" cy="46" r="1.4"/><circle cx="36" cy="22" r="1.3"/></g>` +
    `<path d="M47 6 Q61 10 57 26 Q54 17 45 13 Z" fill="#E8412F"/>` +
    `<path d="M45 13 L42 8 L47 6 Z" fill="#5DB85C"/>` + muka(31, 36)),
  roti: gambar(
    `<path d="M13 28 Q13 11 32 11 Q51 11 51 28 Q51 32 47 33 V53 Q47 56 44 56 H20 Q17 56 17 53 V33 Q13 32 13 28 Z" fill="#E7A65A"/>` +
    `<path d="M18 28 Q18 16 32 16 Q46 16 46 28 Q46 30.5 43 31 V51 H21 V31 Q18 30.5 18 28 Z" fill="#FBE3B3" stroke="none"/>` + muka(32, 37)),
  mie: gambar(
    `<path d="M41 3 L29 30 M48 5 L34 31" fill="none" stroke="#8D5A3B" stroke-width="3"/>` +
    `<path d="M16 32 q4 -9 8 0 t8 0 t8 0 t8 0" fill="none" stroke="#F7C948" stroke-width="3.2"/>` +
    `<rect x="24" y="52" width="16" height="6" rx="2" fill="#F28B6B"/>` +
    `<path d="M8 31 H56 Q55 52 32 54.5 Q9 52 8 31 Z" fill="#F28B6B"/>` +
    `<path d="M13 37 H51" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".75"/>` + muka(32, 43)),
  nasi: gambar(
    `<path d="M11 33 Q12 15 32 14 Q52 15 53 33 Z" fill="#FFFFFF"/>` +
    `<ellipse cx="39" cy="21" rx="8" ry="5" fill="#FFFFFF"/><circle cx="39" cy="21" r="3" fill="#FFC93C"/>` +
    `<path d="M20 22 l2 -1 M25 17 l2 1 M23 27 l2 0" fill="none" stroke-width="1.6"/>` +
    `<path d="M8 32 H56 Q55 52 32 55 Q9 52 8 32 Z" fill="#7FB8E6"/>` + muka(32, 41)),
  eskrim: gambar(
    `<path d="M21 33 H43 L32 61 Z" fill="#E6AC5E"/>` +
    `<path d="M26 38 H38 M28.5 45 H35.5 M30.3 52 H33.7" fill="none" stroke="#B9782F" stroke-width="1.6"/>` +
    `<path d="M14 33 Q12 12 32 11 Q52 12 50 33 Q46 37 42 33 Q38 38 34 33 Q30 38 26 33 Q22 38 18 33 Q16 35 14 33 Z" fill="#FFB3C7"/>` +
    `<path d="M19 22 l3 -1 M42 17 l2 2 M28 16 l3 .5" fill="none" stroke="#5BB3E0" stroke-width="2"/>` +
    `<path d="M33 6 Q35 1 40 1" fill="none" stroke-width="2"/>` +
    `<circle cx="32" cy="8" r="4" fill="#E8412F"/>` + muka(32, 25)),
  snack: gambar(
    `<rect x="14" y="6" width="36" height="7" rx="2" fill="#4FA9CF"/>` +
    `<rect x="16" y="51" width="32" height="7" rx="2" fill="#4FA9CF"/>` +
    `<path d="M16 12 Q13 32 17 52 H47 Q51 32 48 12 Z" fill="#6EC6E8"/>` +
    `<circle cx="32" cy="31" r="12" fill="#FFE07A"/>` + muka(32, 30)),
  belanja: gambar(
    `<path d="M23 23 Q23 10 32 10 Q41 10 41 23" fill="none" stroke-width="3"/>` +
    `<rect x="17" y="11" width="7" height="17" rx="3.5" fill="#E7A65A" transform="rotate(-14 20.5 19.5)"/>` +
    `<path d="M38 24 Q40 12 48 11 Q47 20 41 24 Z" fill="#7CC36E"/>` +
    `<path d="M12 22 H52 L49 57 H15 Z" fill="#E3B67A"/>` + muka(32, 39)),
  lainnya: gambar(
    `<rect x="12" y="22" width="40" height="33" rx="4" fill="#E3B67A"/>` +
    `<rect x="9" y="15" width="46" height="10" rx="3" fill="#EFC891"/>` +
    `<rect x="28" y="15" width="8" height="10" fill="#FF8FAB"/>` +
    `<path d="M32 15 Q24 4 21 11 Q23 16 32 15 Q41 16 43 11 Q40 4 32 15 Z" fill="#FF8FAB"/>` + muka(32, 38)),
};

/* Urutan penting: yang lebih spesifik dicek duluan ("mie ayam" -> mie, bukan nasi). */
const JAJAN = [
  { k: "eskrim", label: "Es krim", re: /\b(es ?krim|ice ?cream|mixue|sundae|gelato|aice|walls|cone)\b/ },
  { k: "matcha", label: "Matcha", re: /\b(matcha|green ?tea|ocha|teh ?hijau)\b/ },
  { k: "boba", label: "Boba & teh", re: /\b(boba|bubble|milk ?tea|thai ?tea|chatime|tiger ?sugar|xing ?fu|teh|tea|taro|yakult|jus|juice)\b/ },
  { k: "kopi", label: "Kopi", re: /\b(kopi|kopsu|coffee|latte|americano|cappuccino|espresso|mocha|macchiato|kenangan|janji ?jiwa|fore|starbucks|tomoro)\b/ },
  { k: "sosis", label: "Sosis & nugget", re: /\b(sosis|sosbak|sausage|corn ?dog|hot ?dog|nugget|odeng|sempol|bakso ?bakar|telur ?gulung)\b/ },
  { k: "gorengan", label: "Gorengan", re: /\b(gorengan|bakwan|tahu|tempe|cireng|cilok|cimol|batagor|risol|risoles|lumpia|pisgor|pisang ?goreng|mendoan|gehu|basreng|cakwe|combro)\b/ },
  { k: "mie", label: "Mie", re: /\b(mie|mi|ramen|indomie|bakmi|noodle|seblak|kwetiau|bihun|udon)\b/ },
  { k: "nasi", label: "Nasi & lauk", re: /\b(nasi|rice|bento|geprek|ayam|rendang|padang|warteg|katsu|bubur|soto|gado|pecel|lontong|ketoprak|sate|bakso)\b/ },
  { k: "roti", label: "Roti & kue", re: /\b(roti|bread|donat|donut|croissant|sandwich|toast|kue|cake|brownies|pastry|martabak|bolu|cookies?|pukis)\b/ },
  { k: "snack", label: "Snack", re: /\b(snack|chitato|keripik|kripik|chiki|cokelat|coklat|chocolate|permen|wafer|biskuit|oreo|pocky|qtela|makaroni|kacang|lays|pringles|silverqueen)\b/ },
  { k: "belanja", label: "Belanjaan", re: /\b(alfagift|alfamart|indomaret|belanja|sabun|tisu|tissue|galon|aqua|air ?mineral|sampo|shampoo|beras|deterjen)\b/ },
  { k: "lainnya", label: "Lainnya", re: null },
];
const jenisValid = (k) => typeof k === "string" && JAJAN.some((j) => j.k === k);
const labelJenis = (k) => (JAJAN.find((j) => j.k === k) || JAJAN[JAJAN.length - 1]).label;
function deteksi(teks) {
  const t = kunci(teks);
  if (!t) return "";
  for (const j of JAJAN) if (j.re && j.re.test(t)) return j.k;
  return "";
}
function stiker(k, size, rot) {
  return h("span", {
    class: "stk", "aria-hidden": "true",
    style: [size ? `--s:${size}px` : "", rot ? `--rot:${rot}deg` : ""].filter(Boolean).join(";") || null,
    html: STIKER[k] || STIKER.lainnya,
  });
}

/* Pola latar: jajanan kartun transparan yang berulang, dari stiker yang sama. Satu ubin 420×420. */
function pasangPola() {
  const isi = [
    ["boba", 18, 22, -14, 0.9], ["kopi", 150, 8, 10, 0.8], ["sosis", 300, 40, -8, 1],
    ["belanja", 195, 70, -10, 0.75], ["gorengan", 78, 140, 16, 0.85], ["mie", 220, 150, -18, 1],
    ["matcha", 345, 185, 12, 0.8], ["roti", 20, 270, 8, 0.95], ["nasi", 150, 300, -6, 0.85], ["snack", 290, 320, 14, 0.9],
  ].map(([k, x, y, r, s]) =>
    `<g transform="translate(${x} ${y}) scale(${s}) rotate(${r} 32 32)">${STIKER[k].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`).join("");
  const kilau = [[120, 232, 7, "#E2A66B"], [255, 236, 6, "#FFD34D"], [392, 112, 7, "#E2A66B"], [362, 268, 5, "#FFD34D"], [60, 398, 6, "#FFD34D"], [242, 396, 7, "#E2A66B"], [110, 92, 5, "#E2A66B"]]
    .map(([x, y, r, c]) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${c}"/>`).join("");
  const ubin = (op) => `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420"><g opacity="${op}">${isi}${kilau}</g></svg>`)}")`;
  const root = document.documentElement.style;
  root.setProperty("--pola-terang", ubin(0.17));
  root.setProperty("--pola-gelap", ubin(0.1));
}

/* Warna kertas sticky note: tetap sama di mode terang dan gelap, karena ini "kertas". */
const KERTAS = [
  { k: "kuning", bg: "#FFE98A", label: "Kuning" },
  { k: "krem", bg: "#FAEACB", label: "Krem" },
  { k: "mint", bg: "#C6EFD0", label: "Mint" },
  { k: "biru", bg: "#C8E4FF", label: "Biru" },
  { k: "ungu", bg: "#E3D6FF", label: "Ungu" },
  { k: "jeruk", bg: "#FFD6AD", label: "Jeruk" },
  { k: "pink", bg: "#FFC9DA", label: "Pink" },
];
const kertasValid = (k) => KERTAS.some((x) => x.k === k);
const kertasBg = (k) => (KERTAS.find((x) => x.k === k) || KERTAS[0]).bg;
const kertasAcak = () => KERTAS[Math.floor(Math.random() * KERTAS.length)].k;

const WAKTU = [{ k: "pagi", label: "Pagi" }, { k: "siang", label: "Siang" }, { k: "sore", label: "Sore" }];
const waktuValid = (k) => WAKTU.some((w) => w.k === k);
const labelWaktu = (k) => (WAKTU.find((w) => w.k === k) || { label: "" }).label;
function waktuSekarang() {
  const j = new Date().getHours();
  return j < 11 ? "pagi" : j < 15 ? "siang" : "sore";
}
