import { blur13 } from "./fast-separable-gaussian-blur.js";

const shader = `#version 300 es
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 direction;

in vec2 vUv;

out vec4 color;

${blur13}

void main() {
    vec2 resolution = vec2(textureSize(inputTexture, 0));
    color = blur13(inputTexture, vUv, resolution, direction);
}`;

export { shader };
