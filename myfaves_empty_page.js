// ===== MY FAVES / EMPTY PAGE: nickname + loading reale + navigazione =====

// ---------- Nickname (persistito nell'onboarding) nel bottone header ----------
const nickname = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();
const dollzBtn = document.getElementById("user-dollz-btn");
if (dollzBtn) dollzBtn.textContent = nickname;

// ---------- myfaves_page: i magazine salvati dalla community ----------
// I preferiti sono persistiti dalla community_page in localStorage. Se ce ne
// sono, la pagina passa da empty_page a myfaves_page (full). Il segnalibro di
// ogni card è nello stato "salvato"; cliccandolo si rimuove dai preferiti.
const FAVES_KEY = "bratz_saved_faves";
function getFaves() {
    try { return JSON.parse(localStorage.getItem(FAVES_KEY) || "[]") || []; }
    catch (_) { return []; }
}
const favesGrid = document.getElementById("faves-grid");
const favesEmpty = document.getElementById("faves-empty");

function buildFaveCard(f) {
    const card = document.createElement("article");
    card.className = "community-card";

    const photo = document.createElement("div");
    photo.className = "community-card__photo is-link";
    const img = document.createElement("img");
    img.src = f.img; img.alt = "";
    photo.appendChild(img);
    // Click sulla copertina -> apre il magazine in lettura (come dalla community).
    // La spine, nella reading page, riporterà a My faves.
    photo.addEventListener("click", () => {
        const params = new URLSearchParams({ type: "community", title: f.title, author: f.author });
        sessionStorage.setItem("bratz_mag_return", "myfaves_empty_page.html");
        navigateWithLoading("magazines_page.html?" + params.toString());
    });

    const below = document.createElement("div");
    below.className = "community-card__below";
    const text = document.createElement("div");
    text.className = "community-card__text";
    const title = document.createElement("p");
    title.className = "community-card__title";
    title.textContent = f.title;
    const author = document.createElement("p");
    author.className = "community-card__author";
    author.textContent = f.author;
    text.append(title, author);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "community-card__save is-saved";
    btn.setAttribute("aria-label", "Rimuovi dai preferiti");
    btn.innerHTML =
        '<svg class="community-card__save-icon" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M17.5 4.5V22.793L11 16.293L4.5 22.793V4.5H17.5Z" stroke="black" /></svg>';
    btn.addEventListener("click", () => {
        const faves = getFaves().filter((x) => x.id !== f.id);
        localStorage.setItem(FAVES_KEY, JSON.stringify(faves));
        renderFaves();
    });

    below.append(text, btn);
    card.append(photo, below);
    return card;
}

function renderFaves() {
    if (!favesGrid || !favesEmpty) return;
    const faves = getFaves();
    if (!faves.length) { favesGrid.hidden = true; favesEmpty.hidden = false; return; }
    favesEmpty.hidden = true;
    favesGrid.hidden = false;
    favesGrid.innerHTML = "";
    faves.forEach((f) => favesGrid.appendChild(buildFaveCard(f)));
}
renderFaves();

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
const content = document.getElementById("faves-content");

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
const backBtn = document.getElementById("faves-back-btn");
if (backBtn) backBtn.addEventListener("click", () => navigateWithLoading("user_page.html"));

const logo = document.querySelector(".user-logo");
if (logo) {
    logo.classList.add("is-link");
    logo.addEventListener("click", () => navigateWithLoading("user_page.html"));
}
