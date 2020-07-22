import { perlin3 } from "../third_party/perlin.js";

function perlin(x, y, z) {
  return 0.5 + 0.5 * perlin3(x, y, z);
}

class ScottGray {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.initialise();
    this.randomise();

    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    document.body.append(this.canvas);
    this.canvas.style.position = "absolute";
    this.context = this.canvas.getContext("2d");
  }

  initialise() {
    const size = this.width * this.height;
    const a1 = new Float32Array(size);
    const a2 = new Float32Array(size);
    const b1 = new Float32Array(size);
    const b2 = new Float32Array(size);
    this.chemicalA = [a1, a2];
    this.chemicalB = [b1, b2];
    this.current = 0;
  }

  randomise() {
    const s = 0.05;
    const a = this.chemicalA[this.current];
    const b = this.chemicalB[this.current];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.write([a, b], x, y, [0, 0]);
      }
    }
  }

  read(buffers, x, y) {
    x = (x + this.width) % this.width;
    y = (y + this.height) % this.height;
    const ptr = y * this.width + x;
    return [buffers[0][ptr], buffers[1][ptr]];
  }

  write(buffers, x, y, values) {
    x = (x + this.width) % this.width;
    y = (y + this.height) % this.height;
    const ptr = y * this.width + x;
    buffers[0][ptr] = values[0];
    buffers[1][ptr] = values[1];
  }

  laplacian(srcs, x, y) {
    const b = this.read(srcs, x, y);
    const p0 = this.read(srcs, x - 1, y);
    const p1 = this.read(srcs, x + 1, y);
    const p2 = this.read(srcs, x, y - 1);
    const p3 = this.read(srcs, x, y + 1);

    const res = [];
    res[0] = -4 * b[0] + p0[0] + p1[0] + p2[0] + p3[0];
    res[1] = -4 * b[1] + p0[1] + p1[1] + p2[1] + p3[1];

    return res;
  }

  step() {
    const dA = 0.16; // diffusion rate for a
    const dB = 0.08; // diffusion rate for b
    const dt = 1;
    const f = 0.035; // feed
    const k = 0.06; // kill

    const srcs = [this.chemicalA[this.current], this.chemicalB[this.current]];
    const dsts = [
      this.chemicalA[1 - this.current],
      this.chemicalB[1 - this.current],
    ];
    const a = 0.0001 * performance.now();
    const r = 0.5 * this.width;
    const px = r + 0.8 * r * Math.cos(a);
    const py = r + 0.8 * r * Math.sin(a);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const [laplacianA, laplacianB] = this.laplacian(srcs, x, y);
        const [a, b] = this.read(srcs, x, y);
        const res = [];
        const reaction = a * b * b;
        res[0] = a + dt * (dA * laplacianA - reaction + f * (1.0 - a));
        res[1] = b + dt * (dB * laplacianB + reaction - (k + f) * b);
        //   const max = 1;
        //   res[0] = Math.max(0, Math.min(res[0], max));
        //   res[1] = Math.max(0, Math.min(res[1], max));
        if (Math.abs(x - px) < 10 && Math.abs(y - py) < 10) {
          res[0] = 0;
          res[1] = 0.9;
        }
        this.write(dsts, x, y, res);
      }
    }

    this.current = 1 - this.current;
  }

  export(data) {
    const a = this.chemicalA[this.current];
    const b = this.chemicalB[this.current];
    let ptr = 0;
    const imageData = this.context.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    for (let j = 0; j < a.length; j++) {
      data[j] = Math.abs(a[j] + b[j]); //(a[j] + b[j]) / 1;
      if (isNaN(data[j])) {
        debugger;
      }
      imageData.data[j * 4] = a[j] * 255;
      imageData.data[j * 4 + 1] = b[j] * 255;
      imageData.data[j * 4 + 2] = 0;
      imageData.data[j * 4 + 3] = 255;
      ptr++;
    }
    this.context.putImageData(imageData, 0, 0);
  }
}

export { ScottGray };
