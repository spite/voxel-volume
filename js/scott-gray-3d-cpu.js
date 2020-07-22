class ScottGray {
  constructor(w, h, d) {
    this.width = w;
    this.height = h;
    this.depth = d;

    this.initialise();
    this.randomise();
  }

  initialise() {
    const size = this.width * this.height * this.depth;
    const a1 = new Float32Array(size);
    const a2 = new Float32Array(size);
    const b1 = new Float32Array(size);
    const b2 = new Float32Array(size);
    this.chemicalA = [a1, a2];
    this.chemicalB = [b1, b2];
    this.current = 0;
  }

  randomise() {
    const a = this.chemicalA[this.current];
    const b = this.chemicalB[this.current];
    for (let z = 0; z < this.depth; z++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.write([a, b], x, y, z, [z / this.depth, 0]);
        }
      }
    }
  }

  read(buffers, x, y, z) {
    x = (x + this.width) % this.width;
    y = (y + this.height) % this.height;
    z = (z + this.depth) % this.depth;
    const ptr = z * this.width * this.height + y * this.width + x;
    return [buffers[0][ptr], buffers[1][ptr]];
  }

  write(buffers, x, y, z, values) {
    x = (x + this.width) % this.width;
    y = (y + this.height) % this.height;
    z = (z + this.depth) % this.depth;
    const ptr = z * this.width * this.height + y * this.width + x;
    buffers[0][ptr] = values[0];
    buffers[1][ptr] = values[1];
  }

  laplacian(srcs, x, y, z) {
    const samples7 = {
      weight: 1,
      weights: [
        [0, 0, -1, 1],

        [0, -1, 0, 1],
        [-1, 0, 0, 1],
        [0, 0, 0, -6],
        [1, 0, 0, 1],
        [0, 1, 0, 1],

        [0, 0, 1, 1],
      ],
    };

    const samples27 = {
      weight: 1 / 26,
      weights: [
        [-1, -1, -1, 2],
        [0, -1, -1, 3],
        [1, -1, -1, 2],
        [-1, 0, -1, 3],
        [0, 0, -1, 6],
        [1, 0, -1, 3],
        [-1, 1, -1, 2],
        [0, 1, -1, 3],
        [1, 1, -1, 2],

        [-1, -1, 0, 3],
        [0, -1, 0, 6],
        [1, -1, 0, 3],
        [-1, 0, 0, 6],
        [0, 0, 0, -88],
        [1, 0, 0, 6],
        [-1, 1, 0, 3],
        [0, 1, 0, 6],
        [1, 1, 0, 3],

        [-1, -1, 1, 2],
        [0, -1, 1, 3],
        [1, -1, 1, 2],
        [-1, 0, 1, 3],
        [0, 0, 1, 6],
        [1, 0, 1, 3],
        [-1, 1, 1, 2],
        [0, 1, 1, 3],
        [1, 1, 1, 2],
      ],
    };

    const selectedSamples = samples27;

    let sum = [0, 0];
    for (const sample of selectedSamples.weights) {
      const v = this.read(srcs, x + sample[0], y + sample[1], z + sample[2]);
      sum[0] += v[0] * sample[3] * selectedSamples.weight;
      sum[1] += v[1] * sample[3] * selectedSamples.weight;
    }

    return sum;
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
    for (let z = 0; z < this.depth; z++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const [laplacianA, laplacianB] = this.laplacian(srcs, x, y, z);
          const [a, b] = this.read(srcs, x, y, z);
          const res = [];
          const reaction = a * b * b;
          res[0] = a + dt * (dA * laplacianA - reaction + f * (1.0 - a));
          res[1] = b + dt * (dB * laplacianB + reaction - (k + f) * b);
          if (x < 10 && y < 10 && z < 10) {
            res[0] = 0;
            res[1] = 0.9;
          }
          this.write(dsts, x, y, z, res);
        }
      }
    }

    this.current = 1 - this.current;
  }

  export(data) {
    const a = this.chemicalA[this.current];
    const b = this.chemicalB[this.current];

    for (let j = 0; j < a.length; j++) {
      data[j] = Math.abs(a[j] + b[j]);
    }
  }
}

export { ScottGray };
