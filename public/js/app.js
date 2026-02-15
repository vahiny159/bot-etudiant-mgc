let dataTree = {};
let selectedClass;

// --- ALWAYS USE TELEGRAM ---
let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();
tg.setHeaderColor("#F9FAFB");

// --- GESTION CLAVIER MOBILE (UX) ---
const inputs = document.querySelectorAll("input, select");
inputs.forEach((input) => {
  input.addEventListener("focus", function () {
    setTimeout(() => {
      this.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  });
});

async function init() {
  document.body.style.display = "none";
  await checkUserTelegram();
}

// ON PAGE LOAD
document.addEventListener("DOMContentLoaded", init);

// Changement de classe
document.getElementById("classeSelect").addEventListener("change", function () {
  selectedClass = this.value;
});

// Error page to display
function showErrorPage(status, message) {
  document.body.innerHTML = `
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f172a;
        color: #e5e7eb;
        font-family: Arial, sans-serif;
      }
      .error-box {
        text-align: center;
        padding: 40px;
        border-radius: 12px;
        background: #020617;
        box-shadow: 0 20px 40px rgba(0,0,0,.4);
      }
      .error-code {
        font-size: 72px;
        font-weight: bold;
        color: #ef4444;
      }
      .error-msg {
        font-size: 20px;
        margin-top: 10px;
        opacity: .9;
        color: #fcf8f8f6;
      }
    </style>

    <div class="error-box">
      <div class="error-code">${status}</div>
      <div class="error-msg">${message}</div>
    </div>
  `;
}

// Check telegram User
async function checkUserTelegram() {
  let initData = tg.initData;

  if (!initData) {
    showErrorPage(403, "Veuillez ouvrir cette application depuis Telegram.");
    document.body.style.display = "block";
    return;
  }

  // RÉCUPÉRATION DU NOM TELEGRAM
  const tgUser = tg.initDataUnsafe?.user;
  const userName = tgUser?.username
    ? `@${tgUser.username}`
    : tgUser?.first_name || "Utilisateur";

  try {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });

    // GESTION ERREURS SERVEUR
    if (!res.ok) {
      if (res.status === 403) {
        showErrorPage(
          403,
          `Accès refusé pour <b>${userName}</b>.<br><br>Vous n'êtes pas autorisé à créer des dossiers.`,
        );
      } else if (res.status === 404) {
        showErrorPage(
          404,
          `<b>${userName}</b> est introuvable dans la base de données.`,
        );
      } else if (res.status === 401) {
        showErrorPage(401, "Signature Telegram invalide.");
      } else {
        showErrorPage(res.status, "Erreur de vérification.");
      }

      document.body.style.display = "block";
      return;
    }

    const data = await res.json();

    if (data.ok) {
      getListClass();

      const userDisplayElement = document.getElementById(
        "telegram-user-display",
      );
      if (userDisplayElement) {
        userDisplayElement.innerText = userName;
      }

      document.body.style.display = "block";
    } else {
      showErrorPage(403, `Accès refusé pour <b>${userName}</b>.`);
      document.body.style.display = "block";
    }
  } catch (e) {
    console.error(e);
    showErrorPage(500, "Erreur de connexion au serveur.");
    document.body.style.display = "block";
  }
}

// --- CHECK DOUBLON ---
async function checkDuplicates() {
  const nom = document.getElementById("nomComplet").value;
  const btn = document.getElementById("btn-check");
  const btnText = document.getElementById("check-text");
  let btnIcon = document.getElementById("check-icon");

  if (!nom) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    const oldText = btnText.innerText;
    btnText.innerText = "⚠️ Nom manquant !";
    setTimeout(() => (btnText.innerText = oldText), 2000);
    return;
  }

  const originalClass = btn.className;
  const originalText = "Vérifier les doublons";

  btnText.innerText = "Recherche...";
  if (btnIcon) btnIcon.innerText = "⏳";
  btn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const nomSplit = nom.replace(/ /g, ",");

    // ✅ CORRECTION : URL relative, suppression de Authorization
    const response = await fetch(`/api/students/findByName/${nomSplit}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    clearTimeout(timeoutId);
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;

    if (!response.ok) throw new Error(`Erreur Server ${response.status}`);

    if (result && Array.isArray(result) && result.length > 0) {
      // Doublon trouvé
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("warning");
      resetBtn(btn, btnText, btnIcon, originalClass, originalText);
      showDuplicateModal(result);
    } else {
      // Pas de doublon
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
      btn.className =
        "w-full flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all bg-green-100 text-green-700 border border-green-300";
      btnText.innerText = "✅ C'est tout bon !";
      if (btnIcon) btnIcon.innerText = "";

      setTimeout(() => {
        resetBtn(btn, btnText, btnIcon, originalClass, originalText);
      }, 2500);
    }
  } catch (error) {
    console.error("Erreur Check:", error);
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");

    btn.className =
      "w-full flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all bg-red-100 text-red-700 border border-red-300";

    if (error.name === "AbortError") {
      btnText.innerText = "⏳ Trop long (Timeout)";
    } else {
      btnText.innerText = "❌ Erreur Serveur";
    }

    setTimeout(() => {
      resetBtn(btn, btnText, btnIcon, originalClass, originalText);
    }, 3000);
  } finally {
    btn.disabled = false;
  }
}

// --- UTILITAIRES ---
function resetBtn(btn, txtSpan, iconSpan, css, txt) {
  btn.className = css;
  txtSpan.innerText = txt;
  if (iconSpan) iconSpan.innerText = "🔍";
}

function showDuplicateModal(candidates) {
  const modal = document.getElementById("duplicate-modal");
  const list = document.getElementById("duplicate-list");
  const content = document.getElementById("modal-content");
  if (!modal || !list) return;

  list.innerHTML = "";
  candidates.forEach((s) => {
    const btn = document.createElement("button");
    btn.className =
      "w-full relative flex items-center justify-between p-4 rounded-2xl bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-all active:scale-[0.98] group text-left shadow-sm mb-2";
    btn.onclick = () => loadExistingStudent(s.id);

    // Adaptation nomComplet ou name selon Strapi
    const displayName = s.name || s.nomComplet || "Nom inconnu";

    btn.innerHTML = `
              <div>
                <div class="font-bold text-gray-900 text-base group-hover:text-yellow-800 transition-colors">${displayName}</div>
             </div>
             <div class="h-8 w-8 rounded-full bg-white text-yellow-500 flex items-center justify-center shadow-sm border border-yellow-100 group-hover:scale-110 transition-transform">✏️</div>
          `;
    list.appendChild(btn);
  });

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    if (content) {
      content.classList.remove("scale-95");
      content.classList.add("scale-100");
    }
  });
}

function closeModal() {
  const modal = document.getElementById("duplicate-modal");
  const modalContent = document.getElementById("modal-content");
  modal.classList.add("opacity-0");
  if (modalContent) {
    modalContent.classList.remove("scale-100");
    modalContent.classList.add("scale-95");
  }
  setTimeout(() => modal.classList.add("hidden"), 300);
}

async function loadExistingStudent(id) {
  closeModal();
  document.getElementById("studentId").value = id;

  const setVal = (id, val) => {
    if (document.getElementById(id))
      document.getElementById(id).value = val || "";
  };

  // ✅ CORRECTION : URL relative, suppression Authorization
  const response = await fetch(`/api/people/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;

  if (response.ok && result) {
    // Adaptation selon format Strapi
    const student = result.data?.attributes || result; // ou result tout court si le back renvoie déjà les attributs

    setVal("nomComplet", student.name || student.nomComplet);
    setVal("telephone", student.phone || student.telephone);
    setVal("dateNaissance", student.birthday || student.dateNaissance);
    setVal("adresse", student.adress || student.adresse);
    setVal("eglise", student.formerChurch || student.eglise);
    setVal("profession", student.profession);
    setVal("nomTree", student.nomTree);

    if (student.birthday) {
      document
        .getElementById("dateNaissance")
        .dispatchEvent(new Event("change"));
    }

    if (student.classType) {
      const index = student.classType === "weekend" ? 1 : 0;
      selectOption(student.classType, index);
    }

    if (student.gender) {
      document.getElementById("sexeInput").value = student.gender;
      const radios = document.getElementsByName("sexe_radio");
      for (let r of radios) {
        if (r.value === student.gender) r.checked = true;
      }
    }

    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    tg.showAlert(`📂 Profil chargé : ${student.name}`);

    const btnText = document.getElementById("btn-text");
    if (btnText) btnText.innerText = "Mettre à jour le dossier";
  }
}

function selectOption(value, index) {
  if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  document.getElementById("optionSelected").value = value;
  document.getElementById("capsule-bg").style.transform =
    `translateX(${index * 100}%)`;

  const btn0 = document.getElementById("btn-0");
  const btn1 = document.getElementById("btn-1");

  btn0.className =
    "flex-1 py-3 text-sm font-bold z-10 transition-colors " +
    (index === 0 ? "text-yellow-900" : "text-gray-500");
  btn1.className =
    "flex-1 py-3 text-sm font-bold z-10 transition-colors " +
    (index === 1 ? "text-yellow-900" : "text-gray-500");
}

// Squelette liste déroulante classe
function updateClassesList(data) {
  const select = document.getElementById("classeSelect");
  if (!select) return;
  select.innerHTML =
    '<option value="" disabled selected>Sélectionner une classe</option>';
  if (data && Array.isArray(data)) {
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      // Adaptation nom
      option.innerText = item.name || item.attributes?.name;
      select.appendChild(option);
    });
  }
}

function clearError() {
  const input = document.getElementById("nomComplet");
  input.classList.remove("border-red-500", "bg-red-50");
  input.classList.add("border-gray-200");
}

function triggerConfetti() {
  if (window.confetti) {
    var colors = ["#facc15", "#fde047", "#ffffff"];
    const opts = {
      particleCount: 40,
      spread: 55,
      colors: colors,
      disableForReducedMotion: true,
    };
    confetti({ ...opts, angle: 60, origin: { x: 0.1, y: 0.7 } });
    confetti({ ...opts, angle: 120, origin: { x: 0.9, y: 0.7 } });
  }
}

// --- MODALS & SUCCESS ---
function showSuccessModal(id) {
  const modal = document.getElementById("success-modal");
  const idSpan = document.getElementById("generated-id");
  if (idSpan) idSpan.innerText = id;

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    const content = modal.querySelector("div");
    if (content) {
      content.classList.remove("scale-95");
      content.classList.add("scale-100");
    }
  });
  triggerConfetti();
}

function closeSuccessModal() {
  const modal = document.getElementById("success-modal");
  modal.classList.add("opacity-0");
  setTimeout(() => {
    modal.classList.add("hidden");
    // tg.close(); // En local on ne ferme pas
  }, 300);
}

function setSexe(valeur) {
  document.getElementById("sexeInput").value = valeur;
  if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

/**
 * Autofill data Tree from its IDAPP
 */
async function getDataTree() {
  let appId = document.getElementById("idApp").value;
  const spinner = document.getElementById("spinner");
  spinner.classList.remove("hidden");

  try {
    // ✅ CORRECTION : URL relative, suppression Authorization
    const response = await fetch(
      `/api/people/findByUser/${appId}?allData=false`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    if (response.ok && result) {
      dataTree = result;
      fillDataTree(dataTree);
    } else {
      // showSuccessModal("No user found"); // Peut être confusant
      emptyData();
    }
    spinner.classList.add("hidden");
  } catch (error) {
    spinner.classList.add("hidden");
    console.error(error);
    // tg.showAlert("Erreur : " + error.message);
  }
}

function fillDataTree() {
  let dptInput = document.getElementById("departement");
  let nameInput = document.getElementById("nomTree");
  let phoneInput = document.getElementById("telTree");
  // fill data
  dptInput.value = dataTree.cell?.team?.department?.name || "";
  nameInput.value = dataTree.name || "";
  phoneInput.value = dataTree.phone || "";
  // disable name, and DPT, phone
  dptInput.disabled = true;
  nameInput.disabled = true;
  phoneInput.disabled = true;
}

function emptyData() {
  dataTree = {};
  let IdInput = document.getElementById("idApp");
  let dptInput = document.getElementById("departement");
  let nameInput = document.getElementById("nomTree");
  let phoneInput = document.getElementById("telTree");
  // empty data
  IdInput.value = "";
  dptInput.value = "";
  nameInput.value = "";
  phoneInput.value = "";
  // enable
  dptInput.disabled = false;
  nameInput.disabled = false;
  phoneInput.disabled = false;
}

// --- SOUMISSION ---
async function submitForm() {
  if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

  const btn = document.getElementById("main-btn");
  const spinner = document.getElementById("spinner");
  const btnText = document.getElementById("btn-text");
  const nomInput = document.getElementById("nomComplet");
  const sexeInput = document.getElementById("sexeInput");
  const classInput = document.getElementById("classeSelect");
  const idHiddenInput = document.getElementById("studentId");

  const nom = nomInput.value;
  const sexe = sexeInput.value;

  // Validations
  if (!sexe) {
    tg.showAlert("Veuillez sélectionner le sexe (Homme/Femme).");
    return;
  }
  if (!nom) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    nomInput.classList.remove("border-gray-200");
    nomInput.classList.add("border-red-500", "bg-red-50");
    nomInput.focus();
    return;
  }

  if (!selectedClass) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    classInput.classList.remove("border-gray-200");
    classInput.classList.add("border-red-500", "bg-red-50");
    classInput.focus();
    return;
  }

  btn.disabled = true;
  spinner.classList.remove("hidden");
  btnText.innerText = "Enregistrement...";

  // Collecte des données
  const data = {
    name: nom,
    phone: document.getElementById("telephone").value,
    birthday: document.getElementById("dateNaissance").value,
    adress: document.getElementById("adresse").value,
    formerChurch: document.getElementById("eglise").value,
    profession: document.getElementById("profession").value,
    classType: document.getElementById("optionSelected").value,
    relationWithTree: document.getElementById("liaison").value,
    gender: sexe,
    nomTree: document.getElementById("nomTree").value,
  };
  // Tree
  if (Object.keys(dataTree).length > 0) {
    data.tree = dataTree.id;
  }

  const existingId = idHiddenInput.value;

  let url = `/api/classes/${selectedClass}/people`;
  let method = "POST";

  if (existingId) {
    // modif students
    data.class = selectedClass;
    url = `/api/people/${existingId}`;
    method = "PUT";
  }

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: data }),
    });

    const result = await response.json();

    if (response.ok && result) {
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

      btn.disabled = false;
      spinner.classList.add("hidden");
      btnText.innerText = "Enregistrer le dossier";

      // --- GRAND NETTOYAGE ---
      idHiddenInput.value = "";
      document
        .querySelectorAll(
          'input[type="text"], input[type="tel"], input[type="date"]',
        )
        .forEach((el) => (el.value = ""));

      document.getElementById("sexeInput").value = "";
      document
        .getElementsByName("sexe_radio")
        .forEach((r) => (r.checked = false));
      document.getElementById("ageCalc").innerText = "";

      if (existingId) {
        // Si c'est un update
        showSuccessModal(existingId);
      } else {
        // Si c'est un nouveau
        showSuccessModal(result.data?.id || "OK");
      }
    } else {
      throw new Error(
        result.message || result.error?.message || "Erreur inconnue",
      );
    }
  } catch (error) {
    btn.disabled = false;
    spinner.classList.add("hidden");
    btnText.innerText = "Réessayer";
    tg.showAlert("Erreur : " + error.message);
  }
}

// Get the list of bb class from the DB
async function getListClass() {
  // ✅ CORRECTION : URL relative, suppression Authorization
  try {
    const response = await fetch(`/api/custom/classes/openedBB`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const text = await response.text();
    const result = text ? JSON.parse(text) : null;

    if (response.ok) {
      // Adaptation format Strapi
      const list = Array.isArray(result) ? result : result.data || [];
      fillListClass(list);
    } else {
      console.error("Erreur chargement classes");
    }
  } catch (e) {
    console.error(e);
  }
}

function fillListClass(data) {
  const select = document.getElementById("classeSelect");
  select.innerHTML =
    '<option value="" disabled selected>Sélectionner une classe</option>';

  data.forEach((classe) => {
    const option = document.createElement("option");
    option.value = classe.id;
    option.textContent = classe.name || classe.attributes?.name || "Classe";
    select.appendChild(option);
  });
}

// Formatage Tel
document.getElementById("telephone").addEventListener("input", function (e) {
  let x = e.target.value
    .replace(/\D/g, "")
    .match(/(\d{0,3})(\d{0,2})(\d{0,3})(\d{0,2})/);
  e.target.value = !x[2]
    ? x[1]
    : x[1] + " " + x[2] + (x[3] ? " " + x[3] : "") + (x[4] ? " " + x[4] : "");
});

// Calcul Age
document
  .getElementById("dateNaissance")
  .addEventListener("change", function (e) {
    const dateStr = e.target.value;
    const span = document.getElementById("ageCalc");

    if (!dateStr) {
      span.innerText = "";
      return;
    }

    const today = new Date();
    const birthDate = new Date(dateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 0) {
      span.innerText = "Erreur date";
      span.className = "text-sm text-red-500 font-bold";
    } else {
      span.innerText = `${age} ans`;
      span.className =
        "text-sm text-yellow-600 font-bold transition-all duration-500";
    }
  });
