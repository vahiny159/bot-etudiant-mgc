import express from "express";
import crypto from "crypto";
import { checkIdTelegram } from "../services/user.service.js";

const router = express.Router();

// Collect all available bot tokens (try each until one validates)
const BOT_TOKENS = [
    process.env.BOT_TOKEN_INSCRIPTION,
    process.env.BOT_TOKEN_EDU,
    process.env.BOT_TOKEN, // legacy fallback
].filter(Boolean);

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

    // Try each token — valid if any one matches
    return BOT_TOKENS.some((token) => {
        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(token)
            .digest();

        const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        return calculatedHash === hash;
    });
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
        const { chatId, message, source } = req.body;

        if (!chatId || !message) {
            return res.status(400).json({ ok: false, message: "chatId and message required" });
        }

        // Pick the right bot based on source
        let botsToTry;
        if (source === "edu") {
            botsToTry = [req.app.locals.botEdu, req.app.locals.bot].filter(Boolean);
        } else if (source === "inscription") {
            botsToTry = [req.app.locals.bot, req.app.locals.botEdu].filter(Boolean);
        } else {
            // No source — try all
            botsToTry = [req.app.locals.bot, req.app.locals.botEdu].filter(Boolean);
        }

        if (botsToTry.length === 0) {
            return res.status(503).json({ ok: false, message: "No bots configured" });
        }

        let sent = false;
        for (const [i, bot] of botsToTry.entries()) {
            try {
                await bot.telegram.sendMessage(chatId, message, { parse_mode: "HTML" });
                sent = true;
                break;
            } catch (e) {
                console.warn(`Bot [${i}] couldn't send: ${e.message}`);
            }
        }

        if (!sent) {
            return res.status(500).json({ ok: false, error: "None of the bots could send the message" });
        }

        res.json({ ok: true });
    } catch (e) {
        console.error("Erreur notification Telegram:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

export default router;
