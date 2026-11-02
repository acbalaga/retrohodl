// One-off: renders og.png, apple-touch-icon.png and favicon-32.png. Run with `npm run images`.
import sharp from "sharp";

await sharp("assets-src/og.svg").png().toFile("public/og.png");
await sharp("public/favicon.svg", { density: 512 }).resize(180, 180).png().toFile("public/apple-touch-icon.png");
await sharp("public/favicon.svg", { density: 256 }).resize(32, 32).png().toFile("public/favicon-32.png");
console.log("images written");
