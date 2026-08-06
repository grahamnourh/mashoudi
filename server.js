// server.js — point d'entrée de l'application
require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const {
  findUserByUsername,
  createCommande,
  listAllCommandes,
  updateCommandeAsAdmin,
  deleteCommandeAsAdmin,
  updateCommandeComment,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-a-changer";
const COOKIE_NAME = "session";

// Nécessaire derrière un proxy HTTPS (Vercel...) pour que les cookies
// "secure" soient correctement reconnus comme envoyés en HTTPS.
app.set("trust proxy", 1);

// En-têtes de sécurité HTTP de base.
// La CSP par défaut de helmet est désactivée ici car elle bloquerait Google Fonts,
// les scripts inline et la carte OpenStreetMap (Leaflet via CDN) ; à durcir si besoin plus tard.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Limite les tentatives de connexion (protection anti-bruteforce)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 tentatives max par IP sur la fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessaie dans quelques minutes." },
});

// --- Session sans état : un JWT signé dans un cookie httpOnly (pas de store serveur,
// ce qui convient à un environnement serverless comme Vercel où le disque n'est pas partagé).
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24h
    secure: isProd, // true uniquement en production, derrière un vrai HTTPS
    sameSite: "lax",
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Non authentifié." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Non authentifié." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Accès non autorisé." });
      }
      next();
    });
  };
}

const requireAdmin = requireRole("admin");
const requireManager = requireRole("manager");

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[";\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Express 4 ne récupère pas automatiquement le rejet d'une promesse dans un
// handler async : sans ce filet, une erreur DB deviendrait un rejet non
// intercepté et ferait planter tout le process (fatal en environnement serverless).
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ============ ROUTES AUTH ============
// Pas d'inscription publique : les comptes sont créés par l'administrateur via
// `node create-user.js <nom> <mot_de_passe> [role]`.

app.post("/api/login", authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUsername(username);

  if (!user) return res.status(401).json({ error: "Identifiants invalides." });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Identifiants invalides." });

  setAuthCookie(res, { userId: user.id, username: user.username, role: user.role });
  res.json({ ok: true, username: user.username, role: user.role });
}));

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.json({ connected: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ connected: true, username: payload.username, role: payload.role });
  } catch {
    res.json({ connected: false });
  }
});

// ============ ROUTES COMMANDES (utilisateur) ============

// Créer une commande : validée immédiatement, l'utilisateur ne la revoit plus ensuite.
// La localisation est obligatoire.
app.post("/api/commandes", requireAuth, asyncHandler(async (req, res) => {
  const { nom, quantite, latitude, longitude } = req.body;

  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: "Le champ nom est obligatoire." });
  }
  if (quantite === undefined || quantite === null || quantite === "" || Number(quantite) <= 0) {
    return res.status(400).json({ error: "Le champ quantité est obligatoire et doit être positif." });
  }
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return res.status(400).json({ error: "Action indisponible pour le moment. Réessaie dans un instant." });
  }

  await createCommande({
    user_id: req.user.userId,
    nom: nom.trim(),
    quantite: Number(quantite),
    latitude,
    longitude,
  });

  res.json({ ok: true });
}));

// ============ ROUTES MANAGER ============

// Voir toutes les commandes VALIDÉES, tous utilisateurs confondus (lecture seule)
app.get("/api/manager/commandes", requireManager, asyncHandler(async (req, res) => {
  res.json(await listAllCommandes());
}));

// ============ ROUTES PARTAGÉES ADMIN + MANAGER ============

// Annoter une commande d'un commentaire libre : seul champ modifiable par le manager.
app.put("/api/commandes/:id/commentaire", requireRole("admin", "manager"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const commentaire = typeof req.body.commentaire === "string" ? req.body.commentaire.trim() : "";

  const result = await updateCommandeComment(id, commentaire);
  if (result.rowCount === 0) return res.status(404).json({ error: "Commande introuvable." });
  res.json({ ok: true });
}));

// ============ ROUTES ADMIN ============

// Voir toutes les commandes VALIDÉES, tous utilisateurs confondus
app.get("/api/admin/commandes", requireAdmin, asyncHandler(async (req, res) => {
  res.json(await listAllCommandes());
}));

// Modifier une commande, uniquement si déjà validée
app.put("/api/admin/commandes/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { nom, quantite } = req.body;

  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: "Le champ nom est obligatoire." });
  }
  if (quantite === undefined || quantite === null || quantite === "" || Number(quantite) <= 0) {
    return res.status(400).json({ error: "Le champ quantité est obligatoire et doit être positif." });
  }

  const result = await updateCommandeAsAdmin(id, { nom: nom.trim(), quantite: Number(quantite) });

  if (result.rowCount === 0) return res.status(404).json({ error: "Commande introuvable." });
  res.json({ ok: true });
}));

// Supprimer une commande, uniquement si déjà validée
app.delete("/api/admin/commandes/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await deleteCommandeAsAdmin(id);
  if (result.rowCount === 0) return res.status(404).json({ error: "Commande introuvable." });
  res.json({ ok: true });
}));

// Prix unitaire fixe utilisé pour calculer le prix total d'une commande.
const PRIX_UNITAIRE_FCFA = 250;

// Export CSV — uniquement les commandes VALIDÉES.
// Colonnes dans l'ordre exact : user, nom, quantite, prix_total_fcfa, latitude, longitude, commentaire
// Séparateur ";" (et ligne "sep=;") pour qu'Excel en français découpe bien chaque
// valeur dans sa propre colonne, plutôt que tout mettre dans une seule cellule.
app.get("/api/admin/commandes/export", requireAdmin, asyncHandler(async (req, res) => {
  const commandes = await listAllCommandes();
  const header = ["user", "nom", "quantite", "prix_total_fcfa", "latitude", "longitude", "commentaire"];
  const rows = commandes.map((c) =>
    [c.username, c.nom, c.quantite, c.quantite * PRIX_UNITAIRE_FCFA, c.latitude, c.longitude, c.commentaire]
      .map(csvEscape)
      .join(";")
  );
  const csv = ["sep=;", header.join(";"), ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="commandes_export.csv"');
  res.send("﻿" + csv); // BOM pour un affichage correct des accents dans Excel
}));

// Gestionnaire d'erreurs global : toute erreur transmise par asyncHandler (ex. base
// de données injoignable) finit ici plutôt que de faire planter le process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erreur serveur. Réessaie dans un instant." });
});

// En local (npm start / npm run dev) on écoute un port classique.
// Sur Vercel, le module exporté est directement utilisé comme handler serverless :
// il ne faut pas appeler app.listen() dans ce cas.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
  });
}

module.exports = app;
