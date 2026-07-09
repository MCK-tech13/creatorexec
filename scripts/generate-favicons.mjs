import { access, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const logoDir = path.join(publicDir, 'logo')

const SOURCE_CANDIDATES = [
  path.join(logoDir, 'ce-logo.png'),
  path.join(logoDir, 'ce-monogram.png'),
]

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function resolveSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    if (await exists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'Missing source logo. Add public/logo/ce-logo.png (preferred) or public/logo/ce-monogram.png.',
  )
}

async function main() {
  const source = await resolveSource()
  console.log(`Using source: ${path.relative(root, source)}`)

  const favicon16 = await sharp(source).resize(16, 16, { fit: 'contain' }).png().toBuffer()
  const favicon32 = await sharp(source).resize(32, 32, { fit: 'contain' }).png().toBuffer()
  const appleTouchIcon = await sharp(source)
    .resize(180, 180, { fit: 'contain' })
    .png()
    .toBuffer()
  const faviconIco = await toIco([favicon16, favicon32])

  await writeFile(path.join(publicDir, 'favicon-16x16.png'), favicon16)
  await writeFile(path.join(publicDir, 'favicon-32x32.png'), favicon32)
  await writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouchIcon)
  await writeFile(path.join(publicDir, 'favicon.ico'), faviconIco)

  console.log('Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
