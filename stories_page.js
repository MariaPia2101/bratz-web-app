// ===== STORIES PAGE: loading reale + navigazione + scrittura =====

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
function stopDots() { clearInterval(dotsTimer); dotsTimer = null; }

// ---------- Loading REALE: barra legata al caricamento delle immagini ----------
const loadingPage = document.getElementById("loading-page");
const loadingBar = document.getElementById("loading-bar");
const loadingFill = document.getElementById("loading-bar-fill");

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
    loadingPage.style.opacity = "0";
    setTimeout(() => { loadingPage.style.display = "none"; }, 450);
}
images.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markLoaded, { once: true });
    }
});
window.addEventListener("load", finish);

// ---------- Navigazione con loading di transito ----------
function navigateWithLoading(url) {
    setProgress(0);
    loadingPage.style.display = "flex";
    loadingPage.style.opacity = "1";
    startDots();
    setTimeout(() => { window.location.href = url; }, 60);
}

// Back → torna alla scena 3D (da dove è partita la scrittura)
const backBtn = document.getElementById("stories-back-btn");
if (backBtn) backBtn.addEventListener("click", () => navigateWithLoading("scene.html"));

// Logo → user_page
const logo = document.querySelector(".stories-logo");
if (logo) logo.addEventListener("click", () => navigateWithLoading("user_page.html"));

// ---------- Scrittura: il container_lecture parte VUOTO ed è compilabile ----------
// (contenteditable). Salvo la bozza in locale così non si perde.
const lecture = document.getElementById("container-lecture");
const saveBtn = document.getElementById("stories-save-btn");
const DRAFT_KEY = "bratz_story_draft";

// Il bottone "save" è attivo (bianco) solo quando c'è del testo scritto,
// disabilitato (grigio) quando il container è vuoto — come da Figma.
function refreshSaveState() {
    const hasText = !!(lecture && lecture.textContent.trim().length);
    if (!saveBtn) return;
    if (hasText) {
        saveBtn.disabled = false;
        saveBtn.classList.add("active");
    } else {
        saveBtn.disabled = true;
        saveBtn.classList.remove("active");
    }
}

if (lecture) {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) lecture.textContent = draft;
    refreshSaveState();
    lecture.addEventListener("input", () => {
        localStorage.setItem(DRAFT_KEY, lecture.textContent);
        refreshSaveState();
    });
    lecture.focus();
}

if (saveBtn) {
    saveBtn.addEventListener("click", () => {
        if (saveBtn.disabled) return;
        localStorage.setItem(DRAFT_KEY, lecture ? lecture.textContent : "");
        const prev = saveBtn.textContent;
        saveBtn.textContent = "saved";
        setTimeout(() => { saveBtn.textContent = prev; }, 1200);
    });
}
