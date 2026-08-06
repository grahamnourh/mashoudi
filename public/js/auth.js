// auth.js — gère la connexion et la redirection si déjà connecté

function urlForRole(role) {
  if (role === "admin") return "/admin.html";
  if (role === "manager") return "/manager.html";
  return "/dashboard.html";
}

fetch("/api/me")
  .then((r) => r.json())
  .then((data) => {
    if (data.connected) window.location.href = urlForRole(data.role);
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
  window.location.href = urlForRole(data.role);
});
