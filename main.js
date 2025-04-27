import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import * as CANNON from 'cannon-es';

let camera, scene, renderer;
let controller, reticle, localRef;
let physicsWorld;
let pelotaMesh, pelotaBody;
const barras = [], jugadores = [];
const mixers = [], clock = new THREE.Clock();

// Gesto y física
let pinchLeft=false, pinchRight=false;
const PINCH_THRESHOLD = 0.03;

// Sonidos (opcional)
const kickSound = new Audio('assets/kick.mp3');
const goalSound = new Audio('assets/goal.mp3');

init();
animate();

async function init() {
  // Escena y cámara
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);

  // Renderer con AR habilitado
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Botón AR solicitando hit-test y hand-tracking
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test','hand-tracking']
    })
  ); :contentReference[oaicite:7]{index=7}

  // Luz
  scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1));

  // Reticle (anillo) para colocar la mesa
  const ringGeo = new THREE.RingGeometry(0.05,0.06,32).rotateX(-Math.PI/2);
  reticle      = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ color:0x00ff00 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Mundo físico con cannon-es
  physicsWorld = new CANNON.World();
  physicsWorld.gravity.set(0,-9.82,0); :contentReference[oaicite:8]{index=8}

  // Pelota: cuerpo físico y mesh
  pelotaBody = new CANNON.Body({ mass:0.1, shape:new CANNON.Sphere(0.03) });
  pelotaBody.position.set(0,0.1,0);
  physicsWorld.addBody(pelotaBody);
  pelotaMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.03,16,16),
    new THREE.MeshStandardMaterial({ color:0xffffff })
  ); :contentReference[oaicite:9]{index=9}
  scene.add(pelotaMesh);

  // Control XR para select
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // Setup de hit-test y referencia local
  const session    = renderer.xr.getSession();
  const viewerRef  = await session.requestReferenceSpace('viewer');
  localRef         = await session.requestReferenceSpace('local');
  const hitTestSrc = await session.requestHitTestSource({ space:viewerRef });

  // Bucle principal AR + gesto de mano
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
      // Hand Tracking: pinch
      handleHands(frame); :contentReference[oaicite:10]{index=10}
    }
    render();
  });
}

// Al pulsar en el reticle, generamos toda la escena procedural
function onSelect() {
  if (!reticle.visible) return;

  // Mesa procedural
  const mesaGeo = new THREE.BoxGeometry(1.2, 0.1, 0.7); :contentReference[oaicite:11]{index=11}
  const mesaMat = new THREE.MeshStandardMaterial({ color:0x8B4513 });
  const mesaMesh= new THREE.Mesh(mesaGeo, mesaMat);
  mesaMesh.applyMatrix4(reticle.matrix);
  scene.add(mesaMesh);

  // Cuerpo físico de la mesa
  const mesaBody = new CANNON.Body({ mass:0 });
  mesaBody.addShape(new CANNON.Box(new CANNON.Vec3(0.6,0.05,0.35)));
  const pos = new THREE.Vector3(), quat=new THREE.Quaternion(), sc=new THREE.Vector3();
  reticle.matrix.decompose(pos,quat,sc);
  mesaBody.position.copy(pos);
  physicsWorld.addBody(mesaBody);

  // Barras y jugadores
  const numBarras = 4;
  for (let i=0; i<numBarras; i++) {
    // Barra procedural
    const barraGeo = new THREE.CylinderGeometry(0.02,0.02,1.2,16); :contentReference[oaicite:12]{index=12}
    const barraMat = new THREE.MeshStandardMaterial({ color:0x666666 });
    const barraMesh = new THREE.Mesh(barraGeo, barraMat);
    barraMesh.rotation.z = Math.PI/2;
    barraMesh.position.set(pos.x, pos.y+0.15, pos.z - 0.3 + i*0.2);
    scene.add(barraMesh);
    barras.push(barraMesh);

    // Jugadores en la barra
    const jugadoresPorBarra = (i===0||i===3)?3:5;
    for (let j=0; j<jugadoresPorBarra; j++) {
      const bodyGeo = new THREE.CylinderGeometry(0.015,0.015,0.1,12); :contentReference[oaicite:13]{index=13}
      const headGeo = new THREE.BoxGeometry(0.03,0.03,0.03); :contentReference[oaicite:14]{index=14}
      const matPlayer = new THREE.MeshStandardMaterial({ color: i<2?0x0000ff:0xff0000 });
      const bodyMesh = new THREE.Mesh(bodyGeo, matPlayer);
      const headMesh = new THREE.Mesh(headGeo, matPlayer);
      const playerGroup = new THREE.Group(); :contentReference[oaicite:15]{index=15}
      bodyMesh.position.set(0,0.05,0);
      headMesh.position.set(0,0.13,0);
      playerGroup.add(bodyMesh, headMesh);
      const offset = -0.4 + j*(0.8/(jugadoresPorBarra-1));
      playerGroup.position.set(pos.x, pos.y+0.15, pos.z - 0.3 + i*0.2 + offset);
      playerGroup.rotation.x = Math.PI/2;
      scene.add(playerGroup);
      jugadores.push(playerGroup);
    }
  }
}

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
        // Dispara patada
        kickPelota(src.handedness === 'left'? -1 : 1); :contentReference[oaicite:16]{index=16}
      }
    }
  }
}

function render() {
  const delta = clock.getDelta();
  physicsWorld.step(1/60);

  // Sincronizar pelota
  pelotaMesh.position.copy(pelotaBody.position);
  pelotaMesh.quaternion.copy(pelotaBody.quaternion);

  renderer.render(scene, camera);
}

function kickPelota(dir) {
  const impulse = new CANNON.Vec3(dir * 0.2, 0, 0);
  pelotaBody.applyImpulse(impulse, pelotaBody.position);
  kickSound.play();
  // Gol sencillo
  if (Math.abs(pelotaBody.position.x) > 0.6) {
    goalSound.play();
    pelotaBody.position.set(0,0.1,0);
    pelotaBody.velocity.set(0,0,0);
  }
}
