// Firebase SDKs
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

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
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// ── Auth helpers ──────────────────────────────────────────────────────────────
function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      if (user) resolve(user);
      else { window.location.href = 'login.html'; reject('Não autenticado'); }
    });
  });
}

function logout() {
  signOut(auth).then(() => { window.location.href = 'login.html'; });
}

// ── Upload imagem ─────────────────────────────────────────────────────────────
async function uploadImagem(file, path) {
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file);
  return await getDownloadURL(sRef);
}

// ── Formatação ────────────────────────────────────────────────────────────────
function formatBRL(val) {
  return 'R$ ' + Number(val).toFixed(2).replace('.', ',');
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim().replace(/\s+/g, '_');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' error' : ''}`;
  toast.innerHTML = `<i class="bi bi-${type === 'error' ? 'x-circle-fill' : 'check-circle-fill'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

export {
  auth, db, storage,
  signInWithEmailAndPassword, onAuthStateChanged,
  ref, set, get, update, remove, onValue,
  requireAuth, logout, uploadImagem, formatBRL, slugify, showToast
};

