// ===== MY TROPHIES / EMPTY PAGE: nickname + loading reale + navigazione =====

// ---------- Nickname (persistito nell'onboarding) nel bottone header ----------
const nickname = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();
const dollzBtn = document.getElementById("user-dollz-btn");
if (dollzBtn) dollzBtn.textContent = nickname;

// ---------- Animazione "Loading" (1 → 2 → 3 punti in loop) ----------
const loadingText = document.getElementById("loading-text");
let dotsTimer = null;

function startDots() {
    let dots = 1;
    loadingText.textContent = "Loading" + ".".repeat(dots);
    dotsTimer = setInterval(() => {
        dots = dots >= 3 ? 1 : dots + 1;
        loadingText.textContent = "Loading" + ".".repeat(dots);
    }, 400);
}

function stopDots() {
    clearInterval(dotsTimer);
    dotsTimer = null;
}

// ---------- Loading REALE: la barra avanza col caricamento effettivo delle immagini ----------
const loadingPage = document.getElementById("loading-page");
const loadingBar = document.getElementById("loading-bar");
const loadingFill = document.getElementById("loading-bar-fill");
const content = document.getElementById("trophies-content");

const images = Array.from(document.images);
const total = images.length || 1;
let loaded = 0;
let finished = false;

startDots();
setProgress(0);

function setProgress(pct) {
    loadingFill.style.width = pct + "%";
    loadingBar.setAttribute("aria-valuenow", String(Math.round(pct)));
}

function markLoaded() {
    loaded = Math.min(total, loaded + 1);
    setProgress((loaded / total) * 100);
    if (loaded >= total) finish();
}

function finish() {
    if (finished) return;
    finished = true;
    setProgress(100);
    stopDots();
    content.classList.add("is-ready");
    loadingPage.style.opacity = "0";
    setTimeout(() => { loadingPage.style.display = "none"; }, 450);
}

images.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
        markLoaded();
    } else {
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markLoaded, { once: true });
    }
});
window.addEventListener("load", finish);

// ---------- Navigazione con loading di transito reale ----------
function navigateWithLoading(url) {
    setProgress(0);
    loadingPage.style.display = "flex";
    loadingPage.style.opacity = "1";
    startDots();
    setTimeout(() => { window.location.href = url; }, 60);
}

// Back + Logo → user_page
const backBtn = document.getElementById("trophies-back-btn");
if (backBtn) backBtn.addEventListener("click", () => navigateWithLoading("user_page.html"));

const logo = document.querySelector(".user-logo");
if (logo) {
    logo.classList.add("is-link");
    logo.addEventListener("click", () => navigateWithLoading("user_page.html"));
}

// ---------- Sblocco della 1ª card_trophies_user (Doll Charmz Pack) ----------
// Si sblocca quando TUTTI i trophies della tab "trophies" sono stati raggiunti
// del tutto = magazine pubblicato (implica 3 oggetti + 3 storie). Allora appare
// il codice "BRATZ2026" nell'input e il bottone copy diventa attivo; al click
// copia il codice negli appunti e passa allo stato tapped "copied".
(function unlockFirstReward() {
    const found = parseInt(localStorage.getItem("bratz_objects_found"), 10) || 0;
    let stories = 0;
    try { stories = (JSON.parse(localStorage.getItem("bratz_saved_stories") || "[]") || []).length; }
    catch (_) { stories = 0; }
    const printed = localStorage.getItem("bratz_magazine_printed") === "1";
    if (!(found >= 3 && stories >= 3 && printed)) return;   // trophies non ancora tutti completati

    const card = document.querySelector(".reward-card");   // la prima (Doll Charmz Pack)
    if (!card) return;
    card.classList.remove("reward-card--locked");

    // description_text: passa al testo "unlocked"
    const desc = card.querySelector(".reward-card__desc");
    if (desc) desc.textContent = "Click the button below to copy your code and use it at checkout on the Bratz store.";

    const CODE = "BRATZ2026";
    const input = card.querySelector(".reward-input");
    if (input) input.textContent = CODE;

    const copyBtn = card.querySelector(".reward-copy");
    if (!copyBtn) return;
    copyBtn.disabled = false;
    copyBtn.classList.add("active");

    copyBtn.addEventListener("click", async () => {
        if (copyBtn.classList.contains("is-copied")) return;   // già copiato
        let ok = false;
        try {
            await navigator.clipboard.writeText(CODE);
            ok = true;
        } catch (_) {
            // fallback per contesti senza Clipboard API
            try {
                const ta = document.createElement("textarea");
                ta.value = CODE;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                ok = document.execCommand("copy");
                document.body.removeChild(ta);
            } catch (_) { ok = false; }
        }
        if (ok) {
            copyBtn.textContent = "copied";
            copyBtn.classList.add("is-copied");
        }
    });
})();
