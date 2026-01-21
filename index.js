const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL =
  process.env.RENDER_EXTERNAL_URL || `https://ton-projet.onrender.com`;

// Vérification du Token
if (!BOT_TOKEN) {
  console.error("❌ ERREUR FATALE : BOT_TOKEN manquant !");
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- DONNÉES DE TEST ---
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

// --- SÉCURITÉ (AUTH) ---
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

// --- API ENREGISTREMENT ---
app.post("/api/students", (req, res) => {
  try {
    const telegramProof = req.header("X-Telegram-Data");
    let user = { id: 99999, first_name: "TestUser" };

    const isValid = verifyTelegramData(telegramProof);

    if (isValid) {
      const userData = new URLSearchParams(telegramProof).get("user");
      user = JSON.parse(userData);
      console.log(`✅ Authentifié : ${user.first_name}`);
    } else {
      console.log("⚠️ Mode TEST (Auth ignorée)");
    }

    const newStudent = req.body;
    newStudent.id = Date.now().toString().slice(-6);
    newStudent.createdByTelegramId = user.id;
    newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");

    students.push(newStudent);
    console.log(`📝 Élève créé avec ID: ${newStudent.id}`);

    res.json({ success: true, id: newStudent.id });
  } catch (e) {
    console.error("Erreur Inscription:", e);
    res.status(500).json({ success: false, message: "Erreur interne serveur" });
  }
});

// --- API CHECK DOUBLONS ---
app.post("/api/check-duplicates", (req, res) => {
  console.log("🔍 Check Duplicates demandé");
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
    console.log("💾 DONNÉE REÇUE DU FRONTEND :", data);

    try {
      await ctx.reply(`✅ Dossier bien reçu pour : ${data} !`);

      await ctx.reply(
        "Voulez-vous en saisir un autre ?",
        Markup.keyboard([
          [Markup.button.webApp("📝 Nouveau Formulaire", WEB_APP_URL)],
        ]).resize(),
      );
    } catch (err) {
      console.error("❌ Erreur d'envoi message bot:", err);
    }
  });

  bot.telegram
    .deleteWebhook()
    .then(() => {
      console.log("🧹 Webhook supprimé -> Lancement du Polling...");
      bot.launch();
      console.log("🚀 Le Bot est EN LIGNE !");
    })
    .catch((e) => console.error("Erreur lancement bot:", e));

  // Gestion arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur Express sur le port ${PORT}`));
