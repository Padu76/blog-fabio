// E:\blog-fabio\scripts\make-icons.mjs
// Genera favicon e icone PWA dal disegno dei libri (eseguito una volta, i file risultanti sono nel repo).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const books = (fg) => `
  <rect x="8" y="14" width="11" height="38" rx="1.5" fill="${fg}"/>
  <rect x="22" y="10" width="11" height="42" rx="1.5" fill="${fg}" opacity="0.82"/>
  <rect x="36" y="18" width="10" height="34" rx="1.5" fill="${fg}" opacity="0.66" transform="rotate(-14 41 35)"/>
  <rect x="4" y="53" width="56" height="4" rx="1" fill="${fg}"/>`;

const icon = (pad, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="#345A6C"/>
  <g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})">${books('#F8F5EE')}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('src/app/icon.svg', icon(8, 12));
await sharp(Buffer.from(icon(8, 12))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(icon(8, 12))).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(icon(14, 0))).resize(512, 512).png().toFile('public/icons/maskable-512.png');
await sharp(Buffer.from(icon(8, 0))).resize(180, 180).png().toFile('src/app/apple-icon.png');
const ico = await sharp(Buffer.from(icon(6, 12))).resize(48, 48).png().toBuffer();
// ICO con un'immagine PNG 48x48
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(ico.length, 14); header.writeUInt32LE(22, 18);
writeFileSync('src/app/favicon.ico', Buffer.concat([header, ico]));
console.log('icone generate');
