import {
  Mesh,
  TorusKnotGeometry,
  Vector3,
  Raycaster,
  BoxGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Matrix4,
} from "../third_party/three.module.js";
import { GLTFLoader } from "../third_party/GLTFLoader.js";

async function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load("../assets/LeePerrySmith.glb", (gltf) => {
      resolve(gltf.scene.children[0]);
    });
  });
}

async function voxelise(size) {
  const obj = await loadModel();
  console.log("loaded");

  console.time("voxel");

  const material = new MeshBasicMaterial({ side: DoubleSide });
  //const mesh = new Mesh(new TorusKnotGeometry(10, 3, 100, 16), material);
  //const mesh = new Mesh(new TorusKnotGeometry(10, 3, 100, 16, 3, 1), material);
  const geo = obj.geometry;
  const scaleMat = new Matrix4().makeScale(4, 4, 4);
  geo.applyMatrix4(scaleMat);
  const mesh = new Mesh(geo, material);
  //mesh = new THREE.Mesh( new THREE.IcosahedronGeometry( 10, 2 ), material );

  var origin = new Vector3(0, 0, 0),
    direction = new Vector3(0, 0, 1);
  var raycaster = new Raycaster(origin, direction, 0, 100);

  mesh.geometry.computeBoundingBox();
  var bounds = mesh.geometry.boundingBox;
  console.log(bounds);

  var step = 40 / size;
  var intersections;
  var grid = new Array(size * size * size);
  var z;

  for (let j = 0; j < grid.length; j++) {
    grid[j] = { value: 0 };
  }

  function markGrid(x, y, z, normal) {
    var mx = Math.round(((x + 20) / 40) * size);
    var my = Math.round(((y + 20) / 40) * size);
    var mz = Math.round(((z + 20) / 40) * size);

    if (mx < 0 || mx >= size || my < 0 || my >= size || mz < 0 || mz >= size) {
      return;
    }

    grid[mx * size * size + my * size + mz] = {
      value: 1,
      normal,
      surface: true,
    };
  }

  console.log("tracing x");
  for (var y = -20; y < 20; y += step) {
    for (var x = -20; x < 20; x += step) {
      origin.set(x, y, -20);
      raycaster.set(origin, direction);
      intersections = raycaster.intersectObject(mesh, true);
      if (intersections.length) {
        for (var j = 0; j < intersections.length; j++) {
          markGrid(
            x,
            y,
            intersections[j].point.z,
            intersections[j].face.normal
          );
        }
      }
    }
  }

  console.log("tracing y");
  direction.set(0, 1, 0);
  for (var z = -20; z < 20; z += step) {
    for (var x = -20; x < 20; x += step) {
      origin.set(x, -20, z);
      raycaster.set(origin, direction);
      intersections = raycaster.intersectObject(mesh, true);
      if (intersections.length) {
        for (var j = 0; j < intersections.length; j++) {
          markGrid(
            x,
            intersections[j].point.y,
            z,
            intersections[j].face.normal
          );
        }
      }
    }
  }

  console.log("tracing z");
  direction.set(1, 0, 0);
  for (var z = -20; z < 20; z += step) {
    for (var y = -20; y < 20; y += step) {
      origin.set(-20, y, z);
      raycaster.set(origin, direction);
      intersections = raycaster.intersectObject(mesh, true);
      if (intersections.length) {
        for (var j = 0; j < intersections.length; j++) {
          markGrid(
            intersections[j].point.x,
            y,
            z,
            intersections[j].face.normal
          );
        }
      }
    }
  }

  function sampleGrid(x, y, z) {
    const ptr = x * size * size + y * size + z;
    return grid[ptr];
  }

  const n = new Vector3();
  function marchGrid(x0, y0, z0, dx, dy, dz) {
    n.set(dx, dy, dz);
    let x = x0;
    let y = y0;
    let z = z0;
    for (let t = 0; t < 100; t++) {
      x += dx;
      y += dy;
      z += dz;
      if (x < 0 || x >= size || y < 0 || y >= size || z < 0 || z >= size) {
        return 0;
      }
      const v = sampleGrid(x, y, z);
      if (v.surface === true && v.value !== 0) {
        if (n.dot(v.normal) > 0) {
          return 1;
        } else {
          return 0;
        }
      }
    }
    return 0;
  }

  function checkAround(x, y, z) {
    const v = sampleGrid(x, y, z);
    if (v.value !== 0) {
      return;
    }
    if (
      marchGrid(x, y, z, -1, 0, 0) !== 0 &&
      marchGrid(x, y, z, 1, 0, 0) !== 0 &&
      marchGrid(x, y, z, 0, -1, 0) !== 0 &&
      marchGrid(x, y, z, 0, 1, 0) !== 0 &&
      marchGrid(x, y, z, 0, 0, -1) !== 0 &&
      marchGrid(x, y, z, 0, 0, 1) !== 0
    ) {
      v.value = 1;
      v.interior = true;
    }
  }

  for (let z = 1; z < size - 2; z++) {
    for (let y = 1; y < size - 2; y++) {
      for (let x = 1; x < size - 2; x++) {
        checkAround(x, y, z);
      }
    }
  }

  console.log("expanding...");
  const depth = 1;
  const data = new Float32Array(grid.length * depth);
  for (let j = 0; j < grid.length; j++) {
    if (grid[j].interior || grid[j].surface) {
      if (depth === 4) {
        data[j * 4] = grid[j].value;
        if (grid[j].normal) {
          data[j * 4 + 1] = grid[j].normal.x;
          data[j * 4 + 2] = grid[j].normal.y;
          data[j * 4 + 3] = grid[j].normal.z;
        }
      } else {
        data[j] = grid[j].value;
      }
    }
  }
  console.log("done");
  console.timeEnd("voxel");

  return data;
}

export { voxelise };
