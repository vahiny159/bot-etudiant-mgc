const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Scenes, session } = require("telegraf");
const axios = require("axios");
require("dotenv").config();

// --- 1. CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000; // Render nous donnera un PORT automatiquement
const BOT_TOKEN = process.env.BOT_TOKEN;
const URL_API_INTERNE = `http://localhost:${PORT}/api/students`; // Le bot parlera à l'API sur le même serveur

// Middleware pour l'API
app.use(cors());
app.use(bodyParser.json());

// --- 2. PARTIE API (Le travail de tes collègues) ---
// Simulation de base de données en mémoire (sera reset si le serveur redémarre)
let students = [
  { id: 1, nom: "Dupont", prenom: "Jean", age: "22", telephone: "0340000000" },
];
let nextId = 2;

app.get("/", (req, res) => res.send("Le serveur est en ligne !"));

app.get("/api/students", (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : null;
  if (query) {
    return res.json(
      students.filter((s) => s.nom.toLowerCase().includes(query)),
    );
  }
  res.json(students);
});

app.post("/api/students", (req, res) => {
  const newStudent = req.body;
  newStudent.id = nextId++;
  students.push(newStudent);
  console.log(`[API] Ajout : ${newStudent.nom}`);
  res.json(newStudent);
});

// --- 3. PARTIE BOT (Ton travail) ---
if (!BOT_TOKEN) {
  console.error("ERREUR : Aucun token bot trouvé !");
} else {
  const bot = new Telegraf(BOT_TOKEN);

  // -- Fonctions Service (Le lien Bot -> API) --
  const apiService = {
    search: async (nom) => {
      try {
        const res = await axios.get(`${URL_API_INTERNE}?q=${nom}`);
        return res.data;
      } catch (e) {
        return [];
      }
    },
    add: async (data) => {
      try {
        const res = await axios.post(URL_API_INTERNE, data);
        return res.data;
      } catch (e) {
        return null;
      }
    },
  };

  // -- Wizard Scene pour l'ajout (Simplifié pour l'exemple) --
  const addWizard = new Scenes.WizardScene(
    "ADD_STUDENT",
    (ctx) => {
      ctx.reply("🆕 Nouveau : Quel est le NOM de l'étudiant ?");
      ctx.wizard.state.data = {};
      return ctx.wizard.next();
    },
    async (ctx) => {
      ctx.wizard.state.data.nom = ctx.message.text;
      // On fait court pour l'exemple, on ajoute direct
      ctx.reply("Enregistrement en cours...");
      const created = await apiService.add(ctx.wizard.state.data);
      ctx.reply(`✅ Étudiant ajouté (ID: ${created.id}) !`);
      return ctx.scene.leave();
    },
  );

  const stage = new Scenes.Stage([addWizard]);
  bot.use(session());
  bot.use(stage.middleware());

  // -- Commandes --
  bot.command("add", (ctx) => ctx.scene.enter("ADD_STUDENT"));

  bot.command("search", async (ctx) => {
    const query = ctx.message.text.split(" ")[1];
    if (!query) return ctx.reply("Utilisation : /search <nom>");
    const results = await apiService.search(query);
    if (results.length === 0) return ctx.reply("Aucun résultat.");
    results.forEach((s) =>
      ctx.reply(`🎓 ${s.nom} ${s.prenom || ""} (ID: ${s.id})`),
    );
  });

  bot.launch();
  console.log("🤖 Bot Telegram démarré !");

  // Arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// --- 4. LANCEMENT DU SERVEUR ---
app.listen(PORT, () => {
  console.log(`🚀 Serveur Web écoutant sur le port ${PORT}`);
});
