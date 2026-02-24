import "./config.js";

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
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
app.post("/api/auth/telegram", async (req, res) => {
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

app.post("/api/classes/:class/people", async (req, res) => {
  try {
    const { class: classId } = req.params;

    let payload = req.body;

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
app.put("/api/people/:id", async (req, res) => {
  const idToUpdate = req.params.id;
  console.log(`🔄 Update demandé pour ID : ${idToUpdate}`);

  try {
    const payload = req.body;

    let strapiUrl;

    if (process.env.USE_STANDARD_ROUTES === "true") {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/people/${idToUpdate}`;
    } else {
      strapiUrl = `${process.env.STRAPI_API_URL}/api/people/${idToUpdate}`;
    }

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
app.post("/api/bb-reports", async (req, res) => {
  console.log("📝 Création BB Report...");
  try {
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
app.put("/api/bb-reports/:id", async (req, res) => {
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
if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  bot.start((ctx) => {
    console.log("🤖 Commande /start reçue");
    ctx.reply(
      "👋 **Bienvenue !**\nCliquez ci-dessous pour remplir une fiche.",
      Markup.inlineKeyboard([
        [Markup.button.webApp("📝 Remplir le Formulaire", WEB_APP_URL)],
      ]),
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
