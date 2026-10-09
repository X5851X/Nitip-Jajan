/* Pengaturan Nitip Yuk.
   Kalau web ini jalan bareng worker.js (Cloudflare Workers), catatan otomatis disimpan di server dan sama di semua browser.
   Di hosting statis biasa (tanpa worker), tempel firebaseConfig dari Firebase Console di sini biar satu tim lihat catatan yang sama
   (langkahnya ada di README.md). Kalau dua-duanya nggak ada, catatan cuma tersimpan di browser masing-masing.
   Config Firebase untuk web memang bukan rahasia; yang menjaga data adalah rules Firestore. */
window.NITIP_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "...firebaseapp.com",
  //   projectId: "...",
  //   storageBucket: "...",
  //   messagingSenderId: "...",
  //   appId: "...",
  // },
  koleksi: "titipan-km",
};
