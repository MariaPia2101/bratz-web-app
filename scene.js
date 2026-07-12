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

// ---------- Configurazione ----------
const MODELS = {
    environment: "assets/3d/models/environment.glb",
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

// Movimento
const MOVE_SPEED   = 2.2;
const RUN_MULT     = 1.8;
const TURN_SPEED   = 2.4;
const CHARACTER_RADIUS = 0.16; // cuscinetto orizzontale per le collisioni (più piccolo = si avvicina di più)
const STAIRS_PAD       = 0.0;  // padding ridotto per le scale (0 = ci si può avvicinare fino al bordo)
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

// ---------- Illuminazione (simula il light bake di Blender) ----------
// LIGHT_TUNE alza/abbassa TUTTA l'intensità in un colpo solo.
const LIGHT_TUNE = 1.0;
RectAreaLightUniformsLib.init(); // necessario per le RectAreaLight (strisce LED)

// Colori dei LED: ROSA (non bianchi). Il fill di ambiente è quasi neutro, così
// il rosa arriva come ACCENTO dalle strisce e non "bagna" tutta la stanza.
const LED_PINK   = 0xff5abb;
const LED_MAGENTA = 0xff2f9e;

// Ambiente + emisferica: fill quasi bianco/appena rosato (evita l'effetto fucsia).
scene.add(new THREE.AmbientLight(0xffeaf5, 0.55 * LIGHT_TUNE));
scene.add(new THREE.HemisphereLight(0xfff3fb, 0xffd0ec, 0.35 * LIGHT_TUNE));

// Key light direzionale: definizione + ombra morbida, praticamente bianca.
const keyLight = new THREE.DirectionalLight(0xfff4f8, 0.85 * LIGHT_TUNE);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

// --- Le 9 lampade a sospensione (Lamp_Mesh_) = PointLight (rosa tenue) ---
const LAMP_POINTS = [
    [2.09, 3.15, -2.68], [1.23, 3.15, -2.11], [2.14, 3.15, -1.39],
    [1.18, 3.15, -0.85], [1.10, 3.15,  0.01], [0.13, 3.15,  0.13],
    [0.41, 3.15, -1.28], [-0.08, 3.15, -0.91], [2.45, 3.15, -0.27],
];
for (const [x, y, z] of LAMP_POINTS) {
    const l = new THREE.PointLight(0xffbfe4, 7 * LIGHT_TUNE, 5, 2);
    l.position.set(x, y, z);
    scene.add(l);
}

// --- I LED = RectAreaLight (strisce luminose), tutte ROSA ---
// { colore, intensità, larghezza, altezza, posizione, punto verso cui illumina }
// NB: le RectAreaLight sono costose -> ne teniamo poche (perimetro soffitto +
// insegna). Gli altri LED restano visibili grazie al loro glow emissivo rosa.
const AREA_LIGHTS = [
    // LED perimetrali del soffitto: illuminano verso il basso
    { c: LED_PINK, i: 5, w: 5, h: 0.6, p: [-0.46, 4.25, -4.3], look: [-0.46, 0, -4.3] },
    { c: LED_PINK, i: 5, w: 5, h: 0.6, p: [-4.05, 4.25, -1.2], look: [-4.05, 0, -1.2] },
    { c: LED_PINK, i: 5, w: 5, h: 0.6, p: [0.60,  4.25,  3.5], look: [0.60, 0,  3.5] },
    { c: LED_PINK, i: 5, w: 5, h: 0.6, p: [3.05,  4.25, -0.35], look: [3.05, 0, -0.35] },
    // Insegna neon "BRATZ": illumina verso l'interno stanza
    { c: LED_MAGENTA, i: 6, w: 1.4, h: 2.0, p: [0.10, 1.40, 3.55], look: [0.10, 1.40, 0] },
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
manager.onLoad = () => { setProgress(100); hideLoading(); };
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
        // (ma resta comunque bloccato, non ci sale).
        const pad = hasName(o, "stair") ? STAIRS_PAD : CHARACTER_RADIUS;
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

    renderer.render(scene, camera);
}

init();
animate();
