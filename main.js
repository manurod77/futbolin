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

// Sounds (optional)
const kickSound = new Audio('assets/kick.mp3');
const goalSound = new Audio('assets/goal.mp3');

// Preload sounds
kickSound.load();
goalSound.load();

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

    // AR Button with hit-test and hand-tracking
    document.body.appendChild(
      ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test', 'hand-tracking']
      })
    );

    // Light
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    // Reticle (ring) for placing objects
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

    // Ball: physical body and mesh
    pelotaBody = new CANNON.Body({ mass: 0.1, shape: new CANNON.Sphere(0.03) });
    pelotaBody.position.set(0, 0.1, 0);
    physicsWorld.addBody(pelotaBody);
    pelotaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    scene.add(pelotaMesh);

    // XR controller for object selection
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Setup hit-test and local reference space
    const session = renderer.xr.getSession();
    const viewerRef = await session.requestReferenceSpace('viewer');
    localRef = await session.requestReferenceSpace('local');

    const hitTestSrc = await session.requestHitTestSource({ space: viewerRef });

    // Main AR loop
    renderer.setAnimationLoop((time, frame) => {
      if (frame) {
        // Hit-test
        const hits = frame.getHitTestResults(hitTestSrc);
        if (hits.length) {
          const pose = hits[0].getPose(localRef);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          reticle.visible = false;
        }
        // Hand Tracking: pinch detection
        handleHands(frame);
      }
      render();
    });

    // Responsive resizing
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  } catch (error) {
    console.error('Error initializing AR session:', error);
  }
}

// Create procedural table and players
function onSelect() {
  if (!reticle.visible) return;

  // Procedural table
  const mesaGeo = new THREE.BoxGeometry(1.2, 0.1, 0.7);
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const mesaMesh = new THREE.Mesh(mesaGeo, mesaMat);
  mesaMesh.applyMatrix4(reticle.matrix);
  scene.add(mesaMesh);

  // Physical body for the table
  const mesaBody = new CANNON.Body({ mass: 0 });
  mesaBody.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.05, 0.35)));
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
  reticle.matrix.decompose(pos, quat, sc);
  mesaBody.position.copy(pos);
  physicsWorld.addBody(mesaBody);

  // Add bars and players
  const numBarras = 4;
  for (let i = 0; i < numBarras; i++) {
    const barraGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 16);
    const barraMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const barraMesh = new THREE.Mesh(barraGeo, barraMat);
    barraMesh.rotation.z = Math.PI / 2;
    barraMesh.position.set(pos.x, pos.y + 0.15, pos.z - 0.3 + i * 0.2);
    scene.add(barraMesh);
    barras.push(barraMesh);

    // Add players to bars
    const jugadoresPorBarra = (i === 0 || i === 3) ? 3 : 5;
    for (let j = 0; j < jugadoresPorBarra; j++) {
      const bodyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 12);
      const headGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
      const matPlayer = new THREE.MeshStandardMaterial({ color: i < 2 ? 0x0000ff : 0xff0000 });
      const bodyMesh = new THREE.Mesh(bodyGeo, matPlayer);
      const headMesh = new THREE.Mesh(headGeo, matPlayer);
      const playerGroup = new THREE.Group();
      bodyMesh.position.set(0, 0.05, 0);
      headMesh.position.set(0, 0.13, 0);
      playerGroup.add(bodyMesh, headMesh);
      const offset = -0.4 + j * (0.8 / (jugadoresPorBarra - 1));
      playerGroup.position.set(pos.x, pos.y + 0.15, pos.z - 0.3 + i * 0.2 + offset);
      playerGroup.rotation.x = Math.PI / 2;
      scene.add(playerGroup);
      jugadores.push(playerGroup);
    }
  }
}

// Detect hand gestures
function handleHands(frame) {
  const session = renderer.xr.getSession();
  pinchLeft = pinchRight = false;
  for (const src of session.inputSources) {
    if (!src.hand) continue;
    const thumb = frame.getJointPose(src.hand.get('thumb-tip'), localRef);
    const index = frame.getJointPose(src.hand.get('index-finger-tip'), localRef);
    if (thumb && index) {
      const d = thumb.transform.position.distanceTo(index.transform.position);
      if (d < PINCH_THRESHOLD) {
        kickPelota(src.handedness === 'left' ? -1 : 1);
      }
    }
  }
}

// Update physics and render
function render() {
  const delta = clock.getDelta();
  const fixedTimeStep = 1 / 60;
  const maxSubSteps = 3;

  physicsWorld.step(fixedTimeStep, delta, maxSubSteps);

  pelotaMesh.position.copy(pelotaBody.position);
  pelotaMesh.quaternion.copy(pelotaBody.quaternion);

  renderer.render(scene, camera);
}

// Simulate ball kick
function kickPelota(dir) {
  const impulse = new CANNON.Vec3(dir * 0.2, 0, 0);
  pelotaBody.applyImpulse(impulse, pelotaBody.position);
  kickSound.play();

  // Simple goal detection
  if (Math.abs(pelotaBody.position.x) > 0.6) {
    goalSound.play();
    pelotaBody.position.set(0, 0.1, 0);
    pelotaBody.velocity.set(0, 0, 0);
  }
}
