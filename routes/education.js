import express from "express";

const router = express.Router();

// --- LIST / SEARCH EXAMS ---
router.get("/quiz-questions", async (req, res) => {
    console.log("📚 Liste/Recherche examens...");
    try {
        const rawQuery = req.originalUrl.split("?")[1] || "";
        const strapiUrl = `${process.env.STRAPI_API_URL}/api/quiz-questions${rawQuery ? "?" + rawQuery : ""}`;

        console.log("📍 URL Strapi:", strapiUrl);

        const response = await fetch(strapiUrl, {
            headers: {
                Authorization: `Bearer ${process.env.APP_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        const result = await response.json();

        if (!response.ok) {
            console.error("Erreur Strapi quiz-questions:", result);
            return res.status(response.status).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error("Erreur liste examens:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- CREATE EXAM ---
router.post("/quiz-questions", async (req, res) => {
    console.log("📝 Création examen...");
    try {
        const examData = req.body.data || req.body;

        // Validation
        if (!examData.content || !examData.content.trim()) {
            return res.status(400).json({ ok: false, errors: ["Le nom de l'examen est requis."] });
        }

        // Force level to "member"
        if (req.body.data) {
            req.body.data.level = "member";
        } else {
            req.body.level = "member";
        }

        const strapiUrl = `${process.env.STRAPI_API_URL}/api/quiz-questions`;

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
            console.error("Erreur Strapi create exam:", result);
            return res.status(response.status).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error("Erreur création examen:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- GET QUIZ SCORES (for loading existing marks) ---
router.get("/quiz-scores", async (req, res) => {
    console.log("📊 Fetching quiz scores...");
    try {
        const rawQuery = req.originalUrl.split("?")[1] || "";
        const strapiUrl = `${process.env.STRAPI_API_URL}/api/quiz-scores${rawQuery ? "?" + rawQuery : ""}`;

        console.log("📍 URL Strapi:", strapiUrl);

        const response = await fetch(strapiUrl, {
            headers: {
                Authorization: `Bearer ${process.env.APP_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        const result = await response.json();

        if (!response.ok) {
            console.error("Error Strapi quiz-scores GET:", result);
            return res.status(response.status).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error("Error fetching quiz scores:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ASSIGN MARK (quiz-score) ---
router.post("/quiz-scores", async (req, res) => {
    console.log("📊 Attribution de note...");
    try {
        const scoreData = req.body.data || req.body;

        // Validation
        const errors = [];
        if (!scoreData.quiz_question) {
            errors.push("L'examen est requis.");
        }
        if (!scoreData.user) {
            errors.push("L'utilisateur est requis.");
        }
        if (!scoreData.mode || !["OFFLINE", "ONLINE", "ABS"].includes(scoreData.mode)) {
            errors.push("Le mode doit être OFFLINE, ONLINE ou ABS.");
        }
        if (scoreData.mode !== "ABS") {
            const score = Number(scoreData.score);
            if (isNaN(score) || score < 0 || score > 100) {
                errors.push("Le score doit être un nombre entre 0 et 100.");
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ ok: false, errors });
        }

        const strapiUrl = `${process.env.STRAPI_API_URL}/api/quiz-scores`;

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
            console.error("Erreur Strapi quiz-scores:", result);
            return res.status(response.status).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error("Erreur attribution note:", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
