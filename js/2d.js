import { ScottGray2D } from "./scott-gray-2d.js";
import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Raycaster,
  Vector2,
  Mesh,
  PlaneBufferGeometry,
  RawShaderMaterial,
  DoubleSide,
  TextureLoader,
  Vector3,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";
import { ShaderPass } from "../third_party/ShaderPass.js";
import { shader as orthoVertexShader } from "../shaders/ortho-vs.js";
import { shader as blurFragmentShader } from "../shaders/blur-fs.js";

const vertexShader = `#version 300 es

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPosition = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * worldPosition;
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform sampler2D map;
uniform sampler2D matCap;

in vec2 vUv;
out vec4 color;

float sampleMap(vec2 uv) {
  vec4 c = texture(map, uv);
  return c.r;
}

vec4 bump(vec2 uv) {
  vec2 inc = vec2(1.) / 2048.;
  float dx = sampleMap(uv+vec2(inc.x,0.)) - sampleMap(uv+vec2(-inc.x,0.)) ;
  float dy = sampleMap(uv+vec2(0.,inc.y)) - sampleMap(uv+vec2(0.,-inc.y)) ;
  vec2 normal = 4.*(vec2(dx,dy));
  vec2 n = .5 + .5 * normal;
  n = clamp(n, vec2(0.), vec2(1.));
  vec4 c = texture(matCap, n);
  return c;
}

vec4 height(vec2 uv) {
  float h = sampleMap(uv);
  h = smoothstep(.45, .55, h);
  return vec4(h,h,h,1.);
}

void main(){
    color = bump(vUv);
    //color = texture(map, vUv);
    float border = 2./512.;
    if (vUv.x < border || vUv.x > 1.-border ||
        vUv.y < border || vUv.y > 1.-border) {
            color.r = 1.;
        }
}`;

const renderer = new WebGLRenderer();
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(2, 2, 2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;

const scottGray = new ScottGray2D(renderer, 1024, 1024);

const loader = new TextureLoader();
const matCap = loader.load("../assets/matball01.jpg");

const geo = new PlaneBufferGeometry(1, 1);
const mat = new RawShaderMaterial({
  uniforms: {
    map: { value: scottGray.simulation.fbos[0].texture },
    matCap: { value: matCap },
  },
  vertexShader,
  fragmentShader,
  side: DoubleSide,
});
const quad = new Mesh(geo, mat);
scene.add(quad);

camera.lookAt(quad.position);

const raycaster = new Raycaster();
const mouse = new Vector2();

const blitFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D map;
uniform sampler2D matCap;

in vec2 vUv;
out vec4 color;

float sampleMap(vec2 uv) {
  vec4 c = texture(map, uv);
  float v = abs(c.r - c.b);
  //v = smoothstep(.45, .55, v);
  return v;// smoothstep(.45, .55, v);
}

vec4 height(vec2 uv) {
  float h = sampleMap(uv);
  h = smoothstep(.45, .55, h);
  return vec4(h,h,h,1.);
}

void main(){
  color = height(vUv);
}
`;

const blitShader = new RawShaderMaterial({
  uniforms: {
    inputTexture: { value: scottGray.texture },
  },
  vertexShader: orthoVertexShader,
  fragmentShader: blitFragmentShader,
});
const blitPass = new ShaderPass(renderer, blitShader);
blitPass.setSize(scottGray.width, scottGray.height);

const blurShader = new RawShaderMaterial({
  uniforms: {
    inputTexture: { value: blitPass.fbo.texture },
    direction: { value: new Vector2(0, 0) },
  },
  vertexShader: orthoVertexShader,
  fragmentShader: blurFragmentShader,
});
const blurPassH = new ShaderPass(renderer, blurShader);
blurPassH.setSize(scottGray.width, scottGray.height);
const blurPassV = new ShaderPass(renderer, blurShader);
blurPassV.setSize(scottGray.width, scottGray.height);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
window.addEventListener("mousemove", onMouseMove, false);

function render() {
  requestAnimationFrame(render);
  const steps = 10;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(quad);
  if (intersects.length) {
    scottGray.pointer.copy(intersects[0].uv);
  } else {
    scottGray.pointer.set(-1, -1);
  }

  for (let j = 0; j < steps; j++) {
    // const a = 0.001 * performance.now();
    // const a2 = 0.0005 * performance.now();
    // const r = 10 + 240 * (0.5 + 0.5 * Math.cos(a2));
    //scottGray.pointer.x = 256 + r * Math.cos(a);
    //scottGray.pointer.y = 256 + r * Math.sin(a);
    scottGray.step();
  }
  blitPass.render();
  const delta = 1;
  blurPassH.shader.uniforms.inputTexture.value = blitPass.fbo.texture;
  for (let j = 0; j < 1; j++) {
    blurPassH.shader.uniforms.direction.value.set(delta, 0);
    blurPassH.render();
    blurPassV.shader.uniforms.inputTexture.value = blurPassH.fbo.texture;
    blurPassV.shader.uniforms.direction.value.set(0, delta);
    blurPassV.render();
    blurPassH.shader.uniforms.inputTexture.value = blurPassV.fbo.texture;
  }

  mat.uniforms.map.value = blurPassV.fbo.texture;

  renderer.render(scene, camera);
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

resize();
window.addEventListener("resize", resize);

render();
