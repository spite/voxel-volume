import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Mesh,
  BoxBufferGeometry,
  MeshNormalMaterial,
  DataTexture3D,
  RedFormat,
  RGBAFormat,
  HalfFloatType,
  FloatType,
  RawShaderMaterial,
  LinearFilter,
  LinearMipMapLinearFilter,
  DoubleSide,
  Vector3,
  Matrix4,
  IcosahedronBufferGeometry,
  UnsignedByteType,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";
import { perlin3 } from "../third_party/perlin.js";
import { voxelise } from "./voxel.js";

const renderer = new WebGLRenderer({
  preserveDrawingBuffer: false,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0, 0);
document.body.append(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(75, 1, 0.1, 100);

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;

const vertexShader = `#version 300 es
in vec3 position;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPos;

out vec3 vPosition;
out vec3 vOrigin;
out vec3 vDirection;

void main() {
  vPosition = position;
  vec4 worldPosition = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * worldPosition;

  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPos, 1.)).xyz;
  vDirection = position - vOrigin;
}
`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp sampler3D;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 vPosition;
in vec3 vOrigin;
in vec3 vDirection;

out vec4 color;

uniform sampler3D map;

vec2 hitBox(vec3 orig, vec3 dir) {
	const vec3 box_min = vec3(-.5);
	const vec3 box_max = vec3(.5);
	vec3 inv_dir = 1.0 / dir;
	vec3 tmin_tmp = (box_min - orig) * inv_dir;
	vec3 tmax_tmp = (box_max - orig) * inv_dir;
	vec3 tmin = min(tmin_tmp, tmax_tmp);
	vec3 tmax = max(tmin_tmp, tmax_tmp);
	float t0 = max(tmin.x, max(tmin.y, tmin.z));
	float t1 = min(tmax.x, min(tmax.y, tmax.z));
	return vec2(t0, t1);
}

void main(){

  vec3 rayDir = normalize(vDirection);
	vec2 bounds = hitBox(vOrigin, rayDir);
	if (bounds.x > bounds.y) {
    discard;
  }
  bounds.x = max(bounds.x, 0.);

  vec3 p = vOrigin + bounds.x * rayDir;
  vec3 inc = 1.0 / abs(rayDir);
	float delta = min(inc.x, min(inc.y, inc.z));
  delta /= 100.; // steps

	for (float t = bounds.x; t < bounds.y; t += delta) {

    vec4 val = texture(map, p + vec3(.5));
    if(val.r > .5 ) {
      //color.rgb += (1. - color.a) * val * (.5 + p );
      //color.a += (1.-color.a) * val;
      color.rgb = .5+p;
      //color.rgb = .5 + .5 * (val.gba);
      color.a = 1.;
      // vec4 depth = (projectionMatrix * modelViewMatrix * vec4(p, 1.));
      // gl_FragDepth = depth.z;
      break;
      //color.rgb += val /1.;
      //color.a = 1.;
    }

		if (color.a >= 0.95) {
			break;
		}

    p += rayDir * delta;
  }

  // color = vec4(.5 + .5 * rayDir, 1.);
  // color = vec4(bounds.y - bounds.x, 0. ,0., 1.);
  // color = vec4(p, 1.);
 // color = vec4(vec3(v),v);
  //color = vec4(bounds,0.,1.);
 // color = vec4(rayDir, 1.);
  return;

  vec4 t =  texture(map, vPosition);
  if(t.r>.5) {
    color = vec4(1.);
  } else{
    discard;
  }
  //color = vec4(vDirection, 1.);
}
`;

const width = 64;
const height = 64;
const depth = 64;

let mesh;

function generatePerlin() {
  const data = new Float32Array(width * height * depth);
  let ptr = 0;
  const s = 0.1;
  const ox = Math.random();
  const oy = Math.random();
  const oz = Math.random();

  const v = new Vector3();
  const c = new Vector3(width, height, depth).multiplyScalar(0.5);
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // v.set(x, y, z);
        // v.sub(c);
        // const d = 100; // v.length();
        // if (d > 0.5 * width) {
        //   data[ptr] = 0;
        // } else {
        //   data[ptr] = 0.5 + 0.5 * perlin3(ox + s * x, oy + s * y, oz + s * z);
        // }
        data[ptr] = 0.5 + 0.5 * perlin3(ox + s * x, oy + s * y, oz + s * z);
        ptr++;
      }
    }
  }
  return data;
}

async function init() {
  // const data = await voxelise(64);
  const data = generatePerlin();

  // let ptr = 0;
  // const normMat = new MeshNormalMaterial();
  // const geo = new BoxBufferGeometry(0.5, 0.5, 0.5);
  // const geo2 = new BoxBufferGeometry(0.25, 0.25, 0.25);
  // for (let z = 0; z < depth; z++) {
  //   for (let y = 0; y < height; y++) {
  //     for (let x = 0; x < width; x++) {
  //       if (data[ptr] !== 0) {
  //         const mesh = new Mesh(geo, normMat);
  //         mesh.position.set(x - 0.5 * width, y - 0.5 * height, z - 0.5 * depth);
  //         scene.add(mesh);
  //       }
  //       ptr++;
  //     }
  //   }
  // }

  const bbox = new Mesh(
    new BoxBufferGeometry(1, 1, 1),
    new MeshNormalMaterial({ wireframe: true })
  );
  scene.add(bbox);

  const texture = new DataTexture3D(data, width, height, depth);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.minFilter = LinearMipMapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  // texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geo = new BoxBufferGeometry(1, 1, 1);
  const mat = new RawShaderMaterial({
    uniforms: {
      map: { value: texture },
      cameraPos: { value: new Vector3() },
    },
    vertexShader,
    fragmentShader,
    // depthTest: false,
    // depthWrite: false,
    transparent: true,
    //side: DoubleSide,
  });
  for ( let i = 0; i < 100; i ++ ) {
    mesh = new Mesh(geo, mat);
    mesh.position.x = Math.random() * 4 - 2;
    mesh.position.y = Math.random() * 4 - 2;
    mesh.position.z = Math.random() * 4 - 2;
    mesh.rotation.x = Math.random() * Math.PI * 2;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    scene.add(mesh);
  }

  camera.position.set(3, 3, 3);
  camera.lookAt(mesh);

  render();
}

function resize() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  renderer.setSize(w, h);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const invCamera = new Matrix4();

function render() {
  requestAnimationFrame(render);

  mesh.material.uniforms.cameraPos.value
    .copy(camera.position);

  renderer.render(scene, camera);
}

window.addEventListener("resize", resize);

resize();
init();
