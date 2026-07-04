// ===== YASMIN / PERSONALITY PAGE: nickname + loading reale + interazioni =====

// ---------- Nickname nell'header ----------
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

// ---------- Loading REALE: barra legata al caricamento effettivo delle immagini ----------
const loadingPage = document.getElementById("loading-page");
const loadingBar = document.getElementById("loading-bar");
const loadingFill = document.getElementById("loading-bar-fill");
const content = document.getElementById("personality-content");

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

// ---------- Back: torna a mydollz_page con loading di transito ----------
const backBtn = document.getElementById("personality-back-btn");
if (backBtn) {
    backBtn.addEventListener("click", () => {
        setProgress(0);
        loadingPage.style.display = "flex";
        loadingPage.style.opacity = "1";
        startDots();
        setTimeout(() => { window.location.href = "mydollz_page.html"; }, 60);
    });
}

// ---------- Interazioni personalità (task 3/4/5) ----------
const selectButtons = Array.from(document.querySelectorAll(".card-select"));
const lockedButtons = Array.from(document.querySelectorAll(".side-locked"));
const popupText = document.getElementById("personality-popup-text");

let unlocked = false;

selectButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        // Task 5: il bottone cliccato → tapped + "SELECTED"; gli altri tornano "SELECT"
        selectButtons.forEach((b) => {
            b.classList.remove("is-selected");
            b.textContent = "select";
        });
        btn.classList.add("is-selected");
        btn.textContent = "selected";

        // Task 4: alla prima scelta, i bottoni laterali disabilitati diventano attivi
        if (!unlocked) {
            unlocked = true;
            lockedButtons.forEach((b) => {
                b.disabled = false;
                b.classList.remove("side-locked");
                b.classList.add("active");
            });
            // il pop_up cambia testo, come nella selected_page di Figma
            if (popupText) {
                popupText.textContent =
                    "From now on, this will be the unique vibe inspiring all your upcoming stories.";
            }
        }
    });
});
