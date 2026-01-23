require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;

// --- 3. VÉRIFICATION DE SÉCURITÉ ---
if (!BOT_TOKEN) {
  console.error(
    "❌ ERREUR FATALE : La variable 'BOT_TOKEN' manque dans le fichier .env",
  );
  process.exit(1);
}
if (!WEB_APP_URL) {
  console.error(
    "❌ ERREUR FATALE : La variable 'WEB_APP_URL' manque dans le fichier .env",
  );
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- DONNÉES DE TEST (Base de données temporaire) ---
let students = [
  {
    id: 999,
    nomComplet: "Test Doublon",
    telephone: "0340000000",
    option: "Journalier",
    idApp: "TEST-01",
    departement: "Informatique",
  },
];
let nextId = 1000;

// --- FONCTION SÉCURITÉ TELEGRAM ---
const verifyTelegramData = (initData) => {
  if (!initData) return false;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => `${key}=${val}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return calculatedHash === hash;
};

// --- CRÉATION (POST) ---
app.post("/api/students", (req, res) => {
  try {
    const telegramProof = req.header("X-Telegram-Data");
    let user = { id: 99999, first_name: "WebUser" };

    const isValid = verifyTelegramData(telegramProof);

    if (isValid) {
      const userData = new URLSearchParams(telegramProof).get("user");
      user = JSON.parse(userData);
      console.log(`✅ Authentifié via Telegram : ${user.first_name}`);
    } else {
      console.log("⚠️ Accès hors Telegram ou signature invalide (Mode Test)");
    }

    const newStudent = req.body;

    newStudent.id = Date.now().toString().slice(-6);
    newStudent.createdByTelegramId = user.id;
    newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");

    students.push(newStudent);
    console.log(
      `📝 Élève créé : ${newStudent.nomComplet} (ID: ${newStudent.id})`,
    );

    res.json({ success: true, id: newStudent.id });
  } catch (e) {
    console.error("Erreur Inscription:", e);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// --- MISE À JOUR (PUT) ---
app.put("/api/students/:id", (req, res) => {
  const idToUpdate = req.params.id;
  console.log(`🔄 Update demandé pour ID : ${idToUpdate}`);

  const index = students.findIndex((s) => s.id == idToUpdate);

  if (index !== -1) {
    const oldData = students[index];
    const newData = req.body;

    students[index] = {
      ...oldData,
      ...newData,
      id: oldData.id,
    };

    console.log(`✅ Dossier ${idToUpdate} mis à jour !`);
    res.json({ success: true, id: idToUpdate });
  } else {
    res.status(404).json({ success: false, message: "Dossier introuvable" });
  }
});

// --- CHECK DOUBLONS ---
app.post("/api/check-duplicates", (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { nomComplet, telephone } = req.body;
    const candidates = students.filter((s) => {
      let match = false;
      if (telephone && s.telephone) {
        if (telephone.replace(/\s/g, "") === s.telephone.replace(/\s/g, ""))
          match = true;
      }
      if (nomComplet && s.nomComplet) {
        const n1 = nomComplet.trim().toLowerCase();
        const n2 = s.nomComplet.trim().toLowerCase();
        if (n1 && n2 && (n2.includes(n1) || n1.includes(n2))) match = true;
      }
      return match;
    });

    console.log(`📊 Résultat : ${candidates.length} candidat(s) trouvé(s)`);
    res.json({ found: candidates.length > 0, candidates: candidates });
  } catch (e) {
    console.error("Erreur doublons:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- BOT TELEGRAM ---
if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  bot.start((ctx) => {
    console.log("🤖 Commande /start reçue");
    ctx.reply(
      "👋 **Bienvenue !**\nCliquez ci-dessous pour remplir une fiche.",
      Markup.keyboard([
        [Markup.button.webApp("📝 Remplir le Formulaire", WEB_APP_URL)],
      ]).resize(),
    );
  });

  bot.on("web_app_data", async (ctx) => {
    const data = ctx.message.web_app_data.data;
    try {
      await ctx.reply(`✅ Dossier reçu pour : ${data} !`);
    } catch (err) {
      console.error("Erreur réponse bot:", err);
    }
  });

  // Lancement propre
  bot.telegram
    .deleteWebhook()
    .then(() => {
      console.log("🧹 Webhook supprimé.");
      bot.launch();
      console.log(`🤖 Bot démarré avec succès ! Lien WebApp : ${WEB_APP_URL}`);
    })
    .catch((e) => console.error("❌ Erreur lancement bot:", e));

  // Arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur API lancé sur le port ${PORT}`));
