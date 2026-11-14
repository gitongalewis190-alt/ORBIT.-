// Draws each medal to a PNG so the PDF can show it exactly as it appears in the app.
// Each medal is drawn twice: the front, then the engraved back.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMedalGroup } from './medalScene';

// items: [{ key, tier, emblem, name, dateLabel, locked }]
// returns: [{ key, front, back }] where front and back are PNG data URLs.
// Renders in batches and yields to the page between them, so the screen stays responsive.
// onProgress(done, total) is called after each batch and once more at the end.
export async function renderMedalImages(items, size = 512, { batchSize = 4, onProgress } = {}) {
  if (typeof document === 'undefined') throw new Error('Medal pictures need a browser.');
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const out = [];
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const scene = new THREE.Scene();
      scene.environment = environment;
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 4, 6);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 0.05, 5.8);
      camera.lookAt(0, -0.05, 0);

      const built = buildMedalGroup(item);
      built.group.position.y = -0.1;
      scene.add(built.group);

      renderer.clear();
      renderer.render(scene, camera);
      const front = canvas.toDataURL('image/png');

      built.group.rotation.y = Math.PI;
      renderer.clear();
      renderer.render(scene, camera);
      const back = canvas.toDataURL('image/png');

      out.push({ key: item.key, front, back });
      built.dispose();
      if (onProgress && ((i + 1) % batchSize === 0 || i + 1 === items.length)) {
        onProgress(i + 1, items.length);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } finally {
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return out;
}
