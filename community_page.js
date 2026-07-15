// ===== COMMUNITY PAGE: nickname + loading + navigazione + bookmark =====

// Nickname nell'header
const nickname = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();
const dollzBtn = document.getElementById("user-dollz-btn");
if (dollzBtn) dollzBtn.textContent = nickname;

// ---------- Loading reale legato alle immagini ----------
const loadingText = document.getElementById("loading-text");
let dotsTimer = null;
function startDots() {
    let d = 1;
    loadingText.textContent = "Loading" + ".".repeat(d);
    dotsTimer = setInterval(() => { d = d >= 3 ? 1 : d + 1; loadingText.textContent = "Loading" + ".".repeat(d); }, 400);
}
function stopDots() { clearInterval(dotsTimer); dotsTimer = null; }

const loadingPage = document.getElementById("loading-page");
const loadingBar = document.getElementById("loading-bar");
const loadingFill = document.getElementById("loading-bar-fill");
const content = document.getElementById("community-content");

const images = Array.from(document.images);
const total = images.length || 1;
let loaded = 0, finished = false;
startDots(); setProgress(0);

function setProgress(p) { loadingFill.style.width = p + "%"; loadingBar.setAttribute("aria-valuenow", String(Math.round(p))); }
function markLoaded() { loaded = Math.min(total, loaded + 1); setProgress((loaded / total) * 100); if (loaded >= total) finish(); }
function finish() {
    if (finished) return;
    finished = true;
    setProgress(100); stopDots();
    if (content) content.classList.add("is-ready");
    loadingPage.style.opacity = "0";
    setTimeout(() => { loadingPage.style.display = "none"; }, 450);
}
images.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) markLoaded();
    else { img.addEventListener("load", markLoaded, { once: true }); img.addEventListener("error", markLoaded, { once: true }); }
});
window.addEventListener("load", finish);

function navigateWithLoading(url) {
    setProgress(0); loadingPage.style.display = "flex"; loadingPage.style.opacity = "1"; startDots();
    setTimeout(() => { window.location.href = url; }, 60);
}

// marpi.dollz / logo → user_page
if (dollzBtn) dollzBtn.addEventListener("click", () => navigateWithLoading("user_page.html"));
const logo = document.querySelector(".user-logo");
if (logo) { logo.classList.add("is-link"); logo.addEventListener("click", () => navigateWithLoading("user_page.html")); }

// Bookmark: toggle salvato (feedback visivo)
document.querySelectorAll(".community-card__save").forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("is-saved"));
});
