// make-admin.js — promeut un compte existant au rôle "admin"
// Usage : node make-admin.js <nom_utilisateur>
require("dotenv").config();
const { setUserRole, findUserByUsername } = require("./db");

async function main() {
  const username = process.argv[2];

  if (!username) {
    console.error("Usage : node make-admin.js <nom_utilisateur>");
    process.exit(1);
  }

  const user = await findUserByUsername(username);
  if (!user) {
    console.error(`❌ Aucun compte trouvé avec le nom "${username}". Crée d'abord le compte via l'appli.`);
    process.exit(1);
  }

  const result = await setUserRole(username, "admin");
  if (result.rowCount === 0) {
    console.error(`❌ Aucune ligne modifiée pour "${username}". Vérifie le nom exact du compte.`);
    process.exit(1);
  }
  console.log(`✅ Le compte "${username}" est maintenant administrateur.`);
}

main();
