import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller;
let futbolin;
let pelota;
let mixer;
const clock = new THREE.Clock();
const soundKick = new Audio('assets/kick.mp3');
const soundGoal = new Audio('assets/goal.mp3');

init();
animate();

function init() {
  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  const loader = new GLTFLoader();
  loader.load('assets/futbolin.gltf', function(gltf) {
    futbolin = gltf.scene;
    futbolin.scale.set(0.5, 0.5, 0.5);
    futbolin.position.set(0, 0, -1);
    scene.add(futbolin);

    mixer = new THREE.AnimationMixer(futbolin);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });

    // Cargar la pelota
    const geometry = new THREE.SphereGeometry(0.03, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    pelota = new THREE.Mesh(geometry, material);
    pelota.position.set(0, 0.1, -1);
    scene.add(pelota);
  });

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);
}

function onSelect() {
  if (pelota) {
    pelota.position.y += 0.05;
    pelota.position.x += (Math.random() - 0.5) * 0.2;
    pelota.position.z += (Math.random() - 0.5) * 0.2;
    soundKick.play();
  }
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  
  if (pelota) {
    pelota.position.y -= 0.001;
    if (pelota.position.y < 0.02) {
      pelota.position.y = 0.02;
      soundGoal.play();
    }
  }

  renderer.render(scene, camera);
}
