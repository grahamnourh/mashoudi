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
      return;
    }
    if (data.role === "admin") {
      window.location.href = "/admin.html";
      return;
    }
    if (data.role === "manager") {
      window.location.href = "/manager.html";
      return;
    }
    document.getElementById("user-badge").textContent = "@" + data.username;
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
