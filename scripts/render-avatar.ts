/**
 * Renders telegram/avatar.svg to telegram/avatar.jpg (Telegram's setMyProfilePhoto only accepts JPG).
 *
 *   npm run avatar
 */
import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";

const SIZE = 640;
const svg = await readFile(new URL("../telegram/avatar.svg", import.meta.url), "utf8");
const image = new Resvg(svg, { fitTo: { mode: "width", value: SIZE }, background: "#1E1B4B" }).render();
const { data } = jpeg.encode({ data: Buffer.from(image.pixels), width: image.width, height: image.height }, 92);
await writeFile(new URL("../telegram/avatar.jpg", import.meta.url), data);
console.log(`telegram/avatar.jpg ${image.width}×${image.height}, ${(data.length / 1024).toFixed(1)} KiB`);
