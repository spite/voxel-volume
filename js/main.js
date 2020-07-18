import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Mesh,
  BoxBufferGeometry,
  MeshNormalMaterial,
  DataTexture3D,
  RedFormat,
  RGBFormat,
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
  Clock,
  BackSide,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";
import { FirstPersonControls } from "../third_party/FirstPersonControls.js";
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
camera.position.set(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
// const controls = new FirstPersonControls(camera, renderer.domElement);
// controls.lookSpeed = 0.05;
const clock = new Clock();

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
  vec4 worldPosition = modelViewMatrix * vec4(position, 1.);

  vPosition = position;
  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPos, 1.)).xyz;
  vDirection = position - vOrigin;

  gl_Position = projectionMatrix * worldPosition;
}
`;

const fragmentShader_ = `#version 300 es
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
      vec4 depth = (projectionMatrix * modelViewMatrix * vec4(p , 1.));
      gl_FragDepth = ((depth.z/depth.w)+1.)/2.;
      break;
      //color.rgb += val /1.;
      //color.a = 1.;
    }

    if (color.a >= 0.95) {
      break;
    }

    p += rayDir * delta;
  }

  if(color.a == 0.) {
    discard;
  }

  // color.rgb = vec3(gl_FragDepth);
  // color = vec4(.5 + .5 * rayDir, 1.);
  // color = vec4(bounds.y - bounds.x, 0. ,0., 1.);
  // color = vec4(p, 1.);
  // color = vec4(vec3(v),v);
  // color = vec4(bounds,0.,1.);
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

const fragmentShader = `#version 300 es
precision highp float;
precision highp sampler3D;

// #define WRITE_DEPTH

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 vPosition;
in vec3 vOrigin;
in vec3 vDirection;

out vec4 color;

uniform sampler3D map;
uniform sampler3D normalMap;
uniform float time;

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

float sample1( vec3 p ) {
  return texture( map, p ).r;
}

vec3 sample2( vec3 p ) {
  return texture( normalMap, p ).rgb;
}

/*
float sphere( vec3 p, float r ) {
  return length( p ) - r;
}

float distort( vec3 p, float a ) {
  return min( 0.02, sin( p.x * a ) + sin( p.y * a ) + sin( p.z * a ) );
}

float w( vec3 p ) {
  return max( sphere( p, 0.5 ), distort( p * 6.0 + time * 0.5, 3.0 ) );
}

vec3 wn(vec3 p) {
  vec2 e = vec2( .001, 0. );
  return normalize(vec3(
    w( p + e.xyy ) - w( p - e.xyy ),
    w( p + e.yxy ) - w( p - e.yxy ),
    w( p + e.yyx ) - w( p - e.yyx )
  ) );
}
*/

#define epsilon .0001

vec3 normal( vec3 coord ) {

  if(coord.x < epsilon){
    return vec3(1.,0.,0.);
  }
  if(coord.x > 1.- epsilon){
    return vec3(-1.,0.,0.);
  }
  if(coord.y < epsilon){
    return vec3(0.,1.,0.);
  }
  if(coord.y > 1.- epsilon){
    return vec3(0.,-1.,0.);
  }
  if(coord.z < epsilon){
    return vec3(0.,0.,1.);
  }
  if(coord.z > 1.- epsilon){
    return vec3(0.,0.,-1.);
  }

  float step = 0.01;
  float x = sample1( coord + vec3( -step, 0.0, 0.0 ) ) - sample1( coord + vec3( +step, 0.0, 0.0 ) );
  float y = sample1( coord + vec3( 0.0, -step, 0.0 ) ) - sample1( coord + vec3( 0.0, +step, 0.0 ) );
  float z = sample1( coord + vec3( 0.0, 0.0, -step ) ) - sample1( coord + vec3( 0.0, 0.0, +step ) );

  return normalize( vec3( x, y, z ) );

}

void main(){

  vec3 rayDir = normalize(vDirection);
  vec2 bounds = hitBox(vOrigin, rayDir);
  if (bounds.x > bounds.y) discard;
  bounds.x = max(bounds.x, 0.);

  vec3 p = vOrigin + bounds.x * rayDir;
  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= 200.; // steps

  /*
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = w(p);
    if ( d < 0.05 ) {
      color.rgb = p * 2.0 + 0.5;
      color.a = 1.;
      break;
    }
    p += rayDir * d;
  }
  */

  #ifdef ACCUMULATE
  vec4 ac = vec4(0.,0.,0.,0.);
    
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = sample1(p + .5);
    float l = smoothstep(.3, .6, 1.-length(p));
    d *=l;
    d = smoothstep(.45, .55, d) / 50.;
    vec3 col = normal(p + .5) * 0.5 + ( p * 2.0 + 0.25 );
    ac.rgb += (1.0 - ac.a) * d * col;
    ac.a += (1.0 - ac.a) * d;
    if(ac.a>=.95){
      break;
    }
    p += rayDir * delta;
  }

  color = ac;
  return;
 #endif

  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = sample1(p + .5);
    if ( d > 0.6 ) {
      // color.rgb = p * 2.0 + 0.5;
      color.rgb = normal(p + .5) * 0.5 + ( p * 2.0 + 0.25 );
      #ifdef WRITE_DEPTH
        vec4 depth = (projectionMatrix * modelViewMatrix * vec4(p , 1.));
        gl_FragDepth = ((depth.z/depth.w)+1.)/2.;
      #endif
      // color.rgb += p * 0.01 + 0.01; // disable break
      color.a = 1.;
      break;
    }
    p += rayDir * delta;
  }

  if ( color.a == 0. ) discard;

}
`;

const size = 128;
const width = size;
const height = size;
const depth = size;
const data = new Float32Array(width * height * depth);
// const data2 = new Float32Array(width * height * depth * 3);

let mesh;

function perlin(x, y, z) {
  return 0.5 + 0.5 * perlin3(x, y, z);
}

const normal = new Vector3();

function perlinNormal(x, y, z) {
  const step = 0.001;
  normal.x = perlin(x - step, y, z) - perlin(x + step, y, z);
  normal.y = perlin(x, y - step, z) - perlin(x, y + step, z);
  normal.z = perlin(x, y, z - step) - perlin(x, y, z + step);

  normal.normalize();
  return normal;
}

function generatePerlin(data, ox, oy, oz) {
  let ptr = 0;
  const s = 0.05;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[ptr] = perlin(ox + s * x, oy + s * y, oz + s * z);
        /*
        perlinNormal(ox + s * x, oy + s * y, oz + s * z);
        data2[ptr*3+0] = normal.x;
        data2[ptr*3+1] = normal.y;
        data2[ptr*3+2] = normal.z;
        */
        ptr++;
      }
    }
  }
}

function generateSphere(data) {
  let ptr = 0;

  const v = new Vector3();
  const c = new Vector3(width, height, depth).multiplyScalar(0.5);
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        v.set(x, y, z);
        v.sub(c);
        const d = v.length();
        if (d > 0.5 * width) {
          data[ptr] = 0;
        } else {
          data[ptr] = 1;
        }
        ptr++;
      }
    }
  }
}

async function init() {
  // await voxelise(data, size);
  generatePerlin(data, 0, 0, 0);
  // generateSphere();

  const texture = new DataTexture3D(data, width, height, depth);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;

  /*
  const texture2 = new DataTexture3D(data2, width, height, depth);
  texture2.format = RGBFormat;
  texture2.type = FloatType;
  texture2.minFilter = LinearFilter;
  texture2.magFilter = LinearFilter;
  */

  const geo = new BoxBufferGeometry(1, 1, 1);
  const mat = new RawShaderMaterial({
    uniforms: {
      map: { value: texture },
      // normalMap: { value: texture2 },
      cameraPos: { value: new Vector3() },
      time: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    side: BackSide,
  });

  mesh = new Mesh(geo, mat);
  scene.add(mesh);

  /*
  const bbox = new Mesh(
    new BoxBufferGeometry(1, 1, 1),
    new MeshNormalMaterial({ wireframe: true })
  );
  scene.add(bbox);
  */

  /*
  for (let i = 0; i < 50; i++) {
    mesh = new Mesh(geo, mat);
    mesh.position.x = Math.random() * 4 - 2;
    mesh.position.y = Math.random() * 4 - 2;
    mesh.position.z = Math.random() * 4 - 2;
    mesh.rotation.x = Math.random() * Math.PI * 2;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.scale.setScalar( Math.random() + 0.5 );
    scene.add(mesh);

    const bbox = new Mesh(
      new BoxBufferGeometry(1, 1, 1),
      new MeshNormalMaterial({ wireframe: true })
    );
    bbox.position.copy(mesh.position);
    bbox.rotation.copy(mesh.rotation);
    bbox.scale.copy(mesh.scale);
    // scene.add(bbox);
  }
  */

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

  const time = performance.now() / 5000;

  // generatePerlin(data, time, time, time);

  // mesh.material.uniforms.map.value.needsUpdate = true;
  mesh.material.uniforms.cameraPos.value.copy(camera.position);
  mesh.material.uniforms.time.value = time;

  controls.update(clock.getDelta()); // Hide this delta stuff
  renderer.render(scene, camera);
}

window.addEventListener("resize", resize);

resize();
init();
