import {
  AmbientLight,
  AxesHelper,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Raycaster,
  Vector2,
  MeshLambertMaterial,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

//Creates the Three.js scene
const scene = new Scene();

//Object to store the size of the viewport
const size = {
  width: window.innerWidth,
  height: window.innerHeight,
};

//Creates the camera (point of view of the user)
const aspect = size.width / size.height;
const camera = new PerspectiveCamera(75, aspect);
camera.position.z = 15;
camera.position.y = 13;
camera.position.x = 8;

//Creates the lights of the scene
const lightColor = 0xffffff;

const ambientLight = new AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(lightColor, 1);
directionalLight.position.set(0, 10, 0);
directionalLight.target.position.set(-5, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

//Sets up the renderer, fetching the canvas of the HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new WebGLRenderer({
  canvas: threeCanvas,
  alpha: true,
});

renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//Creates grids and axes in the scene
const grid = new GridHelper(50, 30);
scene.add(grid);

const axes = new AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 1;
scene.add(axes);

//Creates the orbit controls (to navigate the scene)
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
controls.target.set(-2, 0, 0);

// Creates subset material
const preselectMat = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff88ff,
  depthTest: false,
});

const selectMat = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff00ff,
  depthTest: false,
});

// Sets up the IFC loading
const ifcModels = [];
const ifcLoader = new IFCLoader();
const ifc = ifcLoader.ifcManager;

// Reference to the previous selection
const preselectModel = { id: -1 };
const selectModel = { id: -1 };

// Sets up optimized picking
ifc.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);

const output = document.getElementById("output");

function handleIfcModel(ifcModel) {
  ifc.removeSubset(preselectModel.id, preselectMat);
  ifc.removeSubset(selectModel.id, selectMat);
  
  output.innerHTML = null;

  scene.remove(ifcModels.pop());

  ifcModels.push(ifcModel);
  scene.add(ifcModel);
}

// Sets up raycaster
const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

function cast(event) {
  // Computes the position of the mouse on the screen
  const bounds = threeCanvas.getBoundingClientRect();

  const x1 = event.clientX - bounds.left;
  const x2 = bounds.right - bounds.left;
  mouse.x = (x1 / x2) * 2 - 1;

  const y1 = event.clientY - bounds.top;
  const y2 = bounds.bottom - bounds.top;
  mouse.y = -(y1 / y2) * 2 + 1;

  // Places it on the camera pointing to the mouse
  raycaster.setFromCamera(mouse, camera);

  // Casts a ray
  return raycaster.intersectObjects(ifcModels);
}

async function pick(intersection) {
  const index = intersection.faceIndex;
  const geometry = intersection.object.geometry;
  const id = ifc.getExpressId(geometry, index);
  const modelID = intersection.object.modelID;
  const props = await ifc.getItemProperties(modelID, id);
  output.innerHTML = JSON.stringify(props, null, 2);
}

function highlight(intersection, material, model) {
  // Gets model ID
  model.id = intersection.object.modelID;

  // Gets Express ID
  const index = intersection.faceIndex;
  const geometry = intersection.object.geometry;
  const id = ifc.getExpressId(geometry, index);

  // Creates subset
  ifc.createSubset({
    modelID: model.id,
    ids: [id],
    material,
    scene,
    removePrevious: true,
  });
}

function handleDblClick(event, material, model) {
  const found = cast(event)[0];
  if (found) {
    pick(found);
    highlight(found, material, model);
  } else {
    ifc.removeSubset(model.id, material);
    output.innerHTML = null;
  }
}

function handleMouseMove(event, material, model) {
  const found = cast(event)[0];

  if (found) {
    highlight(found, material, model);
  } else {
    // Removes previous highlight
    ifc.removeSubset(model.id, material);
  }
}

threeCanvas.ondblclick = (event) =>
  handleDblClick(event, selectMat, selectModel);

window.onmousemove = (event) =>
  handleMouseMove(event, preselectMat, preselectModel);

const input = document.getElementById("file-input");
input.addEventListener(
  "change",
  (changed) => {
    const file = changed.target.files[0];
    var ifcURL = URL.createObjectURL(file);
    ifcLoader.load(ifcURL, (ifcModel) => handleIfcModel(ifcModel));
  },
  false
);

//Animation loop
const animate = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

//Adjust the viewport to the size of the browser
window.addEventListener("resize", () => {
  size.width = window.innerWidth;
  size.height = window.innerHeight;
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
});
