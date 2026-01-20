const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto"); // Nécessaire pour la sécurité
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL =
  process.env.RENDER_EXTERNAL_URL || `https://ton-projet.onrender.com`;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let students = [];
let nextId = 1;

// --- FONCTION DE SÉCURITÉ (AUTHENTIFICATION) ---
// C'est la fonction qui vérifie le "Sceau" de Telegram
const verifyTelegramData = (initData) => {
  if (!initData) return false;

  // 1. On récupère le hash envoyé par le front
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  // 2. On trie les données par ordre alphabétique
  const dataCheckString = Array.from(urlParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => `${key}=${val}`)
    .join("\n");

  // 3. On crée la clé secrète avec le TOKEN du bot
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  // 4. On recalcule la signature
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // 5. On compare : Si c'est pareil, c'est authentique !
  return calculatedHash === hash;
};

// --- API SÉCURISÉE ---
app.post("/api/students", (req, res) => {
  // 1. On récupère la preuve d'identité dans le Header
  const telegramProof = req.header("X-Telegram-Data");

  // 2. On vérifie si c'est authentique
  const isValid = verifyTelegramData(telegramProof);

  if (!isValid) {
    console.log("⚠️ Tentative d'intrusion bloquée !");
    return res
      .status(403)
      .json({ success: false, message: "Non autorisé (Fake Data)" });
  }

  // 3. Si on est là, c'est que c'est bien un utilisateur Telegram valide
  // On peut même récupérer son ID unique si on veut
  const userData = new URLSearchParams(telegramProof).get("user");
  const user = JSON.parse(userData);
  console.log(
    `✅ Données reçues de l'utilisateur ID: ${user.id} (${user.first_name})`,
  );

  const newStudent = req.body;
  // On ajoute l'ID Telegram au dossier pour savoir qui l'a créé
  newStudent.createdByTelegramId = user.id;
  newStudent.id = nextId++;
  newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");

  students.push(newStudent);
  res.json({ success: true, id: newStudent.id });
});

// --- BOT TELEGRAM ---
if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);
  bot.start((ctx) => {
    ctx.reply(
      "👋 **Bienvenue !**\nCliquez ci-dessous pour remplir une fiche.",
      Markup.keyboard([
        [Markup.button.webApp("📝 Remplir le Formulaire", WEB_APP_URL)],
      ]).resize(),
    );
  });
  bot.on("message", (ctx) => {
    if (ctx.message.web_app_data) {
      ctx.reply(`✅ Dossier reçu pour "${ctx.message.web_app_data.data}" !`);
    }
  });
  bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur Sécurisé sur le port ${PORT}`));
