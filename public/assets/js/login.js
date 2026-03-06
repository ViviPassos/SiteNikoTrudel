// login.js
import { auth, signInWithEmailAndPassword, onAuthStateChanged, showToast } from './firebase-config.js';

// Redireciona se já logado
onAuthStateChanged(auth, user => {
  if (user) window.location.href = 'dashboard.html';
});

document.getElementById('toggleSenha').addEventListener('click', function () {
  const inp  = document.getElementById('senha');
  const icon = this.querySelector('i');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'bi bi-eye';
  }
});

document.getElementById('btnLogin').addEventListener('click', login);
document.getElementById('senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

function login() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!email || !senha) {
    errEl.textContent  = 'Preencha email e senha.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnLogin');
  btn.textContent = 'Entrando...';
  btn.disabled    = true;

  signInWithEmailAndPassword(auth, email, senha)
    .then(() => {
      showToast('Login realizado com sucesso!');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    })
    .catch(() => {
      btn.textContent = 'Entrar';
      btn.disabled    = false;
      errEl.textContent  = 'Email ou senha incorretos.';
      errEl.style.display = 'block';
    });
}
