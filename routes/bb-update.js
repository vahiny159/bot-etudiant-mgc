import express from "express";

const router = express.Router();

// --- VALIDATION ---
const VALID_BB_CODES = [
    "BB01", "BB02", "BB03", "BB04", "BB05", "BB06",
    "BB07", "BB08", "BB09", "BB10", "BB11", "BB12",
];

function validateBBReport(data) {
    const errors = [];

    const bbCode = data.code || data.bbCode;
    if (!bbCode || !VALID_BB_CODES.includes(bbCode)) {
        errors.push(`Code BB invalide. Valeurs acceptées : ${VALID_BB_CODES.join(", ")}`);
    }

    if (!data.student || isNaN(Number(data.student))) {
        errors.push("L'ID de l'étudiant est requis.");
    }

    return errors;
}

// --- SEARCH PEOPLE (students / teachers) ---
router.get("/people", async (req, res) => {
    console.log("🔍 Recherche people...");
    try {
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
router.post("/bb-reports", async (req, res) => {
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
router.put("/bb-reports/:id", async (req, res) => {
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

// --- DELETE BB REPORT ---
router.delete('/bb-reports/:id', async (req, res) => {
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

export default router;
