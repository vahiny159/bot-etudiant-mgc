const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Scenes, session, Markup } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

// --- 1. CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const URL_API_INTERNE = `http://localhost:${PORT}/api/students`;

app.use(cors());
app.use(bodyParser.json());

// --- 2. BASE DE DONNÉES (SIMULATION) ---
let students = [
  {
    id: 1,
    dateAjout: "19/01/2026",
    nomComplet: "Jean Dupont",
    telephone: "0340000000",
    dateNaissance: "12/05/2000",
    adresse: "Analakely, Tana",
    eglise: "FJKM",
    profession: "Etudiant",
    option: "Journalier",
  },
];
let nextId = 2;

app.get("/", (req, res) => res.send("Serveur et Bot actifs v3 !"));

// API: Recherche
app.get("/api/students", (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : null;
  if (query) {
    return res.json(
      students.filter((s) => s.nomComplet.toLowerCase().includes(query)),
    );
  }
  res.json(students);
});

// API: Ajout
app.post("/api/students", (req, res) => {
  const newStudent = req.body;
  newStudent.id = nextId++;
  newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");
  students.push(newStudent);
  res.json(newStudent);
});

// API: Suppression (NOUVEAU)
app.delete("/api/students/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const initialLength = students.length;
  students = students.filter((s) => s.id !== id);

  if (students.length < initialLength) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// --- 3. BOT TELEGRAM ---
if (!BOT_TOKEN) {
  console.error("❌ ERREUR : Token manquant !");
} else {
  const bot = new Telegraf(BOT_TOKEN);

  // -- Service (Lien Bot <-> API) --
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
    // Nouvelle fonction Delete
    delete: async (id) => {
      try {
        await axios.delete(`${URL_API_INTERNE}/${id}`);
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  const mainMenu = Markup.keyboard([
    ["➕ Ajouter un élève", "🔍 Rechercher"],
    ["❓ Aide"],
  ]).resize();

  // -- SCÈNE D'AJOUT --
  const addWizard = new Scenes.WizardScene(
    "ADD_STUDENT_SCENE",
    (ctx) => {
      ctx.reply(
        "📝 **Nouveau dossier**\n\nNom Complet :",
        Markup.removeKeyboard(),
      );
      ctx.wizard.state.data = {};
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.nomComplet = ctx.message.text;
      ctx.reply("Numéro de téléphone :");
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.telephone = ctx.message.text;
      ctx.reply("Date de naissance (ex: 01/01/2000) :");
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.dateNaissance = ctx.message.text;
      ctx.reply("Adresse :");
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.adresse = ctx.message.text;
      ctx.reply("Nom de l'Église :");
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.eglise = ctx.message.text;
      ctx.reply("Profession :");
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.data.profession = ctx.message.text;
      ctx.reply(
        "Option :",
        Markup.keyboard([["Journalier", "Weekend"]])
          .oneTime()
          .resize(),
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      if (!["Journalier", "Weekend"].includes(ctx.message.text)) {
        ctx.reply(
          "Utilisez les boutons svp.",
          Markup.keyboard([["Journalier", "Weekend"]])
            .oneTime()
            .resize(),
        );
        return;
      }
      ctx.wizard.state.data.option = ctx.message.text;
      ctx.reply("💾 Sauvegarde...");
      const saved = await apiService.add(ctx.wizard.state.data);

      if (saved) {
        await ctx.replyWithMarkdown(
          `✅ **Enregistré !** (ID: ${saved.id})\n` +
            `👤 ${saved.nomComplet}\n` +
            `📚 ${saved.option}`,
        );
      } else {
        ctx.reply("Erreur de sauvegarde.");
      }
      await ctx.reply("Menu principal :", mainMenu);
      return ctx.scene.leave();
    },
  );

  const stage = new Scenes.Stage([addWizard]);
  bot.use(session());
  bot.use(stage.middleware());

  // -- ACTIONS & COMMANDES --
  bot.start((ctx) => ctx.reply("👋 Bonjour ! Utilisez le menu bas.", mainMenu));
  bot.hears("➕ Ajouter un élève", (ctx) =>
    ctx.scene.enter("ADD_STUDENT_SCENE"),
  );
  bot.hears("🔍 Rechercher", (ctx) =>
    ctx.reply("Entrez le nom à chercher avec /search (ex: /search Jean)"),
  );

  bot.command("search", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("Il manque le nom. Ex: /search Jean");

    const results = await apiService.search(query);
    if (results.length === 0) return ctx.reply("Introuvable.");

    for (const s of results) {
      await ctx.replyWithMarkdown(
        `🎓 **${s.nomComplet}**\n📞 ${s.telephone}\n🏠 ${s.adresse}\n📅 ${s.dateAjout}`,
        Markup.inlineKeyboard([
          Markup.button.callback("❌ Supprimer", `del_${s.id}`),
          // Markup.button.callback('✏️ Modifier', `edit_${s.id}`) // Prochaine étape
        ]),
      );
    }
  });

  // -- LOGIQUE DE SUPPRESSION (NOUVEAU) --
  bot.action(/del_(\d+)/, async (ctx) => {
    const idToDelete = ctx.match[1];

    // 1. Appel API
    const success = await apiService.delete(idToDelete);

    if (success) {
      // 2. Si ça a marché, on modifie le message pour dire "Supprimé"
      await ctx.editMessageText(
        `🗑️ L'élève (ID: ${idToDelete}) a été supprimé.`,
      );
    } else {
      await ctx.answerCbQuery("Erreur lors de la suppression.");
    }
  });

  bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur v3 sur le port ${PORT}`));
