import { ShaderPingPongPass } from "../third_party/ShaderPingPongPass.js";
import {
  RawShaderMaterial,
  RGBAFormat,
  FloatType,
  Vector2,
  Vector3,
  DataTexture3D,
  RedFormat,
  LinearFilter,
  TextureLoader,
  Scene,
  PlaneBufferGeometry,
  OrthographicCamera,
  Mesh,
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

const fragmentShaderT = `#version 300 es
precision highp float;

out vec4 outColor[4];

void main() {
  outColor[0] = vec4(1.,0.,1.,1.);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform sampler2D map;
uniform sampler2D modulate;
uniform vec2 resolution;
uniform vec2 pointer;

out vec4 outColor[4];

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

    // da = 0.16;
    // db = 0.08;
    // feed = 0.035;
    // kill = 0.060;

    // feed = .025;
    // kill = .06;

    // da = .1;
    // db= .05;
    // delta = 1.;
    // feed = .055;
    // kill = .062;

    vec4 m = texture(modulate, vUv);
    // feed = mix(.025, .035, m.r);
    // kill = mix(.055, .070, m.r);
    float d = .01;
    feed = mix(.027, .037, m.r);
    float d2 = .005;
    kill = mix(.06, .062, m.r);
    
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

class ShaderPass3D {
  constructor(renderer, shader, width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;

    this.renderer = renderer;
    this.shader = shader;
    this.orthoScene = new Scene();

    this.orthoCamera = new OrthographicCamera(
      1 / -2,
      1 / 2,
      1 / 2,
      1 / -2,
      0.00001,
      1000
    );
    this.orthoQuad = new Mesh(new PlaneBufferGeometry(1, 1), this.shader);
    this.orthoQuad.scale.set(1, 1, 1);
    this.orthoScene.add(this.orthoQuad);

    this.setSize(width, height, depth);

    const gl = renderer.context;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.R32F,
      width,
      height,
      depth,
      0,
      gl.R32F,
      gl.FLOAT,
      0
    );
    // texture.format = RedFormat;
    // texture.type = FloatType;
    // texture.minFilter = LinearFilter;
    // texture.magFilter = LinearFilter;
    // texture.unpackAlignment = 1;

    const numAttachments = 4;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (let i = 0; i < numAttachments; ++i) {
      gl.framebufferTextureLayer(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        texture,
        0,
        i
      );
    }

    gl.drawBuffers([
      gl.COLOR_ATTACHMENT0,
      gl.COLOR_ATTACHMENT1,
      gl.COLOR_ATTACHMENT2,
      gl.COLOR_ATTACHMENT3,
    ]);
  }

  render() {
    this.renderer.render(this.orthoScene, this.orthoCamera);
  }

  setSize(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.orthoQuad.scale.set(width, height, 1);

    this.orthoCamera.left = -width / 2;
    this.orthoCamera.right = width / 2;
    this.orthoCamera.top = height / 2;
    this.orthoCamera.bottom = -height / 2;
    this.orthoCamera.updateProjectionMatrix();
  }
}

class ScottGray3D {
  constructor(renderer, width, height, depth) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.depth = depth;

    this.pointer = new Vector3(0, 0, 0);

    const shader = new RawShaderMaterial({
      uniforms: {
        map: { value: null },
        resolution: { value: new Vector3(width, height, depth) },
        pointer: { value: this.pointer },
      },
      vertexShader,
      fragmentShader: fragmentShaderT,
    });

    this.pass = new ShaderPass3D(renderer, shader);
    this.pass.setSize(width, height, depth);
    this.texture = this.pass.texture;

    this.pass.render();
  }

  step() {}
}

export { ScottGray3D };
