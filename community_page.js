// ===== COMMUNITY PAGE: nickname + loading + navigazione + bookmark =====

// Audio di apertura pagina (normalizzato): styling.
if (window.BratzAudio) window.BratzAudio.play("styling");

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

// Bookmark: salva/rimuovi il magazine dai preferiti (persistiti in localStorage,
// così compaiono nella pagina My faves). Lo stato "salvato" è ripristinato al load.
const FAVES_KEY = "bratz_saved_faves";
function getFaves() {
    try { return JSON.parse(localStorage.getItem(FAVES_KEY) || "[]") || []; }
    catch (_) { return []; }
}
function setFaves(a) { localStorage.setItem(FAVES_KEY, JSON.stringify(a)); }
function cardData(card) {
    const img = card.querySelector(".community-card__photo img");
    const src = (img && img.getAttribute("src")) || "";
    return {
        id: src.split("/").pop(),   // basename immagine = id stabile
        title: (card.querySelector(".community-card__title") || {}).textContent || "",
        author: (card.querySelector(".community-card__author") || {}).textContent || "",
        img: src,
    };
}

document.querySelectorAll(".community-card").forEach((card) => {
    const btn = card.querySelector(".community-card__save");
    if (!btn) return;
    const d = cardData(card);
    if (getFaves().some((f) => f.id === d.id)) btn.classList.add("is-saved");
    btn.addEventListener("click", () => {
        const saved = btn.classList.toggle("is-saved");
        let faves = getFaves();
        if (saved) { if (!faves.some((f) => f.id === d.id)) faves.push(d); }
        else { faves = faves.filter((f) => f.id !== d.id); }
        setFaves(faves);
    });
});

// Click sulla copertina di un magazine della community -> reading page CON
// third_input_field. Passo titolo/autore così la spine mostra il magazine giusto;
// la spine, nella reading page, riporterà qui.
document.querySelectorAll(".community-card").forEach((card) => {
    const photo = card.querySelector(".community-card__photo");
    if (!photo) return;
    photo.classList.add("is-link");
    photo.addEventListener("click", () => {
        const title = card.querySelector(".community-card__title");
        const author = card.querySelector(".community-card__author");
        const params = new URLSearchParams({ type: "community" });
        if (title) params.set("title", title.textContent.trim());
        if (author) params.set("author", author.textContent.trim());
        sessionStorage.setItem("bratz_mag_return", "community_page.html");
        navigateWithLoading("magazines_page.html?" + params.toString());
    });
});
