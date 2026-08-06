// create-user.js — crée un compte directement en base (pas d'inscription publique dans l'appli)
// Usage : node create-user.js <nom_utilisateur> <mot_de_passe> [admin|manager]
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { createUser, findUserByUsername, setUserRole } = require("./db");

const ROLES = ["admin", "manager"];

async function main() {
  const [username, password, role] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Usage : node create-user.js <nom_utilisateur> <mot_de_passe> [admin|manager]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("❌ Le mot de passe doit faire au moins 6 caractères.");
    process.exit(1);
  }
  if (role && !ROLES.includes(role)) {
    console.error(`❌ Rôle inconnu "${role}". Valeurs possibles : ${ROLES.join(", ")} (ou rien pour un compte utilisateur normal).`);
    process.exit(1);
  }
  if (await findUserByUsername(username)) {
    console.error(`❌ Le nom d'utilisateur "${username}" est déjà pris.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await createUser(username, passwordHash);

  if (role) {
    await setUserRole(username, role);
  }

  console.log(`✅ Compte "${username}" créé${role ? ` (${role})` : ""}.`);
}

main();
