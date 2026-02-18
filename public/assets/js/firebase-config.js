// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// SUA CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyB4i4Pf34S3U_qel2Mu4p5EK6mdKfUb3iA",
  authDomain: "sitenikotrudel.firebaseapp.com",
  databaseURL: "https://sitenikotrudel-default-rtdb.firebaseio.com",
  projectId: "sitenikotrudel",
  storageBucket: "sitenikotrudel.firebasestorage.app",
  messagingSenderId: "777376616597",
  appId: "1:777376616597:web:8d64226e90dffbc3318b9c",
  measurementId: "G-YWRTVG84RW"
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);
const storage = getStorage(app);

export { database, storage };
