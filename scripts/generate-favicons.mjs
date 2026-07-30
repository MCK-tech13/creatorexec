import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const brandDir = path.join(publicDir, 'brand')
/** Prefer the exact GitHub-uploaded mark; fall back to ce-monogram.png. */
const preferredSource = path.join(publicDir, 'logo', 'creatorexec-logo-1024x1024.png')
const fallbackSource = path.join(publicDir, 'logo', 'ce-monogram.png')

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

/** Source must be full-bleed emerald (no cream-corner placeholder). */
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

  if (corners.filter(isCreamish).length >= 3) {
    throw new Error(
      `${path.relative(root, imagePath)} has cream corners. Use the full-bleed emerald interlocking CE mark.`,
    )
  }

  if (corners.filter(isEmeraldish).length < 3) {
    throw new Error(
      `${path.relative(root, imagePath)} corners are not emerald. Tab icons need a solid emerald field.`,
    )
  }
}

async function resizePng(imagePath, size) {
  return sharp(imagePath).resize(size, size, { fit: 'cover' }).png().toBuffer()
}

async function main() {
  const sourcePath = (await exists(preferredSource)) ? preferredSource : fallbackSource
  if (!(await exists(sourcePath))) {
    throw new Error(
      'Missing logo source. Add public/logo/creatorexec-logo-1024x1024.png then run npm run generate:favicons.',
    )
  }

  await validateSource(sourcePath)
  console.log(`Using source: ${path.relative(root, sourcePath)}`)

  const favicon16 = await resizePng(sourcePath, 16)
  const favicon32 = await resizePng(sourcePath, 32)
  const favicon48 = await resizePng(sourcePath, 48)
  const appleTouchIcon = await resizePng(sourcePath, 180)
  const faviconIco = await toIco([favicon16, favicon32, favicon48])

  await mkdir(brandDir, { recursive: true })

  // Legacy root paths (Safari address bar often uses /favicon.ico only).
  await writeFile(path.join(publicDir, 'favicon-16x16.png'), favicon16)
  await writeFile(path.join(publicDir, 'favicon-32x32.png'), favicon32)
  await writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon)
  await writeFile(path.join(publicDir, 'favicon.ico'), faviconIco)

  // Unique /brand/* paths referenced from index.html — busts sticky favicon caches.
  await writeFile(path.join(brandDir, 'ce-icon-16.png'), favicon16)
  await writeFile(path.join(brandDir, 'ce-icon-32.png'), favicon32)
  await writeFile(path.join(brandDir, 'ce-apple-touch.png'), appleTouchIcon)
  await writeFile(path.join(brandDir, 'ce-icon.ico'), faviconIco)

  console.log('Generated root favicons + public/brand/ce-icon-* (16/32/48 ICO, no SVG).')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
