# 📱 Bot Telegram - Gestion Inscription Élèves (Mini App)

Ce projet est un Bot Telegram couplé à une **Mini App (Web App)** pour gérer l'inscription des élèves.
Il offre une interface utilisateur moderne (Thème "Yellow Gold"), fluide et responsive pour saisir les informations des étudiants et leurs parrainages (Tree).



## 🚀 Fonctionnalités

* **Bot Telegram :** Sert de point d'entrée avec un bouton pour lancer l'application.
* **Mini App (Frontend) :** Formulaire complet avec validation, animations UX et mode sombre automatique.
* **Backend (Node.js/Express) :** API REST pour recevoir les données du formulaire.
* **Tech Stack :** Node.js, Telegraf, Express, HTML5, TailwindCSS (CDN).

---

## 🛠️ Installation & Démarrage

Pour tester le projet en local sur votre machine :

### 1. Prérequis
* Node.js (v16 ou supérieur)
* Un compte Telegram et un Token de bot (via @BotFather)

### 2. Cloner et Installer
```bash
git clone [https://github.com/VOTRE-USER/NOM-DU-REPO.git](https://github.com/VOTRE-USER/NOM-DU-REPO.git)
cd NOM-DU-REPO
npm install
```

### 3. Configuration (.env)
Créez un fichier `.env` à la racine et ajoutez-y votre token :

```env
PORT=3000
BOT_TOKEN=votre_token_telegram_ici
# En local, vous pouvez laisser ça vide
RENDER_EXTERNAL_URL=
```

### 3. Configuration (.env)
Créez un fichier .env à la racine et ajoutez-y votre token :

## 📂 Structure du Projet

- index.js : Point d'entrée. Contient le serveur Express (API) et la logique du Bot Telegram.

- public/index.html : Frontend. Le code de la Mini App (HTML/JS/Tailwind). C'est ici que se trouve le design.

- package.json : Liste des dépendances.

## ⚙️ Documentation API

Actuellement, le serveur stocke les données dans une variable temporaire (students array) dans index.js.

Note aux devs Backend : Vous devez implémenter la vérification du header X-Telegram-Data avant d'accepter une requête. Si la signature est invalide, renvoyez une erreur 403.

#### Endpoint d'Inscription
Le Frontend envoie une requête POST lorsque l'utilisateur clique sur "Enregistrer".

- URL : /api/students

- Méthode : POST

- Content-Type : application/json
- 

#### Format des données reçues (Payload JSON) :

```JSON
{
  "nomComplet": "Jean Rakoto",      // String (Requis)
  "telephone": "034 00 000 00",     // String
  "dateNaissance": "2000-01-01",    // String (Format YYYY-MM-DD)
  "adresse": "Lot IV, Antananarivo",// String
  "eglise": "FJKM Analakely",       // String
  "profession": "Etudiant",         // String
  "option": "Journalier",           // String ("Journalier" ou "Weekend")

  // --- Partie Tree / Parrainage ---
  "idApp": "APP-1234",              // String
  "nomTree": "Papa Jean",           // String
  "telTree": "033 11 222 33",       // String
  "liaison": "Père",                // String
  "departement": "Informatique"     // String
}
```

#### Réponse attendue par le Front :
Si l'insertion en BDD réussit, renvoyez simplement :

```JSON
{
  "success": true,
  "message": "Enregistré avec succès"
}
```

#### Exemple de Logique de Validation (Node.js) :
```JS
const crypto = require('crypto');

function verifyTelegramData(initData) {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // 1. Trier les clés alphabétiquement
    const dataCheckString = Array.from(urlParams.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, val]) => `${key}=${val}`)
        .join('\n');

    // 2. Créer la clé secrète (HMAC-SHA256 du Token Bot)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    
    // 3. Calculer le hash attendu
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // 4. Comparer
    return calculatedHash === hash;
}
```

## 📝 TODO List (Reste à faire)
- [x] Frontend : UI Yellow Theme + Envoi du Header Auth.

- [x] Bot : Launcher WebApp prêt.

- [x] Securité : Validation HMAC implémentée sur le squelette.

- [ ] Backend : Connexion BDD (MySQL/Postgres) à faire.

- [ ] Backend : Gestion des erreurs (Doublons, champs manquants).



