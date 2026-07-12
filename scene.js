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

// ---------- Configurazione ----------
const MODELS = {
    environment: "assets/3d/models/environment.glb",
    character:   "assets/3d/models/character.glb",
};

const DRACO_DECODER_PATH = "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/";

// Nome della mesh che fa da PAVIMENTO calpestabile (con dislivelli).
const FLOOR_MESH_NAME = "foundament";

// Movimento
const MOVE_SPEED   = 2.2;
const RUN_MULT     = 1.8;
const TURN_SPEED   = 2.4;
const CHARACTER_RADIUS = 0.30; // cuscinetto orizzontale per le collisioni

// Il fronte del modello guarda verso +Z: ruotato di 180° -> spalle alla camera.
const MODEL_FACING_YAW_OFFSET = Math.PI;
const INITIAL_YAW = 0;

// Camera in terza persona: offset FISSO (ancoraggio rigido)
const CAM = { back: 3.2, height: 1.9, look: 1.2 };

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
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scena e camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 1000);
camera.position.set(0, CAM.height, CAM.back);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Luci ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

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

// ---------- Stato ----------
const character = { obj: null, yaw: INITIAL_YAW, x: 0, z: 0, y: 0, footOffset: 0 };

const room = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
let groundRayStartY = 8;   // da quanto in alto sparo il raggio verso il basso
let floorRefY = 0;         // livello nominale del pavimento (per il filtro ostacoli)

const floorMeshes = [];    // mesh su cui appoggiare i piedi (Foundament_Home_)
const colliders = [];      // ostacoli: { minX, maxX, minZ, maxZ }

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

        if (hasName(o, FLOOR_MESH_NAME)) {
            floorMeshes.push(o);
            floorBox = floorBox ? floorBox.union(b) : b.clone(); // unione di tutte le parti
            return; // il pavimento non è un ostacolo
        }
        if (hasName(o, "ceiling") || hasName(o, "soffitt")) return;
        if (hasName(o, "floor")) return; // decoro piatto calpestabile

        candidates.push(b.clone());
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
    for (const box of candidates) {
        // Deve intersecare l'area della stanza (scarta mesh esterne/lontane).
        if (box.max.x < room.minX || box.min.x > room.maxX ||
            box.max.z < room.minZ || box.min.z > room.maxZ) continue;
        // Deve sporgere dal suolo ma non essere solo roba appesa in alto.
        if (box.max.y < floorRefY + OBSTACLE_MIN_RISE) continue;
        if (box.min.y > floorRefY + OBSTACLE_MAX_BASE) continue;
        colliders.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    }

    console.info(`[scene] Stanza X[${room.minX.toFixed(2)},${room.maxX.toFixed(2)}] Z[${room.minZ.toFixed(2)},${room.maxZ.toFixed(2)}] — ostacoli: ${colliders.length}, pavimenti: ${floorMeshes.length}`);
}

// ---------- Collisioni (bounding box, asse per asse) ----------
// Il personaggio (cerchio di raggio R) è dentro un ostacolo?
function blocked(x, z) {
    const r = CHARACTER_RADIUS;
    for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
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

// ---------- Camera rigida in terza persona ----------
const _forward = new THREE.Vector3();
const _lookAt  = new THREE.Vector3();
function headingForward(yaw) { return _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); }

function updateCamera() {
    const fwd = headingForward(character.yaw);
    camera.position.set(
        character.x - fwd.x * CAM.back,
        character.y + CAM.height,   // segue salite/discese del terreno
        character.z - fwd.z * CAM.back
    );
    _lookAt.set(character.x + fwd.x * 2, character.y + CAM.look, character.z + fwd.z * 2);
    camera.lookAt(_lookAt);
}

// ---------- Posizionamento personaggio ----------
function placeCharacter() {
    const o = character.obj;
    if (!o) return;
    character.y = groundY();                 // quota del terreno sotto di lei
    o.position.set(character.x, character.y - character.footOffset, character.z);
    o.rotation.y = character.yaw + MODEL_FACING_YAW_OFFSET;
}

// ---------- Avvio ----------
async function init() {
    try {
        const environment = await loadModel(MODELS.environment);
        enableShadows(environment);
        scene.add(environment);
        classifyEnvironment(environment);

        const charModel = await loadModel(MODELS.character);
        enableShadows(charModel);
        charModel.updateMatrixWorld(true);
        character.footOffset = new THREE.Box3().setFromObject(charModel).min.y; // origine ai piedi (~0)

        const spawn = findSpawn();
        character.x = spawn.x;
        character.z = spawn.z;
        character.y = spawn.y;
        character.obj = charModel;

        placeCharacter();
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

        placeCharacter();
        updateCamera();
        updateDebug();
    }

    renderer.render(scene, camera);
}

// HUD di debug: posizione + confini + se ha pavimento sotto.
const debugEl = document.getElementById("scene-debug");
function updateDebug() {
    if (!debugEl) return;
    const grounded = probeFloor(character.x, character.z) !== null;
    debugEl.textContent =
        `pos ${character.x.toFixed(2)}, ${character.y.toFixed(2)}, ${character.z.toFixed(2)} | ` +
        `room X[${room.minX.toFixed(1)},${room.maxX.toFixed(1)}] Z[${room.minZ.toFixed(1)},${room.maxZ.toFixed(1)}] | ` +
        `floor:${grounded ? "OK" : "NO"} | obst:${colliders.length}`;
}

init();
animate();
