// ===== BRATZ — Scena 3D =====
// Carica la stanza (environment.glb) e la doll (character.glb) con three.js.
// I modelli usano compressione Draco + texture WebP, quindi servono DRACOLoader
// e un browser con supporto WebP (tutti i browser moderni).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------- Configurazione (facile da ritoccare passo dopo passo) ----------
const MODELS = {
    environment: "assets/3d/models/environment.glb",
    character:   "assets/3d/models/character.glb",
};

// Path del decoder Draco (stessa versione di three sul CDN).
const DRACO_DECODER_PATH = "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/";

// Trasformazioni iniziali della doll — le rifiniamo insieme una volta vista la scena.
const CHARACTER_TRANSFORM = {
    position: new THREE.Vector3(0, 0, 0),
    rotationY: 0,
    scale: 1,
};

// ---------- Riferimenti DOM ----------
const canvas       = document.getElementById("scene-canvas");
const loadingEl    = document.getElementById("scene-loading");
const loadingBar   = document.getElementById("scene-loading-bar");
const loadingFill  = document.getElementById("scene-loading-fill");
const loadingText  = document.getElementById("scene-loading-text");

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
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(4, 2, 6);

// Environment map neutra (illuminazione indoor) — indispensabile perché i materiali
// con transmission/specular/sheen abbiano qualcosa da riflettere.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Luci di supporto ----------
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

// ---------- Controlli orbitali ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.495; // non si scende sotto il pavimento
controls.target.set(0, 1, 0);

// ---------- Loading manager: barra di avanzamento reale ----------
const manager = new THREE.LoadingManager();

manager.onProgress = (url, loaded, total) => {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    setProgress(pct);
};

manager.onLoad = () => {
    setProgress(100);
    hideLoading();
};

manager.onError = (url) => {
    console.error("[scene] Errore nel caricamento di:", url);
    loadingText.textContent = "Load error";
};

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

// ---------- Loaders (GLTF + Draco) ----------
const dracoLoader = new DRACOLoader(manager);
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);

const gltfLoader = new GLTFLoader(manager);
gltfLoader.setDRACOLoader(dracoLoader);

// Carica un GLB e restituisce una Promise con lo scene-graph.
function loadModel(url) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}

// Abilita ombre su tutte le mesh di un modello.
function enableShadows(root) {
    root.traverse((obj) => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
}

// Inquadra la camera in base al bounding box dell'oggetto passato.
function frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.4;

    controls.target.copy(center);
    camera.position.set(center.x + dist * 0.6, center.y + size.y * 0.25, center.z + dist);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();
    controls.update();
}

// ---------- Avvio: carica la stanza, poi la doll ----------
async function init() {
    try {
        const environment = await loadModel(MODELS.environment);
        enableShadows(environment);
        scene.add(environment);
        frameObject(environment);

        const character = await loadModel(MODELS.character);
        enableShadows(character);
        character.position.copy(CHARACTER_TRANSFORM.position);
        character.rotation.y = CHARACTER_TRANSFORM.rotationY;
        character.scale.setScalar(CHARACTER_TRANSFORM.scale);
        scene.add(character);

        // Esponi in console per rifinire posizioni al volo durante lo sviluppo.
        window.__bratz = { scene, camera, controls, environment, character, renderer };
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

// ---------- Render loop ----------
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
animate();
