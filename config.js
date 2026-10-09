/* Pengaturan Nitip Yuk.
   Selama `firebase` masih null, web jalan di "mode coba": catatan cuma tersimpan di browser ini.
   Biar satu tim lihat catatan yang sama, tempel firebaseConfig dari Firebase Console di sini
   (langkahnya ada di README.md). Config Firebase untuk web memang bukan rahasia; yang menjaga data adalah rules Firestore. */
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
