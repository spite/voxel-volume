import { ShaderPingPongPass } from "../third_party/ShaderPingPongPass.js";
import {
  RawShaderMaterial,
  RGBAFormat,
  FloatType,
  Vector2,
  TextureLoader,
  LinearMipMapLinearFilter,
  LinearFilter,
} from "../third_party/three.module.js";

const vertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

uniform vec2 resolution;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. );
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform sampler2D map;
uniform sampler2D modulate;
uniform vec2 resolution;
uniform vec2 pointer;

out vec4 color;
in vec2 vUv;

void main() {

    vec2 step = 1./resolution;
    vec2 uv = texture(map, vUv).xy;
    vec2 uv0 = texture(map, vUv+vec2(-step.x, 0.0)).xy;
    vec2 uv1 = texture(map, vUv+vec2(step.x, 0.0)).xy;
    vec2 uv2 = texture(map, vUv+vec2(0.0, -step.y)).xy;
    vec2 uv3 = texture(map, vUv+vec2(0.0, step.y)).xy;

    float feed = .037;
    float kill = .06;
    float delta = 1.;
    float da = 0.2097;
    float db = 0.105;

    // feed = .029;
    // kill = .057;

    // feed = .014;
    // kill = .045;

    // da = 0.16;
    // db = 0.08;
    // feed = 0.060;
    // kill = 0.062;

    da = 0.16;
    db = 0.08;
    feed = 0.035;
    kill = 0.060;

    // feed = .025;
    // kill = .06;

    // da = .1;
    // db= .05;
    // delta = 1.;
    // feed = .055;
    // kill = .062;

    // vec4 m = texture(modulate, vUv);
    // // feed = mix(.025, .035, m.r);
    // // kill = mix(.055, .070, m.r);
    // float d = .01;
    // feed = mix(.027, .037, m.r);
    // float d2 = .005;
    // kill = mix(.06, .062, m.r);
    
    vec2 lapl = (uv0 + uv1 + uv2 + uv3 - 4.0*uv);
    float a = uv.x;
    float b = uv.y;
    float reaction = a*b*b;
    float du = da * lapl.x - reaction + feed*(1.0 - a);
    float dv = db * lapl.y + reaction - (feed+kill)*b;
    vec2 dst = uv + delta*vec2(du, dv);

    color = vec4(dst, 0., 1.);
    if(pointer.x>0. && pointer.y> 0. && length(vUv-pointer)<.01) {
        color = vec4(0.,.9,0.,1.);
    }
}`;

const loader = new TextureLoader();
const modulate = loader.load("../assets/jeepster_skinmat2.jpg");

class ScottGray2D {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    this.pointer = new Vector2(0, 0);

    const shader = new RawShaderMaterial({
      uniforms: {
        map: { value: null },
        modulate: { value: modulate },
        resolution: { value: new Vector2(width, height) },
        pointer: { value: this.pointer },
      },
      vertexShader,
      fragmentShader,
    });
    this.simulation = new ShaderPingPongPass(renderer, shader, {
      format: RGBAFormat,
      type: FloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    this.simulation.setSize(width, height);
  }

  step() {
    this.simulation.shader.uniforms.map.value = this.simulation.fbos[
      this.simulation.currentFBO
    ];
    this.simulation.render();
  }
}

export { ScottGray2D };
