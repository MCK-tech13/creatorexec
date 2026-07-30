import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const brandDir = path.join(publicDir, 'brand')
/**
 * Prefer the true interlocking weave (C over/under E on emerald).
 * Fall back to the GitHub upload / ce-monogram copy.
 */
const preferredSource = path.join(publicDir, 'logo', 'ce-interlock-emerald.png')
const uploadSource = path.join(publicDir, 'logo', 'creatorexec-logo-1024x1024.png')
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

/**
 * Build a modern ICO that embeds PNG payloads (not BMP).
 * BMP ICO frames corrupt this mark; Safari loads /favicon.ico.
 */
function buildPngIco(pngBuffersWithSizes) {
  const count = pngBuffersWithSizes.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const entries = pngBuffersWithSizes.map(({ size, png }) => {
    const entry = { size, bytes: png.length, offset, png }
    offset += png.length
    return entry
  })

  const out = Buffer.alloc(offset)
  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(count, 4)

  entries.forEach((entry, index) => {
    const o = 6 + index * 16
    out[o] = entry.size >= 256 ? 0 : entry.size
    out[o + 1] = entry.size >= 256 ? 0 : entry.size
    out[o + 2] = 0
    out[o + 3] = 0
    out.writeUInt16LE(1, o + 4)
    out.writeUInt16LE(32, o + 6)
    out.writeUInt32LE(entry.bytes, o + 8)
    out.writeUInt32LE(entry.offset, o + 12)
    entry.png.copy(out, entry.offset)
  })

  return out
}

function assertPngIco(icoBuffer) {
  const count = icoBuffer.readUInt16LE(4)
  if (count < 1) throw new Error('ICO has no frames.')
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16
    const byteLength = icoBuffer.readUInt32LE(o + 8)
    const frameOffset = icoBuffer.readUInt32LE(o + 12)
    const magic = icoBuffer.slice(frameOffset, frameOffset + 8)
    if (magic[0] !== 0x89 || magic.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error(
        `ICO frame ${i} is not PNG-compressed (got ${magic.toString('hex')}). Refusing BMP ICO.`,
      )
    }
    if (byteLength < 50) throw new Error(`ICO frame ${i} is too small.`)
  }
}

async function assertInterlockingFrame(pngBuffer, label) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let cream = 0
  let emerald = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 200 && g > 190 && b > 160) cream += 1
    if (r < 80 && g > 50 && g > r && b < g) emerald += 1
  }
  const total = info.width * info.height
  if (cream < total * 0.02) {
    throw new Error(`${label}: missing cream interlocking CE pixels (cream=${cream}/${total}).`)
  }
  if (emerald < total * 0.4) {
    throw new Error(`${label}: missing emerald field (emerald=${emerald}/${total}).`)
  }
}

async function resolveSource() {
  for (const candidate of [preferredSource, uploadSource, fallbackSource]) {
    if (await exists(candidate)) return candidate
  }
  return null
}

async function main() {
  const sourcePath = await resolveSource()
  if (!sourcePath) {
    throw new Error(
      'Missing logo source. Add public/logo/ce-interlock-emerald.png then run npm run generate:favicons.',
    )
  }

  await validateSource(sourcePath)
  console.log(`Using source: ${path.relative(root, sourcePath)}`)

  const favicon16 = await resizePng(sourcePath, 16)
  const favicon32 = await resizePng(sourcePath, 32)
  const favicon48 = await resizePng(sourcePath, 48)
  const appleTouchIcon = await resizePng(sourcePath, 180)

  await assertInterlockingFrame(favicon32, '32x32 PNG')
  await assertInterlockingFrame(favicon48, '48x48 PNG')

  const faviconIco = buildPngIco([
    { size: 16, png: favicon16 },
    { size: 32, png: favicon32 },
    { size: 48, png: favicon48 },
  ])
  assertPngIco(faviconIco)

  const largestOffset = faviconIco.readUInt32LE(6 + 2 * 16 + 12)
  const largestBytes = faviconIco.readUInt32LE(6 + 2 * 16 + 8)
  await assertInterlockingFrame(
    faviconIco.slice(largestOffset, largestOffset + largestBytes),
    'ICO 48 PNG frame',
  )

  await mkdir(brandDir, { recursive: true })

  await writeFile(path.join(publicDir, 'favicon-16x16.png'), favicon16)
  await writeFile(path.join(publicDir, 'favicon-32x32.png'), favicon32)
  await writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon)
  await writeFile(path.join(publicDir, 'favicon.ico'), faviconIco)

  // Legacy brand names (kept for older HTML) + weave names (new cache-busting paths).
  await writeFile(path.join(brandDir, 'ce-icon-16.png'), favicon16)
  await writeFile(path.join(brandDir, 'ce-icon-32.png'), favicon32)
  await writeFile(path.join(brandDir, 'ce-apple-touch.png'), appleTouchIcon)
  await writeFile(path.join(brandDir, 'ce-icon.ico'), faviconIco)
  await writeFile(path.join(brandDir, 'ce-weave-16.png'), favicon16)
  await writeFile(path.join(brandDir, 'ce-weave-32.png'), favicon32)
  await writeFile(path.join(brandDir, 'ce-weave-apple.png'), appleTouchIcon)
  await writeFile(path.join(brandDir, 'ce-weave.ico'), faviconIco)

  console.log('Generated favicons from interlocking weave mark (PNG-in-ICO).')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
