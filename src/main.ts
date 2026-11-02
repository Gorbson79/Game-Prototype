import * as THREE from 'three';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x3a8f3a }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 0.6));

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// Player
const PLAYER_RADIUS = 0.5;
const PLAYER_LENGTH = 1;
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_LENGTH, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0x2f6fd6 }),
);
player.position.y = PLAYER_RADIUS + PLAYER_LENGTH / 2;
player.castShadow = true;
scene.add(player);

// Camera: fixed MOBA-style angle, looking down at the player from behind and above
const CAMERA_OFFSET = new THREE.Vector3(0, 14, 9);
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);

function updateCamera() {
  camera.position.copy(player.position).add(CAMERA_OFFSET);
  camera.lookAt(player.position);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  updateCamera();
  renderer.render(scene, camera);
});
