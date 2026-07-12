// ===== BRATZ — Scena 3D =====
// Stanza (environment.glb) + doll (character.glb) con three.js.
// Camera in TERZA PERSONA ancorata rigidamente ALLE SPALLE del personaggio.
// Il personaggio è incollato al pavimento (raycast verso il basso) e si muove
// su quel piano; le collisioni con muri e oggetti sono gestite a raycast nel
// loop di aggiornamento. I modelli usano Draco + WebP.

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
const CHARACTER_RADIUS = 0.30; // "cuscinetto" del personaggio per le collisioni

// Il fronte del modello guarda verso +Z: lo ruotiamo di 180° così la doll dà
// le spalle alla telecamera e cammina nella direzione in cui guarda.
const MODEL_FACING_YAW_OFFSET = Math.PI;
const INITIAL_YAW = 0;      // direzione iniziale in cui guarda il personaggio

// Camera in terza persona: offset FISSO rispetto al personaggio (ancoraggio rigido)
const CAM = {
    back:   3.2,   // quanto è arretrata dietro le spalle
    height: 1.9,   // quanto è rialzata
    look:   1.2,   // altezza del punto guardato (spalle/testa)
};

// Margine dai bordi del pavimento (rete di sicurezza per non uscire dalla stanza)
const ROOM_MARGIN = 0.30;

// Altezze (dal pavimento) a cui sparo i raggi di collisione orizzontali:
// caviglia / bacino / spalle → blocca sia mobili bassi sia muri alti.
const PROBE_HEIGHTS = [0.20, 0.70, 1.05];

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
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 1000);
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

// ---------- Stato ----------
const character = { obj: null, yaw: INITIAL_YAW, x: 0, z: 0, footOffset: 0 };
let floorTopY = 0;

const room = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };

// Mesh su cui appoggiare i piedi (pavimento) e mesh contro cui sbattere (muri+oggetti).
const floorMeshes = [];
const collidables = [];

// Input tastiera
const keys = new Set();
const isDown = (...codes) => codes.some((c) => keys.has(c));
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

// ---------- Classificazione della geometria ----------
// Pavimento -> per l'ancoraggio e i confini. Soffitto/luci -> ignorati come collider.
// Tutto il resto (muri, mobili, scale...) -> collidibile.
function classifyEnvironment(environment) {
    environment.updateMatrixWorld(true);

    let floorBox = null;
    const tmp = new THREE.Box3();
    const areaXZ = (b) => (b.max.x - b.min.x) * (b.max.z - b.min.z);

    environment.traverse((o) => {
        if (!o.isMesh) return;
        const name = (o.name || "").toLowerCase();

        if (name.includes("floor")) {
            floorMeshes.push(o);
            tmp.setFromObject(o);
            if (isFinite(tmp.min.x) && (!floorBox || areaXZ(tmp) > areaXZ(floorBox))) {
                floorBox = tmp.clone();
            }
            return; // il pavimento non blocca il movimento orizzontale
        }
        // Il soffitto e le mesh luminose non fermano il personaggio.
        if (name.includes("ceiling") || name.includes("soffitt")) return;

        collidables.push(o); // muri, mobili, scale, ecc.
    });

    if (floorBox) {
        room.minX = floorBox.min.x + ROOM_MARGIN;
        room.maxX = floorBox.max.x - ROOM_MARGIN;
        room.minZ = floorBox.min.z + ROOM_MARGIN;
        room.maxZ = floorBox.max.z - ROOM_MARGIN;
        floorTopY = floorBox.max.y;
    } else {
        const g = new THREE.Box3().setFromObject(environment);
        room.minX = g.min.x + ROOM_MARGIN; room.maxX = g.max.x - ROOM_MARGIN;
        room.minZ = g.min.z + ROOM_MARGIN; room.maxZ = g.max.z - ROOM_MARGIN;
        floorTopY = g.min.y;
        console.warn("[scene] Pavimento non trovato: uso la bbox globale come confine.");
    }
    console.info(`[scene] Stanza X[${room.minX.toFixed(2)},${room.maxX.toFixed(2)}] Z[${room.minZ.toFixed(2)},${room.maxZ.toFixed(2)}] floorY=${floorTopY.toFixed(2)} — collidibili: ${collidables.length}, pavimenti: ${floorMeshes.length}`);
}

// ---------- Collisioni a raycast ----------
const _rc  = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _org = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

// Quanto può avanzare il personaggio lungo un asse prima di sbattere (raycast).
function sweepAxis(axis, amount) {
    if (amount === 0) return 0;
    const sign = Math.sign(amount);
    const dist = Math.abs(amount);
    _dir.set(axis === "x" ? sign : 0, 0, axis === "z" ? sign : 0);

    let allowed = dist;
    for (let i = 0; i < PROBE_HEIGHTS.length; i++) {
        _org.set(character.x, floorTopY + PROBE_HEIGHTS[i], character.z);
        _rc.set(_org, _dir);
        _rc.far = dist + CHARACTER_RADIUS;
        const hits = _rc.intersectObjects(collidables, false);
        if (hits.length) {
            allowed = Math.min(allowed, Math.max(0, hits[0].distance - CHARACTER_RADIUS));
        }
    }
    return sign * allowed;
}

// Muove il personaggio un asse alla volta: così scivola lungo muri e oggetti
// invece di incastrarsi. In coda, clamp ai confini della stanza (rete di sicurezza).
function resolveMove(dx, dz) {
    character.x += sweepAxis("x", dx);
    character.z += sweepAxis("z", dz);
    character.x = THREE.MathUtils.clamp(character.x, room.minX, room.maxX);
    character.z = THREE.MathUtils.clamp(character.z, room.minZ, room.maxZ);
}

// Altezza del pavimento sotto il personaggio (raycast verso il basso) -> ancoraggio.
function groundY() {
    if (!floorMeshes.length) return floorTopY;
    _org.set(character.x, floorTopY + 2.0, character.z);
    _rc.set(_org, _down);
    _rc.far = 6.0;
    const hits = _rc.intersectObjects(floorMeshes, false);
    return hits.length ? hits[0].point.y : floorTopY;
}

// ---------- Camera rigida in terza persona ----------
const _forward = new THREE.Vector3();
const _camPos  = new THREE.Vector3();
const _lookAt  = new THREE.Vector3();

// Direzione (world) verso cui guarda il personaggio, dato lo yaw logico.
function headingForward(yaw) {
    return _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function updateCamera() {
    const fwd = headingForward(character.yaw);
    // Dietro le spalle (-fwd) e rialzata (+y): offset FISSO = ancoraggio rigido.
    _camPos.set(
        character.x - fwd.x * CAM.back,
        floorTopY + CAM.height,
        character.z - fwd.z * CAM.back
    );
    camera.position.copy(_camPos);
    // Guarda sempre nella stessa direzione del personaggio.
    _lookAt.set(character.x + fwd.x * 2, floorTopY + CAM.look, character.z + fwd.z * 2);
    camera.lookAt(_lookAt);
}

// ---------- Posizionamento personaggio ----------
function placeCharacter() {
    const o = character.obj;
    if (!o) return;
    o.position.set(character.x, groundY() - character.footOffset, character.z);
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

        // Origine del modello ai piedi (footOffset ~0): serve ad appoggiarla al suolo.
        const box = new THREE.Box3().setFromObject(charModel);
        character.footOffset = box.min.y;

        // Spawn al centro della stanza.
        character.x = (room.minX + room.maxX) / 2;
        character.z = (room.minZ + room.maxZ) / 2;
        character.obj = charModel;

        placeCharacter();
        scene.add(charModel);
        updateCamera();

        window.__bratz = { scene, camera, renderer, character, room, collidables, floorMeshes, CAM };
    } catch (err) {
        console.error("[scene] Init fallita:", err);
        loadingText.textContent = "Load error";
    }
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
    const dt = Math.min(clock.getDelta(), 0.05); // clamp anti-tunneling nei cali di frame

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
    }

    renderer.render(scene, camera);
}

init();
animate();
