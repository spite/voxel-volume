async function loadRaw(filename, data, width, height, depth) {
  const res = await fetch(`../assets/${filename}`);
  const arrayBuffer = await res.arrayBuffer();
  const srcData = new Uint8Array(arrayBuffer);
  let ptr = 0;
  const sw = 256 / width;
  const sh = 256 / height;
  const sd = 256 / depth;
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = 0;
        let samples = 0;
        for (let zz = 0; zz < sd; zz++) {
          for (let yy = 0; yy < sh; yy++) {
            for (let xx = 0; xx < sw; xx++) {
              const srcPtr =
                (x * sw + xx) * 256 * 256 + (y * sh + yy) * 256 + (z * sd + zz);
              const t = srcData[srcPtr];
              v = Math.max(v, t);
              samples++;
            }
          }
        }
        //v /= samples;
        data[ptr] = v / 255;
        ptr++;
      }
    }
  }
}

export { loadRaw };
