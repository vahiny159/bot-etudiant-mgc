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

// --- CHECK DOUBLON (Filtre strict côté Frontend) ---
async function checkDuplicates() {
  let nomBrut = document.getElementById("nomComplet").value;
  const btn = document.getElementById("btn-check");
  const btnText = document.getElementById("check-text");
  let btnIcon = document.getElementById("check-icon");

  // On nettoie les espaces en trop
  const nom = nomBrut.trim().replace(/\s+/g, " ");

  if (!nom) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    const oldText = btnText.innerText;
    btnText.innerText = "⚠️ Nom manquant !";
    setTimeout(() => (btnText.innerText = oldText), 2000);
    return;
  }

  const originalClass = btn.className;
  const originalText = "Check doublons";

  btnText.innerText = "Recherche...";
  if (btnIcon)
    btnIcon.innerHTML = `<span class="animate-spin inline-block h-4 w-4 border-2 border-yellow-800 border-t-transparent rounded-full"></span>`;
  btn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Retour à ton ancienne route qui fonctionne côté serveur
    const nomSplit = nom.replace(/ /g, ",");

    const response = await fetch(`/api/students/findByName/${nomSplit}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    const result = text ? JSON.parse(text) : null;

    if (!response.ok) throw new Error(`Erreur Server ${response.status}`);

    let candidates = [];
    if (result && Array.isArray(result)) {
      candidates = result;
    }

    // 🚀 LE FILTRE MAGIQUE : On élimine les résultats vagues !
    const motsRecherches = nom.toLowerCase().split(" ");

    candidates = candidates.filter((c) => {
      const nomCandidat = (c.name || c.nomComplet || "").toLowerCase();
      // Le nom du candidat doit obligatoirement contenir TOUS les mots tapés
      return motsRecherches.every((mot) => nomCandidat.includes(mot));
    });

    if (candidates.length > 0) {
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("warning");
      resetBtn(btn, btnText, btnIcon, originalClass, originalText);
      showDuplicateModal(candidates);
    } else {
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

      btn.className =
        "w-full flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all bg-green-50 text-green-700 border border-green-200";
      btnText.innerText = "Aucun doublon trouvé !";
      if (btnIcon) btnIcon.innerHTML = "✅";

      setTimeout(() => {
        resetBtn(btn, btnText, btnIcon, originalClass, originalText);
      }, 3000);
    }
  } catch (error) {
    console.error("Erreur Check:", error);
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");

    btn.className =
      "w-full flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all bg-red-50 text-red-700 border border-red-200";

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

// Fonction utilitaire pour remettre le bouton à son état normal
function resetBtn(btn, txtSpan, iconSpan, css, txt) {
  btn.className = css;
  txtSpan.innerText = txt;
  if (iconSpan)
    iconSpan.innerHTML = `<img src="icons/duplicate.svg" alt="Icone Duplicate" class="w-5 h-5 object-contain" />`;
}

// --- MODALE DES RÉSULTATS ---
function showDuplicateModal(candidates) {
  const modal = document.getElementById("duplicate-modal");
  const list = document.getElementById("duplicate-list");
  const content = document.getElementById("modal-content");
  if (!modal || !list) return;

  list.innerHTML = "";
  candidates.forEach((s) => {
    const data = s.attributes || s;
    const displayName = data.name || data.nomComplet || "Nom inconnu";

    const btn = document.createElement("button");
    btn.className =
      "w-full relative flex items-center justify-between p-4 rounded-2xl bg-white border border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-md transition-all active:scale-[0.98] group text-left shadow-sm mb-3";
    btn.onclick = () => loadExistingStudent(s.id);

    btn.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 flex items-center justify-center font-black text-lg shadow-inner border border-yellow-300">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div class="font-bold text-gray-900 text-base group-hover:text-yellow-800 transition-colors">${displayName}</div>
          <div class="text-[11px] font-bold text-yellow-600/70 uppercase tracking-wide mt-0.5">Dossier existant</div>
        </div>
      </div>
      
      <div class="flex-shrink-0 text-yellow-400 group-hover:text-yellow-600 transition-colors group-hover:translate-x-1 duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
      </div>
    `;
    list.appendChild(btn);
  });

  // Affichage fluide de la modale
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

  const setVal = (elId, val) => {
    if (document.getElementById(elId))
      document.getElementById(elId).value = val || "";
  };

  const queryParams =
    "?populate[0]=class&populate[1]=tree&populate[2]=tree.user";

  const response = await fetch(`/api/people/${id}${queryParams}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : null;

  if (response.ok && result) {
    const student = result.data?.attributes || result;

    // Champs de base
    setVal("nomComplet", student.name);
    setVal("telephone", student.phone);
    setVal("dateNaissance", student.birthday);
    setVal("facebook", student.facebook || student.facebookId || "");
    setVal("liaison", student.relationWithTree || "");

    // Calcul âge
    if (student.birthday) {
      document
        .getElementById("dateNaissance")
        .dispatchEvent(new Event("change"));
    }

    // Sexe
    if (student.gender) {
      document.getElementById("sexeInput").value = student.gender;
      document.getElementsByName("sexe_radio").forEach((r) => {
        if (r.value === student.gender) r.checked = true;
      });
    }

    // Classe
    const classeId =
      student.class?.data?.id ||
      student.classes?.data?.[0]?.id ||
      student.class?.id ||
      null;
    if (classeId) {
      selectedClass = String(classeId);
      const select = document.getElementById("classeSelect");
      if (select) select.value = selectedClass;
    }

    // Gestion tree
    let treeData = null;
    let treeId = null;

    if (student.tree?.data?.attributes) {
      treeData = student.tree.data.attributes;
      treeId = student.tree.data.id;
    } else if (student.tree && typeof student.tree === "object") {
      treeData = student.tree;
      treeId = student.tree.id;
    }

    if (treeData) {
      dataTree = { id: treeId, ...treeData };

      setVal("nomTree", treeData.name || "");
      setVal("telTree", treeData.phone || "");

      const appId =
        treeData.user?.data?.attributes?.username ||
        treeData.user?.username ||
        treeData.scjId ||
        "";
      setVal("idApp", appId);

      const deptName =
        treeData.department || treeData.registrationDepartment || "";
      setVal("departement", deptName);

      document.getElementById("nomTree").disabled = true;
      document.getElementById("departement").disabled = true;
    } else {
      setVal("nomTree", student.treeName || "");
    }

    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    tg.showAlert(`📂 Profil chargé : ${student.name}`);

    const banner = document.getElementById("edit-banner");
    if (banner) {
      banner.classList.remove("hidden");
      banner.classList.add("flex");
    }

    const btnText = document.getElementById("btn-text");
    if (btnText) btnText.innerText = "Mettre à jour le dossier";
  }
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
  if (!appId) {
    emptyData();
    return;
  }
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

function fillDataTree(dataTree) {
  let dptInput = document.getElementById("departement");
  let nameInput = document.getElementById("nomTree");
  let phoneInput = document.getElementById("telTree");

  // fill data
  dptInput.value = dataTree.cell?.team?.department?.name || "";
  nameInput.value = dataTree.name || "";
  phoneInput.value = dataTree.phone || "";

  dptInput.disabled = true;
  nameInput.disabled = true;
  // phoneInput.disabled = true;
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

// --- RESET FORMULAIRE (nouveau dossier) ---
function resetForm() {
  if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

  document.getElementById("studentId").value = "";
  selectedClass = null;

  document
    .querySelectorAll(
      'input[type="text"], input[type="tel"], input[type="date"]',
    )
    .forEach((el) => (el.value = ""));

  // Reset sexe
  document.getElementById("sexeInput").value = "";
  document.getElementsByName("sexe_radio").forEach((r) => (r.checked = false));
  document.getElementById("ageCalc").innerText = "";

  // Reset classe
  const select = document.getElementById("classeSelect");
  if (select) select.selectedIndex = 0;

  // Reset liaison
  const liaison = document.getElementById("liaison");
  if (liaison) liaison.selectedIndex = 0;

  // Reset section Tree
  emptyData();

  // Cacher la bannière mode modification
  const banner = document.getElementById("edit-banner");
  if (banner) {
    banner.classList.add("hidden");
    banner.classList.remove("flex");
  }

  // Remettre le texte du bouton principal
  const btnText = document.getElementById("btn-text");
  if (btnText)
    btnText.innerHTML = `<img src="icons/save.svg" alt="Icone save" class="w-8 h-8 object-contain" /><span>Enregistrer le dossier</span>`;
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

  const telephone = document.getElementById("telephone").value.trim();
  const dateNaissance = document.getElementById("dateNaissance").value;
  const facebook = document.getElementById("facebook").value.trim();

  // Validations — tous les champs Fruit sont obligatoires
  if (
    !nom ||
    !sexe ||
    !telephone ||
    !dateNaissance ||
    !facebook ||
    !selectedClass
  ) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    tg.showAlert("Veuillez remplir tous les champs de la partie Fruit.");

    if (!nom) {
      nomInput.classList.remove("border-gray-200");
      nomInput.classList.add("border-red-500", "bg-red-50");
    }
    if (!selectedClass) {
      classInput.classList.remove("border-gray-200");
      classInput.classList.add("border-red-500", "bg-red-50");
    }
    return;
  }

  btn.disabled = true;
  spinner.classList.remove("hidden");
  btnText.innerText = "Enregistrement...";

  const data = {
    name: nom,
    phone: telephone,
    birthday: dateNaissance,
    facebookId: facebook,
    relationWithTree: document.getElementById("liaison").value,
    gender: sexe,
    treeName: document.getElementById("nomTree").value,
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
    // On ajoute "?populate=user" (ou populate=*) pour forcer Strapi à renvoyer le matricule
    url = `/api/people/${existingId}?populate=*`;
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

    console.log("🟢 RETOUR STRAPI :", result);

    if (response.ok && result) {
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

      btn.disabled = false;
      spinner.classList.add("hidden");
      btnText.innerText = "Enregistrer le dossier";

      // --- GRAND NETTOYAGE ---
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

      // RÉCUPÉRATION DU MATRICULE (POST ou PUT)
      // PUT → result.data.attributes.email = "43010016@mail.com" → on extrait la partie avant "@"
      const emailAttr = result.data?.attributes?.email || "";
      const matricule =
        (emailAttr ? emailAttr.split("@")[0] : null) ||
        result.data?.attributes?.user?.data?.attributes?.username ||
        result.data?.attributes?.user?.username ||
        result.data?.username ||
        result.data?.id ||
        "OK";

      showSuccessModal(matricule);
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
