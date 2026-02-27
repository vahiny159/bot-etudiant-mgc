import express from "express";

const router = express.Router();

// --- VALIDATION ---
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

// --- CRÉATION STUDENT ---
router.post("/classes/:class/people", async (req, res) => {
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

// --- MISE À JOUR STUDENT (PUT) ---
router.put("/people/:id", async (req, res) => {
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

// --- CHECK DOUBLONS ---
router.get("/students/checkDuplicates", async (req, res) => {
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

// --- FIND PERSON BY USER (before /people/:id !) ---
router.get("/people/findByUser/:appId", async (req, res) => {
    console.log("🔍 Recherche par user...");
    try {
        const { appId } = req.params;
        const { allData } = req.query;
        const strapiUrl =
            `${process.env.STRAPI_API_URL}/api/people/findByUser/${encodeURIComponent(appId)}` +
            `?allData=${allData ?? "false"}`;

        const response = await fetch(strapiUrl, {
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

// --- EXPORT STUDENTS EXCEL (before /people/:id !) ---
router.get("/people/students/export", async (req, res) => {
    console.log("📊 Export Excel des étudiants...");
    try {
        const { classId, createdAtFrom } = req.query;

        const strapiUrl = new URL(`${process.env.STRAPI_API_URL}/api/people/students/export`);
        if (classId) strapiUrl.searchParams.append("classId", classId);
        if (createdAtFrom) strapiUrl.searchParams.append("createdAtFrom", createdAtFrom);

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

        const buffer = await response.arrayBuffer();

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

// --- CLASSES OUVERTES ---
router.get("/custom/classes/openedBB", async (req, res) => {
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

// --- FIND PERSON BY ID (generic :id — MUST be LAST) ---
router.get("/people/:id", async (req, res) => {
    try {
        const { id } = req.params;
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

        if (!response.ok) {
            return res.status(response.status).json(result);
        }

        res.json(result);
    } catch (e) {
        console.error("Erreur :", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
