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

// ===================== TOAST NOTIFICATIONS =====================
const toastIcons = {
    success: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    error: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    warning: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>`,
    info: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>`
};

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${toastIcons[type] || toastIcons.info}<span style="flex:1">${message}</span><div class="toast-progress" style="animation-duration:${duration}ms"></div>`;

    // Click to dismiss
    toast.addEventListener('click', () => dismissToast(toast));

    container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => dismissToast(toast), duration);

    // Haptic
    if (tg.HapticFeedback) {
        if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
        else if (type === 'error' || type === 'warning') tg.HapticFeedback.notificationOccurred('error');
    }
}

function dismissToast(toast) {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

// ===================== RIPPLE EFFECT =====================
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.ripple');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = x + 'px';
    circle.style.top = y + 'px';

    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
});

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
        showErrorPage(403, "Please open this application from Telegram.");
        document.body.style.display = "block";
        return;
    }

    const tgUser = tg.initDataUnsafe?.user;
    const userName = tgUser?.username ? `@${tgUser.username}` : tgUser?.first_name || "User";

    try {
        const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
            if (skeleton) skeleton.classList.add("hidden");
            if (res.status === 403) showErrorPage(403, `Access denied for <b>${userName}</b>.`);
            else if (res.status === 404) showErrorPage(404, `<b>${userName}</b> not found.`);
            else if (res.status === 401) showErrorPage(401, "Invalid Telegram signature.");
            else showErrorPage(res.status, "Verification error.");
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
            showErrorPage(403, `Access denied for <b>${userName}</b>.`);
            document.body.style.display = "block";
        }
    } catch (e) {
        console.error(e);
        if (skeleton) skeleton.classList.add("hidden");
        showErrorPage(500, "Server connection error.");
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
        console.error("Error loading exams:", e);
        listEl.innerHTML = `<p class="text-red-500 text-sm text-center py-4">Loading error</p>`;
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

    btnIcon.innerHTML = '<span class="animate-spin inline-block h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full"></span>';
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
        console.error("Error searching exams:", e);
        showToast("Search error.", "error");
    } finally {
        btnIcon.textContent = 'Go';
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
              <span><img src="icons/calendar.svg" alt="" class="w-3.5 h-3.5 object-contain inline-block align-text-bottom" /> ${date}</span>
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
    icon.src = form.classList.contains('open') ? 'icons/minus.svg' : 'icons/plus.svg';
}

async function createExam() {
    const name = document.getElementById('newExamName').value.trim();
    const date = document.getElementById('newExamDate').value;
    const spinner = document.getElementById('create-exam-spinner');
    const text = document.getElementById('create-exam-text');
    const btn = document.getElementById('btn-create-exam');

    if (!name) {
        showToast("Exam name is required.", "warning");
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
        return;
    }
    if (!date) {
        showToast("Date is required.", "warning");
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
        return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');
    text.textContent = 'Creating...';

    try {
        const res = await fetch(`${BASE_URL}/api/quiz-questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: { content: name, date: `${date}T00:00:00.000Z`, level: "member" }
            }),
        });

        if (!res.ok) throw new Error("Error creating exam");
        const result = await res.json();

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        showToast("Exam created successfully!", "success");

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
        console.error("Error creating exam:", e);
        tg.showAlert(`❌ ${e.message}`);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        text.innerHTML = '<span class="flex items-center gap-1.5"><img src="icons/check-circle.svg" alt="" class="w-4 h-4 object-contain invert" /> Create Exam</span>';
    }
}

// ===================== ASSIGN MARK TAB =====================
let currentMember = null;
let selectedMode = null;
let memberScores = []; // existing quiz-scores for the current member

// ===================== STEPPER =====================
function updateStepper() {
    const hasMember = !!currentMember;
    const hasExam = !!document.getElementById('examSelect')?.value;
    const hasMode = !!selectedMode;

    // Determine completed steps
    const step = hasMember ? (hasExam ? (hasMode ? 4 : 3) : 2) : 1;

    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById(`step-circle-${i}`);
        const label = document.getElementById(`step-label-${i}`);
        const lineFill = document.getElementById(`step-line-fill-${i}`);

        if (!circle) continue;

        if (i < step) {
            // Completed
            circle.className = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30';
            circle.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
            label.className = 'text-[10px] font-bold mt-1.5 text-emerald-600 dark:text-emerald-400 transition-colors duration-300';
            if (lineFill) lineFill.style.transform = 'scaleX(1)';
        } else if (i === step) {
            // Active
            circle.className = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30';
            circle.textContent = i;
            label.className = 'text-[10px] font-bold mt-1.5 text-emerald-600 dark:text-emerald-400 transition-colors duration-300';
            if (lineFill) lineFill.style.transform = 'scaleX(0)';
        } else {
            // Inactive
            circle.className = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400';
            circle.textContent = i;
            label.className = 'text-[10px] font-bold mt-1.5 text-gray-400 dark:text-gray-500 transition-colors duration-300';
            if (lineFill) lineFill.style.transform = 'scaleX(0)';
        }
    }
}

async function loadExamsForDropdown() {
    try {
        const query = `filters[$and][0][level]=member&sort[0]=date%3Adesc&pagination[page]=1&pagination[pageSize]=50`;
        const res = await fetch(`${BASE_URL}/api/quiz-questions?${query}`);
        if (!res.ok) return;
        const result = await res.json();
        const exams = result.data || [];

        const select = document.getElementById('examSelect');
        select.innerHTML = '<option value="" selected>-- Choose an exam --</option>';
        exams.forEach(exam => {
            const a = exam.attributes || exam;
            const date = a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '';
            const opt = document.createElement('option');
            opt.value = exam.id;
            opt.textContent = `${a.content}${date ? ' (' + date + ')' : ''}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading exam dropdown:", e);
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
        query += `&filters[%24and][1][%24or][2][phone][%24containsi]=${safeVal}`;

        const response = await fetch(`${BASE_URL}/api/people?${query}`);
        if (!response.ok) throw new Error("Server error");
        const result = await response.json();
        const candidates = result.data || [];

        showSearchModal(candidates, "member");
    } catch (e) {
        console.error("Error searching member:", e);
        showToast("Search error.", "error");
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

    document.getElementById('display-member-name').textContent = attrs.name || 'Unknown';
    document.getElementById('display-member-id').textContent = `SMADA: ${username} | UserID: ${userId}`;
    document.getElementById('selected-member-card').classList.remove('hidden');
    document.getElementById('selectedMemberUserId').value = userId;

    const formSection = document.getElementById('assign-form-section');
    formSection.classList.remove('hidden');
    requestAnimationFrame(() => formSection.classList.remove('opacity-0'));

    document.getElementById('bottom-action-bar').classList.remove('hidden');

    // Fetch existing scores for this member
    loadMemberScores(userId);
    updateStepper();
}

async function loadMemberScores(userId) {
    memberScores = [];
    try {
        const query = `filters[user][id][$eq]=${userId}&populate[quiz_question]=*&pagination[pageSize]=100`;
        const res = await fetch(`${BASE_URL}/api/quiz-scores?${query}`);
        if (res.ok) {
            const result = await res.json();
            memberScores = result.data || [];
            // Auto-fill if an exam is already selected
            checkExistingScore();
        }
    } catch (e) {
        console.error("Error loading member scores:", e);
    }
}

function checkExistingScore() {
    const examSelect = document.getElementById('examSelect');
    const examId = examSelect.value;
    const scoreInput = document.getElementById('scoreInput');
    const infoBadge = document.getElementById('existing-score-info');

    // Reset
    if (infoBadge) infoBadge.remove();

    if (!examId || memberScores.length === 0) {
        return;
    }

    // Find existing score for this exam
    const existing = memberScores.find(s => {
        const qId = s.attributes?.quiz_question?.data?.id || s.quiz_question?.data?.id || s.quiz_question?.id || '';
        return String(qId) === String(examId);
    });

    const badge = document.createElement('div');
    badge.id = 'existing-score-info';

    if (existing) {
        const attrs = existing.attributes || existing;
        const mode = attrs.mode || '';
        const score = attrs.score ?? '';

        // Auto-fill mode
        if (mode && ['ONLINE', 'OFFLINE', 'ABS'].includes(mode)) {
            selectMode(mode);
        }

        // Auto-fill score
        if (mode !== 'ABS') {
            scoreInput.value = score;
        }

        badge.className = 'mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1';
        badge.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg> Existing record — Mode: ${mode}, Score: ${score}`;
    } else {
        // Reset fields for new record
        selectedMode = null;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected-online', 'selected-offline', 'selected-absent'));
        scoreInput.value = '';
        document.getElementById('score-container').style.opacity = '1';
        scoreInput.disabled = false;

        badge.className = 'mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1';
        badge.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg> New record`;
    }

    examSelect.parentElement.after(badge);
    updateStepper();
}

function resetMemberSearch() {
    currentMember = null;
    selectedMode = null;
    memberScores = [];
    document.getElementById('searchMemberInput').value = '';
    document.getElementById('selected-member-card').classList.add('hidden');
    document.getElementById('assign-form-section').classList.add('hidden', 'opacity-0');
    document.getElementById('bottom-action-bar').classList.add('hidden');
    document.getElementById('selectedMemberUserId').value = '';
    document.getElementById('examSelect').selectedIndex = 0;
    document.getElementById('scoreInput').value = '';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected-online', 'selected-offline', 'selected-absent'));

    const infoBadge = document.getElementById('existing-score-info');
    if (infoBadge) infoBadge.remove();

    const dropdown = document.getElementById('member-autocomplete');
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    updateStepper();
}

// --- Mode selection ---
function selectMode(mode) {
    selectedMode = mode;
    const colorMap = { ONLINE: 'selected-online', OFFLINE: 'selected-offline', ABS: 'selected-absent' };
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('selected-online', 'selected-offline', 'selected-absent');
        if (b.dataset.mode === mode) b.classList.add(colorMap[mode]);
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
    updateStepper();
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
        showToast("Please select a member.", "warning");
        return;
    }
    if (!examId) {
        showToast("Please select an exam.", "warning");
        return;
    }
    if (!selectedMode) {
        showToast("Please select a mode (Online/Offline/Absent).", "warning");
        return;
    }
    if (selectedMode !== 'ABS' && (isNaN(score) || score < 0 || score > 100)) {
        showToast("Score must be between 0 and 100.", "warning");
        return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerHTML = '<span>Saving...</span>';

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
            throw new Error(err.errors?.join(', ') || "Server error");
        }

        const result = await res.json();

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        showToast("Mark saved successfully!", "success");

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
        console.error("Error assigning mark:", e);
        tg.showAlert(`❌ ${e.message}`);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerHTML = '<img src="icons/check-circle.svg" alt="" class="w-5 h-5 object-contain invert" /> Save Mark';
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
        console.error("Telegram notification failed:", e);
    }
}

// ===================== SEARCH MODAL =====================
function showSearchModal(candidates, type) {
    const modal = document.getElementById("search-modal");
    const list = document.getElementById("search-results-list");
    const title = document.getElementById("search-modal-title");

    if (candidates.length === 0) {
        showToast("No results found.", "info");
        return;
    }

    title.innerText = "Select a member";
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
