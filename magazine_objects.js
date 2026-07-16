// ===== BRATZ — Oggetti del magazine =====
// Rende i 3 oggetti TROVATI (camera.glb, lipstick.glb, bag.glb) al posto di
// Rectangle 1/2/3 nella magazines_page. Ogni oggetto vive in un piccolo viewer
// three.js autonomo (canvas dedicato), con auto-fit e lenta rotazione.
// Stesso stack di scene.js (three da CDN + Draco). Se il 3D non è disponibile,
// il riquadro resta semplicemente vuoto: nessun errore bloccante.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODELS = {
    camera: "assets/3d/models/camera.glb",
    lipstick: "assets/3d/models/lipstick.glb",
    bag: "assets/3d/models/bag.glb",
};
const DRACO_DECODER_PATH = "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/";
const ROTATE_SPEED = 0.35; // giri/secondo * 2π scalato: rotazione lenta e continua

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

function loadModel(url) {
    return new Promise((resolve, reject) =>
        gltfLoader.load(url, (g) => resolve(g.scene), undefined, reject));
}

// Inquadra il modello centrandolo nell'origine e adattando la distanza camera.
function frameObject(model, camera) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // centra il modello sull'origine
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.6; // 1.6 = margine attorno
    camera.position.set(0, size.y * 0.15, dist);
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return maxDim;
}

function setupViewer(canvas, url) {
    const parent = canvas.parentElement;
    let w = parent.clientWidth || 200;
    let h = parent.clientHeight || 200;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene(); // sfondo trasparente (alpha)
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 100);

    // Luce ambientale morbida + environment neutro per riflessi puliti.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4);
    scene.add(key);

    const holder = new THREE.Group();
    scene.add(holder);

    let ready = false;
    loadModel(url).then((model) => {
        frameObject(model, camera);
        holder.add(model);
        ready = true;
    }).catch((err) => { console.warn("magazine object failed:", url, err); });

    function resize() {
        const nw = parent.clientWidth, nh = parent.clientHeight;
        if (!nw || !nh || (nw === w && nh === h)) return;
        w = nw; h = nh;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);

    let last = performance.now();
    function tick(now) {
        const dt = (now - last) / 1000; last = now;
        resize();
        if (ready) holder.rotation.y += ROTATE_SPEED * dt;
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

document.querySelectorAll(".mag-obj__canvas").forEach((canvas) => {
    const url = MODELS[canvas.dataset.model];
    if (url) setupViewer(canvas, url);
});
