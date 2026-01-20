const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL =
  process.env.RENDER_EXTERNAL_URL || `https://ton-projet.onrender.com`;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- BASE DE DONNÉES SIMULÉE ---
let students = [];
let nextId = 1;

app.get("/", (req, res) => res.send("Serveur Formulaire Actif"));

// --- API : CREATE (POST) ---
app.post("/api/students", (req, res) => {
  const newStudent = req.body;

  // Ajout des infos automatiques
  newStudent.id = nextId++;
  newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");

  students.push(newStudent);

  console.log("📝 Nouveau dossier reçu :", newStudent.nomComplet);
  res.json({ success: true, id: newStudent.id });
});

// --- BOT TELEGRAM ---
if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  // Commande /start
  bot.start((ctx) => {
    ctx.reply(
      "👋 **Bienvenue !**\nCliquez ci-dessous pour remplir une nouvelle fiche d'inscription.",
      Markup.keyboard([
        [Markup.button.webApp("📝 Remplir le Formulaire", WEB_APP_URL)],
      ]).resize(),
    );
  });

  bot.on("message", (ctx) => {
    if (ctx.message.web_app_data) {
      ctx.reply(
        `✅ Le dossier pour "${ctx.message.web_app_data.data}" a bien été reçu !`,
      );
    }
  });

  bot.launch();
  // Gestion arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () =>
  console.log(`🚀 Serveur Formulaire sur le port ${PORT}`),
);
