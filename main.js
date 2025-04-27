import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import * as CANNON from 'cannon-es';

let camera, scene, renderer;
let controller, reticle, localRef;
let physicsWorld;
let pelotaMesh, pelotaBody;
const barras = [], jugadores = [];
const mixers = [], clock = new THREE.Clock();

// Gesture and physics
let pinchLeft = false, pinchRight = false;
const PINCH_THRESHOLD = 0.03;

// Sounds (ensure these files are uploaded to the assets folder)
let kickSound, goalSound;
try {
  kickSound = new Audio('assets/kick.mp3');
  goalSound = new Audio('assets/goal.mp3');
  kickSound.load();
  goalSound.load();
} catch (error) {
  console.warn('Audio files not found or cannot be loaded.', error);
}

init();
animate();

async function init() {
  try {
    // Scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Renderer with AR enabled
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Add AR button
    document.body.appendChild(
      ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'], // Ensure 'hand-tracking' is supported on the device
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      })
    );

    // Light
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    // Reticle (for object placement)
    const ringGeo = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2);
    reticle = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Cannon.js physics world
    physicsWorld = new CANNON.World();
    physicsWorld.gravity.set(0, -9.82, 0);

    // Ball (pelota)
    pelotaBody = new CANNON.Body({ mass: 0.1, shape: new CANNON.Sphere(0.03) });
    pelotaBody.position.set(0, 0.1, 0);
    physicsWorld.addBody(pelotaBody);
    pelotaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    scene.add(pelotaMesh);

    // XR Controller
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Hit-Test Source
    const session = renderer.xr.getSession();
    const viewerRef = await session.requestReferenceSpace('viewer');
    localRef = await session.requestReferenceSpace('local');

    const hitTestSrc = await session.requestHitTestSource({ space: viewerRef });

    // Animation Loop
    renderer.setAnimationLoop((time, frame) => {
      if (frame) {
        const hits = frame.getHitTestResults(hitTestSrc);
        if (hits.length) {
          const pose = hits[0].getPose(localRef);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          reticle.visible = false;
        }
      }
      render();
    });

    // Handle Resizing
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  } catch (error) {
    console.error('Error initializing AR session:', error);
  }
}

// Function to render the scene
function render() {
  const delta = clock.getDelta();
  physicsWorld.step(1 / 60, delta, 3);

  // Update pelota (ball) position
  pelotaMesh.position.copy(pelotaBody.position);
  pelotaMesh.quaternion.copy(pelotaBody.quaternion);

  renderer.render(scene, camera);
}

// Add table and players when selecting a location
function onSelect() {
  if (!reticle.visible) return;

  // Example: Add a table or object
  const tableGeo = new THREE.BoxGeometry(1, 0.1, 0.5);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.matrix.copy(reticle.matrix);
  tableMesh.matrix.decompose(tableMesh.position, tableMesh.quaternion, tableMesh.scale);
  scene.add(tableMesh);
}
