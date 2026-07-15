import sharp from 'sharp'

const LONG_EDGE = 1024
const JPEG_QUALITY = 85

/**
 * Downsize screenshots before Claude vision (~1024px long edge).
 * Returns JPEG buffer + media type for the Messages API.
 */
export async function downsizeScreenshotForVision(inputBuffer) {
  const image = sharp(inputBuffer, { failOn: 'none' }).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const longEdge = Math.max(width, height)

  let pipeline = image
  if (longEdge > LONG_EDGE && width > 0 && height > 0) {
    if (width >= height) {
      pipeline = pipeline.resize({ width: LONG_EDGE, withoutEnlargement: true })
    } else {
      pipeline = pipeline.resize({ height: LONG_EDGE, withoutEnlargement: true })
    }
  }

  const buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
  const outMeta = await sharp(buffer).metadata()

  return {
    buffer,
    mediaType: 'image/jpeg',
    width: outMeta.width ?? null,
    height: outMeta.height ?? null,
    originalWidth: width || null,
    originalHeight: height || null,
  }
}

export function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/i.exec(dataUrl ?? '')
  if (!match) {
    throw new Error('Expected a data URL with image/jpeg, image/png, image/webp, or image/gif')
  }
  const mediaType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  return {
    mediaType,
    buffer: Buffer.from(match[2], 'base64'),
  }
}
