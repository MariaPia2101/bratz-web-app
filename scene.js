// ===== BRATZ — Scena 3D =====
// Stanza (environment.glb) + doll (character.glb) con three.js.
// Camera in TERZA PERSONA ancorata rigidamente alle spalle del personaggio.
// Movimento sul pavimento con collisioni: niente scale, niente muri, niente uscite.
// I modelli usano Draco + WebP: servono DRACOLoader e un browser con WebP.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------- Configurazione (tutto ritoccabile passo dopo passo) ----------
const MODELS = {
    environment: "assets/3d/models/environment.glb",
    character:   "assets/3d/models/character.glb",
};

const DRACO_DECODER_PATH = "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/";

// Movimento del personaggio
const MOVE_SPEED   = 2.2;   // unità/secondo (avanti/indietro)
const RUN_MULT     = 1.8;   // moltiplicatore con Shift
const TURN_SPEED   = 2.4;   // radianti/secondo (rotazione sinistra/destra)
const CHARACTER_RADIUS = 0.28; // raggio del personaggio per le collisioni (footprint ~0.4)

// Se la doll cammina "all'indietro" (dà le spalle alla direzione di marcia),
// metti Math.PI qui: allinea il fronte del modello alla direzione di movimento.
const MODEL_FACING_YAW_OFFSET = 0;
const INITIAL_YAW = 0;      // direzione iniziale in cui guarda il personaggio

// Camera in terza persona: offset FISSO rispetto al personaggio
const CAM = {
    back:   3.2,   // quanto è arretrata dietro le spalle
    height: 1.9,   // quanto è rialzata
    look:   1.2,   // altezza del punto guardato (circa la testa/spalle)
};

// Margine dai bordi del pavimento (spessore muro + raggio personaggio)
const ROOM_MARGIN = 0.35;

// ---------- Riferimenti DOM ----------
const canvas      = document.getElementById("scene-canvas");
const loadingEl   = document.getElementById("scene-loading");
const loadingBar  = document.getElementById("scene-loading-bar");
const loadingFill = document.getElementById("scene-loading-fill");
const loadingText = document.getElementById("scene-loading-text");

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scena e camera ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.05,
    1000
);
camera.position.set(0, CAM.height, CAM.back);

// Environment map neutra: serve ai materiali transmission/specular/sheen.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Luci ----------
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.6);
scene.add(hemiLight);

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
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}
function enableShadows(root) {
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// ---------- Stato di gioco ----------
const character = { obj: null, yaw: INITIAL_YAW, x: 0, z: 0 };
let floorTopY = 0;

// Confini della stanza (rettangolo del pavimento, ristretto dal margine).
const room = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };

// Ostacoli AABB in pianta (XZ): scale + muri. Ognuno viene gonfiato del raggio al test.
const obstacles = []; // { minX, maxX, minZ, maxZ, kind }

// Input tastiera
const keys = new Set();
const isDown = (...codes) => codes.some((c) => keys.has(c));

window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    fadeHint();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

// Il suggerimento comandi svanisce al primo tasto (o dopo qualche secondo).
const hintEl = document.getElementById("scene-hint");
let hintFaded = false;
function fadeHint() {
    if (hintFaded || !hintEl) return;
    hintFaded = true;
    hintEl.classList.add("is-faded");
    setTimeout(() => { hintEl.style.display = "none"; }, 900);
}
setTimeout(fadeHint, 6000);

// ---------- Estrazione dei collider dalla geometria reale ----------
// Legge le bounding box mondo delle mesh per nome: pavimento -> confini stanza,
// *stair* -> zona proibita, *wall* -> ostacoli. Niente coordinate hardcoded.
function buildColliders(environment) {
    environment.updateMatrixWorld(true);

    let floorBox = null;
    const tmp = new THREE.Box3();

    environment.traverse((o) => {
        if (!o.isMesh) return;
        const name = (o.name || "").toLowerCase();
        tmp.setFromObject(o);
        if (!isFinite(tmp.min.x)) return;

        if (name.includes("floor") && (!floorBox || boxAreaXZ(tmp) > boxAreaXZ(floorBox))) {
            floorBox = tmp.clone(); // il pavimento più grande = pavimento della stanza
        }
        if (name.includes("stair")) {
            obstacles.push(boxToRect(tmp, "stairs"));
        } else if (name.includes("wall")) {
            obstacles.push(boxToRect(tmp, "wall"));
        }
    });

    if (floorBox) {
        room.minX = floorBox.min.x + ROOM_MARGIN;
        room.maxX = floorBox.max.x - ROOM_MARGIN;
        room.minZ = floorBox.min.z + ROOM_MARGIN;
        room.maxZ = floorBox.max.z - ROOM_MARGIN;
        floorTopY = floorBox.max.y;
    } else {
        // Fallback: usa la bbox globale dell'ambiente.
        const g = new THREE.Box3().setFromObject(environment);
        room.minX = g.min.x + ROOM_MARGIN; room.maxX = g.max.x - ROOM_MARGIN;
        room.minZ = g.min.z + ROOM_MARGIN; room.maxZ = g.max.z - ROOM_MARGIN;
        floorTopY = g.min.y;
        console.warn("[scene] Pavimento non trovato: uso la bbox globale come confine.");
    }

    console.info(`[scene] Stanza X[${room.minX.toFixed(2)},${room.maxX.toFixed(2)}] Z[${room.minZ.toFixed(2)},${room.maxZ.toFixed(2)}] floorY=${floorTopY.toFixed(2)} — ostacoli: ${obstacles.length}`);
}

const boxAreaXZ = (b) => (b.max.x - b.min.x) * (b.max.z - b.min.z);
function boxToRect(b, kind) {
    return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, kind };
}

// Il personaggio (cerchio di raggio R) è dentro un ostacolo?
function inObstacle(x, z) {
    const r = CHARACTER_RADIUS;
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (x > o.minX - r && x < o.maxX + r && z > o.minZ - r && z < o.maxZ + r) return true;
    }
    return false;
}

// Risoluzione collisione asse per asse: clamp ai muri perimetrali + reject sugli ostacoli.
// Muovendo un asse alla volta il personaggio scivola lungo muri e scale invece di incastrarsi.
function resolveMove(dx, dz) {
    // Asse X
    let nx = THREE.MathUtils.clamp(character.x + dx, room.minX, room.maxX);
    if (inObstacle(nx, character.z)) nx = character.x;
    // Asse Z (con la X già risolta)
    let nz = THREE.MathUtils.clamp(character.z + dz, room.minZ, room.maxZ);
    if (inObstacle(nx, nz)) nz = character.z;
    character.x = nx;
    character.z = nz;
}

// ---------- Camera rigida in terza persona ----------
const _forward = new THREE.Vector3();
const _camPos  = new THREE.Vector3();
const _lookAt  = new THREE.Vector3();

// Direzione (world) verso cui punta il personaggio, dato lo yaw logico.
function headingForward(yaw) {
    return _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function updateCamera() {
    const fwd = headingForward(character.yaw);
    // Posizione: dietro le spalle (-fwd) e rialzata (+y). Offset FISSO -> ancoraggio rigido.
    _camPos.set(
        character.x - fwd.x * CAM.back,
        floorTopY + CAM.height,
        character.z - fwd.z * CAM.back
    );
    camera.position.copy(_camPos);
    // Guarda sempre nella stessa direzione del personaggio (verso +fwd, all'altezza spalle).
    _lookAt.set(character.x + fwd.x * 2, floorTopY + CAM.look, character.z + fwd.z * 2);
    camera.lookAt(_lookAt);
}

// ---------- Avvio ----------
async function init() {
    try {
        const environment = await loadModel(MODELS.environment);
        enableShadows(environment);
        scene.add(environment);
        buildColliders(environment);

        const charModel = await loadModel(MODELS.character);
        enableShadows(charModel);

        // Appoggia i piedi sul pavimento (origine del modello ai piedi).
        const box = new THREE.Box3().setFromObject(charModel);
        const footOffset = box.min.y; // ~0 per questo modello
        charModel.userData.footOffset = footOffset;

        // Posizione iniziale: centro stanza, ma fuori dagli ostacoli.
        const start = findSpawn();
        character.x = start.x;
        character.z = start.z;
        character.obj = charModel;

        placeCharacter();
        scene.add(charModel);
        updateCamera();

        window.__bratz = { scene, camera, renderer, character, room, obstacles, CAM };
    } catch (err) {
        console.error("[scene] Init fallita:", err);
        loadingText.textContent = "Load error";
    }
}

// Trova uno spawn valido vicino al centro della stanza, evitando gli ostacoli.
function findSpawn() {
    const cx = (room.minX + room.maxX) / 2;
    const cz = (room.minZ + room.maxZ) / 2;
    if (!inObstacle(cx, cz)) return { x: cx, z: cz };
    // Cerca a spirale se il centro è occupato.
    for (let r = 0.5; r < 8; r += 0.5) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
            const x = THREE.MathUtils.clamp(cx + Math.cos(a) * r, room.minX, room.maxX);
            const z = THREE.MathUtils.clamp(cz + Math.sin(a) * r, room.minZ, room.maxZ);
            if (!inObstacle(x, z)) return { x, z };
        }
    }
    return { x: cx, z: cz };
}

function placeCharacter() {
    const o = character.obj;
    if (!o) return;
    o.position.set(character.x, floorTopY - (o.userData.footOffset || 0), character.z);
    o.rotation.y = character.yaw + MODEL_FACING_YAW_OFFSET;
}

// ---------- Resize ----------
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Loop di aggiornamento ----------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05); // clamp anti-tunneling nei cali di frame

    if (character.obj) {
        // Rotazione
        const turn = (isDown("ArrowLeft", "KeyA") ? 1 : 0) - (isDown("ArrowRight", "KeyD") ? 1 : 0);
        character.yaw += turn * TURN_SPEED * dt;

        // Avanzamento lungo la direzione corrente
        const move = (isDown("ArrowUp", "KeyW") ? 1 : 0) - (isDown("ArrowDown", "KeyS") ? 1 : 0);
        if (move !== 0) {
            const speed = MOVE_SPEED * (isDown("ShiftLeft", "ShiftRight") ? RUN_MULT : 1);
            const fwd = headingForward(character.yaw);
            resolveMove(fwd.x * move * speed * dt, fwd.z * move * speed * dt);
        }

        placeCharacter();
        updateCamera();
    }

    renderer.render(scene, camera);
}

init();
animate();
