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

// ---------- "play game" → scena 3D ----------
// Ogni primary-button il cui testo è "play game" apre la scena 3D (scene.html),
// passando per la loading-page di transito. Selettore generico: vale per il play
// del popup, per la barra mobile e per eventuali futuri bottoni uguali.
// I button disabilitati/nascosti non emettono click, quindi non serve altra guardia.
document.querySelectorAll(".primary-button").forEach((btn) => {
    const label = btn.textContent.trim().replace(/\s+/g, " ").toLowerCase();
    if (label === "play game") {
        btn.addEventListener("click", () => {
            // Ricorda la pagina di provenienza: marpi.dollz nella scena tornerà qui.
            sessionStorage.setItem("bratz_return_page", location.pathname.split("/").pop() || "user_page.html");
            navigateWithLoading("scene.html");
        });
    }
});

// ---------- Tabs del container_side_30%: cambiano SOLO il container_side_70% ----------
const tabs = Array.from(document.querySelectorAll(".side-tab"));
const panels = Array.from(document.querySelectorAll(".tab-panel"));
const popup = document.getElementById("personality-popup");
const popupText = document.getElementById("personality-popup-text");
const popupPlay = document.getElementById("popup-play-btn");
const popupPrint = document.getElementById("popup-print-btn");
const popupClose = document.getElementById("personality-popup-close");
const mobilePlay = document.getElementById("mobile-play-btn");   // button_bar mobile

let selected = false;   // personalità scelta?
let activeTab = "identity";

function updatePopup() {
    if (popupPrint) popupPrint.hidden = true;   // il print compare solo nella select_page
    if (activeTab === "identity") {
        popup.classList.remove("is-hidden");
        popupText.textContent = selected
            ? "From now on, this will be the unique vibe inspiring all your upcoming stories."
            : "It's time to bring me to life. Choose the right personality now, babe.";
        popupPlay.hidden = !selected;   // visibile solo dopo aver scelto la personalità
    } else if (activeTab === "goalz") {
        popup.classList.remove("is-hidden");
        popupText.textContent = "Complete these challenges to level up your vibe and unlock the runway.";
        popupPlay.hidden = false;
    } else if (activeTab === "trophies") {
        popup.classList.remove("is-hidden");
        popupText.textContent = "Your fashion hall of fame. Flex all the exclusive badges you've earned.";
        popupPlay.hidden = false;
    } else if (activeTab === "stories") {
        popup.classList.remove("is-hidden");
        popupText.textContent = "Explore the scene to unlock new drama and write your stories.";
        popupPlay.hidden = false;
    } else if (activeTab === "magazines") {
        popup.classList.remove("is-hidden");
        if (getSavedStories().length < 3) {
            // sezione ancora bloccata (meno di 3 storie)
            popupText.textContent = "Stack up your stories to design and print ultimate magazines.";
            popupPlay.hidden = false;
        } else if (getMagState() === "select") {
            popupText.textContent = "Pick your 3 favorite stories and hit the button below. Choose wisely, babe, the runway doesn’t forgive boring choices.";
            popupPlay.hidden = true;
            // il bottone "print" vive nel pop_up: attivo solo con 3 storie scelte
            if (popupPrint) {
                popupPrint.hidden = false;
                const can = getMagSelected().length >= 3;
                popupPrint.disabled = !can;
                popupPrint.classList.toggle("active", can);
            }
        } else {
            popupText.textContent = "Pick your 3 favorite stories to compile the most iconic magazine ever. Serve the ultimate look and print it, babe.";
            popupPlay.hidden = true;
        }
    } else {
        popup.classList.add("is-hidden");
    }
    // button_bar mobile: sempre presente; attiva quando lo è il play del popup,
    // altrimenti disattiva (es. identity senza personalità scelta)
    if (mobilePlay) {
        const active = !popupPlay.hidden;
        mobilePlay.classList.toggle("active", active);
        mobilePlay.disabled = !active;
    }
}

// Chiusura del popup (title_text "Close")
if (popupClose) {
    popupClose.addEventListener("click", () => popup.classList.add("is-hidden"));
}

// Bottone "print" nel pop_up (select_page dei magazines)
if (popupPrint) {
    popupPrint.addEventListener("click", () => { if (!popupPrint.disabled) doPrintMagazine(); });
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
// La selezione è PERSISTENTE: una volta scelta, la pagina mostra sempre e solo
// la yasmin/personality/selected_page (anche dopo reload o rientro).
const SELECTED_KEY = "yasmin_selected_personality";
const selectButtons = Array.from(document.querySelectorAll(".card-select"));

function applySelection(btn, persist) {
    // il bottone scelto → tapped + "SELECTED"; gli altri tornano "SELECT"
    selectButtons.forEach((b) => {
        b.classList.remove("is-selected");
        b.textContent = "select";
    });
    btn.classList.add("is-selected");
    btn.textContent = "selected";

    // alla prima scelta le tab bloccate si attivano (e restano tali)
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
    if (persist) localStorage.setItem(SELECTED_KEY, String(selectButtons.indexOf(btn)));
    updatePopup();
}

selectButtons.forEach((btn) => {
    btn.addEventListener("click", () => applySelection(btn, true));
});

// Ripristina la selezione salvata all'ingresso -> mai più la personality_page
// "da scegliere", ma direttamente la selected_page.
const savedIdx = parseInt(localStorage.getItem(SELECTED_KEY), 10);
if (!Number.isNaN(savedIdx) && selectButtons[savedIdx]) {
    applySelection(selectButtons[savedIdx], false);
}

// ---------- Progressione condivisa col 3D (localStorage) ----------
function getSavedStories() {
    try { return JSON.parse(localStorage.getItem("bratz_saved_stories") || "[]") || []; }
    catch (_) { return []; }
}
function getObjectsFound() {
    const n = parseInt(localStorage.getItem("bratz_objects_found"), 10);
    return Number.isNaN(n) ? 0 : n;
}

// Sblocca una tab bloccata (usata quando la progressione rende la sezione visibile).
function unlockTab(name) {
    const tab = tabs.find((t) => t.dataset.tab === name);
    if (tab && tab.disabled) {
        tab.disabled = false;
        tab.classList.remove("side-locked");
        if (tab.dataset.tab !== activeTab) tab.classList.add("active");
    }
}

// ---------- yasmin/goalz_page: obiettivi ATTIVI in base alla progressione ----------
const GOALS = {
    G1: "Explore every corner of the immersive space to unlock the complete vibe of the environment",
    G2: "Use your sharp fashion eye to find the first hidden item in the scene",
    G3: "Write a unique fashion-forward story inspired by the secret object you just uncovered",
    G4: "Look closer at the details and track down the second hidden item waiting in the room",
    G5: "Let your creativity run wild and write a captivating story inspired by this new discovery",
    G6: "Scan the space to reveal the third secret object and add it to your collection",
    G7: "Craft the story for the final object to complete your vibe and finish the challenge.",
    G8: "Complete the layout and publish your magazine",
};

// Obiettivi visibili per lo stato (found = oggetti trovati, saved = storie scritte).
function activeGoals(found, saved) {
    if (found === saved) {
        if (saved === 0) return [GOALS.G1, GOALS.G2]; // cerca 1° oggetto
        if (saved === 1) return [GOALS.G4, GOALS.G5]; // cerca 2° oggetto + scrivi
        if (saved === 2) return [GOALS.G6, GOALS.G7]; // cerca 3° oggetto + scrivi
        return [GOALS.G8];                            // magazine
    }
    if (found === 1) return [GOALS.G3]; // scrivi storia 1
    if (found === 2) return [GOALS.G5]; // scrivi storia 2
    if (found === 3) return [GOALS.G7]; // scrivi storia 3
    return [];
}

const goalzList = document.getElementById("goalz-list");
function renderGoalz() {
    if (!goalzList) return;
    const goals = activeGoals(getObjectsFound(), getSavedStories().length);
    goalzList.innerHTML = "";
    goals.forEach((text) => {
        const box = document.createElement("div");
        box.className = "box-goalz";
        const p = document.createElement("p");
        p.className = "box-goalz__text";
        p.textContent = text;
        box.appendChild(p);
        goalzList.appendChild(box);
    });
}

// ---------- Storie salvate: yasmin/stories_page da vuota a piena ----------
// Un complete_card_button per storia salvata:
// titolo→title_text, nickname→subtitle_text, corpo→preview (max 6 righe).
const storiesEmpty = document.getElementById("stories-empty");
const storiesCards = document.getElementById("stories-cards");

function buildStoryCard(story, index) {
    const card = document.createElement("article");
    card.className = "persona-card story-card";

    const upper = document.createElement("div");
    upper.className = "persona-card__upper story-card__upper";
    const desc = document.createElement("p");
    desc.className = "persona-card__desc story-card__desc";
    // anteprima continua (i newline diventano spazi): il clamp mostra max 6 righe
    desc.textContent = (story.body || "").replace(/\s+/g, " ").trim();
    upper.appendChild(desc);

    const below = document.createElement("div");
    below.className = "persona-card__below";
    const row = document.createElement("div");
    row.className = "container-below-button";
    const textCard = document.createElement("div");
    textCard.className = "container-text-card";
    const title = document.createElement("p");
    title.className = "persona-card__title";
    title.textContent = story.title || "";             // titolo digitato
    const subtitle = document.createElement("p");
    subtitle.className = "persona-card__subtitle";
    subtitle.textContent = story.nickname || nickname; // nickname dell'onboarding
    textCard.append(title, subtitle);

    const modify = document.createElement("button");
    modify.type = "button";
    modify.className = "primary-button active story-modify";
    modify.textContent = "modify";
    modify.addEventListener("click", () => {
        // modifica QUESTA storia: carica la bozza e segna l'indice
        localStorage.setItem("bratz_story_edit_index", String(index));
        localStorage.setItem("bratz_story_title", story.title || "");
        localStorage.setItem("bratz_story_body", story.body || "");
        sessionStorage.setItem("bratz_stories_return", location.pathname.split("/").pop() || "user_page.html");
        navigateWithLoading("stories_page.html");
    });

    row.append(textCard, modify);
    below.appendChild(row);
    card.append(upper, below);
    return card;
}

function renderSavedStories() {
    if (!storiesCards || !storiesEmpty) return;
    const stories = getSavedStories();
    const hasStory = stories.some((s) => (s.title && s.title.trim()) || (s.body && s.body.trim()));

    if (hasStory) {
        storiesCards.innerHTML = "";
        stories.forEach((story, idx) => storiesCards.appendChild(buildStoryCard(story, idx)));
        storiesCards.hidden = false;
        storiesEmpty.hidden = true;
        unlockTab("stories");   // la sezione non è più vuota
    } else {
        storiesCards.hidden = true;
        storiesEmpty.hidden = false;
    }
}

// ---------- yasmin/magazines_page: add → select → printed ----------
// Con 3 storie salvate la sezione passa da empty a magazines_page. Il plus apre
// la select_page; selezionate le 3 storie, "print" stampa il magazine. Solo il
// container_side_70% e il testo del popup cambiano (stessa pagina).
const magEmpty = document.getElementById("mag-empty");
const magView = document.getElementById("mag-view");
const MAG_STATE_KEY = "bratz_magazine_state";     // "add" | "select" | "printed"
const MAG_SEL_KEY = "bratz_magazine_selected";    // indici selezionati
const MAG_PRINTED_KEY = "bratz_magazine_printed"; // "1" dopo la stampa

function getMagState() {
    if (localStorage.getItem(MAG_PRINTED_KEY) === "1") return "printed";
    return localStorage.getItem(MAG_STATE_KEY) || "add";
}
function getMagSelected() {
    try { return JSON.parse(localStorage.getItem(MAG_SEL_KEY) || "[]") || []; } catch (_) { return []; }
}

// Attiva il bottone "community" (dopo la stampa) e lo collega a community_page.
function activateCommunity() {
    const c = document.getElementById("user-community-btn");
    if (!c || c.dataset.communityReady) return;
    c.dataset.communityReady = "1";
    c.disabled = false;
    c.classList.add("active");
    c.addEventListener("click", () => navigateWithLoading("community_page.html"));
}

// --- render dei 3 stati ---
function renderMagAdd() {
    const wrap = document.createElement("div");
    wrap.className = "mag-cover-wrap";
    const cover = document.createElement("div");
    cover.className = "mag-cover";
    // stesso bottone del mydollz-plus-btn (icon-button con stati, SVG "+")
    const plus = document.createElement("button");
    plus.type = "button";
    plus.id = "mydollz-plus-btn";
    plus.className = "icon-button mag-plus";
    plus.setAttribute("aria-label", "Crea magazine");
    plus.innerHTML =
        '<span class="icon-button__inner">' +
        '<svg class="icon-button__plus" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M10 1V19M1 10H19" stroke="black" stroke-width="1.2" /></svg></span>';
    plus.addEventListener("click", () => {
        localStorage.setItem(MAG_STATE_KEY, "select");
        localStorage.setItem(MAG_SEL_KEY, "[]");
        renderMagazines();
        updatePopup();
    });
    wrap.append(cover, plus);
    magView.appendChild(wrap);
}

// Il bottone "print" vive nel pop_up del container_side_30% (vedi updatePopup):
// qui costruiamo solo le card con i bottoni select.
function renderMagSelect(stories) {
    const grid = document.createElement("div");
    grid.className = "cards-grid stories-cards";

    function isSel(idx) { return getMagSelected().indexOf(idx) >= 0; }

    stories.forEach((story, idx) => {
        const card = buildStoryCard(story, idx);
        const btn = card.querySelector(".story-modify");
        const sel = document.createElement("button");
        sel.type = "button";
        function paint() {
            sel.className = "primary-button mag-select " + (isSel(idx) ? "is-selected" : "active");
            sel.textContent = isSel(idx) ? "selected" : "select";
        }
        paint();
        // Aggiornamento IN PLACE + aggiorna lo stato del "print" nel pop_up.
        sel.addEventListener("click", () => {
            let s = getMagSelected();
            if (s.indexOf(idx) >= 0) s = s.filter((i) => i !== idx);
            else if (s.length < 3) s.push(idx);
            localStorage.setItem(MAG_SEL_KEY, JSON.stringify(s));
            paint();
            updatePopup();
        });
        if (btn) btn.replaceWith(sel);
        grid.appendChild(card);
    });

    magView.append(grid);
}

// Azione "print" (dal pop_up): stampa il magazine e attiva la community.
function doPrintMagazine() {
    if (getMagSelected().length < 3) return;
    localStorage.setItem(MAG_PRINTED_KEY, "1");
    localStorage.setItem(MAG_STATE_KEY, "printed");
    activateCommunity();
    renderMagazines();
    updatePopup();
}

function renderMagPrinted() {
    const wrap = document.createElement("div");
    wrap.className = "mag-cover-wrap";
    const card = document.createElement("article");
    card.className = "mag-magazine";
    const cover = document.createElement("div");
    cover.className = "mag-magazine__cover";
    const img = document.createElement("img");
    img.src = "assets/images/summerparty_magazine.jpg";
    img.alt = "";
    cover.appendChild(img);
    const below = document.createElement("div");
    below.className = "mag-magazine__below";
    const title = document.createElement("p");
    title.className = "mag-magazine__title";
    title.textContent = "Summer party";
    const author = document.createElement("p");
    author.className = "mag-magazine__author";
    author.textContent = nickname;
    below.append(title, author);
    card.append(cover, below);
    wrap.appendChild(card);
    magView.appendChild(wrap);
}

function renderMagazines() {
    if (!magView || !magEmpty) return;
    if (getSavedStories().length < 3) {   // ancora bloccata
        magView.hidden = true;
        magEmpty.hidden = false;
        return;
    }
    unlockTab("magazines");
    magEmpty.hidden = true;
    magView.hidden = false;
    magView.innerHTML = "";
    const state = getMagState();
    if (state === "printed") { activateCommunity(); renderMagPrinted(); }
    else if (state === "select") renderMagSelect(getSavedStories());
    else renderMagAdd();
}

// Se il gioco è iniziato, la sezione goalz è comunque consultabile.
if (getObjectsFound() > 0 || getSavedStories().length > 0) unlockTab("goalz");
renderGoalz();
renderSavedStories();
renderMagazines();

// Stato iniziale del popup (tab identity): impostato via JS ora che il bottone
// non ha più l'attributo HTML "hidden"
updatePopup();

// Arrivo dal 3D col bottone "print": apri direttamente la tab magazines.
if (new URLSearchParams(location.search).get("tab") === "magazines") {
    const magTab = tabs.find((t) => t.dataset.tab === "magazines");
    if (magTab && !magTab.disabled) setActiveTab("magazines");
}
