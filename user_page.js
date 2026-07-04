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
    if (loaded >= total) finish();
}

function finish() {
    if (finished) return;
    finished = true;
    setProgress(100);
    stopDots();
    // dissolvenza dell'overlay e comparsa fluida del contenuto
    content.classList.add("is-ready");
    loadingPage.style.opacity = "0";
    setTimeout(() => { loadingPage.style.display = "none"; }, 450);
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

// Rete di sicurezza: quando l'intera pagina è caricata, completa comunque
window.addEventListener("load", finish);
