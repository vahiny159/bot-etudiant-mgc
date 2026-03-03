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
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL;

// VÉRIFICATION DE SÉCURITÉ
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
if (!PORT) {
  console.error(
    "❌ ERREUR FATALE : La variable 'PORT' manque dans le fichier .env",
  );
  process.exit(1);
}

const app = express();
const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// Share bot instance with routes via app.locals
app.locals.bot = bot;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- ROUTES ---
app.use("/api", authRoutes);
app.use("/api", inscriptionRoutes);
app.use("/api", bbUpdateRoutes);
app.use("/api", educationRoutes);

// --- BOT TELEGRAM ---
if (bot) {
  // Menu d'actions (réutilisé par /start et /menu)
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [Markup.button.webApp("📝 Remplir une Fiche", WEB_APP_URL)],
    [Markup.button.webApp("📖 Suivi Leçons BB", `${WEB_APP_URL}/bb-update.html`)],
    [Markup.button.webApp("📚 Éducation", `${WEB_APP_URL}/education.html`)],
  ]);

  bot.start((ctx) => {
    console.log("🤖 Commande /start reçue");
    ctx.reply(
      "👋 **Bienvenue !**\nChoisissez l'action que vous souhaitez effectuer :",
      mainMenuKeyboard
    );
  });

  bot.command("menu", (ctx) => {
    console.log("🤖 Commande /menu reçue");
    ctx.reply(
      "📋 **Menu principal**\nChoisissez une action :",
      mainMenuKeyboard
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
    .then(async () => {
      console.log("🧹 Webhook supprimé.");

      // Enregistrer les commandes visibles dans le menu Telegram
      await bot.telegram.setMyCommands([
        { command: "menu", description: "📋 Afficher le menu principal" },
      ]);
      console.log("📋 Commandes du menu enregistrées.");

      // Bouton Menu → ouvre directement la WebApp
      await bot.telegram.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "📝 Ouvrir",
          web_app: { url: WEB_APP_URL },
        },
      });
      console.log("🔘 Bouton Menu configuré.");

      bot.launch();
      console.log(`🤖 Bot démarré avec succès ! Lien WebApp : ${WEB_APP_URL}`);
    })
    .catch((e) => console.error("❌ Erreur lancement bot:", e));

  // Arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur API lancé sur le port ${PORT}`));
