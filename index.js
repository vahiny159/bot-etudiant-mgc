const checkIdTelegram = require('./services/user.service.js');
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Telegraf, Markup } = require("telegraf");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL;

// --- 3. VÉRIFICATION DE SÉCURITÉ ---
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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- DONNÉES DE TEST (Base de données temporaire) ---
// let students = [
//   {
//     id: 999,
//     nomComplet: "Test Doublon",
//     telephone: "0340000000",
//     option: "Journalier",
//     idApp: "TEST-01",
//     departement: "Informatique",
//   },
// ];
// let nextId = 1000;

// --- FONCTION SÉCURITÉ TELEGRAM ---
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
/**
 * LIST OF API CALL
 */
// --- CRÉATION STUDENTS---
app.post('/auth/telegram', async (req, res) => {
  const { initData } = req.body;

  if (!initData) {
    return res.status(400).json({ ok: false });
  }

  const isValid = verifyTelegramData(initData);
  if (!isValid) {
    return res.status(401).json({ ok: false });
  }

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get('user'));
  const telegramId = user.id;

  const exists = await checkIdTelegram(telegramId);
  if (!exists) {
    return res.status(403).json({ ok: false });
  }

  // ✅ utilisateur validé
  req.session.authorized = true;
  req.session.telegramId = telegramId;

  res.json({ ok: true });
});

app.post("/api/classes/:class/people", async (req, res) => {
  try {
    const { classe } = req.params;

    const telegramProof = req.header("X-Telegram-Data");
    let user = { id: 99999, first_name: "WebUser" };

    const isValid = verifyTelegramData(telegramProof);

    if (isValid) {
      const userData = new URLSearchParams(telegramProof).get("user");
      user = JSON.parse(userData);
      console.log(`✅ Authentifié via Telegram : ${user.first_name}`);
    } else {
      console.log("⚠️ Accès hors Telegram ou signature invalide (Mode Test)");
    }

    const response = await fetch(`${process.env.STRAPI_API_URL}/api/classes/${classe}/people`, {
      // method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur :", e);
    res.status(500).json({ error: e.message });
  }
});

// --- MISE À JOUR STUDENTS (PUT) ---
app.put("/api/people/:id", async (req, res) => {
  const idToUpdate = req.params.id;
  console.log(`🔄 Update demandé pour ID : ${idToUpdate}`);
  try {
    const response = await fetch(`${process.env.STRAPI_API_URL}/api/people/${idToUpdate}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  }
  catch (e) {
    console.error("Erreur doublons:", e);
    res.status(500).json({ error: e.message });
  }

});

// --- CHECK DOUBLONS ---
app.get("/api/students/findByName/:names", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { names } = req.params;

    const response = await fetch(`${process.env.STRAPI_API_URL}/api/students/findByName/${names}`, {
      // method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur doublons:", e);
    res.status(500).json({ error: e.message });
  }
});

// FIND PERSON BY ID
app.get("/api/people/:id", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { id } = req.params;

    const response = await fetch(`${process.env.STRAPI_API_URL}/api/people/${id}`, {
      //   method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur :", e);
    res.status(500).json({ error: e.message });
  }
});

// FIND PERSON BY USER
app.get("/people/findByUser/:appId", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { appId } = req.params;
    const { allData } = req.query;
    const strapiUrl =
      `${process.env.STRAPI_API_URL}/api/people/findByUser/${encodeURIComponent(appId)}`
      + `?allData=${allData ?? 'false'}`;

    const response = await fetch(strapiUrl, {
      //  method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur :", e);
    res.status(500).json({ error: e.message });
  }
});

// CLASS OPENED BB
app.get("/api/custom/classes/openedBB", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const strapiUrl =
      `${process.env.STRAPI_API_URL}/api/custom/classes/openedBB`;

    const response = await fetch(strapiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
        // "X-Telegram-Data": tg.initData || "",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur :", e);
    res.status(500).json({ error: e.message });
  }
});

// CHECK TELEGRAM ID IN DB


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
    try {
      await ctx.reply(`✅ Dossier reçu pour : ${data} !`);
    } catch (err) {
      console.error("Erreur réponse bot:", err);
    }
  });

  // Lancement propre
  bot.telegram
    .deleteWebhook()
    .then(() => {
      console.log("🧹 Webhook supprimé.");
      bot.launch();
      console.log(`🤖 Bot démarré avec succès ! Lien WebApp : ${WEB_APP_URL}`);
    })
    .catch((e) => console.error("❌ Erreur lancement bot:", e));

  // Arrêt propre
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`🚀 Serveur API lancé sur le port ${PORT}`));
