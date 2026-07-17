// ===== USER PAGE: iniezione nickname + loading legato al caricamento REALE =====

// ---------- Nickname scelto nell'onboarding (persistito in localStorage) ----------
const nickname = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();

const dollzBtn = document.getElementById("user-dollz-btn");
const welcome = document.getElementById("user-welcome");
if (dollzBtn) dollzBtn.textContent = nickname;
if (welcome) welcome.innerHTML = `Welcome ${nickname},<br>your stories are waiting for you.`;

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
const content = document.getElementById("user-content");

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
    if (loaded >= total) onImagesReady();
}

// Rivela la pagina (dissolvenza dell'overlay e comparsa fluida del contenuto).
function reveal() {
    if (finished) return;
    finished = true;
    setProgress(100);
    stopDots();
    content.classList.add("is-ready");
    loadingPage.style.opacity = "0";
    setTimeout(() => { loadingPage.style.display = "none"; }, 450);
}

// Immagini caricate = ULTIMA parte del caricamento: parte l'INTRO (con dissolvenza
// audio in ingresso e in uscita) e la user_page si rivela — con la sua dissolvenza —
// a 1'' dall'inizio dell'audio. L'audio si sente SOLO alla primissima apertura in
// assoluto (flag in localStorage): dalle volte successive la pagina si rivela subito,
// senza suono. Se l'autoplay è bloccato o l'audio non parte, si rivela subito.
const INTRO_FLAG = "bratz_intro_played";
const AUDIO_FADE_MS = 700;   // durata dissolvenza audio in/out
const REVEAL_DELAY_MS = 1000; // la pagina appare a 1'' dell'audio

let introStarted = false;
function onImagesReady() {
    if (introStarted) { return; }
    introStarted = true;
    setProgress(100);

    let done = false;
    const revealOnce = () => { if (!done) { done = true; reveal(); } };

    // Già sentito una volta: nessun audio, rivelo subito (con dissolvenza della pagina).
    if (localStorage.getItem(INTRO_FLAG)) { revealOnce(); return; }

    // INTRO normalizzato allo stesso volume delle altre tracce (BratzAudio), con
    // dissolvenza audio in ingresso/uscita. La pagina si rivela a 1'' dall'avvio;
    // se l'audio non parte (autoplay bloccato / errore) si rivela subito.
    if (!window.BratzAudio) { revealOnce(); return; }
    window.BratzAudio.playIntro("assets/audio/INTRO.m4a", {
        fadeInMs: AUDIO_FADE_MS,
        fadeOutMs: AUDIO_FADE_MS,
        onStarted: () => {
            localStorage.setItem(INTRO_FLAG, "1"); // sentito: non ripartirà più
            setTimeout(revealOnce, REVEAL_DELAY_MS); // pagina a 1'' dell'audio
        },
        onEnded: revealOnce,   // rivela alla fine (se non già rivelata)
        onFail: revealOnce,    // audio non disponibile/bloccato -> rivela subito
    });

    setTimeout(revealOnce, 8000); // rete di sicurezza assoluta
}

// Conta ogni immagine man mano che finisce di caricare (load o error)
images.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
        markLoaded();
    } else {
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markLoaded, { once: true });
    }
});

// Rete di sicurezza: quando l'intera pagina è caricata, avvia comunque la sequenza
window.addEventListener("load", onImagesReady);

// ---------- "See more" delle card → pagina dedicata con loading di transito reale ----------
function navigateWithLoading(url) {
    setProgress(0);
    loadingPage.style.display = "flex";
    loadingPage.style.opacity = "1";
    startDots();
    setTimeout(() => { window.location.href = url; }, 60);
}

const seeMore = {
    "see-more-mydollz": "mydollz_page.html",
    "see-more-mytrophies": "mytrophies_empty_page.html",
    "see-more-myfaves": "myfaves_empty_page.html",
};

Object.entries(seeMore).forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => navigateWithLoading(url));
});
