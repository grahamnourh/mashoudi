// db.js — connexion Postgres (Neon, attaché via l'intégration Vercel) et requêtes utiles
// Neon expose DATABASE_URL (ou POSTGRES_URL selon l'intégration) une fois la base
// attachée au projet Vercel ; à définir manuellement en local dans .env.
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
// fullResults: true pour récupérer { rows, rowCount, ... } comme avec pg / better-sqlite3.
const sql = neon(connectionString, { fullResults: true });

// Les tables sont créées à la demande (idempotent), une seule fois par instance froide.
let ready;
function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS commandes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          nom TEXT NOT NULL,
          quantite INTEGER NOT NULL,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          status TEXT NOT NULL DEFAULT 'validee',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `;
    })();
  }
  return ready;
}

module.exports = {
  // ================= Utilisateurs =================
  createUser: async (username, passwordHash) => {
    await ensureSchema();
    const result = await sql`
      INSERT INTO users (username, password_hash) VALUES (${username}, ${passwordHash})
      RETURNING id
    `;
    return result.rows[0];
  },

  findUserByUsername: async (username) => {
    await ensureSchema();
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    return result.rows[0];
  },

  setUserRole: async (username, role) => {
    await ensureSchema();
    return sql`UPDATE users SET role = ${role} WHERE username = ${username}`;
  },

  // ================= Commandes =================

  // Crée une commande directement validée : l'utilisateur ne la revoit plus ensuite.
  createCommande: async ({ user_id, nom, quantite, latitude, longitude }) => {
    await ensureSchema();
    return sql`
      INSERT INTO commandes (user_id, nom, quantite, latitude, longitude, status)
      VALUES (${user_id}, ${nom}, ${quantite}, ${latitude}, ${longitude}, 'validee')
    `;
  },

  // Uniquement les commandes VALIDÉES, tous utilisateurs confondus
  listAllCommandes: async () => {
    await ensureSchema();
    const result = await sql`
      SELECT commandes.*, users.username AS username
      FROM commandes
      JOIN users ON commandes.user_id = users.id
      WHERE commandes.status = 'validee'
      ORDER BY commandes.created_at DESC
    `;
    return result.rows;
  },

  // L'admin peut modifier une commande, uniquement si elle est déjà validée
  updateCommandeAsAdmin: async (id, { nom, quantite }) => {
    await ensureSchema();
    return sql`
      UPDATE commandes SET nom = ${nom}, quantite = ${quantite}
      WHERE id = ${id} AND status = 'validee'
    `;
  },

  // L'admin peut supprimer une commande, uniquement si elle est déjà validée
  deleteCommandeAsAdmin: async (id) => {
    await ensureSchema();
    return sql`DELETE FROM commandes WHERE id = ${id} AND status = 'validee'`;
  },
};
