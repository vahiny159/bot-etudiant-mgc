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
let nextId = 1;

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

// --- API SÉCURISÉE (AVEC MODE TEST AUTORISÉ) ---
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
      console.log(
        "⚠️ Mode TEST (Pas de sécu Telegram ou vérification échouée)",
      );
      // pour bloquer strictement plus tard, décommente la ligne ci-dessous :
      // return res.status(403).json({ success: false, message: "Non autorisé" });
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

// --- CHECK DOUBLONS ---
app.post("/api/check-duplicates", (req, res) => {
  console.log("🔍 REQUÊTE REÇUE : Check Duplicates");

  try {
    const { nomComplet, telephone } = req.body;
    console.log(`Données reçues -> Nom: "${nomComplet}", Tel: "${telephone}"`);

    const candidates = students.filter((s) => {
      let match = false;

      // Vérification par TÉLÉPHONE
      if (telephone && s.telephone) {
        const t1 = telephone.replace(/\s/g, "");
        const t2 = s.telephone.replace(/\s/g, "");
        if (t1 === t2) match = true;
      }

      //Vérification par NOM
      if (nomComplet && s.nomComplet) {
        const n1 = nomComplet.trim().toLowerCase();
        const n2 = s.nomComplet.trim().toLowerCase();

        if (n1 && n2 && (n2.includes(n1) || n1.includes(n2))) {
          match = true;
        }
      }
      return match;
    });

    console.log(`✅ Résultat : ${candidates.length} doublon(s) trouvé(s).`);

    res.json({ found: candidates.length > 0, candidates: candidates });
  } catch (e) {
    console.error("❌ ERREUR CRITIQUE SERVEUR :", e);
    res.status(500).json({ error: e.message });
  }
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
  bot.launch();
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur Sécurisé sur le port ${PORT}`));
