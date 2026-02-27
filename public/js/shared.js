// === SHARED.JS — Code commun aux deux pages ===

// --- OFFLINE DETECTION ---
function initOfflineDetection() {
    const banner = document.getElementById("offline-banner");
    if (!banner) return;

    function updateStatus() {
        if (!navigator.onLine) {
            banner.classList.add("show");
            document.body.style.paddingTop = banner.offsetHeight + "px";
        } else {
            banner.classList.remove("show");
            document.body.style.paddingTop = "0";
        }
    }

    window.addEventListener("online", () => {
        updateStatus();
        // Brief green flash to confirm reconnection
        banner.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
        banner.innerHTML = '📶 Connexion rétablie !';
        banner.classList.add("show");
        setTimeout(() => {
            banner.classList.remove("show");
            banner.style.background = "";
            banner.innerHTML = '📡 Pas de connexion internet';
        }, 2000);
    });

    window.addEventListener("offline", updateStatus);
    updateStatus();
}

// --- SKELETON HELPERS ---
function showSkeleton(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
}

function hideSkeleton(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
}

// Init on load
document.addEventListener("DOMContentLoaded", () => {
    initOfflineDetection();
});
