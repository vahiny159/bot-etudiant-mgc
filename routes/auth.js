import express from "express";
import crypto from "crypto";
import { checkIdTelegram } from "../services/user.service.js";

const router = express.Router();

const BOT_TOKEN = process.env.BOT_TOKEN;

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

// --- AUTH TELEGRAM ---
router.post("/auth/telegram", async (req, res) => {
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
router.post("/notify/telegram", async (req, res) => {
    try {
        const { chatId, message } = req.body;

        if (!chatId || !message) {
            return res.status(400).json({ ok: false, message: "chatId and message required" });
        }

        // Access bot from app locals (set in index.js)
        const bot = req.app.locals.bot;
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

export default router;
