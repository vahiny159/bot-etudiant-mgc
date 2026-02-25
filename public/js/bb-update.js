let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();
tg.setHeaderColor("#F9FAFB");

const BASE_URL = "";

// leçon bb
const LESSONS = {
  BB01: "Hazo Ambolena Amoron'ny Rano Velona",
  BB02: "Tempoly Tsara",
  BB03: "Fahalalana Fototra ny Baiboly",
  BB04: "Testamenta Taloha sy Testamenta Vaovao",
  BB05: "Fanavahana Vanim-potoana",
  BB06: "Nahoana i Jesosy no Antsoina hoe Mesia?",
  BB07: "Fanavahana ny Tsara sy ny Ratsy (Fizarana 1)",
  BB08: "Fanavahana ny Tsara sy ny Ratsy (Fizarana 2)",
  BB09: "Tsiambaratelon'ny Fanjakan'ny Lanitra Voasoratra Anaty Fanoharana",
  BB10: "Saha Efatra",
  BB11: "Mazava sy Maizina (Fizarana 1-2)",
  BB12: "Mosary",
};

let currentStudent = null;
let currentStudentReports = [];
let currentTeacherId = null;
let currentReportId = null;

// recherche bb
async function searchStudent() {
  const input = document.getElementById("searchStudentInput");
  const val = input.value.trim();
  const btnIcon = document.getElementById("search-student-icon");

  if (!val) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    return;
  }

  btnIcon.innerHTML = `<span class="animate-spin inline-block h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></span>`;
  input.disabled = true;

  try {
    const safeVal = encodeURIComponent(val);

    // encodage pour la sécurité
    let query = `populate[user]=*&populate[bbReports][populate][teacher][populate][user]=*`;
    query += `&filters[%24and][0][user][level][%24ne]=member`;
    query += `&filters[%24and][1][%24or][0][name][%24containsi]=${safeVal}`;
    query += `&filters[%24and][1][%24or][1][user][username][%24containsi]=${safeVal}`;

    const response = await fetch(`${BASE_URL}/api/people?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Erreur serveur");
    const result = await response.json();
    const candidates = result.data || [];

    showSearchModal(candidates, "student");
  } catch (error) {
    console.error("Erreur recherche étudiant:", error);
    tg.showAlert("Erreur lors de la recherche. Veuillez réessayer.");
  } finally {
    btnIcon.innerHTML = "Go";
    input.disabled = false;
  }
}

// selection bb
function selectStudent(studentData) {
  if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  closeSearchModal();

  currentStudent = studentData;
  const attrs = studentData.attributes || studentData;

  console.log("⬇️ DOSSIER CHARGÉ :", attrs.name, attrs.firstRegistrationInterview);

  currentStudentReports = attrs.bbReports?.data || [];

  document.getElementById("display-student-name").innerText = attrs.name || "Nom Inconnu";
  document.getElementById("display-student-id").innerText = attrs.user?.data?.attributes?.username || "Sans ID Smada";
  document.getElementById("selected-student-card").classList.remove("hidden");

  document.getElementById("studentId").value = studentData.id;
  document.getElementById("nomComplet").value = attrs.name || "";
  document.getElementById("telephone").value = attrs.phone || "";

  // gestion interview
  const hasInterviewCb = document.getElementById("hasInterview");
  const interviewDateContainer = document.getElementById("interview-date-container");
  const interviewDateInput = document.getElementById("dateInterview");

  if (attrs.firstRegistrationInterview === true) {
    hasInterviewCb.checked = true;
    interviewDateContainer.classList.remove("hidden");

    if (attrs.firstRegistrationDate) {
      interviewDateInput.value = attrs.firstRegistrationDate.split("T")[0];
    }
  } else {
    hasInterviewCb.checked = false;
    interviewDateContainer.classList.add("hidden");
    interviewDateInput.value = "";
  }

  const mainForm = document.getElementById("main-form-section");
  const bottomBar = document.getElementById("bottom-action-bar");
  mainForm.classList.remove("hidden");
  bottomBar.classList.remove("hidden");

  requestAnimationFrame(() => {
    mainForm.classList.remove("opacity-0");
  });

  updateLessonUI();

  document.getElementById("bbLessonSelect").dispatchEvent(new Event("change"));
}

function resetStudentSearch() {
  currentStudent = null;
  currentStudentReports = [];
  document.getElementById("selected-student-card").classList.add("hidden");
  document.getElementById("main-form-section").classList.add("hidden", "opacity-0");
  document.getElementById("bottom-action-bar").classList.add("hidden");
  document.getElementById("searchStudentInput").value = "";

  // reset form
  document.getElementById("bbLessonSelect").selectedIndex = 0;
  document.getElementById("dateLesson").value = "";
  resetTeacherSearch();

  // NETTOYAGE INTERVIEW
  document.getElementById("hasInterview").checked = false;
  document.getElementById("interview-date-container").classList.add("hidden");
  document.getElementById("dateInterview").value = "";
}

// gestion leçon
function updateLessonUI() {
  const select = document.getElementById("bbLessonSelect");
  const options = select.options;
  const totalLessons = Object.keys(LESSONS).length;
  const completedCodes = currentStudentReports.map((r) => (r.attributes || r).code);

  let highestNum = 0;
  completedCodes.forEach((code) => {
    const num = parseInt(code.replace("BB", ""), 10);
    if (num > highestNum) highestNum = num;
  });

  // prochaine leçon logique
  let nextLessonCode = null;
  if (highestNum < totalLessons) {
    nextLessonCode = `BB${String(highestNum + 1).padStart(2, "0")}`;
  }

  for (let i = 1; i < options.length; i++) {
    const opt = options[i];
    const code = opt.value;
    const baseText = LESSONS[code];

    if (completedCodes.includes(code)) {
      opt.innerText = `✅ ${code} - ${baseText} (Done)`;
    } else if (code === nextLessonCode) {
      opt.innerText = `👉 ${code} - ${baseText} (To do)`;
    } else {
      opt.innerText = `🔒 ${code} - ${baseText}`;
    }
  }

  if (nextLessonCode) {
    select.value = nextLessonCode;
  } else if (highestNum === totalLessons) {
    select.value = `BB${String(totalLessons).padStart(2, "0")}`;
  } else {
    select.value = "BB01";
  }
}

// changement de leçon
document.getElementById("bbLessonSelect").addEventListener("change", function (e) {
  const selectedCode = e.target.value;
  const infoBadge = document.getElementById("lesson-status-info");

  if (!selectedCode || !currentStudent) return;

  // chercher si l'étudiant a déjà fait la leçon
  const existingReport = currentStudentReports.find((r) => {
    const rAttrs = r.attributes || r;
    return rAttrs.code === selectedCode;
  });

  if (existingReport) {
    const rAttrs = existingReport.attributes || existingReport;
    infoBadge.classList.remove("hidden");
    document.getElementById("btn-delete-lesson").classList.remove("hidden");
    currentReportId = existingReport.id;

    // pré-remplir la date
    if (rAttrs.date) {
      document.getElementById("dateLesson").value = rAttrs.date.split("T")[0];
    }

    // MOUCHARDS POUR LE BBT
    console.log(`\n--- VÉRIFICATION LEÇON ${selectedCode} ---`);
    console.log("Objet complet de la leçon :", rAttrs);
    console.log("Champ 'teacher' :", rAttrs.teacher);

    if (rAttrs.teacher && rAttrs.teacher.data) {
      console.log("✅ Teacher trouvé :", rAttrs.teacher.data.attributes?.name);
      selectTeacher(rAttrs.teacher.data, true);
    } else {
      console.log("❌ Aucun teacher valide trouvé dans les données (ou teacher.data est null)");
      resetTeacherSearch();
    }
  } else {
    infoBadge.classList.add("hidden");
    document.getElementById("dateLesson").value = "";
    document.getElementById("btn-delete-lesson").classList.add("hidden");
    currentReportId = null;
    resetTeacherSearch();
  }
});

// recherche bbt
async function searchTeacher() {
  const input = document.getElementById("searchTeacherInput");
  const val = input.value.trim();
  const btnIcon = document.getElementById("search-teacher-icon");

  if (!val) return;

  btnIcon.innerText = "⏳";
  input.disabled = true;

  try {
    const safeVal = encodeURIComponent(val);

    let query = `populate[user]=*`;
    query += `&filters[%24and][0][user][level][%24eq]=member`;
    query += `&filters[%24and][1][status][%24eq]=active`;
    query += `&filters[%24and][2][%24or][0][name][%24containsi]=${safeVal}`;
    query += `&filters[%24and][2][%24or][1][user][username][%24containsi]=${safeVal}`;

    const response = await fetch(`${BASE_URL}/api/people?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Erreur serveur");
    const result = await response.json();
    const candidates = result.data || [];

    showSearchModal(candidates, "teacher");
  } catch (error) {
    console.error("Erreur recherche teacher:", error);
    tg.showAlert("Impossible de trouver le membre.");
  } finally {
    btnIcon.innerText = "Chercher";
    input.disabled = false;
  }
}

function selectTeacher(teacherData, silent = false) {
  if (!silent && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  closeSearchModal();

  currentTeacherId = teacherData.id;
  const attrs = teacherData.attributes || teacherData;
  const teacherIdApp = attrs.user?.data?.attributes?.username || "";

  document.getElementById("display-teacher-name").innerHTML = `
    <img src="icons/teacher.svg" alt="Teacher" class="w-5 h-5 object-contain" />
    <span>${attrs.name} ${teacherIdApp ? "(" + teacherIdApp + ")" : ""}</span>
  `;

  document.getElementById("searchTeacherInput").classList.add("hidden");
  document.getElementById("btn-search-teacher").classList.add("hidden");
  document.getElementById("selected-teacher-card").classList.remove("hidden");
  document.getElementById("selected-teacher-card").classList.add("flex");
}

function resetTeacherSearch() {
  currentTeacherId = null;
  document.getElementById("searchTeacherInput").value = "";
  document.getElementById("searchTeacherInput").classList.remove("hidden");
  document.getElementById("btn-search-teacher").classList.remove("hidden");
  document.getElementById("selected-teacher-card").classList.add("hidden");
  document.getElementById("selected-teacher-card").classList.remove("flex");
}

// soumission finale
async function submitBBLesson() {
  if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

  const btn = document.getElementById("main-btn");
  const spinner = document.getElementById("spinner");
  const btnText = document.getElementById("btn-text");

  const studentId = document.getElementById("studentId").value;
  const nom = document.getElementById("nomComplet").value.trim();
  const tel = document.getElementById("telephone").value.replace(/\s/g, "");
  const codeLesson = document.getElementById("bbLessonSelect").value;
  const dateLesson = document.getElementById("dateLesson").value;

  const hasInterview = document.getElementById("hasInterview").checked;
  const dateInterview = document.getElementById("dateInterview").value;

  // validation
  if (!nom || !codeLesson || !dateLesson) {
    tg.showAlert("⚠️ Please fill in the Name, BB Lesson, and Date.");
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    return;
  }

  if (hasInterview && !dateInterview) {
    tg.showAlert("⚠️ You checked 'Interview', please specify the date.");
    return;
  }

  btn.disabled = true;
  spinner.classList.remove("hidden");
  btnText.innerHTML = "<span>Processing...</span>";

  try {
    // préparation des données du BB Report
    const reportData = {
      code: codeLesson,
      title: LESSONS[codeLesson],
      completed: true,
      date: `${dateLesson}T12:00:00.000Z`,
      student: parseInt(studentId, 10),
      teacher: currentTeacherId ? parseInt(currentTeacherId, 10) : null,
    };

    // chercher si c'est un PUT ou un POST
    const existingReport = currentStudentReports.find(
      (r) => (r.attributes || r).code === codeLesson,
    );

    let reportUrl = `${BASE_URL}/api/bb-reports`;
    let reportMethod = "POST";
    if (existingReport) {
      reportUrl = `${BASE_URL}/api/bb-reports/${existingReport.id}`;
      reportMethod = "PUT";
    }

    // APPEL API : Enregistrement du Rapport
    const reportResponse = await fetch(reportUrl, {
      method: reportMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: reportData }),
    });

    if (!reportResponse.ok)
      throw new Error("Erreur lors de la sauvegarde du rapport BB.");

    const resultReport = await reportResponse.json();

    // préparation des données du Student
    const lessonNumber = parseInt(codeLesson.replace("BB", ""), 10);

    const studentData = {
      name: nom,
      phone: tel,
      bbLessonNumber: lessonNumber,
      firstRegistrationInterview: hasInterview,
      firstRegistrationDate: hasInterview
        ? `${dateInterview}T12:00:00.000Z`
        : null,
    };

    // APPEL API : Mise à jour du profil de l'étudiant
    const studentResponse = await fetch(`${BASE_URL}/api/people/${studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: studentData }),
    });

    if (!studentResponse.ok)
      throw new Error("Erreur lors de la mise à jour de l'étudiant.");

    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    tg.showAlert("✅ Lesson and Profile updated successfully !");

    if (existingReport) {
      const index = currentStudentReports.findIndex(r => r.id === existingReport.id);
      if (index !== -1) currentStudentReports[index] = resultReport.data;
    } else {
      currentStudentReports.push(resultReport.data);
    }

    updateLessonUI();
    document.getElementById("bbLessonSelect").dispatchEvent(new Event("change"));

  } catch (error) {
    console.error("Erreur Submit:", error);
    tg.showAlert(`❌ ${error.message}`);
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
  } finally {
    btn.disabled = false;
    spinner.classList.add("hidden");
    btnText.innerHTML = "<span>Save lesson</span>";
  }
}

// suppression leçon
async function deleteBBLesson() {
  if (!currentReportId || !currentStudent) return;

  // demande de confirmation à l'utilisateur via Telegram
  tg.showConfirm("Are you sure you want to delete this lesson record ?", async (confirmed) => {
    if (!confirmed) return;

    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("heavy");

    const btnDel = document.getElementById("btn-delete-lesson");
    const originalText = btnDel.innerHTML;
    btnDel.innerHTML = "Deleting...";
    btnDel.disabled = true;

    try {
      // suppression du rapport BB dans Strapi
      const delResponse = await fetch(`${BASE_URL}/api/bb-reports/${currentReportId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!delResponse.ok) throw new Error("Erreur lors de la suppression du rapport.");

      const codeLessonToDelete = document.getElementById("bbLessonSelect").value;
      const remainingReports = currentStudentReports.filter(r => (r.attributes || r).code !== codeLessonToDelete);

      let newHighestNum = 0;
      remainingReports.forEach(r => {
        const num = parseInt((r.attributes || r).code.replace("BB", ""), 10);
        if (num > newHighestNum) newHighestNum = num;
      });

      // mise à jour du niveau de l'étudiant
      const studentId = document.getElementById("studentId").value;
      await fetch(`${BASE_URL}/api/people/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { bbLessonNumber: newHighestNum } }),
      });

      tg.showAlert("🗑️ Lesson record deleted successfully !");
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

      // On met à jour l'interface sans fermer le dossier
      currentStudentReports = remainingReports;
      updateLessonUI();
      document.getElementById("bbLessonSelect").dispatchEvent(new Event("change"));

    } catch (error) {
      console.error(error);
      tg.showAlert(`Erreur: ${error.message}`);
    } finally {
      btnDel.innerHTML = originalText;
      btnDel.disabled = false;
    }
  });
}

// modales génériques de résultat
function showSearchModal(candidates, type) {
  const modal = document.getElementById("search-modal");
  const list = document.getElementById("search-results-list");
  const title = document.getElementById("search-modal-title");

  if (candidates.length === 0) {
    tg.showAlert("No results found.");
    return;
  }

  title.innerText =
    type === "student" ? "Select Student" : "Select Teacher";
  list.innerHTML = "";

  candidates.forEach((item) => {
    const data = item.attributes || item;
    const name = data.name || "Unknown";
    const smadaId = data.user?.data?.attributes?.username || "---";

    const btn = document.createElement("button");
    btn.className =
      "w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-xl mb-2 flex justify-between items-center transition-colors";

    btn.onclick = () => {
      if (type === "student") selectStudent(item);
      else selectTeacher(item);
    };

    btn.innerHTML = `
      <div>
        <div class="font-bold text-gray-900">${name}</div>
        <div class="text-xs text-gray-500 font-mono">ID: ${smadaId}</div>
      </div>
      <div class="text-blue-500 text-lg">›</div>
    `;
    list.appendChild(btn);
  });

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    document
      .getElementById("search-modal-content")
      .classList.remove("scale-95");
  });
}

function closeSearchModal() {
  const modal = document.getElementById("search-modal");
  modal.classList.add("opacity-0");
  document.getElementById("search-modal-content").classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
}