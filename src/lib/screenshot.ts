// Screenshots for the tutor: a pasted, dropped or chosen image is shrunk on this device (long edge at
// most 1568 px, about what Claude reads at full detail) and re-encoded, so it is small enough to send
// with every turn of the chat. Read through a data: URL, which the site's CSP allows for images.

export type Shot = { mediaType: "image/png" | "image/jpeg"; data: string; url: string; w: number; h: number };
export const MAX_SHOTS = 4;
const MAX_EDGE = 1568;
const MAX_PIXELS = 1_150_000;
const PNG_LIMIT = 1_200_000; // bytes of base64; screenshots of text stay crisp as PNG below this

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that image."));
    r.readAsDataURL(file);
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file isn't an image the browser can open. Try a PNG or JPG screenshot."));
    img.src = src;
  });
}

/** The size to draw at: long edge ≤ 1568 px and ≤ ~1.15 megapixels, never upscaled. */
export function fitSize(w: number, h: number): { w: number; h: number } {
  const s = Math.min(1, MAX_EDGE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export async function toShot(file: Blob): Promise<Shot> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be attached (PNG, JPG, GIF or WebP screenshots).");
  if (file.size > 25 * 1024 * 1024) throw new Error("That image is over 25 MB. Take a smaller screenshot.");
  const img = await loadImage(await readAsDataUrl(file));
  const { w, h } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.fillStyle = "#fff"; // transparent screenshots become white, not black, as JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  let url = canvas.toDataURL("image/png");
  let mediaType: Shot["mediaType"] = "image/png";
  if (url.length > PNG_LIMIT) { url = canvas.toDataURL("image/jpeg", 0.88); mediaType = "image/jpeg"; }
  return { mediaType, data: url.slice(url.indexOf(",") + 1), url, w, h };
}
