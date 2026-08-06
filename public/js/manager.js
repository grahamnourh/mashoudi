// manager.js

fetch("/api/me")
  .then((r) => r.json())
  .then((data) => {
    if (!data.connected) {
      window.location.href = "/index.html";
      return;
    }
    if (data.role !== "manager") {
      window.location.href = "/dashboard.html";
      return;
    }
    document.getElementById("user-badge").textContent = "@" + data.username + " (manager)";
  });

// --- Menu : bascule entre "Tableau des commandes" et "Ajouter une commande" ---
const navList = document.getElementById("nav-list");
const navAdd = document.getElementById("nav-add");
const viewList = document.getElementById("view-list");
const viewAdd = document.getElementById("view-add");

navList.addEventListener("click", () => {
  navList.classList.add("active");
  navList.classList.remove("secondary");
  navAdd.classList.remove("active");
  navAdd.classList.add("secondary");
  viewList.style.display = "block";
  viewAdd.style.display = "none";
});

navAdd.addEventListener("click", () => {
  navAdd.classList.add("active");
  navAdd.classList.remove("secondary");
  navList.classList.remove("active");
  navList.classList.add("secondary");
  viewAdd.style.display = "block";
  viewList.style.display = "none";
});

// --- Le tableau est la vue principale : on le charge dès l'arrivée sur la page ---
loadCommandes();

// --- Capture silencieuse de la position (nécessaire pour créer une commande) ---
const submitBtn = document.getElementById("submit-btn");
let currentLat = null;
let currentLng = null;

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

// --- Liste des commandes (tableau, lecture seule) ---
let allCommandes = [];

async function loadCommandes() {
  const res = await fetch("/api/manager/commandes");
  if (!res.ok) return;
  allCommandes = await res.json();
  applyFilters();
}

// --- Filtres : utilisateur, date, nom du client (appliqués côté client) ---
function getFilteredCommandes() {
  const userFilter = document.getElementById("filter-user").value.trim().toLowerCase();
  const dateFilter = document.getElementById("filter-date").value; // "YYYY-MM-DD"
  const nomFilter = document.getElementById("filter-nom").value.trim().toLowerCase();

  return allCommandes.filter((c) => {
    if (userFilter && !c.username.toLowerCase().includes(userFilter)) return false;
    if (nomFilter && !c.nom.toLowerCase().includes(nomFilter)) return false;
    if (dateFilter) {
      const d = new Date(c.created_at);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (localDate !== dateFilter) return false;
    }
    return true;
  });
}

function applyFilters() {
  const filtered = getFilteredCommandes();

  document.getElementById("count-badge").textContent = `${filtered.length} commande(s)`;

  const totalQuantite = filtered.reduce((sum, c) => sum + c.quantite, 0);
  document.getElementById("total-quantite-cell").textContent = totalQuantite;
  document.getElementById("total-cout-cell").textContent = formatPrixTotal(totalQuantite);

  const tbody = document.getElementById("commandes-tbody");
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-dim);">Aucune commande.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((c) => `
    <tr>
      <td>@${escapeHtml(c.username)}</td>
      <td>${new Date(c.created_at).toLocaleString("fr-FR")}</td>
      <td>${escapeHtml(c.nom)}</td>
      <td>${c.quantite}</td>
      <td>${formatPrixTotal(c.quantite)}</td>
      <td><input type="text" class="comment-input" data-id="${c.id}" value="${escapeAttr(c.commentaire || "")}" placeholder="Commentaire…"></td>
    </tr>
  `).join("");

  document.querySelectorAll(".comment-input").forEach((input) => {
    input.addEventListener("change", () => saveComment(input));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
  });
}

async function saveComment(input) {
  const id = input.dataset.id;
  const commentaire = input.value.trim();

  const res = await fetch(`/api/commandes/${id}/commentaire`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentaire }),
  });

  if (!res.ok) {
    alert("Erreur lors de l'enregistrement du commentaire.");
    return;
  }

  const c = allCommandes.find((x) => String(x.id) === String(id));
  if (c) c.commentaire = commentaire;
}

["filter-user", "filter-date", "filter-nom"].forEach((id) => {
  document.getElementById(id).addEventListener("input", applyFilters);
});
document.getElementById("filter-reset").addEventListener("click", () => {
  document.getElementById("filter-user").value = "";
  document.getElementById("filter-date").value = "";
  document.getElementById("filter-nom").value = "";
  applyFilters();
});

const PRIX_UNITAIRE_FCFA = 250;

function formatPrixTotal(quantite) {
  return `${(quantite * PRIX_UNITAIRE_FCFA).toLocaleString("fr-FR")} FCFA`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
