// ===== MAGAZINE READING PAGE =====
// Reading del magazine (proprio o della community).
//  - type=own        -> magazine stampato dall'utente: NIENTE third_input_field.
//  - type=community  -> magazine della community: third_input_field VISIBILE.
// La spine (container_spine) è fissa e cliccabile: riporta alla pagina di
// provenienza (memorizzata in sessionStorage prima della navigazione).

const nickname = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();
const params = new URLSearchParams(location.search);
const type = params.get("type") || "own";

// ---------- Spine: titolo + autore in base al magazine aperto ----------
const spineTitle = document.getElementById("mag-spine-title");
const spineAuthor = document.getElementById("mag-spine-author");
const lectureTitle = document.getElementById("mag-lecture-title"); // heading mobile
let magTitle;
if (type === "community") {
    magTitle = params.get("title") || "The slumber party";
    if (spineAuthor && params.get("author")) spineAuthor.textContent = params.get("author");
} else {
    // magazine proprio: titolo = titolo della PRIMA storia selezionata, firmato col nickname
    magTitle = ownMagazineTitle();
    if (spineAuthor) spineAuthor.textContent = nickname;
}
if (spineTitle) spineTitle.textContent = magTitle;
if (lectureTitle) lectureTitle.textContent = magTitle;   // heading mobile = stesso titolo

// Titolo del magazine dell'utente = titolo della prima storia selezionata.
function ownMagazineTitle() {
    try {
        const sel = JSON.parse(localStorage.getItem("bratz_magazine_selected") || "[]") || [];
        const stories = JSON.parse(localStorage.getItem("bratz_saved_stories") || "[]") || [];
        const first = sel.length ? stories[sel[0]] : null;
        const t = first && (first.title || "").trim();
        return t || "Summer party";
    } catch (_) { return "Summer party"; }
}

// ---------- third_input_field: solo per la community ----------
const thirdInput = document.getElementById("mag-third-input");
if (thirdInput) thirdInput.hidden = (type !== "community");

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
const content = document.getElementById("mag-content");

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

// ---------- Spine: click -> pagina precedentemente visitata ----------
const spine = document.getElementById("mag-spine");
if (spine) {
    spine.addEventListener("click", () => {
        const back = sessionStorage.getItem("bratz_mag_return")
            || (type === "community" ? "community_page.html" : "yasmin_personality_page.html?tab=magazines");
        navigateWithLoading(back);
    });
}

// ---------- third_input_field: dopo aver scritto e cliccato SEND, il bottone
// passa allo stato tapped con testo "sent" (feedback di invio). ----------
const sendBtn = document.querySelector(".mag-third-input__send");
const sendInput = document.querySelector(".mag-third-input__field");
if (sendBtn && sendInput) {
    sendBtn.addEventListener("click", () => {
        if (sendBtn.classList.contains("is-sent")) return;   // già inviato
        if (!sendInput.value.trim()) return;                 // niente da inviare
        sendBtn.textContent = "sent";
        sendBtn.classList.add("is-sent");
    });
}
