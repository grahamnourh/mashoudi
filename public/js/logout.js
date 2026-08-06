// logout.js — lien de déconnexion commun à toutes les pages authentifiées
// (remplace l'ancien bouton "Se déconnecter" par un texte discret en bas à droite)

const logoutLink = document.createElement("a");
logoutLink.href = "#";
logoutLink.className = "logout-link";
logoutLink.textContent = "Se déconnecter";

logoutLink.addEventListener("click", async (e) => {
  e.preventDefault();
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/index.html";
});

document.body.appendChild(logoutLink);
