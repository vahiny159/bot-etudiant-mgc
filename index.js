import "./config.js";

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import crypto from "crypto";
import { message } from "telegraf/filters";

import { db } from "./services/db.js";
import { checkIdTelegram } from "./services/user.service.js";

import { fileURLToPath } from "url";
import { dirname } from "path";

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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// --- RATE LIMITERS ---
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Trop de requêtes, réessayez dans 1 minute." },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Trop de tentatives, réessayez dans 1 minute." },
});

// Apply global limiter to all /api routes
app.use("/api", globalLimiter);

// --- VALIDATION HELPERS ---
function validateStudentData(data) {
  const errors = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    errors.push("Le nom est obligatoire (min 2 caractères).");
  }

  if (!data.phone || !/^\d{7,15}$/.test(data.phone.replace(/\s/g, ""))) {
    errors.push("Le téléphone est invalide (7-15 chiffres).");
  }

  if (!data.birthday || isNaN(Date.parse(data.birthday))) {
    errors.push("La date de naissance est invalide.");
  }

  if (data.gender && !["M", "F"].includes(data.gender)) {
    errors.push("Le genre doit être M ou F.");
  }

  return errors;
}

const VALID_BB_CODES = [
  "BB01", "BB02", "BB03", "BB04", "BB05", "BB06",
  "BB07", "BB08", "BB09", "BB10", "BB11", "BB12",
];

function validateBBReport(data) {
  const errors = [];

  if (!data.bbCode || !VALID_BB_CODES.includes(data.bbCode)) {
    errors.push(`Code BB invalide. Valeurs acceptées : ${VALID_BB_CODES.join(", ")}`);
  }

  if (!data.student || isNaN(Number(data.student))) {
    errors.push("L'ID de l'étudiant est requis.");
  }

  return errors;
}

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
app.post("/api/auth/telegram", strictLimiter, async (req, res) => {
  const { initData } = req.body;

  if (!initData) {
    return res.status(400).json({
      ok: false,
      message: "Invalid telegram init data",
    });
  }

  const isValid = verifyTelegramData(initData);
  if (!isValid) {
    return res.status(401).json({
      ok: false,
      message: "Invalid Telegram signature",
    });
  }

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));
  const telegramId = user?.id;

  if (!telegramId) {
    return res.status(404).json({
      ok: false,
      message: "Telegram user not found",
    });
  }

  const exists = await checkIdTelegram(telegramId);
  if (!exists) {
    return res.status(403).json({
      ok: false,
      message: "Unauthorized telegram user",
    });
  } else {
    console.log("id exist");
    return res.json({ ok: true });
  }
});

// --- NOTIFICATION TELEGRAM ---
app.post("/api/notify/telegram", async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ ok: false, message: "chatId and message required" });
    }

    if (!bot) {
      return res.status(503).json({ ok: false, message: "Bot not configured" });
    }

    await bot.telegram.sendMessage(chatId, message, { parse_mode: "HTML" });
    res.json({ ok: true });
  } catch (e) {
    console.error("Erreur notification Telegram:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/classes/:class/people", strictLimiter, async (req, res) => {
  try {
    const { class: classId } = req.params;

    let payload = req.body;

    // --- VALIDATION ---
    const studentData = payload.data || payload;
    const errors = validateStudentData(studentData);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    let strapiUrl;

    if (process.env.USE_STANDARD_ROUTES === "true") {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/people`;

      if (payload.data) {
        payload.data.class = classId;
      }
    } else {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/classes/${classId}/people`;
    }

    const response = await fetch(strapiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi Create:", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur :", e);
    res.status(500).json({ error: e.message });
  }
});

// --- MISE À JOUR STUDENTS (PUT) ---
app.put("/api/people/:id", strictLimiter, async (req, res) => {
  const idToUpdate = req.params.id;
  console.log(`🔄 Update demandé pour ID : ${idToUpdate}`);

  try {
    const payload = req.body;

    // --- VALIDATION ---
    const studentData = payload.data || payload;
    const errors = validateStudentData(studentData);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    const strapiUrl = `${process.env.STRAPI_API_URL}/api/people/${idToUpdate}`;

    const response = await fetch(strapiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi Update:", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur Update:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- CHECK DOUBLONS (name OR phone) ---
app.get("/api/students/checkDuplicates", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { name, phone } = req.query;
    const cleanPhone = phone ? phone.replace(/\D/g, "") : "";

    const strapiUrl = new URL(`${process.env.STRAPI_API_URL}/api/people`);
    strapiUrl.searchParams.append("populate[class]", "true");
    strapiUrl.searchParams.append("populate[user]", "true");
    strapiUrl.searchParams.append("populate[tree]", "true");
    strapiUrl.searchParams.append("filters[$and][0][user][level][$ne]", "member");
    if (name) {
      strapiUrl.searchParams.append("filters[$and][1][$or][0][name][$containsi]", name);
    }
    if (cleanPhone) {
      strapiUrl.searchParams.append("filters[$and][1][$or][1][phone][$containsi]", cleanPhone);
    }
    strapiUrl.searchParams.append("pagination[page]", "1");
    strapiUrl.searchParams.append("pagination[pageSize]", "50");

    console.log("📍 URL Strapi:", strapiUrl.toString());

    const response = await fetch(strapiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi:", result);
      return res.status(response.status).json(result);
    }

    let finalData = result;
    if (result.data && Array.isArray(result.data)) {
      finalData = result.data.map((item) => ({
        id: item.id,
        ...item.attributes,
      }));
    }

    res.json(finalData);
  } catch (e) {
    console.error("Erreur doublons:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- SEARCH PEOPLE (students / teachers) - proxy to Strapi ---
app.get("/api/people", async (req, res) => {
  console.log("🔍 Recherche people...");
  try {
    // Use raw query string to preserve Strapi bracket notation (filters[$and]...)
    // URLSearchParams(req.query) would break because Express/qs parses brackets into nested objects
    const rawQuery = req.originalUrl.split("?")[1] || "";
    const strapiUrl = `${process.env.STRAPI_API_URL}/api/people${rawQuery ? "?" + rawQuery : ""}`;

    console.log("📍 URL Strapi:", strapiUrl);

    const response = await fetch(strapiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi search people:", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur recherche people:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- CREATE BB REPORT ---
app.post("/api/bb-reports", strictLimiter, async (req, res) => {
  console.log("📝 Création BB Report...");
  try {
    // --- VALIDATION ---
    const reportData = req.body.data || req.body;
    const errors = validateBBReport(reportData);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    const strapiUrl = `${process.env.STRAPI_API_URL}/api/bb-reports`;

    const response = await fetch(strapiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi create BB Report:", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur création BB Report:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- UPDATE BB REPORT ---
app.put("/api/bb-reports/:id", strictLimiter, async (req, res) => {
  const { id } = req.params;
  console.log(`🔄 Update BB Report ID: ${id}`);
  try {
    const strapiUrl = `${process.env.STRAPI_API_URL}/api/bb-reports/${id}`;

    const response = await fetch(strapiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi update BB Report:", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (e) {
    console.error("Erreur update BB Report:", e);
    res.status(500).json({ error: e.message });
  }
});

// delete bb repport
app.delete('/api/bb-reports/:id', async (req, res) => {
  console.log(`🗑️ Delete BB Report ID: ${req.params.id}`);
  try {
    const response = await fetch(`${process.env.STRAPI_API_URL}/api/bb-reports/${req.params.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APP_TOKEN}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Erreur Strapi DELETE :", result);
      return res.status(response.status).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Erreur Proxy DELETE :", error);
    res.status(500).json({ error: 'Erreur lors de la suppression sur le proxy' });
  }
});

// EXPORT STUDENTS TO EXCEL
app.get("/api/people/students/export", async (req, res) => {
  console.log("📊 Export Excel des étudiants...");
  try {
    const { classId, createdAtFrom } = req.query;

    // Construire l'URL Strapi avec les paramètres
    const strapiUrl = new URL(`${process.env.STRAPI_API_URL}/api/people/students/export`);
    if (classId) strapiUrl.searchParams.append("classId", classId);
    if (createdAtFrom) strapiUrl.searchParams.append("createdAtFrom", createdAtFrom);

    console.log("📍 URL Strapi:", strapiUrl.toString());

    const response = await fetch(strapiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur Strapi:", errorText);
      return res.status(response.status).send(errorText);
    }

    // Récupérer le fichier Excel et le transférer
    const buffer = await response.arrayBuffer();

    // Copier les headers importants
    const contentType = response.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="export_students_${classId}_${createdAtFrom}.xlsx"`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("Erreur export:", e);
    res.status(500).json({ error: e.message });
  }
});

// FIND PERSON BY ID
app.get("/api/people/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // On transmet les query params reçus (ex: ?populate=*) à Strapi
    const queryString = new URLSearchParams(req.query).toString();
    const strapiUrl = `${process.env.STRAPI_API_URL}/api/people/${id}${queryString ? "?" + queryString : ""}`;

    console.log("🔍 GET people/:id →", strapiUrl);

    const response = await fetch(strapiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();

    console.log("🟢 Strapi people/:id retourne :", JSON.stringify(result).slice(0, 500));

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
app.get("/api/people/findByUser/:appId", async (req, res) => {
  console.log("🔍 Vérification doublons...");
  try {
    const { appId } = req.params;
    const { allData } = req.query;
    const strapiUrl =
      `${process.env.STRAPI_API_URL}/api/people/findByUser/${encodeURIComponent(appId)}` +
      `?allData=${allData ?? "false"}`;

    const response = await fetch(strapiUrl, {
      //  method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
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
  console.log("🔍 Récupération des classes...");
  try {
    let strapiUrl;

    if (process.env.USE_STANDARD_ROUTES === "true") {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/classes?filters[status][$eq]=Open`;
    } else {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/custom/classes/openedBB`;
    }

    const response = await fetch(strapiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.APP_TOKEN}`,
        "Content-Type": "application/json",
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
if (bot) {
  // Menu d'actions (réutilisé par /start et /menu)
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [Markup.button.webApp("📝 Remplir une Fiche", WEB_APP_URL)],
    [Markup.button.webApp("📖 Suivi Leçons BB", `${WEB_APP_URL}/bb-update.html`)],
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
