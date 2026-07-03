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

form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (startBtn.disabled) return;
    // START attivo: qui si aggancerà il passaggio alla pagina successiva.
});