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

// Back → torna alla scena 3D. Se siamo dentro l'overlay (iframe della scena),
// chiediamo alla scena di chiudere l'overlay: così il 3D RIPRENDE dal punto in cui
// si era fermato, senza reload/caricamento iniziale. Fuori dall'iframe: fallback.
const inSceneOverlay = window.parent && window.parent !== window;
function goBack() {
    if (inSceneOverlay) {
        window.parent.postMessage({ type: "bratz:stories-close" }, "*");
    } else {
        // Aperta direttamente (es. "modify" dalla stories_page della doll):
        // torna alla pagina di provenienza, altrimenti alla scena 3D.
        navigateWithLoading(sessionStorage.getItem("bratz_stories_return") || "scene.html");
    }
}
const backBtn = document.getElementById("stories-back-btn");
if (backBtn) backBtn.addEventListener("click", goBack);

// (Il logo NON è cliccabile — nessun handler.)

// ---------- Scrittura: title_text → trattino → description_text ----------
// Il container_lecture parte VUOTO. Il 1° rigo è il TITOLO (title_text). Premendo
// INVIO compare automaticamente il trattino "-" (secondo title_text) e il cursore
// si sposta nell'area della storia (description_text), pronta alla scrittura.
const titleEl = document.getElementById("story-title");
const dashEl = document.getElementById("story-dash");
const bodyEl = document.getElementById("story-body");
const saveBtn = document.getElementById("stories-save-btn");
const TITLE_KEY = "bratz_story_title";
const BODY_KEY = "bratz_story_body";

function focusEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

// Rivela il trattino + l'area storia (una volta scritto il titolo).
function revealStory(focus) {
    if (dashEl) dashEl.hidden = false;
    if (bodyEl) {
        bodyEl.hidden = false;
        if (focus) focusEnd(bodyEl);
    }
}

// "save" attivo (bianco) solo quando c'è del testo, disabilitato (grigio) se vuoto.
function refreshSaveState() {
    if (!saveBtn) return;
    const hasText = !!(
        (titleEl && titleEl.textContent.trim().length) ||
        (bodyEl && bodyEl.textContent.trim().length)
    );
    saveBtn.disabled = !hasText;
    saveBtn.classList.toggle("active", hasText);
}

// Dopo il salvataggio il bottone resta "saved" (stato tapped) finché non si
// apporta una nuova modifica al testo: allora torna "save".
let isSaved = false;
function clearSaved() {
    if (!isSaved) return;
    isSaved = false;
    if (saveBtn) {
        saveBtn.classList.remove("is-saved");
        saveBtn.textContent = "save";
    }
}

if (titleEl) {
    // Ripristino bozza (se presente).
    const draftTitle = localStorage.getItem(TITLE_KEY) || "";
    const draftBody = localStorage.getItem(BODY_KEY) || "";
    if (draftTitle) titleEl.textContent = draftTitle;
    if (draftBody) { if (bodyEl) bodyEl.textContent = draftBody; }
    if (draftTitle && (draftBody || draftTitle)) revealStory(false);
    refreshSaveState();

    // Il titolo è una sola riga: INVIO conferma → compare "-" e si passa alla storia.
    titleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (titleEl.textContent.trim().length === 0) return; // serve prima un titolo
            revealStory(true);
        }
    });
    titleEl.addEventListener("input", () => {
        localStorage.setItem(TITLE_KEY, titleEl.textContent);
        clearSaved();       // nuova modifica → il bottone torna "save"
        refreshSaveState();
    });

    if (bodyEl) {
        bodyEl.addEventListener("input", () => {
            localStorage.setItem(BODY_KEY, bodyEl.textContent);
            clearSaved();   // nuova modifica → il bottone torna "save"
            refreshSaveState();
        });
    }

    titleEl.focus();
}

if (saveBtn) {
    saveBtn.addEventListener("click", () => {
        if (saveBtn.disabled) return;
        const title = titleEl ? titleEl.textContent.trim() : "";
        const body = bodyEl ? bodyEl.textContent.trim() : "";
        localStorage.setItem(TITLE_KEY, title);
        localStorage.setItem(BODY_KEY, body);
        // Storia SALVATA (solo al click su save): comparirà come card nella
        // yasmin/stories_page. title→title_text, nickname→subtitle_text, corpo→preview.
        localStorage.setItem("bratz_saved_story", JSON.stringify({
            title,
            body,
            nickname: (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim(),
            ts: Date.now(),
        }));
        // Stato tapped persistente: "saved" finché non si scrive di nuovo.
        isSaved = true;
        saveBtn.classList.add("is-saved");
        saveBtn.textContent = "saved";
    });
}
