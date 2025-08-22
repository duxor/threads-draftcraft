const fs = require('fs');
const path = require('path');

function readPngSize(buf) {
  // Validate PNG signature
  const sig = '89504e470d0a1a0a';
  if (buf.slice(0, 8).toString('hex') !== sig) {
    throw new Error('Invalid PNG signature');
  }
  // IHDR chunk starts at byte 8+8=16: [length(4), type(4), data(13), crc(4)]
  const ihdrType = buf.slice(12, 16).toString('ascii');
  if (ihdrType !== 'IHDR') throw new Error('IHDR chunk not found');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

const required = [
  { file: 'icon16.png',  w: 16,  h: 16 },
  { file: 'icon32.png',  w: 32,  h: 32 },
  { file: 'icon48.png',  w: 48,  h: 48 },
  { file: 'icon128.png', w: 128, h: 128 },
];

const dir = path.join(__dirname, '..', 'icons');

console.log('Verifying PNG icons...');
let ok = true;

for (const r of required) {
  const p = path.join(dir, r.file);
  if (!fs.existsSync(p)) {
    console.error('❌ Missing:', r.file);
    ok = false;
    continue;
  }
  
  try {
    const buf = fs.readFileSync(p);
    const { width, height } = readPngSize(buf);
    if (width !== r.w || height !== r.h) {
      console.error(`❌ Wrong dimensions for ${r.file}: got ${width}x${height}, expected ${r.w}x${r.h}`);
      ok = false;
    } else {
      console.log(`✓ OK ${r.file}: ${width}x${height}`);
    }
  } catch (e) {
    console.error(`❌ Error reading ${r.file}:`, e.message);
    ok = false;
  }
}

if (ok) {
  console.log('\n🎉 All icons verified successfully!');
} else {
  console.log('\n❌ Icon verification failed!');
}

process.exit(ok ? 0 : 1);
