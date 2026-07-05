// ===== YASMIN / PERSONALITY PAGE: nickname + loading reale + interazioni =====

// ---------- Nickname nell'header ----------
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

// ---------- Loading REALE: barra legata al caricamento effettivo delle immagini ----------
const loadingPage = document.getElementById("loading-page");
const loadingBar = document.getElementById("loading-bar");
const loadingFill = document.getElementById("loading-bar-fill");
const content = document.getElementById("personality-content");

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

// Back → torna a mydollz_page
const backBtn = document.getElementById("personality-back-btn");
if (backBtn) backBtn.addEventListener("click", () => navigateWithLoading("mydollz_page.html"));

// Logo → user_page (in tutte le pagine successive a user_page)
const logo = document.querySelector(".user-logo");
if (logo) {
    logo.classList.add("is-link");
    logo.addEventListener("click", () => navigateWithLoading("user_page.html"));
}

// ---------- Tabs del container_side_30%: cambiano SOLO il container_side_70% ----------
const tabs = Array.from(document.querySelectorAll(".side-tab"));
const panels = Array.from(document.querySelectorAll(".tab-panel"));
const popup = document.getElementById("personality-popup");
const popupText = document.getElementById("personality-popup-text");
const popupPlay = document.getElementById("popup-play-btn");

let selected = false;   // personalità scelta?
let activeTab = "identity";

function updatePopup() {
    if (activeTab === "identity") {
        popup.classList.remove("is-hidden");
        popupText.textContent = selected
            ? "From now on, this will be the unique vibe inspiring all your upcoming stories."
            : "It's time to bring me to life. Choose the right personality now, babe.";
        popupPlay.hidden = true;
    } else if (activeTab === "goalz") {
        popup.classList.remove("is-hidden");
        popupText.textContent = "Complete these challenges to level up your vibe and unlock the runway.";
        popupPlay.hidden = false;
    } else if (activeTab === "trophies") {
        popup.classList.remove("is-hidden");
        popupText.textContent = "Your fashion hall of fame. Flex all the exclusive badges you've earned.";
        popupPlay.hidden = false;
    } else {
        // stories / magazines: contenuto non ancora disponibile
        popup.classList.add("is-hidden");
    }
}

function setActiveTab(name) {
    activeTab = name;
    tabs.forEach((t) => {
        const isActive = t.dataset.tab === name;
        t.classList.toggle("is-current", isActive);           // tab attivo → tapped
        t.classList.toggle("active", !isActive && !t.disabled); // altri sbloccati → attivi
    });
    panels.forEach((p) => { p.hidden = p.dataset.tab !== name; });
    updatePopup();
}

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        if (tab.disabled) return;   // le tab bloccate non rispondono
        setActiveTab(tab.dataset.tab);
    });
});

// ---------- Scelta della personalità (radio) + sblocco delle tab ----------
const selectButtons = Array.from(document.querySelectorAll(".card-select"));

selectButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        // il bottone cliccato → tapped + "SELECTED"; gli altri tornano "SELECT"
        selectButtons.forEach((b) => {
            b.classList.remove("is-selected");
            b.textContent = "select";
        });
        btn.classList.add("is-selected");
        btn.textContent = "selected";

        // alla prima scelta le tab bloccate si attivano
        if (!selected) {
            selected = true;
            tabs.forEach((t) => {
                if (t.classList.contains("side-locked")) {
                    t.disabled = false;
                    t.classList.remove("side-locked");
                    if (t.dataset.tab !== activeTab) t.classList.add("active");
                }
            });
        }
        updatePopup();
    });
});
