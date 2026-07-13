// ===== BRATZ — Scena 3D =====
// Stanza (environment.glb) + doll (character.glb) con three.js.
// Camera in TERZA PERSONA rigidamente alle spalle del personaggio.
// Il personaggio cammina sul terreno "Foundament_Home_" (raycast verso il basso,
// quindi segue salite e discese) e NON attraversa nessuna mesh: ogni oggetto della
// stanza ha una bounding box che lo blocca. I modelli usano Draco + WebP.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ---------- Configurazione ----------
const MODELS = {
    environment: "assets/3d/models/environment2.glb",
    character:   "assets/3d/models/character.glb",
};

const DRACO_DECODER_PATH = "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/";

// Nome della mesh che fa da PAVIMENTO calpestabile (con dislivelli).
const FLOOR_MESH_NAME = "foundament";

// Specchio: Reflector sulla FORMA REALE del materiale "Mirror" di Mirror_Mesh_.
const MIRROR = {
    matName: "mirror",
    res: 512,        // risoluzione della texture di riflessione (più bassa = più leggera)
    offset: 0.012,   // micro-spostamento verso la stanza (anti z-fighting)
    color: 0xc2c9cd, // leggera tinta dei riflessi
};

// Mesh CALPESTABILI (non ostacoli): ci si cammina sopra senza fermarsi.
// Es. decori piatti del pavimento e il tappeto "Rug_Mesh_".
const WALKABLE_NAMES = ["floor", "rug"];

// Oggetto "camera.glb": la sua posizione è già baked nel modello (~-3.90, 0.76, 1.48).
// Appare dopo un ritardo e ha un alone bianco pulsante.
const CAMERA_PROP = {
    url: "assets/3d/models/camera.glb",
    delayMs: 20000,                  // compare 20'' dopo l'ingresso
    center: [-3.90, 0.76, 1.48],     // centro oggetto (per l'alone)
    glowSize: 0.32,                  // dimensione dell'alone
    pulseSpeed: 2.2,                 // velocità della pulsazione
};

// Movimento
const MOVE_SPEED   = 2.2;
const RUN_MULT     = 1.8;
const TURN_SPEED   = 2.4;
const CHARACTER_RADIUS = 0.16; // cuscinetto orizzontale per le collisioni (più piccolo = si avvicina di più)
const STAIRS_PAD       = 0.0;  // padding ridotto per le scale (0 = ci si può avvicinare fino al bordo)
const SOFA_PAD         = -0.08; // padding ridotto per i divani (negativo = ci si avvicina di più)
const GROUND_LERP  = 12;       // morbidezza dei dislivelli (più alto = più reattivo, più basso = più morbido)

// Il fronte del modello guarda verso +Z: ruotato di 180° -> spalle alla camera.
const MODEL_FACING_YAW_OFFSET = Math.PI;
const INITIAL_YAW = 0;

// Camera in terza persona: offset dietro le spalle. La camera si AVVICINA se
// c'è un muro/vetro tra lei e il personaggio (niente "vedo attraverso").
const CAM = { back: 3.2, height: 1.9, look: 1.2, min: 0.5, pad: 0.18 };

// Riposizionamento della mesh decorativa "Lines_Floor_Mesh_".
// I valori arrivano da Blender (Z-up): convertiti in three (Y-up) -> (X, Zb, -Yb).
const LINES_FLOOR_NAME = "Lines_Floor_Mesh_";
const LINES_FLOOR_POS  = { x: 1.90923, y: 0.367931, z: -1.18059 };

// Confini: margine dal bordo del terreno.
const ROOM_MARGIN = 0.30;

// Filtro per decidere cosa è un OSTACOLO (rispetto al livello del pavimento):
// deve sporgere almeno OBSTACLE_MIN_RISE dal suolo (esclude tappeti/decori piatti)
// e partire sotto la testa (esclude oggetti appesi/soffitti sopra di lei).
const OBSTACLE_MIN_RISE = 0.20;
const OBSTACLE_MAX_BASE = 2.20;

// ---------- Riferimenti DOM ----------
const canvas      = document.getElementById("scene-canvas");
const loadingEl   = document.getElementById("scene-loading");
const loadingBar  = document.getElementById("scene-loading-bar");
const loadingFill = document.getElementById("scene-loading-fill");
const loadingText = document.getElementById("scene-loading-text");

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // più basso = alte luci meno bruciate (look più soffuso)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scena e camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 1000);
camera.position.set(0, CAM.height, CAM.back);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Sfondo: paesaggio urbano (foto fornita) ----------
// Fuori dal modello, al posto del nero, la foto "Foto_Background_3D_.jpeg"
// come panorama a 360° (caricata in init -> loadCityBackground).
const CITY_BG_URL = "assets/3d/textures/Foto_Background_3D_.jpeg";

// ---------- Post-processing: bloom per il "soft glow" morbido ----------
// Solo le zone luminose (LED, neon, lampade) fioriscono -> alone soffuso.
const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.16,  // strength (glow soft, non lattiginoso)
    0.85,  // radius (quanto si allarga)
    0.0    // threshold 0 = TUTTA la scena fiorisce -> glow morbido e uniforme
);
// Tinta ROSA del glow (solo il bloom, non l'immagine intera): riduce verde/blu.
const _bloomTint = new THREE.Vector3(1.0, 0.78, 0.9);
bloomPass.bloomTintColors = bloomPass.bloomTintColors.map(() => _bloomTint.clone());
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------- Illuminazione (simula il light bake di Blender) ----------
// LIGHT_TUNE alza/abbassa TUTTA l'intensità in un colpo solo.
const LIGHT_TUNE = 1.0;
RectAreaLightUniformsLib.init(); // necessario per le RectAreaLight (strisce LED)

// Colori dei LED: ROSA PASTELLO (non fucsia). Più chiari/desaturati -> atmosfera
// morbida; il glow soffuso lo aggiunge il bloom in post-processing.
const LED_PINK    = 0xff9ed6; // rosa pastello
const LED_MAGENTA = 0xff77c4; // insegna: rosa acceso ma non fucsia

// Ambiente + emisferica: fill rosa pastello chiarissimo (niente fucsia).
scene.add(new THREE.AmbientLight(0xfdeaf4, 0.55 * LIGHT_TUNE));
scene.add(new THREE.HemisphereLight(0xfff2fa, 0xffe2f2, 0.35 * LIGHT_TUNE));

// Key light direzionale: definizione + ombra morbida, praticamente bianca.
const keyLight = new THREE.DirectionalLight(0xfff4f8, 0.85 * LIGHT_TUNE);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

// --- Le 9 lampade a sospensione: la luce esce dal "Bulb_" DENTRO la lampada ---
// (le posizioni sono ricavate a runtime dalle mesh "Bulb_" -> addBulbLights)
const BULB = { color: 0xffd6ea, intensity: 3, distance: 4.5 };

// --- I LED = RectAreaLight (strisce luminose), rosa PASTELLO ---
// { colore, intensità, larghezza, altezza, posizione, punto verso cui illumina }
// NB: le RectAreaLight sono costose -> ne teniamo poche (perimetro soffitto +
// insegna). Gli altri LED restano visibili grazie al loro glow emissivo rosa.
const AREA_LIGHTS = [
    // LED perimetrali del soffitto: illuminano verso il basso
    { c: LED_PINK, i: 4, w: 5, h: 0.6, p: [-0.46, 4.25, -4.3], look: [-0.46, 0, -4.3] },
    { c: LED_PINK, i: 4, w: 5, h: 0.6, p: [-4.05, 4.25, -1.2], look: [-4.05, 0, -1.2] },
    { c: LED_PINK, i: 4, w: 5, h: 0.6, p: [0.60,  4.25,  3.5], look: [0.60, 0,  3.5] },
    { c: LED_PINK, i: 4, w: 5, h: 0.6, p: [3.05,  4.25, -0.35], look: [3.05, 0, -0.35] },
    // Insegna neon "BRATZ": illumina verso l'interno stanza
    { c: LED_MAGENTA, i: 4.5, w: 1.4, h: 2.0, p: [0.10, 1.40, 3.55], look: [0.10, 1.40, 0] },
];
for (const a of AREA_LIGHTS) {
    const l = new THREE.RectAreaLight(a.c, a.i * LIGHT_TUNE, a.w, a.h);
    l.position.set(a.p[0], a.p[1], a.p[2]);
    l.lookAt(a.look[0], a.look[1], a.look[2]);
    scene.add(l);
}

// ---------- Loading manager ----------
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => setProgress(total ? Math.round((loaded / total) * 100) : 0);
manager.onLoad = () => { setProgress(100); }; // il loading si chiude dopo il PRIMO render (init)
manager.onError = (url) => { console.error("[scene] Errore caricamento:", url); loadingText.textContent = "Load error"; };

function setProgress(pct) {
    loadingFill.style.width = pct + "%";
    loadingBar.setAttribute("aria-valuenow", String(pct));
    loadingText.textContent = pct < 100 ? `Loading ${pct}%` : "Ready";
}
let loadingHidden = false;
function hideLoading() {
    if (loadingHidden) return;
    loadingHidden = true;
    loadingEl.classList.add("is-hidden");
    loadingEl.setAttribute("aria-hidden", "true");
    setTimeout(() => { loadingEl.style.display = "none"; }, 700);
}

// ---------- Loaders ----------
const dracoLoader = new DRACOLoader(manager);
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setDRACOLoader(dracoLoader);

function loadModel(url) {
    return new Promise((resolve, reject) => gltfLoader.load(url, (g) => resolve(g.scene), undefined, reject));
}
function enableShadows(root) {
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// Tetto d'intensità per i materiali emissivi (evita blob bianchi slavati,
// mantiene il colore saturo del LED/neon). Alza per glow più forte.
const EMISSIVE_MAX = 3.0;
// Influenza dell'environment map neutro (RoomEnvironment): più bassa = meno
// "bianco piatto" che slava la stanza. Alza per riflessi/ambient più forti.
const ENV_INTENSITY = 0.35;

// Passata sui materiali: (1) riduce il wash bianco dell'IBL, (2) tiene vividi
// gli emissivi (LED/neon/lampade) indipendenti dal tone mapping e con un tetto.
function tuneMaterials(root) {
    let emissiveCount = 0;
    root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
            if (!m) continue;
            if ("envMapIntensity" in m) m.envMapIntensity = ENV_INTENSITY;
            if (m.emissive) {
                const glows = (m.emissiveIntensity > 0) &&
                    (m.emissive.r + m.emissive.g + m.emissive.b > 0.001);
                if (glows) {
                    m.emissiveIntensity = Math.min(m.emissiveIntensity, EMISSIVE_MAX);
                    m.toneMapped = false; // il glow resta vivido a prescindere dall'esposizione
                    // Se il LED è biancastro/poco saturo -> tingilo di rosa (i LED devono essere rosa).
                    const c = m.emissive, mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
                    const sat = mx > 0 ? (mx - mn) / mx : 0;
                    if (sat < 0.35) m.emissive.set(LED_PINK);
                    emissiveCount++;
                }
            }
            m.needsUpdate = true;
        }
    });
    console.info(`[scene] Materiali: emissivi sistemati ${emissiveCount}, envMapIntensity=${ENV_INTENSITY}`);
}

// ---------- Stato ----------
const character = { obj: null, yaw: INITIAL_YAW, x: 0, z: 0, y: 0, footOffset: 0 };

// Oggetto camera + alone (popolato in init, rivelato dopo il ritardo)
let cameraProp = null; // { model, glow }

// Gestione ingresso: la loading page si chiude solo dopo alcuni frame realmente
// renderizzati (mai schermo nero tra "modelli caricati" e "primo render").
let sceneReady = false;
let warmFrames = 0;

const room = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
let groundRayStartY = 8;   // da quanto in alto sparo il raggio verso il basso
let floorRefY = 0;         // livello nominale del pavimento (per il filtro ostacoli)

const floorMeshes = [];    // mesh su cui appoggiare i piedi (Foundament_Home_)
const colliders = [];      // ostacoli movimento: { minX, maxX, minZ, maxZ }
const occluders = [];      // TUTTE le mesh: la camera non ci passa attraverso

// Input tastiera
const keys = new Set();
const isDown = (...c) => c.some((k) => keys.has(k));
window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    fadeHint();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

const hintEl = document.getElementById("scene-hint");
let hintFaded = false;
function fadeHint() {
    if (hintFaded || !hintEl) return;
    hintFaded = true;
    hintEl.classList.add("is-faded");
    setTimeout(() => { hintEl.style.display = "none"; }, 900);
}
setTimeout(fadeHint, 6000);

// ---------- Overlay "3dgame/enter_page": pop-up dopo 5'' ----------
const GAME_POPUP_DELAY_MS = 5000;
const gamePopup = document.getElementById("go-popup");
const gamePopupClose = document.getElementById("go-popup-close");
if (gamePopupClose) gamePopupClose.addEventListener("click", hideGamePopup);

function showGamePopup() {
    if (!gamePopup) return;
    gamePopup.hidden = false;
    gamePopup.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => gamePopup.classList.add("is-visible"));
}
function hideGamePopup() {
    if (!gamePopup) return;
    gamePopup.classList.remove("is-visible");
    gamePopup.setAttribute("aria-hidden", "true");
    setTimeout(() => { gamePopup.hidden = true; }, 400);
}

// Bottone marpi.dollz: mostra il nickname scelto nell'onboarding e, se cliccato,
// riporta alla pagina da cui si è entrati nella scena (fallback user_page).
const goDollzBtn = document.getElementById("go-dollz-btn");
if (goDollzBtn) {
    goDollzBtn.textContent = (localStorage.getItem("bratz_nickname") || "marpi.dollz").trim();
    goDollzBtn.addEventListener("click", () => {
        window.location.href = sessionStorage.getItem("bratz_return_page") || "user_page.html";
    });
}

// ---------- Click sull'oggetto camera -> pop-up "story" con bottone "write" ----------
// Contenuto fedele al Figma "3dgame/story_page" (pop_up 239x170).
const _clickRay = new THREE.Raycaster();
const _clickNdc = new THREE.Vector2();
let cameraClicked = false;

function setStoryPopup() {
    if (!gamePopup) return;
    gamePopup.innerHTML = "";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "enter-popup-close";
    close.textContent = "Close";
    close.addEventListener("click", hideGamePopup);
    const text = document.createElement("p");
    text.className = "enter-popup-text";
    text.textContent = "Yay, you found it, babe. Object unlocked. Your next goal is to start writing its story right now.";
    const write = document.createElement("button");
    write.type = "button";
    write.className = "primary-button active go-write-btn";
    write.textContent = "write";
    write.addEventListener("click", () => { window.location.href = "stories_page.html"; });
    gamePopup.append(close, text, write);
}

renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!cameraProp || !cameraProp.model.visible || cameraClicked) return;
    _clickNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
    _clickNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _clickRay.setFromCamera(_clickNdc, camera);
    if (_clickRay.intersectObject(cameraProp.model, true).length) {
        cameraClicked = true;
        if (cameraProp.glow) cameraProp.glow.visible = false; // oggetto "raccolto"
        setStoryPopup();
        showGamePopup();
    }
});

// ---------- Classificazione geometria ----------
// Foundament_Home_ -> pavimento (grounding + confini). Tutte le altre mesh solide
// che sporgono dal suolo -> ostacoli (bounding box). Soffitti/decori piatti esclusi.
function classifyEnvironment(environment) {
    environment.updateMatrixWorld(true);

    const candidates = []; // { box } di possibili ostacoli, filtrati dopo
    let floorBox = null;
    const b = new THREE.Box3();

    // Il nome utile può stare sulla mesh O su un suo antenato: GLTFLoader avvolge
    // le mesh multi-materiale in un Group che porta il nome (es. "Foundament_Home_").
    // Quindi cerchiamo la parola chiave lungo tutta la catena mesh -> ... -> root.
    const hasName = (o, kw) => {
        let p = o;
        while (p && p !== environment.parent) {
            if (p.name && p.name.toLowerCase().includes(kw)) return true;
            p = p.parent;
        }
        return false;
    };

    environment.traverse((o) => {
        if (!o.isMesh) return;
        b.setFromObject(o);
        if (!isFinite(b.min.x)) return;

        occluders.push(o); // ogni mesh può occludere la camera

        if (hasName(o, FLOOR_MESH_NAME)) {
            floorMeshes.push(o);
            floorBox = floorBox ? floorBox.union(b) : b.clone(); // unione di tutte le parti
            return; // il pavimento non è un ostacolo
        }
        if (hasName(o, "ceiling") || hasName(o, "soffitt")) return;
        if (WALKABLE_NAMES.some((kw) => hasName(o, kw))) return; // calpestabile (pavimento, tappeto)

        // Le scale hanno un padding ridotto: il character può avvicinarsi molto
        // (ma resta comunque bloccato, non ci sale). I divani hanno padding ancora
        // più ridotto, così ci si può avvicinare/appoggiare.
        let pad = CHARACTER_RADIUS;
        if (hasName(o, "stair")) pad = STAIRS_PAD;
        else if (hasName(o, "sofa")) pad = SOFA_PAD;
        candidates.push({ box: b.clone(), pad });
    });

    // Confini della stanza = footprint del pavimento, ristretto dal margine.
    if (floorBox) {
        room.minX = floorBox.min.x + ROOM_MARGIN;
        room.maxX = floorBox.max.x - ROOM_MARGIN;
        room.minZ = floorBox.min.z + ROOM_MARGIN;
        room.maxZ = floorBox.max.z - ROOM_MARGIN;
        floorRefY = floorBox.min.y;
        groundRayStartY = floorBox.max.y + 2;
    } else {
        const g = new THREE.Box3().setFromObject(environment);
        room.minX = g.min.x + ROOM_MARGIN; room.maxX = g.max.x - ROOM_MARGIN;
        room.minZ = g.min.z + ROOM_MARGIN; room.maxZ = g.max.z - ROOM_MARGIN;
        floorRefY = g.min.y; groundRayStartY = g.max.y + 2;
        console.warn(`[scene] Mesh pavimento "${FLOOR_MESH_NAME}" NON trovata: uso la bbox globale (fallback).`);
    }

    // Filtra i candidati: tieni solo ciò che è davvero un ostacolo dentro la stanza.
    for (const { box, pad } of candidates) {
        // Deve intersecare l'area della stanza (scarta mesh esterne/lontane).
        if (box.max.x < room.minX || box.min.x > room.maxX ||
            box.max.z < room.minZ || box.min.z > room.maxZ) continue;
        // Deve sporgere dal suolo ma non essere solo roba appesa in alto.
        if (box.max.y < floorRefY + OBSTACLE_MIN_RISE) continue;
        if (box.min.y > floorRefY + OBSTACLE_MAX_BASE) continue;
        colliders.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, pad });
    }

    console.info(`[scene] Stanza X[${room.minX.toFixed(2)},${room.maxX.toFixed(2)}] Z[${room.minZ.toFixed(2)},${room.maxZ.toFixed(2)}] — ostacoli: ${colliders.length}, pavimenti: ${floorMeshes.length}`);
}

// Sposta la mesh decorativa "Lines_Floor_Mesh_" alla posizione richiesta.
// worldToLocal: così la posizione MONDO risulta corretta anche se la mesh è
// figlia di un Group con una sua trasformazione.
function repositionLinesFloor(environment) {
    const o = environment.getObjectByName(LINES_FLOOR_NAME);
    if (!o) { console.warn(`[scene] "${LINES_FLOOR_NAME}" non trovata: niente riposizionamento.`); return; }
    const target = new THREE.Vector3(LINES_FLOOR_POS.x, LINES_FLOOR_POS.y, LINES_FLOOR_POS.z);
    if (o.parent) { o.parent.updateWorldMatrix(true, false); o.parent.worldToLocal(target); }
    o.position.copy(target);
    o.updateMatrixWorld(true);
    console.info(`[scene] "${LINES_FLOOR_NAME}" riposizionata a world (${LINES_FLOOR_POS.x}, ${LINES_FLOOR_POS.y}, ${LINES_FLOOR_POS.z}).`);
}

// Carica la foto di sfondo come panorama equirettangolare (paesaggio urbano).
async function loadCityBackground() {
    try {
        const tex = await new THREE.TextureLoader(manager).loadAsync(CITY_BG_URL);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        scene.background = tex;
        console.info("[scene] Sfondo urbano caricato.");
    } catch (e) {
        console.warn("[scene] Sfondo non caricato:", e);
    }
}

// Texture radiale bianca (centro pieno -> bordo trasparente) per l'alone glow.
function makeGlowTexture() {
    const s = 256;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.85)");
    g.addColorStop(0.6, "rgba(255,255,255,0.25)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// Carica camera.glb (nascosto) + alone bianco: verranno rivelati dopo il ritardo.
async function loadCameraProp() {
    const model = await loadModel(CAMERA_PROP.url);
    enableShadows(model);
    model.visible = false;
    scene.add(model);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false, // disegnato SOPRA: copre l'oggetto e il ripiano, niente compenetrazione
        opacity: 0,
    }));
    glow.position.set(CAMERA_PROP.center[0], CAMERA_PROP.center[1], CAMERA_PROP.center[2]);
    glow.scale.set(CAMERA_PROP.glowSize, CAMERA_PROP.glowSize, 1);
    glow.renderOrder = 999;
    glow.visible = false;
    scene.add(glow);

    cameraProp = { model, glow };
}

// Rivela l'oggetto camera e attiva l'alone pulsante.
function revealCameraProp() {
    if (!cameraProp) return;
    cameraProp.model.visible = true;
    cameraProp.glow.visible = true;
    console.info("[scene] Oggetto camera comparso.");
}

// Mette una PointLight su ogni "Bulb_" (la lampadina dentro le lampade a
// sospensione): la luce esce dal bulbo reale, non dal Lamp_Mesh. Le posizioni
// sono lette dalla geometria, così restano corrette anche con nuovi export.
function addBulbLights(environment) {
    environment.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const seen = new Set();
    let count = 0;
    environment.traverse((o) => {
        if (!o.isMesh) return;
        // il nome "Bulb_" può stare sulla mesh o su un antenato
        let p = o, isBulb = false;
        while (p && p !== environment.parent) {
            if ((p.name || "").toLowerCase().includes("bulb_")) { isBulb = true; break; }
            p = p.parent;
        }
        if (!isBulb) return;
        box.setFromObject(o);
        if (!isFinite(box.min.x)) return;
        box.getCenter(c);
        const key = `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`;
        if (seen.has(key)) return; // un solo lume per bulbo
        seen.add(key);
        const l = new THREE.PointLight(BULB.color, BULB.intensity * LIGHT_TUNE, BULB.distance, 2);
        l.position.copy(c);
        scene.add(l);
        count++;
    });
    console.info(`[scene] Luci sui bulbi (Bulb_): ${count}`);
}

// Aggiunge uno specchio realmente riflettente sul piano "Mirror" e nasconde
// il materiale originale (opaco), lasciando visibile solo il Reflector.
function setupMirror(environment) {
    environment.updateMatrixWorld(true);

    // Trova la mesh (primitive) che usa il materiale "Mirror".
    let mirrorMesh = null;
    environment.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m && (m.name || "").toLowerCase() === MIRROR.matName)) mirrorMesh = o;
    });
    if (!mirrorMesh) { console.warn('[scene] Mesh "Mirror" non trovata: niente specchio.'); return; }

    // Usa la GEOMETRIA REALE dello specchio (silhouette esatta, niente rettangolo
    // che sborda). La porto in coordinate mondo, la ricentro su un piano XY con
    // normale +Z e azzero lo spessore -> piano perfetto pronto per il Reflector.
    const geo = mirrorMesh.geometry.clone();
    geo.applyMatrix4(mirrorMesh.matrixWorld);
    geo.clearGroups();                       // via i gruppi multi-materiale
    geo.computeBoundingBox();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) posAttr.setZ(i, 0);
    posAttr.needsUpdate = true;

    const reflector = new Reflector(geo, {
        textureWidth: MIRROR.res,
        textureHeight: MIRROR.res,
        color: MIRROR.color,
        clipBias: 0.003,
    });
    reflector.material.side = THREE.DoubleSide; // il quad si vede a prescindere dal winding
    reflector.position.copy(center);
    reflector.rotation.y = Math.PI;         // faccia riflettente verso la stanza (-Z), verticale preservata
    reflector.position.z -= MIRROR.offset;  // micro-offset anti z-fighting

    scene.add(reflector);
    mirrorMesh.visible = false;             // nascondi il vetro originale
    console.info("[scene] Specchio: Reflector sulla forma reale della mesh.");
}

// ---------- Collisioni (bounding box, asse per asse) ----------
// Il personaggio è dentro un ostacolo? Ogni ostacolo usa il proprio padding
// (le scale ne hanno uno ridotto, così ci si può avvicinare di più).
function blocked(x, z) {
    for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const r = c.pad;
        if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
}

// Muove un asse alla volta -> scivola lungo gli oggetti invece di incastrarsi;
// clamp finale ai confini del pavimento (non esce dalla stanza).
function resolveMove(dx, dz) {
    let nx = THREE.MathUtils.clamp(character.x + dx, room.minX, room.maxX);
    if (blocked(nx, character.z)) nx = character.x;
    let nz = THREE.MathUtils.clamp(character.z + dz, room.minZ, room.maxZ);
    if (blocked(nx, nz)) nz = character.z;
    character.x = nx;
    character.z = nz;
}

// ---------- Ancoraggio al pavimento (raycast verso il basso) ----------
const _rc = new THREE.Raycaster();
const _org = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

// Raycast verso il basso su un punto (x,z): restituisce la quota del pavimento
// oppure null se lì sotto NON c'è terreno (buco / fuori dal Foundament).
function probeFloor(x, z) {
    if (!floorMeshes.length) return floorRefY;
    _org.set(x, groundRayStartY, z);
    _rc.set(_org, _down);
    _rc.far = groundRayStartY - floorRefY + 4;
    const hits = _rc.intersectObjects(floorMeshes, false);
    return hits.length ? hits[0].point.y : null;
}

function groundY() {
    const y = probeFloor(character.x, character.z);
    return y === null ? character.y : y; // se buco, mantieni l'ultima quota valida
}

// ---------- Camera in terza persona con anti-occlusione ----------
const _forward   = new THREE.Vector3();
const _lookAt    = new THREE.Vector3();
const _camOrigin = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camDir    = new THREE.Vector3();
function headingForward(yaw) { return _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); }

function updateCamera() {
    const fwd = headingForward(character.yaw);

    // Punto "occhio" (spalle) e posizione ideale dietro le spalle.
    _camOrigin.set(character.x, character.y + CAM.look, character.z);
    _camDesired.set(
        character.x - fwd.x * CAM.back,
        character.y + CAM.height,
        character.z - fwd.z * CAM.back
    );

    // Se c'è geometria tra l'occhio e la posizione ideale, avvicina la camera
    // fin davanti all'ostacolo -> non attraversa muri/vetri e resta nell'interno.
    _camDir.copy(_camDesired).sub(_camOrigin);
    let dist = _camDir.length();
    _camDir.normalize();
    _rc.set(_camOrigin, _camDir);
    _rc.far = dist;
    const hits = _rc.intersectObjects(occluders, false);
    if (hits.length) dist = Math.max(CAM.min, hits[0].distance - CAM.pad);

    camera.position.copy(_camOrigin).addScaledVector(_camDir, dist);
    _lookAt.set(character.x + fwd.x * 2, character.y + CAM.look, character.z + fwd.z * 2);
    camera.lookAt(_lookAt);
}

// ---------- Posizionamento personaggio ----------
// Applica la trasformazione corrente (x/y/z + rotazione) al modello.
function applyCharacterTransform() {
    const o = character.obj;
    if (!o) return;
    o.position.set(character.x, character.y - character.footOffset, character.z);
    o.rotation.y = character.yaw + MODEL_FACING_YAW_OFFSET;
}

// ---------- Avvio ----------
async function init() {
    try {
        const environment = await loadModel(MODELS.environment);
        enableShadows(environment);
        tuneMaterials(environment);
        scene.add(environment);
        classifyEnvironment(environment);
        repositionLinesFloor(environment);
        setupMirror(environment);
        addBulbLights(environment);

        const charModel = await loadModel(MODELS.character);
        enableShadows(charModel);
        charModel.updateMatrixWorld(true);
        character.footOffset = new THREE.Box3().setFromObject(charModel).min.y; // origine ai piedi (~0)

        const spawn = findSpawn();
        character.x = spawn.x;
        character.z = spawn.z;
        character.y = spawn.y;
        character.obj = charModel;

        character.y = groundY();       // aggancio esatto alla partenza (senza smoothing)
        applyCharacterTransform();
        scene.add(charModel);
        updateCamera();

        await loadCameraProp();        // caricato ma nascosto: comparirà dopo il ritardo
        await loadCityBackground();    // sfondo urbano pronto prima del primo frame

        // Precompila gli shader: la loading page resta finché non ho renderizzato
        // per davvero (vedi warmFrames nel loop) -> mai schermo nero.
        renderer.compile(scene, camera);
        sceneReady = true;

        console.info(`[scene] Spawn (${spawn.x.toFixed(2)}, ${spawn.y.toFixed(2)}, ${spawn.z.toFixed(2)}) — pavimento trovato: ${spawn.grounded}`);
        window.__bratz = { scene, camera, renderer, character, room, colliders, floorMeshes, CAM };
    } catch (err) {
        console.error("[scene] Init fallita:", err);
        loadingText.textContent = "Load error";
    }
}

// Spawn valido: dal centro verso l'esterno a spirale, il primo punto che è
// (a) libero da ostacoli E (b) con VERO pavimento sotto (raggio che colpisce il
// Foundament a quota sensata). Così non finisce mai in un buco/fuori dalla stanza.
function findSpawn() {
    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;

    const test = (x, z) => {
        if (blocked(x, z)) return null;
        const y = probeFloor(x, z);
        if (y === null) return null;                       // nessun pavimento -> scarta
        if (y > floorRefY + OBSTACLE_MAX_BASE) return null; // troppo alto (tetto/muro) -> scarta
        return { x, z, y, grounded: true };
    };

    const center = test(cx, cz);
    if (center) return center;

    for (let r = 0.4; r < 9; r += 0.4) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
            const x = THREE.MathUtils.clamp(cx + Math.cos(a) * r, room.minX, room.maxX);
            const z = THREE.MathUtils.clamp(cz + Math.sin(a) * r, room.minZ, room.maxZ);
            const spot = test(x, z);
            if (spot) return spot;
        }
    }
    // Fallback estremo: centro con quota di riferimento.
    console.warn("[scene] Nessuno spawn con pavimento valido: uso il centro.");
    return { x: cx, z: cz, y: floorRefY, grounded: false };
}

// ---------- Resize ----------
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Loop ----------
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (character.obj) {
        const turn = (isDown("ArrowLeft", "KeyA") ? 1 : 0) - (isDown("ArrowRight", "KeyD") ? 1 : 0);
        character.yaw += turn * TURN_SPEED * dt;

        const move = (isDown("ArrowUp", "KeyW") ? 1 : 0) - (isDown("ArrowDown", "KeyS") ? 1 : 0);
        if (move !== 0) {
            const speed = MOVE_SPEED * (isDown("ShiftLeft", "ShiftRight") ? RUN_MULT : 1);
            const fwd = headingForward(character.yaw);
            resolveMove(fwd.x * move * speed * dt, fwd.z * move * speed * dt);
        }

        // Quota del terreno interpolata -> salite/discese morbide, niente scatti.
        character.y = THREE.MathUtils.damp(character.y, groundY(), GROUND_LERP, dt);

        applyCharacterTransform();
        updateCamera();
    }

    // Alone bianco pulsante dell'oggetto camera
    if (cameraProp && cameraProp.glow.visible) {
        const t = performance.now() * 0.001;
        const pulse = 0.5 + 0.5 * Math.sin(t * CAMERA_PROP.pulseSpeed); // 0..1
        cameraProp.glow.material.opacity = 0.35 + 0.5 * pulse;
        const s = CAMERA_PROP.glowSize * (0.9 + 0.2 * pulse);
        cameraProp.glow.scale.set(s, s, 1);
    }

    composer.render(); // render con bloom (soft glow)

    // Chiudi la loading page SOLO dopo qualche frame davvero disegnato.
    if (sceneReady && !loadingHidden) {
        if (++warmFrames >= 3) {
            hideLoading();
            // L'utente è "entrato": avvia i timer (pop-up a 5'', oggetto camera a 20'').
            setTimeout(showGamePopup, GAME_POPUP_DELAY_MS);
            setTimeout(revealCameraProp, CAMERA_PROP.delayMs);
        }
    }
}

init();
animate();
