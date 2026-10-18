import { t } from "./messages";
import type { ShareCard } from "./result";

/**
 * The result image players post (M8 U7): drawn on the phone, never on a server, from the
 * share card only (what every screen showed at the end of the game). Portrait 1080×1350,
 * the "Hồ sơ mật" look: kraft folder, paper sheet, ink, one red stamp.
 */

const W = 1080;
const H = 1350;
const C = {
  kraft: "#E9DCC0",
  paper: "#F6EEDB",
  rule: "#8A7552",
  ink: "#2B241A",
  soft: "#6D5D40",
  stamp: "#B3261E",
};
const DISPLAY = "Oswald";
const TYPE = "'IBM Plex Mono'";

/** The largest font size (down to `min`) at which `text` fits in `max` pixels. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  start: number,
  min: number,
  max: number,
): number {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > max) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

export async function drawResult(card: ShareCard, appHost: string): Promise<Blob> {
  // Canvas text only uses fonts that are already loaded.
  await Promise.all([
    document.fonts.load(`700 96px ${DISPLAY}`),
    document.fonts.load(`600 40px ${TYPE}`),
    document.fonts.load(`400 36px ${TYPE}`),
  ]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  // Folder and sheet.
  ctx.fillStyle = C.kraft;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.paper;
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.roundRect(60, 60, W - 120, H - 120, 18);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  const left = 120;
  const right = W - 120;
  let y = 170;
  ctx.textBaseline = "alphabetic";

  // Brand and game.
  ctx.fillStyle = C.ink;
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.textAlign = "left";
  ctx.fillText("A3 SPY", left, y);
  ctx.fillStyle = C.soft;
  ctx.font = `400 30px ${TYPE}`;
  ctx.fillText(t.shareGame(card.gameId), left, y + 48);

  // The red stamp: the odd one out.
  ctx.save();
  ctx.translate(right - 110, y + 10);
  ctx.rotate(-0.12);
  ctx.strokeStyle = C.stamp;
  ctx.lineWidth = 6;
  ctx.strokeRect(-110, -48, 220, 84);
  ctx.fillStyle = C.stamp;
  ctx.font = `700 50px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillText("MẬT", 0, 14);
  ctx.restore();

  // Winner and the viewer's own result.
  y += 190;
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  const headline = t.winnerShort[card.winner] ?? "";
  fitSize(ctx, headline, (px) => `700 ${px}px ${DISPLAY}`, 120, 64, right - left);
  ctx.fillText(headline, left, y);
  y += 76;
  ctx.font = `600 42px ${TYPE}`;
  ctx.fillStyle = card.mine?.won ? C.ink : C.soft;
  if (card.mine)
    ctx.fillText(fitText(ctx, t.shareMine(card.mine.won, t.roles[card.mine.role] ?? ""), right - left), left, y);
  y += 56;
  ctx.font = `400 32px ${TYPE}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(fitText(ctx, t.reasons[card.winner] ?? "", right - left), left, y);

  // Both words.
  y += 90;
  ctx.font = `400 34px ${TYPE}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(t.civilianWord, left, y);
  ctx.fillText(t.spyWord, W / 2 + 10, y);
  y += 64;
  ctx.font = `700 60px ${DISPLAY}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(fitText(ctx, card.words.civilian, W / 2 - left - 20), left, y);
  ctx.fillStyle = C.stamp;
  ctx.fillText(fitText(ctx, card.words.spy, right - W / 2 - 10), W / 2 + 10, y);

  // Every player and role; two columns past 8 players.
  y += 50;
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 70;
  const cols = card.players.length > 8 ? 2 : 1;
  const colW = (right - left) / cols;
  const rows = Math.ceil(card.players.length / cols);
  const rowH = Math.min(84, (H - 230 - y) / Math.max(rows, 1));
  const size = Math.round(Math.min(40, rowH * 0.55));
  card.players.forEach((p, i) => {
    const x = left + Math.floor(i / rows) * colW;
    const yy = y + (i % rows) * rowH;
    ctx.font = `${p.me ? 600 : 400} ${size}px ${TYPE}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    const name = `${p.out ? "❌ " : ""}${p.name}${p.me ? ` (${t.you})` : ""}`;
    ctx.fillText(fitText(ctx, name, colW - 200), x, yy);
    ctx.textAlign = "right";
    ctx.fillStyle = p.role === "civilian" ? C.soft : C.stamp;
    ctx.fillText(t.roles[p.role] ?? "", x + colW - 24, yy);
  });

  // Footer: where to play.
  ctx.textAlign = "center";
  ctx.fillStyle = C.soft;
  ctx.font = `400 30px ${TYPE}`;
  ctx.fillText(t.shareFooter(appHost), W / 2, H - 110);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no image"))), "image/png"),
  );
}

/** Opens the share sheet with the image, or downloads it where files cannot be shared (M8 AC14). */
export async function shareResult(card: ShareCard): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await drawResult(card, location.host);
  const file = new File([blob], `a3spy-van-${card.gameId}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t.shareTitle, text: t.shareResultText(location.origin) });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
