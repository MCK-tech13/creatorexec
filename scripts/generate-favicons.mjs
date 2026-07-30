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

/** Brand emerald — matches the monogram circle fill. */
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
 * Tab icons need a solid emerald field. The monogram source keeps cream outside
 * the circle for logo use — remap that cream to emerald so 16/32px tabs read green.
 */
async function monogramOnEmeraldBackground(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  for (let i = 0; i < data.length; i += channels) {
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
    if (isCreamish(pixel)) {
      data[i] = EMERALD.r
      data[i + 1] = EMERALD.g
      data[i + 2] = EMERALD.b
      data[i + 3] = EMERALD.alpha
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels },
  })
}

async function resizePng(pipeline, size) {
  return pipeline
    .clone()
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer()
}

async function main() {
  if (!(await exists(sourcePath))) {
    throw new Error(
      'Missing public/logo/ce-monogram.png. Add the uploaded CE monogram source image, then run npm run generate:favicons.',
    )
  }

  await validateSource(sourcePath)
  console.log(`Using source: ${path.relative(root, sourcePath)}`)

  const onEmerald = await monogramOnEmeraldBackground(sourcePath)

  // Sanity: corners must be emerald after remap (not cream).
  const corner = await sampleRgb(onEmerald, 2, 2)
  if (isCreamish(corner)) {
    throw new Error('Favicon background remap failed — corners still cream.')
  }
  if (!isEmeraldish(corner)) {
    throw new Error(
      `Favicon background remap failed — corner rgba=(${corner.r},${corner.g},${corner.b}) is not emerald.`,
    )
  }

  const favicon16 = await resizePng(onEmerald, 16)
  const favicon32 = await resizePng(onEmerald, 32)
  const appleTouchIcon = await resizePng(onEmerald, 180)
  const faviconIco = await toIco([favicon16, favicon32])

  await writeFile(path.join(publicDir, 'favicon-16x16.png'), favicon16)
  await writeFile(path.join(publicDir, 'favicon-32x32.png'), favicon32)
  await writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon)
  await writeFile(path.join(publicDir, 'favicon.ico'), faviconIco)

  console.log('Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png')
  console.log('Tab icons use solid emerald background (cream corners remapped).')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
