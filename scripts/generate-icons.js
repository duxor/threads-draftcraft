const fs = require('fs');
const path = require('path');

// Base64 encoded PNG files for each icon size
// Blue background with white document and green time indicator
const icons = [
  {
    name: 'icon16.png',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAAF5JREFUOI3NkrEJACAMAysW6yDKE/gEO4t5guIHv8AF7QVCLgkEZubNzDOzDLJ0kRgijBBJ4pJNINgPNgfJCqmtmxn5d2aUWzKFqMhEyVaycLM1o5lKUWoQ4BEfYC/2C5kJgb8Ng/QAAAAASUVORK5CYII='
  },
  {
    name: 'icon32.png',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAAMNJREFUWIXt1bEJwzAQheFP2AHSpoOkyxROl27SKSFQwSFdOkWhbQZIkSatsoKlsxXZjmOCBL7qBPfd435+JEmSJEmSJP9eVVU9Y4zJGKNqHJdSSh9jjEmMUTWOS+zBti3GGJVSqr2OU0rJtm0xxqiUUu11nGgBa6012z7XATsNcOs9GNwKXKPJrucAc52rqJOZNQ5IKdHb1lrN8zyPYIzZNgCJHQfgdQDgdGotPEPdwPq2gJRe34O5zlXUGccByKPfkCFJkiRJkiSjfABVGAIIJmQNigAAAABJRU5ErkJggg=='
  },
  {
    name: 'icon48.png',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAAJtJREFUaIHt2rENwjAQheFfyAJpMwXTZIp0mSJdOiU3QKC2qAe4AoooShGBJCKKKKKIIoorjJJSShJRRBFFFFFEcWUd55wxxqwHGGPMOecbhOzV5LZtSf9EFFFEEUUUUVyJoogiiiiiCKFGGGPMtsn5f3jndrJtW5IaWKNFi1bNdyK1f0OABFFFEUUUVVRRhHEvA4jIkKIEIo/oNw3d9r4kSZIkG+QASoNVsm9IEQAAAABJRU5ErkJggg=='
  },
  {
    name: 'icon128.png',
    b64: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAAJtJREFUeJzt3NEJAjAQBEGRWIhF2I9F2JdF2I9dWINJCN4eHhwdN+8gE7YbNpfkXZMkSZIkSZIkSZIkSZIkSZL+kfclSZIkSZIkSZIkSdI3gK7XaX31yZ8Au15mQR9+gGNfZvBjfp/AF2Cr3za+3e/l7Gve+r7Mpr9vJEmSJEmSJEmSJEmSJEmSJOkbePcCyZYE5jwYAGAAAAAASUVORK5CYII='
  }
];

const outDir = path.join(__dirname, '..', 'icons');

console.log('Generating PNG icons...');
for (const { name, b64 } of icons) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('✓ Created:', name);
}

console.log('Icon generation complete!');
