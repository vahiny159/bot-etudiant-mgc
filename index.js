import "./config.js";

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Telegraf, Markup } from "telegraf";
import path from "path";

import { fileURLToPath } from "url";
import { dirname } from "path";

// Route modules
import authRoutes from "./routes/auth.js";
import inscriptionRoutes from "./routes/inscription.js";
import bbUpdateRoutes from "./routes/bb-update.js";
import educationRoutes from "./routes/education.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT;
const BOT_TOKEN_INSCRIPTION = process.env.BOT_TOKEN_INSCRIPTION || process.env.BOT_TOKEN;
const BOT_TOKEN_EDU = process.env.BOT_TOKEN_EDU;
const WEB_APP_URL = (process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");

// ===================== VÉRIFICATIONS =====================
if (!BOT_TOKEN_INSCRIPTION) {
  console.error("❌ ERREUR FATALE : 'BOT_TOKEN_INSCRIPTION' (ou 'BOT_TOKEN') manque dans .env");
  process.exit(1);
}
if (!WEB_APP_URL) {
  console.error("❌ ERREUR FATALE : 'WEB_APP_URL' manque dans .env");
  process.exit(1);
}
if (!PORT) {
  console.error("❌ ERREUR FATALE : 'PORT' manque dans .env");
  process.exit(1);
}
if (!BOT_TOKEN_EDU) {
  console.warn("⚠️  BOT_TOKEN_EDU manquant — le bot Education ne sera pas démarré.");
}

// ===================== EXPRESS =====================
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- ROUTES ---
app.use("/api", authRoutes);
app.use("/api", inscriptionRoutes);
app.use("/api", bbUpdateRoutes);
app.use("/api", educationRoutes);

// ===================== BOT 1 : INSCRIPTION / BB-UPDATE =====================
async function launchBotInscription() {
  const bot = new Telegraf(BOT_TOKEN_INSCRIPTION);
  app.locals.bot = bot;

  const menu = Markup.inlineKeyboard([
    [Markup.button.webApp("📝 Remplir une Fiche", WEB_APP_URL)],
    [Markup.button.webApp("📖 Suivi Leçons BB", `${WEB_APP_URL}/bb-update.html`)],
  ]);

  bot.start((ctx) => {
    ctx.reply("👋 **Bienvenue !**\nChoisissez l'action souhaitée :", menu);
  });

  bot.command("menu", (ctx) => {
    ctx.reply("📋 **Menu principal**\nChoisissez une action :", menu);
  });

  bot.on("web_app_data", async (ctx) => {
    try {
      await ctx.reply(`✅ Dossier reçu pour : ${ctx.message.web_app_data.data} !`);
    } catch (err) {
      console.error("Erreur réponse bot inscription:", err);
    }
  });

  await bot.telegram.deleteWebhook();
  await bot.telegram.setMyCommands([
    { command: "menu", description: "📋 Afficher le menu principal" },
  ]);
  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "📝 Ouvrir",
      web_app: { url: WEB_APP_URL },
    },
  });

  bot.launch();
  console.log(`🤖 Bot Inscription démarré ! (${WEB_APP_URL})`);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// ===================== BOT 2 : EDUCATION =====================
async function launchBotEdu() {
  if (!BOT_TOKEN_EDU) return;

  const bot = new Telegraf(BOT_TOKEN_EDU);
  app.locals.botEdu = bot;

  const eduUrl = `${WEB_APP_URL}/education.html`;

  const menu = Markup.inlineKeyboard([
    [Markup.button.webApp("📚 Lauch edu bot", eduUrl)],
  ]);

  bot.start((ctx) => {
    ctx.reply("📚 **MGC Education**\nConsultez les résultats et assignez des notes :", menu);
  });

  bot.command("menu", (ctx) => {
    ctx.reply("📋 **Menu Education**", menu);
  });

  await bot.telegram.deleteWebhook();
  await bot.telegram.setMyCommands([
    { command: "menu", description: "📋 Afficher le menu Education" },
  ]);
  await bot.telegram.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "📚 Education",
      web_app: { url: eduUrl },
    },
  });

  bot.launch();
  console.log(`🤖 Bot Education démarré ! (${eduUrl})`);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// ===================== DÉMARRAGE =====================
app.listen(PORT, async () => {
  console.log(`🚀 Serveur API lancé sur le port ${PORT}`);
  try {
    await launchBotInscription();
    await launchBotEdu();
  } catch (e) {
    console.error("❌ Erreur lancement des bots:", e);
  }
});
