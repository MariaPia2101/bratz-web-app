// ===== Onboarding: logica di sblocco sequenziale =====

const PACK_CODE = "BRATZ-2026-01";

// Messaggi di validazione del Nickname (testi esatti da Figma)
const NICK_MSG = {
    error:   "Error, your nickname needs more fashion vibe",
    warning: "Careful babe, your vibe needs a quick fix",
    success: "Totally iconic, look served, internet broken",
};

const packInput = document.getElementById("pack-code");
const nickField = document.querySelector('[data-field="nickname"]');
const nickInput = document.getElementById("nickname");
const nickMsg   = document.getElementById("nickname-msg");
const passInput = document.getElementById("password");
const startBtn  = document.getElementById("start-btn");
const form      = document.getElementById("onboarding-form");

// Un carattere "speciale" = qualsiasi carattere non alfanumerico e non spazio (es. ".")
const hasSpecialChar = (value) => /[^\p{L}\p{N}\s]/u.test(value);

// ---------- Fase 1: Pack Code ----------
function checkPackCode() {
    const unlocked = packInput.value.trim() === PACK_CODE;
    nickInput.disabled = !unlocked;
    passInput.disabled = !unlocked;

    if (!unlocked) {
        setNickState(null);   // ripulisce l'eventuale stato di validazione
    }
    updateStartButton();
}

// ---------- Fase 2: validazione Nickname ----------
function setNickState(state) {
    nickField.classList.remove("is-error", "is-warning", "is-success");
    if (state) {
        nickField.classList.add("is-" + state);
        nickMsg.textContent = NICK_MSG[state];
    } else {
        nickMsg.textContent = "";
    }
}

// Durante la digitazione: vuoto → nessuno stato, speciale → success, altrimenti → warning
function validateNickTyping() {
    const value = nickInput.value;
    if (value.length === 0) return setNickState(null);
    setNickState(hasSpecialChar(value) ? "success" : "warning");
}

// All'uscita dal campo: se resta "plain" (senza speciale) → error
function validateNickBlur() {
    const value = nickInput.value;
    if (value.length === 0) return setNickState(null);
    setNickState(hasSpecialChar(value) ? "success" : "error");
}

// ---------- Fase 3: bottone START ----------
function updateStartButton() {
    const ready = !passInput.disabled && passInput.value.length > 0;
    startBtn.disabled = !ready;
    startBtn.classList.toggle("active", ready);
}

// ---------- Eventi ----------
packInput.addEventListener("input", checkPackCode);

nickInput.addEventListener("input", validateNickTyping);
nickInput.addEventListener("focus", validateNickTyping);
nickInput.addEventListener("blur", validateNickBlur);

passInput.addEventListener("input", updateStartButton);

// ===== Flusso SPA: onboarding → loading_page → enter_page =====

const onboarding   = document.querySelector(".onboarding");
const loadingPage  = document.getElementById("loading-page");
const loadingBar   = document.getElementById("loading-bar");
const loadingFill  = document.getElementById("loading-bar-fill");
const loadingText  = document.getElementById("loading-text");
const enterPage    = document.getElementById("enter-page");
const dollzBtn     = document.getElementById("enter-dollz-btn");
const popup        = document.getElementById("enter-popup");
const popupClose   = document.getElementById("enter-popup-close");

// ---------- Helper di transizione (fade fluido) ----------
const FADE_MS = 450;

function fadeOut(el, done) {
    el.style.opacity = "0";
    el.setAttribute("aria-hidden", "true");
    setTimeout(() => {
        el.style.display = "none";
        if (done) done();
    }, FADE_MS);
}

function fadeIn(el, display) {
    el.style.display = display;
    el.setAttribute("aria-hidden", "false");
    // forza il reflow prima di far partire la transizione di opacità
    void el.offsetWidth;
    el.style.opacity = "1";
}

// ---------- Il nickname digitato diventa il testo del primo bottone ----------
function syncDollzButton() {
    const nickname = nickInput.value.trim();
    if (nickname) dollzBtn.textContent = nickname;
}
nickInput.addEventListener("input", syncDollzButton);

// ---------- Avvio del transito al click su START ----------
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (startBtn.disabled) return;

    // Il testo digitato nel nickname è già il testo del primo bottone della enter_page
    syncDollzButton();

    // L'onboarding si nasconde e si apre la loading_page
    fadeOut(onboarding, () => {
        fadeIn(loadingPage, "flex");
        runLoading();
    });
});

// ---------- Animazione della scritta "Loading" (1 → 2 → 3 punti, in loop) ----------
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

// ---------- Fase di caricamento simulato (0% → 100%) ----------
function runLoading() {
    let progress = 0;
    loadingFill.style.width = "0%";
    loadingBar.setAttribute("aria-valuenow", "0");
    startDots();

    const timer = setInterval(() => {
        progress = Math.min(100, progress + (4 + Math.random() * 8));
        loadingFill.style.width = progress + "%";
        loadingBar.setAttribute("aria-valuenow", String(Math.round(progress)));

        if (progress >= 100) {
            clearInterval(timer);
            stopDots();
            // Raggiunto il 100%: transito verso la enter_page
            setTimeout(goToEnter, FADE_MS);
        }
    }, 120);
}

// ---------- Arrivo alla enter_page ----------
function goToEnter() {
    fadeOut(loadingPage, () => {
        fadeIn(enterPage, "block");
        initPopup();
    });
}

// ---------- Pop-up fisso (nessuna animazione): solo chiusura ----------
function initPopup() {
    popupClose.addEventListener("click", () => {
        popup.style.transition = "opacity 0.3s ease";
        popup.style.opacity = "0";
        setTimeout(() => { popup.style.display = "none"; }, 300);
    });
}