// dashboard.js

const submitBtn = document.getElementById("submit-btn");

// Position capturée en silence — jamais affichée ni mentionnée à l'écran.
let currentLat = null;
let currentLng = null;

fetch("/api/me")
  .then((r) => r.json())
  .then((data) => {
    if (!data.connected) {
      window.location.href = "/index.html";
    } else {
      document.getElementById("user-badge").textContent = "@" + data.username;
      if (data.role === "admin") {
        document.getElementById("admin-link-card").style.display = "block";
      }
    }
  });

// --- Capture silencieuse de la position ---
// Le bouton reste désactivé ("Patientez…") tant qu'on n'a pas de position.
// Aucun texte, aucun champ n'indique à l'utilisateur ce qui se passe.
function tryGetLocation() {
  if (!("geolocation" in navigator)) {
    setTimeout(tryGetLocation, 5000);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      submitBtn.disabled = false;
      submitBtn.textContent = "Valider la commande";
    },
    () => {
      // Échec (refus, timeout...) : on retente en silence, sans jamais rien afficher.
      setTimeout(tryGetLocation, 5000);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

tryGetLocation();

// --- Menu : bascule entre "Nouvelle commande" et "Paramètres" ---
const navCommande = document.getElementById("nav-commande");
const navSettings = document.getElementById("nav-settings");
const viewCommande = document.getElementById("view-commande");
const viewSettings = document.getElementById("view-settings");

navCommande.addEventListener("click", () => {
  navCommande.classList.add("active");
  navSettings.classList.remove("active");
  viewCommande.style.display = "block";
  viewSettings.style.display = "none";
});

navSettings.addEventListener("click", () => {
  navSettings.classList.add("active");
  navCommande.classList.remove("active");
  viewSettings.style.display = "block";
  viewCommande.style.display = "none";
});

// --- Changement de mot de passe ---
document.getElementById("password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("password-error");
  const successBox = document.getElementById("password-success");
  errorBox.style.display = "none";
  successBox.style.display = "none";

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (newPassword !== confirmPassword) {
    errorBox.textContent = "Les deux mots de passe ne correspondent pas.";
    errorBox.style.display = "block";
    return;
  }

  const res = await fetch("/api/me/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.error || "Erreur.";
    errorBox.style.display = "block";
    return;
  }

  successBox.textContent = "Mot de passe modifié ✓";
  successBox.style.display = "block";
  document.getElementById("password-form").reset();
});

// --- Création d'une commande ---
document.getElementById("commande-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("form-error");
  const successBox = document.getElementById("form-success");
  errorBox.style.display = "none";
  successBox.style.display = "none";

  const payload = {
    nom: document.getElementById("nom").value.trim(),
    quantite: document.getElementById("quantite").value,
    latitude: currentLat,
    longitude: currentLng,
  };

  const res = await fetch("/api/commandes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok) {
    errorBox.textContent = data.error || "Erreur lors de l'envoi.";
    errorBox.style.display = "block";
    return;
  }

  successBox.textContent = "Commande validée ✓";
  successBox.style.display = "block";
  document.getElementById("commande-form").reset();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/index.html";
});
