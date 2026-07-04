// ===== MY DOLLZ PAGE: nickname + loading reale + navigazione =====

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
const content = document.getElementById("mydollz-content");

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

// ---------- Back: torna a user_page con loading di transito ----------
const backBtn = document.getElementById("mydollz-back-btn");
if (backBtn) {
    backBtn.addEventListener("click", () => {
        setProgress(0);
        loadingPage.style.display = "flex";
        loadingPage.style.opacity = "1";
        startDots();
        setTimeout(() => { window.location.href = "user_page.html"; }, 60);
    });
}

// ---------- Chiusura dei pop-up (fissi) ----------
document.querySelectorAll(".doll-popup__close").forEach((btn) => {
    btn.addEventListener("click", () => {
        const popup = btn.closest(".doll-popup");
        popup.style.transition = "opacity 0.3s ease";
        popup.style.opacity = "0";
        setTimeout(() => { popup.style.display = "none"; }, 300);
    });
});
