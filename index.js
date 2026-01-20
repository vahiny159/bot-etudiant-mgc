const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf"); // Plus besoin de Scenes ni Session !
const axios = require("axios");
const path = require("path"); // Pour gérer les chemins de fichiers
require("dotenv").config();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
// L'URL publique de ton site Render (Render te la donne, ex: https://mon-bot.onrender.com)
// ⚠️ IMPORTANT : Render mettra ça automatiquement dans la variable RENDER_EXTERNAL_URL
const WEB_APP_URL =
  process.env.RENDER_EXTERNAL_URL || `https://ton-projet.onrender.com`;
const URL_API_INTERNE = `http://localhost:${PORT}/api/students`;

app.use(cors());
app.use(bodyParser.json());
// On dit au serveur de servir les fichiers du dossier "public" (notre HTML)
app.use(express.static(path.join(__dirname, "public")));

// --- BASE DE DONNÉES SIMULÉE ---
let students = [{ id: 1, nomComplet: "Test User", dateAjout: "20/01/2026" }];
let nextId = 2;

app.get("/", (req, res) => res.send("Serveur Mini App Actif !"));

// --- API ---
app.get("/api/students", (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : null;
  if (query)
    return res.json(
      students.filter((s) => s.nomComplet.toLowerCase().includes(query)),
    );
  res.json(students);
});

app.post("/api/students", (req, res) => {
  const newStudent = req.body;
  newStudent.id = nextId++;
  newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");
  students.push(newStudent);
  res.json(newStudent);
});

app.delete("/api/students/:id", (req, res) => {
  const id = parseInt(req.params.id);
  students = students.filter((s) => s.id !== id);
  res.json({ success: true });
});

// --- BOT TELEGRAM ---
if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  // -- Service --
  const apiService = {
    add: async (data) => {
      try {
        return (await axios.post(URL_API_INTERNE, data)).data;
      } catch (e) {
        return null;
      }
    },
    search: async (nom) => {
      try {
        return (await axios.get(`${URL_API_INTERNE}?q=${nom}`)).data;
      } catch (e) {
        return [];
      }
    },
    delete: async (id) => {
      try {
        await axios.delete(`${URL_API_INTERNE}/${id}`);
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  // -- MENU PRINCIPAL AVEC BOUTON MINI APP --
  // Note le bouton spécial : .webApp('Texte', 'URL')
  const mainMenu = (url) =>
    Markup.keyboard([
      [Markup.button.webApp("📝 Ouvrir le Formulaire", url)],
      ["🔍 Rechercher", "❓ Aide"],
    ]).resize();

  bot.start((ctx) => {
    // On envoie le clavier qui contient l'URL vers notre fichier index.html
    ctx.reply(
      "👋 Bienvenue ! Cliquez sur le bouton ci-dessous pour remplir le formulaire.",
      mainMenu(WEB_APP_URL),
    );
  });

  // -- RÉCEPTION DES DONNÉES DE LA MINI APP --
  // C'est ici que la magie opère. Quand l'utilisateur clique sur "ENREGISTRER" dans le HTML.
  bot.on("web_app_data", async (ctx) => {
    const data = JSON.parse(ctx.webAppData.data); // On récupère le JSON du formulaire

    ctx.reply("⏳ Réception des données...");

    // On sauvegarde via l'API
    const saved = await apiService.add(data);

    if (saved) {
      const recap =
        `✅ **Dossier Reçu et Enregistré !**\n\n` +
        `👤 **Nom:** ${saved.nomComplet}\n` +
        `📚 **Option:** ${saved.option}\n` +
        `🏫 **Classe:** ${saved.departement}`;
      await ctx.replyWithMarkdown(recap);
    } else {
      ctx.reply("❌ Erreur de sauvegarde.");
    }
  });

  // -- RECHERCHE & SUPPRESSION (Reste inchangé) --
  bot.hears("🔍 Rechercher", (ctx) => ctx.reply("Entrez le nom : /search Nom"));

  bot.command("search", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("Ex: /search Jean");
    const results = await apiService.search(query);
    if (results.length === 0) return ctx.reply("Introuvable.");
    for (const s of results) {
      await ctx.replyWithMarkdown(
        `👤 **${s.nomComplet}** (ID: ${s.id})\n📞 ${s.telephone || "?"}`,
        Markup.inlineKeyboard([
          Markup.button.callback("❌ Supprimer", `del_${s.id}`),
        ]),
      );
    }
  });

  bot.action(/del_(\d+)/, async (ctx) => {
    if (await apiService.delete(ctx.match[1]))
      ctx.editMessageText("🗑️ Dossier supprimé.");
  });

  bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur MiniApp sur le port ${PORT}`));
