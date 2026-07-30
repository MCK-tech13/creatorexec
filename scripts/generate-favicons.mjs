import { access, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const sourcePath = path.join(publicDir, 'logo', 'ce-monogram.png')

/** Brand emerald — matches the monogram circle fill (#1A4A3A). */
const EMERALD = { r: 26, g: 74, b: 58, alpha: 255 }

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function sampleRgb(image, x, y) {
  const { data, info } = await image
    .clone()
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (info.channels < 3) {
    throw new Error('Expected RGB/RGBA source image.')
  }

  return { r: data[0], g: data[1], b: data[2] }
}

function isCreamish({ r, g, b }) {
  return r > 235 && g > 230 && b > 220
}

function isEmeraldish({ r, g, b }) {
  return r < 80 && g > 50 && b > 40 && g > r && b < g
}

/** Reject the old SVG/text placeholder (cream field + emerald letters, no circle). */
async function validateSource(imagePath) {
  const image = sharp(imagePath)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error(`Invalid source image: ${imagePath}`)
  }

  const width = metadata.width
  const height = metadata.height

  const corners = [
    await sampleRgb(image, 2, 2),
    await sampleRgb(image, width - 3, 2),
    await sampleRgb(image, 2, height - 3),
    await sampleRgb(image, width - 3, height - 3),
  ]
  const center = await sampleRgb(image, Math.floor(width / 2), Math.floor(height / 2))
  const upperMid = await sampleRgb(image, Math.floor(width / 2), Math.floor(height * 0.18))

  const creamCorners = corners.filter(isCreamish).length
  const emeraldCenter = isEmeraldish(center)
  const upperMidEmerald = isEmeraldish(upperMid)

  if (creamCorners >= 3 && emeraldCenter && !upperMidEmerald) {
    throw new Error(
      'public/logo/ce-monogram.png looks like the old text placeholder (cream background + emerald letters). Upload the real circular monogram PNG and re-run npm run generate:favicons.',
    )
  }
}

/**
 * Fill cream OUTSIDE the monogram circle with emerald.
 *
 * Important: CE letter strokes are the same cream as the outer field, so a
 * color-only cream→emerald remap erases the letters (what shipped in #54).
 * Use geometry: only replace cream pixels outside the circle radius.
 */
async function monogramOnEmeraldBackground(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2

  // Radius = farthest emerald-ish pixel from center (the circle fill).
  let radius = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
      if (!isEmeraldish(pixel)) continue
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > radius) radius = dist
    }
  }

  if (radius < Math.min(width, height) * 0.25) {
    throw new Error(`Could not detect monogram circle radius (got ${radius.toFixed(1)}).`)
  }

  // Slightly inset so anti-aliased cream/green ring at the rim becomes emerald.
  const fillOutside = radius - 1.5
  let filled = 0
  let creamLettersKept = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
      const dist = Math.hypot(x - cx, y - cy)

      if (dist > fillOutside && isCreamish(pixel)) {
        data[i] = EMERALD.r
        data[i + 1] = EMERALD.g
        data[i + 2] = EMERALD.b
        data[i + 3] = EMERALD.alpha
        filled += 1
        continue
      }

      // Cream (or cream-ish) inside the circle = letter strokes — keep.
      if (dist <= fillOutside && isCreamish(pixel)) {
        creamLettersKept += 1
      }
    }
  }

  if (creamLettersKept < 200) {
    throw new Error(
      `CE letter pixels missing after emerald fill (kept=${creamLettersKept}).`,
    )
  }

  console.log(
    `Circle radius≈${radius.toFixed(1)}px; filled ${filled} outer cream pixels; kept ${creamLettersKept} letter pixels`,
  )

  return sharp(data, {
    raw: { width, height, channels },
  }).png()
}

async function resizePng(pipeline, size) {
  return pipeline.clone().resize(size, size, { fit: 'cover' }).png().toBuffer()
}

/** Crisp SVG fallback for modern browsers — solid emerald + cream CE. */
function faviconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" fill="#1a4a3a"/>
  <text
    x="16"
    y="22"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="15"
    font-weight="700"
    fill="#faf7f2"
    letter-spacing="-0.04em"
  >CE</text>
</svg>
`
}

async function main() {
  if (!(await exists(sourcePath))) {
    throw new Error(
      'Missing public/logo/ce-monogram.png. Add the uploaded CE monogram source image, then run npm run generate:favicons.',
    )
  }

  await validateSource(sourcePath)
  console.log(`Using source: ${path.relative(root, sourcePath)}`)

  const onEmeraldPipeline = await monogramOnEmeraldBackground(sourcePath)
  const onEmeraldBuffer = await onEmeraldPipeline.toBuffer()
  const onEmerald = sharp(onEmeraldBuffer)

  const corner = await sampleRgb(onEmerald, 2, 2)
  if (isCreamish(corner) || !isEmeraldish(corner)) {
    throw new Error(
      `Favicon background remap failed — corner rgba=(${corner.r},${corner.g},${corner.b}) is not emerald.`,
    )
  }

  // Tiny tab sizes: SVG raster is crisper than downscaling the monogram.
  const svgRaster = await sharp(Buffer.from(faviconSvg()))
    .resize(128, 128)
    .png()
    .toBuffer()
  const favicon16 = await sharp(svgRaster).resize(16, 16).png().toBuffer()
  const favicon32 = await sharp(svgRaster).resize(32, 32).png().toBuffer()
  const appleTouchIcon = await resizePng(onEmerald, 180)
  const faviconIco = await toIco([favicon16, favicon32])

  await writeFile(path.join(publicDir, 'favicon.svg'), faviconSvg())
  await writeFile(path.join(publicDir, 'favicon-16x16.png'), favicon16)
  await writeFile(path.join(publicDir, 'favicon-32x32.png'), favicon32)
  await writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon)
  await writeFile(path.join(publicDir, 'favicon.ico'), faviconIco)

  console.log(
    'Generated favicon.svg, favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png',
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
