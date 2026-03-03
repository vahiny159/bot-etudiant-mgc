let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// --- DARK/LIGHT MODE ---
function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    tg.setHeaderColor(isDark ? '#111827' : '#F9FAFB');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('edu-theme', isDark ? 'dark' : 'light');
}

function toggleTheme() {
    const isDark = !document.documentElement.classList.contains('dark');
    applyTheme(isDark);
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

(function () {
    const saved = localStorage.getItem('edu-theme');
    applyTheme(saved === 'dark');
})();

const BASE_URL = "";

// ===================== AUTH =====================
function showErrorPage(status, message) {
    document.body.innerHTML = `
    <style>
      body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#0f172a; color:#e5e7eb; font-family:Arial,sans-serif; }
      .error-box { text-align:center; padding:40px; border-radius:12px; background:#020617; box-shadow:0 20px 40px rgba(0,0,0,.4); }
      .error-code { font-size:72px; font-weight:bold; color:#ef4444; }
      .error-msg { font-size:20px; margin-top:10px; opacity:.9; color:#fcf8f8f6; }
    </style>
    <div class="error-box">
      <div class="error-code">${status}</div>
      <div class="error-msg">${message}</div>
    </div>`;
}

async function checkUserTelegram() {
    document.body.style.display = "block";
    const skeleton = document.getElementById("page-skeleton");
    if (skeleton) skeleton.classList.remove("hidden");
    document.querySelectorAll(".relative.z-10 > :not(#page-skeleton)").forEach(el => {
        el.style.display = "none";
    });

    let initData = tg.initData;
    if (!initData) {
        if (skeleton) skeleton.classList.add("hidden");
        showErrorPage(403, "Veuillez ouvrir cette application depuis Telegram.");
        document.body.style.display = "block";
        return;
    }

    const tgUser = tg.initDataUnsafe?.user;
    const userName = tgUser?.username ? `@${tgUser.username}` : tgUser?.first_name || "Utilisateur";

    try {
        const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
            if (skeleton) skeleton.classList.add("hidden");
            if (res.status === 403) showErrorPage(403, `Accès refusé pour <b>${userName}</b>.`);
            else if (res.status === 404) showErrorPage(404, `<b>${userName}</b> est introuvable.`);
            else if (res.status === 401) showErrorPage(401, "Signature Telegram invalide.");
            else showErrorPage(res.status, "Erreur de vérification.");
            document.body.style.display = "block";
            return;
        }

        const data = await res.json();
        if (data.ok) {
            if (skeleton) skeleton.classList.add("hidden");
            document.querySelectorAll(".relative.z-10 > *").forEach(el => {
                if (el.id !== "page-skeleton") el.style.display = "";
            });
            loadExams();
            loadExamsForDropdown();
        } else {
            if (skeleton) skeleton.classList.add("hidden");
            showErrorPage(403, `Accès refusé pour <b>${userName}</b>.`);
            document.body.style.display = "block";
        }
    } catch (e) {
        console.error(e);
        if (skeleton) skeleton.classList.add("hidden");
        showErrorPage(500, "Erreur de connexion au serveur.");
        document.body.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", checkUserTelegram);

// ===================== TABS =====================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    const bar = document.getElementById('bottom-action-bar');
    if (tab === 'assign' && currentMember) {
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }

    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// ===================== EXAMS TAB =====================
let allExams = [];

async function loadExams() {
    const listEl = document.getElementById('exams-list');
    const emptyEl = document.getElementById('exams-empty');
    const loadingEl = document.getElementById('exams-loading');

    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    listEl.innerHTML = '';

    try {
        const query = `filters[$and][0][level]=member&sort[0]=date%3Adesc&pagination[page]=1&pagination[pageSize]=20`;
        const res = await fetch(`${BASE_URL}/api/quiz-questions?${query}`);
        if (!res.ok) throw new Error("Erreur serveur");
        const result = await res.json();
        allExams = result.data || [];
        renderExams(allExams);
    } catch (e) {
        console.error("Erreur chargement examens:", e);
        listEl.innerHTML = `<p class="text-red-500 text-sm text-center py-4">❌ Erreur de chargement</p>`;
    } finally {
        loadingEl.classList.add('hidden');
    }
}

async function searchExams() {
    const val = document.getElementById('searchExamInput').value.trim();
    const btnIcon = document.getElementById('search-exam-icon');
    const listEl = document.getElementById('exams-list');
    const emptyEl = document.getElementById('exams-empty');
    const loadingEl = document.getElementById('exams-loading');

    if (!val) {
        loadExams();
        return;
    }

    btnIcon.textContent = '⏳';
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    listEl.innerHTML = '';

    try {
        const safeVal = encodeURIComponent(val);
        const query = `filters[$and][0][level]=member&filters[$and][1][content][$containsi]=${safeVal}&sort[0]=date%3Adesc&pagination[page]=1&pagination[pageSize]=20`;
        const res = await fetch(`${BASE_URL}/api/quiz-questions?${query}`);
        if (!res.ok) throw new Error("Erreur serveur");
        const result = await res.json();
        renderExams(result.data || []);
    } catch (e) {
        console.error("Erreur recherche examens:", e);
        tg.showAlert("Erreur lors de la recherche.");
    } finally {
        btnIcon.textContent = '🔍';
        loadingEl.classList.add('hidden');
    }
}

function renderExams(exams) {
    const listEl = document.getElementById('exams-list');
    const emptyEl = document.getElementById('exams-empty');

    if (exams.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = exams.map((exam, i) => {
        const a = exam.attributes || exam;
        const date = a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const delay = i * 30;
        return `
      <div class="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all" style="animation: fadeSlideIn 0.3s ease ${delay}ms both;">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">${a.content}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
              <span>📅 ${date}</span>
              <span class="text-gray-300 dark:text-gray-600">•</span>
              <span class="font-mono">ID: ${exam.id}</span>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
}

// --- CREATE EXAM ---
function toggleCreateForm() {
    const form = document.getElementById('create-form');
    const icon = document.getElementById('create-toggle-icon');
    form.classList.toggle('open');
    icon.textContent = form.classList.contains('open') ? '➖' : '➕';
}

async function createExam() {
    const name = document.getElementById('newExamName').value.trim();
    const date = document.getElementById('newExamDate').value;
    const spinner = document.getElementById('create-exam-spinner');
    const text = document.getElementById('create-exam-text');
    const btn = document.getElementById('btn-create-exam');

    if (!name) {
        tg.showAlert("⚠️ Le nom de l'examen est requis.");
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
        return;
    }
    if (!date) {
        tg.showAlert("⚠️ La date est requise.");
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
        return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');
    text.textContent = 'Création...';

    try {
        const res = await fetch(`${BASE_URL}/api/quiz-questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: { content: name, date: `${date}T00:00:00.000Z`, level: "member" }
            }),
        });

        if (!res.ok) throw new Error("Erreur lors de la création");
        const result = await res.json();

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        tg.showAlert("✅ Examen créé avec succès !");

        // Telegram notification
        const examName = result.data?.attributes?.content || name;
        sendTelegramNotification(
            `📚 <b>Nouvel examen créé</b>\n` +
            `📝 Nom : <b>${examName}</b>\n` +
            `📅 Date : ${date}`
        );

        // Reset form & reload
        document.getElementById('newExamName').value = '';
        document.getElementById('newExamDate').value = '';
        toggleCreateForm();
        loadExams();
        loadExamsForDropdown();

    } catch (e) {
        console.error("Erreur création examen:", e);
        tg.showAlert(`❌ ${e.message}`);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        text.textContent = '✅ Créer l\'examen';
    }
}

// ===================== ASSIGN MARK TAB =====================
let currentMember = null;
let selectedMode = null;

async function loadExamsForDropdown() {
    try {
        const query = `filters[$and][0][level]=member&sort[0]=date%3Adesc&pagination[page]=1&pagination[pageSize]=50`;
        const res = await fetch(`${BASE_URL}/api/quiz-questions?${query}`);
        if (!res.ok) return;
        const result = await res.json();
        const exams = result.data || [];

        const select = document.getElementById('examSelect');
        select.innerHTML = '<option value="" selected>-- Choisir un examen --</option>';
        exams.forEach(exam => {
            const a = exam.attributes || exam;
            const date = a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '';
            const opt = document.createElement('option');
            opt.value = exam.id;
            opt.textContent = `${a.content}${date ? ' (' + date + ')' : ''}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Erreur chargement dropdown examens:", e);
    }
}

// --- Search member ---
async function searchMember() {
    const val = document.getElementById('searchMemberInput').value.trim();
    const btnIcon = document.getElementById('search-member-icon');

    if (!val) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
        return;
    }

    btnIcon.innerHTML = `<span class="animate-spin inline-block h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full"></span>`;

    try {
        const safeVal = encodeURIComponent(val);

        let query = `populate[user]=*`;
        query += `&filters[%24and][0][user][level][%24eq]=member`;
        query += `&filters[%24and][1][%24or][0][name][%24containsi]=${safeVal}`;
        query += `&filters[%24and][1][%24or][1][user][username][%24containsi]=${safeVal}`;

        const response = await fetch(`${BASE_URL}/api/people?${query}`);
        if (!response.ok) throw new Error("Erreur serveur");
        const result = await response.json();
        const candidates = result.data || [];

        showSearchModal(candidates, "member");
    } catch (e) {
        console.error("Erreur recherche membre:", e);
        tg.showAlert("Erreur lors de la recherche.");
    } finally {
        btnIcon.textContent = "Go";
    }
}

function selectMember(personData) {
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    currentMember = personData;
    const attrs = personData.attributes || personData;
    const userId = attrs.user?.data?.id || '';
    const username = attrs.user?.data?.attributes?.username || '---';

    document.getElementById('display-member-name').textContent = attrs.name || 'Inconnu';
    document.getElementById('display-member-id').textContent = `SMADA: ${username} | UserID: ${userId}`;
    document.getElementById('selected-member-card').classList.remove('hidden');
    document.getElementById('selectedMemberUserId').value = userId;

    const formSection = document.getElementById('assign-form-section');
    formSection.classList.remove('hidden');
    requestAnimationFrame(() => formSection.classList.remove('opacity-0'));

    document.getElementById('bottom-action-bar').classList.remove('hidden');
}

function resetMemberSearch() {
    currentMember = null;
    selectedMode = null;
    document.getElementById('searchMemberInput').value = '';
    document.getElementById('selected-member-card').classList.add('hidden');
    document.getElementById('assign-form-section').classList.add('hidden', 'opacity-0');
    document.getElementById('bottom-action-bar').classList.add('hidden');
    document.getElementById('selectedMemberUserId').value = '';
    document.getElementById('examSelect').selectedIndex = 0;
    document.getElementById('scoreInput').value = '';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));

    const dropdown = document.getElementById('member-autocomplete');
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
}

// --- Mode selection ---
function selectMode(mode) {
    selectedMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.mode === mode);
    });

    const scoreContainer = document.getElementById('score-container');
    const scoreInput = document.getElementById('scoreInput');
    if (mode === 'ABS') {
        scoreContainer.style.opacity = '0.4';
        scoreInput.disabled = true;
        scoreInput.value = '0';
    } else {
        scoreContainer.style.opacity = '1';
        scoreInput.disabled = false;
        if (scoreInput.value === '0') scoreInput.value = '';
    }

    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// --- Submit mark ---
async function submitMark() {
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

    const btn = document.getElementById('main-btn');
    const spinner = document.getElementById('submit-spinner');
    const btnText = document.getElementById('submit-btn-text');

    const userId = document.getElementById('selectedMemberUserId').value;
    const examId = document.getElementById('examSelect').value;
    const score = Number(document.getElementById('scoreInput').value);

    // Validation
    if (!userId) {
        tg.showAlert("⚠️ Veuillez sélectionner un membre.");
        return;
    }
    if (!examId) {
        tg.showAlert("⚠️ Veuillez sélectionner un examen.");
        return;
    }
    if (!selectedMode) {
        tg.showAlert("⚠️ Veuillez sélectionner un mode (Online/Offline/Absent).");
        return;
    }
    if (selectedMode !== 'ABS' && (isNaN(score) || score < 0 || score > 100)) {
        tg.showAlert("⚠️ Le score doit être entre 0 et 100.");
        return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerHTML = '<span>Enregistrement...</span>';

    try {
        const payload = {
            data: {
                quiz_question: parseInt(examId, 10),
                user: parseInt(userId, 10),
                mode: selectedMode,
                score: selectedMode === 'ABS' ? 0 : score,
            }
        };

        const res = await fetch(`${BASE_URL}/api/quiz-scores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.errors?.join(', ') || "Erreur serveur");
        }

        const result = await res.json();

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        tg.showAlert("✅ Note attribuée avec succès !");

        // Telegram notification
        const memberName = currentMember?.attributes?.name || currentMember?.name || '';
        const examName = document.getElementById('examSelect').selectedOptions[0]?.textContent || '';
        sendTelegramNotification(
            `📊 <b>Note attribuée</b>\n` +
            `👤 Membre : <b>${memberName}</b>\n` +
            `📝 Examen : <b>${examName}</b>\n` +
            `🎯 Mode : ${selectedMode}\n` +
            `💯 Score : ${selectedMode === 'ABS' ? 'Absent' : score + '/100'}`
        );

        // Reset
        resetMemberSearch();

    } catch (e) {
        console.error("Erreur attribution note:", e);
        tg.showAlert(`❌ ${e.message}`);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerHTML = '📊 Enregistrer la note';
    }
}

// ===================== TELEGRAM NOTIFICATION =====================
async function sendTelegramNotification(message) {
    try {
        const chatId = tg.initDataUnsafe?.user?.id;
        if (!chatId) return;
        await fetch("/api/notify/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, message }),
        });
    } catch (e) {
        console.error("Notification Telegram échouée:", e);
    }
}

// ===================== SEARCH MODAL =====================
function showSearchModal(candidates, type) {
    const modal = document.getElementById("search-modal");
    const list = document.getElementById("search-results-list");
    const title = document.getElementById("search-modal-title");

    if (candidates.length === 0) {
        tg.showAlert("Aucun résultat trouvé.");
        return;
    }

    title.innerText = "Sélectionner un membre";
    list.innerHTML = "";

    candidates.forEach((item) => {
        const data = item.attributes || item;
        const name = data.name || "Unknown";
        const smadaId = data.user?.data?.attributes?.username || "---";

        const btn = document.createElement("button");
        btn.className =
            "w-full text-left p-3 bg-gray-50 dark:bg-gray-700 hover:bg-emerald-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl mb-2 flex justify-between items-center transition-colors";

        btn.onclick = () => {
            selectMember(item);
            closeSearchModal();
        };

        btn.innerHTML = `
      <div>
        <div class="font-bold text-gray-900 dark:text-gray-100">${name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: ${smadaId}</div>
      </div>
      <div class="text-emerald-500 dark:text-emerald-400 text-lg">›</div>
    `;
        list.appendChild(btn);
    });

    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        document.getElementById("search-modal-content").classList.remove("scale-95");
    });
}

function closeSearchModal() {
    const modal = document.getElementById("search-modal");
    modal.classList.add("opacity-0");
    document.getElementById("search-modal-content").classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 300);
}
