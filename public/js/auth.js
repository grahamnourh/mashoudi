// auth.js — gère la connexion, l'inscription, et la redirection si déjà connecté

const loginCard = document.getElementById("login-card");
const registerCard = document.getElementById("register-card");

document.getElementById("show-register").addEventListener("click", () => {
  loginCard.style.display = "none";
  registerCard.style.display = "block";
});

document.getElementById("show-login").addEventListener("click", () => {
  registerCard.style.display = "none";
  loginCard.style.display = "block";
});

fetch("/api/me")
  .then((r) => r.json())
  .then((data) => {
    if (data.connected) window.location.href = "/dashboard.html";
  });

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error");
  errorBox.style.display = "none";

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.error || "Erreur de connexion.";
    errorBox.style.display = "block";
    return;
  }
  window.location.href = "/dashboard.html";
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value;
  const errorBox = document.getElementById("register-error");
  errorBox.style.display = "none";

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.error || "Erreur lors de la création du compte.";
    errorBox.style.display = "block";
    return;
  }
  window.location.href = "/dashboard.html";
});
