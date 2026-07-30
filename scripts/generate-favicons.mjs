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

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function sampleRgb(imagePath, x, y) {
  const { data, info } = await sharp(imagePath)
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

/**
 * Source must be full-bleed emerald with cream interlocking CE
 * (not the old cream-field text placeholder, and not cream-corner circle).
 */
async function validateSource(imagePath) {
  const metadata = await sharp(imagePath).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Invalid source image: ${imagePath}`)
  }

  const width = metadata.width
  const height = metadata.height
  const corners = [
    await sampleRgb(imagePath, 2, 2),
    await sampleRgb(imagePath, width - 3, 2),
    await sampleRgb(imagePath, 2, height - 3),
    await sampleRgb(imagePath, width - 3, height - 3),
  ]

  const creamCorners = corners.filter(isCreamish).length
  if (creamCorners >= 3) {
    throw new Error(
      'public/logo/ce-monogram.png still has cream corners. Use the full-bleed emerald interlocking CE mark.',
    )
  }

  const emeraldCorners = corners.filter(isEmeraldish).length
  if (emeraldCorners < 3) {
    throw new Error(
      'public/logo/ce-monogram.png corners are not emerald. Tab icons need a solid emerald field.',
    )
  }
}

async function resizePng(imagePath, size) {
  return sharp(imagePath).resize(size, size, { fit: 'cover' }).png().toBuffer()
}

/** SVG mirrors full-bleed emerald + cream CE for browsers that prefer SVG. */
function faviconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" fill="#1a4a3a"/>
  <text
    x="15.2"
    y="22.5"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="18"
    font-weight="700"
    fill="#faf7f2"
    letter-spacing="-0.08em"
  >CE</text>
</svg>
`
}

async function main() {
  if (!(await exists(sourcePath))) {
    throw new Error(
      'Missing public/logo/ce-monogram.png. Add the interlocking emerald CE mark, then run npm run generate:favicons.',
    )
  }

  await validateSource(sourcePath)
  console.log(`Using source: ${path.relative(root, sourcePath)}`)

  const favicon16 = await resizePng(sourcePath, 16)
  const favicon32 = await resizePng(sourcePath, 32)
  const appleTouchIcon = await resizePng(sourcePath, 180)
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
