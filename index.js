const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Scenes, session, Markup } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

// Config
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const URL_API_INTERNE = `http://localhost:${PORT}/api/students`;

app.use(cors());
app.use(bodyParser.json());

// BDD
let students = [
  {
    // Voankazo
    id: 1,
    dateAjout: "19/01/2026",
    nomComplet: "Rakoto ziona",
    telephone: "0340000000",
    dateNaissance: "12/05/2000",
    adresse: "Analakely, Tana",
    eglise: "FJKM",
    profession: "Etudiant",
    option: "Journalier",
    // Tree
    idApp: "APP-001",
    nomTree: "Rakoto",
    telTree: "0331111111",
    liaison: "Père",
    departement: "Informatique",
  },
];
let nextId = 2;

app.get("/", (req, res) => res.send("Serveur v4 Actif !"));

// API: search(mbola test)
app.get("/api/students", (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : null;
  if (query) {
    return res.json(
      students.filter((s) => s.nomComplet.toLowerCase().includes(query)),
    );
  }
  res.json(students);
});

// API: Ajout(mbola test)
app.post("/api/students", (req, res) => {
  const newStudent = req.body;
  newStudent.id = nextId++;
  newStudent.dateAjout = new Date().toLocaleDateString("fr-FR");
  students.push(newStudent);
  res.json(newStudent);
});

// API: Suppression(mbola test)
app.delete("/api/students/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const initialLength = students.length;
  students = students.filter((s) => s.id !== id);
  if (students.length < initialLength) res.json({ success: true });
  else res.status(404).json({ success: false });
});

// BOT Telegram
if (!BOT_TOKEN) {
  console.error("ERREUR : Token manquant !");
} else {
  const bot = new Telegraf(BOT_TOKEN);

  // Service
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

  const mainMenu = Markup.keyboard([
    ["Ajouter voankazo", "Rechercher"],
    ["Aide"],
  ]).resize();

  // Scène (formulaire)
  const addWizard = new Scenes.WizardScene(
    "ADD_STUDENT_SCENE",

    // 1. Nom
    (ctx) => {
      ctx.reply(
        "**Nouveau dossier**\n\nNom Complet :",
        Markup.removeKeyboard(),
      );
      ctx.wizard.state.data = {};
      return ctx.wizard.next();
    },
    // 2. Tel
    (ctx) => {
      ctx.wizard.state.data.nomComplet = ctx.message.text;
      ctx.reply("Numéro de téléphone :");
      return ctx.wizard.next();
    },
    // 3. Date Naissance
    (ctx) => {
      ctx.wizard.state.data.telephone = ctx.message.text;
      ctx.reply("Date de naissance (ex: 01/01/2000) :");
      return ctx.wizard.next();
    },
    // 4. Adresse
    (ctx) => {
      ctx.wizard.state.data.dateNaissance = ctx.message.text;
      ctx.reply("Adresse :");
      return ctx.wizard.next();
    },
    // 5. Eglise
    (ctx) => {
      ctx.wizard.state.data.adresse = ctx.message.text;
      ctx.reply("Finoana :");
      return ctx.wizard.next();
    },
    // 6. Profession
    (ctx) => {
      ctx.wizard.state.data.eglise = ctx.message.text;
      ctx.reply("Profession :");
      return ctx.wizard.next();
    },
    // 7. Option fianarana (select)
    (ctx) => {
      ctx.wizard.state.data.profession = ctx.message.text;
      ctx.reply(
        "Option fianarana :",
        Markup.keyboard([["Journalier", "Weekend"]])
          .oneTime()
          .resize(),
      );
      return ctx.wizard.next();
    },
    // 8. Sauvegarde Option -> Demande ID App
    (ctx) => {
      if (!["Journalier", "Weekend"].includes(ctx.message.text)) {
        ctx.reply(
          "Utilisez les boutons azafady",
          Markup.keyboard([["Weekday", "Weekend"]])
            .oneTime()
            .resize(),
        );
        return;
      }
      ctx.wizard.state.data.option = ctx.message.text;

      ctx.reply("A propos du tree, ID SMADA :", Markup.removeKeyboard());
      return ctx.wizard.next();
    },
    // 9. ID App -> Demande Nom Tree
    (ctx) => {
      ctx.wizard.state.data.idApp = ctx.message.text;
      ctx.reply("Nom Tree :");
      return ctx.wizard.next();
    },
    // 10. Nom Tree -> Demande Tel Tree
    (ctx) => {
      ctx.wizard.state.data.nomTree = ctx.message.text;
      ctx.reply("Numéro Tel Tree :");
      return ctx.wizard.next();
    },
    // 11. Tel Tree -> Demande Liaison
    (ctx) => {
      ctx.wizard.state.data.telTree = ctx.message.text;
      ctx.reply("Liaison (ex: Namana, Fianakaviana...) :");
      return ctx.wizard.next();
    },
    // 12. Liaison -> Demande Département/Classe
    (ctx) => {
      ctx.wizard.state.data.liaison = ctx.message.text;
      ctx.reply("Département / Classe :");
      return ctx.wizard.next();
    },
    // 13. FINALISATION
    async (ctx) => {
      ctx.wizard.state.data.departement = ctx.message.text;

      ctx.reply("Enregistrement en cours...");
      const saved = await apiService.add(ctx.wizard.state.data);

      if (saved) {
        // Output
        const recap =
          `✅ **Done !**\n\n` +
          `🆔 **ID App:** ${saved.idApp}\n` +
          `👤 **Nom:** ${saved.nomComplet}\n` +
          `📞 **Tel:** ${saved.telephone}\n` +
          `🎂 **Né(e):** ${saved.dateNaissance}\n` +
          `🏠 **Adresse:** ${saved.adresse}\n` +
          `⛪ **Eglise:** ${saved.eglise}\n` +
          `💼 **Profession:** ${saved.profession}\n` +
          `📚 **Option fianarana:** ${saved.option}\n` +
          `--------------------\n` +
          `🌳 **Tree:** ${saved.idApp} ${saved.nomTree} (${saved.liaison})\n` +
          `📱 **Tel Tree:** ${saved.telTree}\n` +
          `🏫 **Classe:** ${saved.departement}`;

        await ctx.replyWithMarkdown(recap);
      } else {
        ctx.reply("Erreur lors de la sauvegarde.");
      }

      await ctx.reply("Menu principal :", mainMenu);
      return ctx.scene.leave();
    },
  );

  const stage = new Scenes.Stage([addWizard]);
  bot.use(session());
  bot.use(stage.middleware());

  // -- ACTIONS & COMMANDES --
  bot.start((ctx) =>
    ctx.reply("Salama tompoko ! Utilisez le menu bas.", mainMenu),
  );
  bot.hears("Ajouter voankazo", (ctx) => ctx.scene.enter("ADD_STUDENT_SCENE"));
  bot.hears("Rechercher", (ctx) =>
    ctx.reply("Entrez le nom à chercher avec /search (ex: /search Jean)"),
  );

  bot.command("search", async (ctx) => {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("Il manque le nom. Ex: /search Jean");

    const results = await apiService.search(query);
    if (results.length === 0) return ctx.reply("Introuvable.");

    for (const s of results) {
      // output complet
      const fiche =
        `**Dossier Élève** (Réf: ${s.id})\n` +
        `Ajouté le: ${s.dateAjout}\n\n` +
        `**ID App:** ${s.idApp || "Non défini"}\n` +
        `**Nom:** ${s.nomComplet}\n` +
        `**Tel:** ${s.telephone}\n` +
        `**Né(e):** ${s.dateNaissance}\n` +
        `**Adresse:** ${s.adresse}\n` +
        `**Eglise:** ${s.eglise}\n` +
        `**Pro:** ${s.profession}\n` +
        `**Option:** ${s.option}\n` +
        `--------------------\n` +
        `**Tree:** ${s.idApp || "?"} ${s.nomTree || "?"} (${s.liaison || "?"})\n` +
        `**Tel Tree:** ${s.telTree || "?"}\n` +
        `**Classe:** ${s.departement || "?"}`;

      await ctx.replyWithMarkdown(
        fiche,
        Markup.inlineKeyboard([
          Markup.button.callback("Supprimer", `del_${s.id}`),
        ]),
      );
    }
  });

  bot.action(/del_(\d+)/, async (ctx) => {
    const idToDelete = ctx.match[1];
    const success = await apiService.delete(idToDelete);
    if (success) {
      await ctx.editMessageText(
        `Le dossier (ID BDD: ${idToDelete}) a été supprimé définitivement.`,
      );
    } else {
      await ctx.answerCbQuery("Erreur lors de la suppression.");
    }
  });

  bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`Serveur v4 sur le port ${PORT}`));
