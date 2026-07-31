// admin.js

fetch("/api/me")
  .then((r) => r.json())
  .then((data) => {
    if (!data.connected) {
      window.location.href = "/index.html";
      return;
    }
    if (data.role !== "admin") {
      window.location.href = "/dashboard.html";
      return;
    }
    document.getElementById("user-badge").textContent = "@" + data.username + " (admin)";
  });

// --- Menu : bascule entre "Ajouter une commande" et "Liste des commandes" ---
const navAdd = document.getElementById("nav-add");
const navList = document.getElementById("nav-list");
const viewAdd = document.getElementById("view-add");
const viewList = document.getElementById("view-list");

navAdd.addEventListener("click", () => {
  navAdd.classList.add("active");
  navList.classList.remove("active");
  viewAdd.style.display = "block";
  viewList.style.display = "none";
});

navList.addEventListener("click", () => {
  navList.classList.add("active");
  navAdd.classList.remove("active");
  viewList.style.display = "block";
  viewAdd.style.display = "none";
  loadAllCommandes();
});

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

// --- Création d'une commande (admin) ---
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

async function loadAllCommandes() {
  const res = await fetch("/api/admin/commandes");
  if (!res.ok) return;
  const commandes = await res.json();

  document.getElementById("count-badge").textContent = `${commandes.length} commande(s)`;
  updateMapMarkers(commandes);

  const list = document.getElementById("admin-entries-list");
  if (commandes.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim); font-size:0.85rem;">Aucune commande validée pour le moment.</p>';
    return;
  }

  list.innerHTML = commandes.map(renderCommande).join("");
  attachHandlers();
}

// --- Carte OpenStreetMap : un marqueur par commande géolocalisée ---
let map = null;
let markersLayer = null;

function ensureMap() {
  if (map) return;
  map = L.map("map").setView([46.6034, 1.8883], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function updateMapMarkers(commandes) {
  ensureMap();
  markersLayer.clearLayers();

  const points = [];
  commandes.forEach((c) => {
    if (c.latitude == null || c.longitude == null) return;
    L.marker([c.latitude, c.longitude])
      .bindPopup(`<strong>${escapeHtml(c.nom)}</strong><br>qté ${c.quantite}<br>@${escapeHtml(c.username)}`)
      .addTo(markersLayer);
    points.push([c.latitude, c.longitude]);
  });

  if (points.length > 0) {
    map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
  }
  setTimeout(() => map.invalidateSize(), 0);
}

function renderCommande(c) {
  return `
    <div class="entry-item" data-id="${c.id}">
      <div class="entry-top">
        <div class="entry-name">
          ${escapeHtml(c.nom)} — qté ${c.quantite}
          <span class="entry-owner">@${escapeHtml(c.username)}</span>
        </div>
      </div>
      <div class="entry-coords">${c.latitude ?? "?"}, ${c.longitude ?? "?"}</div>
      <div class="entry-date">${new Date(c.created_at).toLocaleString("fr-FR")}</div>
      <div class="entry-actions">
        <button type="button" class="small secondary edit-btn" data-id="${c.id}">Modifier</button>
        <button type="button" class="small danger delete-btn" data-id="${c.id}">Supprimer</button>
      </div>
      <div class="edit-slot"></div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer définitivement cette commande ?")) return;
      const res = await fetch(`/api/admin/commandes/${btn.dataset.id}`, { method: "DELETE" });
      if (res.ok) loadAllCommandes();
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditForm(btn.dataset.id));
  });
}

function openEditForm(id) {
  const item = document.querySelector(`.entry-item[data-id="${id}"]`);
  const slot = item.querySelector(".edit-slot");
  const nomActuel = item.querySelector(".entry-name").childNodes[0].textContent.split(" — qté ")[0].trim();
  const qteMatch = item.querySelector(".entry-name").textContent.match(/qté (\d+)/);
  const qteActuelle = qteMatch ? qteMatch[1] : "";

  slot.innerHTML = `
    <div class="edit-form">
      <input type="text" class="edit-nom" value="${escapeAttr(nomActuel)}" placeholder="Nom">
      <input type="number" class="edit-quantite" value="${escapeAttr(qteActuelle)}" min="1" placeholder="Quantité">
      <div class="edit-form-actions">
        <button type="button" class="small save-btn">Enregistrer</button>
        <button type="button" class="small secondary cancel-btn">Annuler</button>
      </div>
    </div>`;

  slot.querySelector(".cancel-btn").addEventListener("click", () => (slot.innerHTML = ""));

  slot.querySelector(".save-btn").addEventListener("click", async () => {
    const payload = {
      nom: slot.querySelector(".edit-nom").value.trim(),
      quantite: slot.querySelector(".edit-quantite").value,
    };
    const res = await fetch(`/api/admin/commandes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erreur.");
    loadAllCommandes();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
