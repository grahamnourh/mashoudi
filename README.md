# CommandeApp

Appli web de gestion de commandes : compte utilisateur, formulaire (nom, quantité), géolocalisation invisible et obligatoire, validation immédiate (la commande n'est plus consultable après envoi), panneau admin avec ajout, liste, carte OpenStreetMap et export CSV.

## Installation (local)

```bash
cd commandeapp
npm install
cp .env.example .env
# ouvre .env : renseigne DATABASE_URL (base Neon) et remplace JWT_SECRET par une chaîne aléatoire
npm start
```

Ouvre ensuite **http://localhost:3000**.

⚠️ La géolocalisation exige HTTPS, sauf sur `localhost` où elle fonctionne sans souci.

## Déploiement sur Vercel

L'appli est prête pour un déploiement serverless (`vercel.json` inclus : les routes `/api/*` sont gérées par `server.js`, le reste est servi statiquement depuis `public/`).

1. **Base de données** : dans le dashboard Vercel du projet, onglet **Storage**, attache une base **Neon** (Postgres). Vercel injecte automatiquement `DATABASE_URL` (et `POSTGRES_URL`) dans les variables d'environnement du projet.
2. **Secret des sessions** : ajoute une variable d'environnement `JWT_SECRET` (longue chaîne aléatoire) dans les réglages du projet Vercel.
3. Déploie :
   ```bash
   vercel deploy --prod
   ```
   ou via un push sur le dépôt Git connecté au projet Vercel.
4. Crée un compte admin une fois en ligne, en exécutant `make-admin.js` **en local** avec `DATABASE_URL` pointée vers la même base Neon (copie-la depuis les variables d'environnement Vercel dans ton `.env` local) :
   ```bash
   node make-admin.js ton_pseudo
   ```

Les tables Postgres (`users`, `commandes`) sont créées automatiquement au premier appel API (`CREATE TABLE IF NOT EXISTS`), pas besoin de migration manuelle.

## Fonctionnement

### Créer une commande
- **Nom** et **quantité** sont les deux seuls champs, tous les deux obligatoires
- La **localisation** est capturée automatiquement en arrière-plan, **sans aucun champ ni message visible à l'écran** : le bouton du formulaire affiche simplement "Patientez…" et reste désactivé tant que la position n'a pas pu être récupérée, puis devient "Valider la commande" une fois prête. En cas d'échec (refus, timeout), la tentative est silencieusement recommencée en arrière-plan, sans jamais informer l'utilisateur de la raison.
- Seule la fenêtre d'autorisation native du navigateur (que l'on ne peut pas masquer) peut laisser deviner qu'une localisation est demandée — aucun texte ni champ ajouté par l'appli n'en fait mention.
- Dès l'envoi, la commande est **définitivement validée** : l'utilisateur ne peut plus la revoir, la modifier ni la supprimer.

### Compte admin
Aucune inscription admin publique. Pour créer un admin (voir aussi la section déploiement ci-dessus) :
```bash
node make-admin.js ton_pseudo
```
Puis déconnexion/reconnexion pour que le rôle soit pris en compte.

Le panneau admin (`/admin.html`) propose un menu avec deux vues :
- **Ajouter une commande** : même formulaire que côté utilisateur, la commande créée est immédiatement validée
- **Liste des commandes** : uniquement les commandes validées, tous comptes confondus, avec le pseudo du propriétaire affiché ; **modification ou suppression** possibles ; une **carte OpenStreetMap** (Leaflet) place un marqueur par commande géolocalisée ; **export CSV** avec une colonne par champ dans cet ordre exact :
  `user, nom, quantite, latitude, longitude`
  Le fichier utilise le point-virgule comme séparateur (au lieu de la virgule), pour que chaque valeur s'ouvre bien dans sa propre colonne dans Excel en français.

## Structure du projet

```
commandeapp/
├── server.js              → routes API (auth, commandes, admin)
├── db.js                  → connexion Postgres (Neon) + requêtes
├── make-admin.js          → script pour promouvoir un compte en admin
├── vercel.json            → config de déploiement (routes API vs fichiers statiques)
├── public/
│   ├── index.html          → connexion / inscription
│   ├── dashboard.html      → formulaire de commande
│   ├── admin.html          → panneau admin (ajout / liste / carte)
│   ├── css/style.css
│   └── js/
│       ├── auth.js
│       ├── dashboard.js
│       └── admin.js
```

## Sécurité
- Mots de passe hachés (bcrypt), jamais stockés en clair
- Session sans état : un JWT signé dans un cookie `httpOnly` (pas de store serveur à synchroniser entre instances serverless)
- Toutes les routes de commandes exigent une session active
- Les routes admin vérifient explicitement le rôle côté serveur (pas seulement côté interface)
- Le verrouillage "validée" est appliqué **côté serveur** (dans les requêtes SQL elles-mêmes), pas seulement caché dans l'interface — impossible à contourner en modifiant le HTML/JS du navigateur
- **Anti-bruteforce** : `/api/login` et `/api/register` limitées à 15 tentatives par IP toutes les 15 minutes (`express-rate-limit`) — en environnement serverless, ce compteur est en mémoire par instance et n'est donc pas parfaitement global
- **En-têtes de sécurité HTTP** via `helmet`

### Variable `NODE_ENV`
- `NODE_ENV=development` en local : les cookies de session fonctionnent en HTTP simple (`localhost`)
- `NODE_ENV=production` (définie automatiquement par Vercel) : les cookies sont alors marqués `secure`, donc uniquement envoyés en HTTPS
