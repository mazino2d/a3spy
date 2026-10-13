/**
 * Renders telegram/avatar.svg to:
 * - telegram/avatar.jpg (Telegram's setMyProfilePhoto only accepts JPG);
 * - web/public/icons/*.png for the web app. Every element sits inside the circle
 *   Telegram crops to, which is also the maskable icon safe zone.
 *
 *   npm run avatar
 */
import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";

const BACKGROUND = "#1E1B4B";
const svg = await readFile(new URL("../telegram/avatar.svg", import.meta.url), "utf8");
const render = (size: number) =>
  new Resvg(svg, { fitTo: { mode: "width", value: size }, background: BACKGROUND }).render();

const avatar = render(640);
const { data } = jpeg.encode({ data: Buffer.from(avatar.pixels), width: avatar.width, height: avatar.height }, 92);
await writeFile(new URL("../telegram/avatar.jpg", import.meta.url), data);
console.log(`telegram/avatar.jpg ${avatar.width}×${avatar.height}, ${(data.length / 1024).toFixed(1)} KiB`);

const icons: [string, number][] = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];
for (const [file, size] of icons) {
  const png = render(size).asPng();
  await writeFile(new URL(`../web/public/icons/${file}`, import.meta.url), png);
  console.log(`web/public/icons/${file} ${size}×${size}, ${(png.length / 1024).toFixed(1)} KiB`);
}
