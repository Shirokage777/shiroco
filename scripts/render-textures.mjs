// Renders the SVG textures to ordinary pictures (WebP), once, here on the computer.
//
// The wall and the paper grain are SVG noise filters. Safari works filters out on the processor
// and has to do it again whenever it redraws while you scroll, which made scrolling heavy on the
// iPhone. A picture only has to be shown. Rendered at twice the size they are shown, so they stay
// sharp on phone screens.
//
//   node scripts/make-wall.mjs           (only when the wall design changes)
//   node scripts/render-textures.mjs     (after any change to the SVG sources below)
//
// Sources: public/bunker-wall.svg (made by make-wall.mjs) and scripts/textures/*.svg.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const SCALE = 2;
const jobs = [{ src: "public/bunker-wall.svg", out: "public/bunker-wall.webp", quality: 0.82 }];
for (const name of (await readdir("scripts/textures")).filter((n) => n.endsWith(".svg"))) {
  jobs.push({ src: join("scripts/textures", name), out: join("public/textures", name.replace(".svg", ".webp")), quality: 0.9 });
}

await mkdir("public/textures", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const { src, out, quality } of jobs) {
  const svg = await readFile(src, "utf8");
  const dataUrl = await page.evaluate(
    async ({ svg, scale, quality }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    },
    { svg, scale: SCALE, quality },
  );
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  await writeFile(out, bytes);
  console.log(`${out}: ${(bytes.length / 1024).toFixed(0)} KB`);
}
await browser.close();
