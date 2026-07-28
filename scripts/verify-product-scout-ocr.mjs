/**
 * Unit tests for Product Scout screenshot OCR helpers (no live Anthropic call).
 * Usage: npm run verify:product-scout-ocr
 */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  PRODUCT_SCOUT_OCR_MODEL,
  PRODUCT_SCOUT_OCR_SYSTEM_PROMPT,
  PRODUCT_SCOUT_OCR_TOOL,
  PRODUCT_SCOUT_OCR_USER_PROMPT,
  buildProductScoutOcrSystemPrompt,
  buildProductScoutOcrTool,
  buildProductScoutOcrUserPrompt,
  normalizeExtractedMetrics,
  extractTrendMetricsFromImage,
} from '../server/productScoutOcr.mjs'
import { downsizeScreenshotForVision } from '../server/imageDownsize.mjs'
import { formatTrendNumber } from '../src/lib/productScout/metricParser.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const artifacts = '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

assert.equal(PRODUCT_SCOUT_OCR_MODEL, 'claude-sonnet-4-6')
assert.equal(PRODUCT_SCOUT_OCR_TOOL.name, 'extract_trend_metrics')
assert.deepEqual(PRODUCT_SCOUT_OCR_TOOL.input_schema.required, [
  'orders',
  'delta_orders',
  'ctr',
  'delta_ctr',
  'creators',
  'delta_creators',
  'atc',
  'delta_atc',
  'confidence',
])
assert.ok(PRODUCT_SCOUT_OCR_SYSTEM_PROMPT.includes('Do NOT guess'))
assert.ok(PRODUCT_SCOUT_OCR_SYSTEM_PROMPT.includes('▲'))
assert.ok(PRODUCT_SCOUT_OCR_USER_PROMPT.includes('delta_orders'))
assert.ok(
  PRODUCT_SCOUT_OCR_TOOL.input_schema.properties.orders.description.includes('30-day'),
)

const tool7 = buildProductScoutOcrTool('7')
assert.ok(tool7.input_schema.properties.orders.description.includes('7-day'))
assert.ok(buildProductScoutOcrSystemPrompt('7').includes('7-day'))
assert.ok(buildProductScoutOcrUserPrompt('7').includes('7-day'))
assert.ok(buildProductScoutOcrUserPrompt('30').includes('30-day'))

assert.deepEqual(
  normalizeExtractedMetrics({
    orders: 24100,
    delta_orders: 3600,
    ctr: 3.5,
    delta_ctr: -0.5,
    creators: 8800,
    delta_creators: 1100,
    atc: 74100,
    delta_atc: 13200,
    confidence: 'high',
  }),
  {
    orders: 24100,
    delta_orders: 3600,
    ctr: 3.5,
    delta_ctr: -0.5,
    creators: 8800,
    delta_creators: 1100,
    atc: 74100,
    delta_atc: 13200,
    confidence: 'high',
  },
)

assert.deepEqual(
  normalizeExtractedMetrics({
    orders: null,
    delta_orders: null,
    ctr: null,
    delta_ctr: null,
    creators: 1200,
    delta_creators: null,
    atc: null,
    delta_atc: null,
    confidence: 'low',
  }),
  {
    orders: null,
    delta_orders: null,
    ctr: null,
    delta_ctr: null,
    creators: 1200,
    delta_creators: null,
    atc: null,
    delta_atc: null,
    confidence: 'low',
  },
)

assert.throws(() => normalizeExtractedMetrics({ orders: 1, confidence: 'nope' }))
assert.equal(formatTrendNumber(24100), '24.1K')

// Mock Claude tool_use response
const fakeFetch = async () => ({
  ok: true,
  json: async () => ({
    content: [
      {
        type: 'tool_use',
        name: 'extract_trend_metrics',
        input: {
          orders: 12500,
          delta_orders: 190,
          ctr: 2.1,
          delta_ctr: 1.8,
          creators: 3400,
          delta_creators: 16,
          atc: 9800,
          delta_atc: 504,
          confidence: 'medium',
        },
      },
    ],
  }),
})

const mockResult = await extractTrendMetricsFromImage({
  apiKey: 'test-key',
  imageBase64: 'abc',
  mediaType: 'image/jpeg',
  fetchImpl: fakeFetch,
})
assert.deepEqual(mockResult, {
  orders: 12500,
  delta_orders: 190,
  ctr: 2.1,
  delta_ctr: 1.8,
  creators: 3400,
  delta_creators: 16,
  atc: 9800,
  delta_atc: 504,
  confidence: 'medium',
})

// Synthetic TikTok-like metrics screenshot for visual/OCR accuracy testing
async function buildFixture({ label, lines, width = 900, height = 1400 }) {
  const textSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0f0f12"/>
      <rect x="40" y="80" width="${width - 80}" height="${height - 160}" rx="24" fill="#1c1c22"/>
      <text x="72" y="160" fill="#f5f5f7" font-size="36" font-family="Arial, sans-serif" font-weight="700">Product trends</text>
      <text x="72" y="210" fill="#a1a1aa" font-size="22" font-family="Arial, sans-serif">${label}</text>
      ${lines
        .map(
          (line, index) => `
        <rect x="72" y="${280 + index * 170}" width="${width - 144}" height="140" rx="16" fill="#27272f"/>
        <text x="100" y="${330 + index * 170}" fill="#a1a1aa" font-size="22" font-family="Arial, sans-serif">${line.title}</text>
        <text x="100" y="${390 + index * 170}" fill="#ffffff" font-size="48" font-family="Arial, sans-serif" font-weight="700">${line.value}</text>
        <text x="100" y="${430 + index * 170}" fill="${line.delta.startsWith('▼') || line.delta.startsWith('-') ? '#f87171' : '#4ade80'}" font-size="26" font-family="Arial, sans-serif">${line.delta}</text>
      `,
        )
        .join('')}
    </svg>
  `

  const png = await sharp(Buffer.from(textSvg)).png().toBuffer()
  const outPath = path.join(artifacts, `product-scout-fixture-${label.replace(/\s+/g, '-').toLowerCase()}.png`)
  writeFileSync(outPath, png)
  return { outPath, png }
}

const clearFixture = await buildFixture({
  label: 'Clear metrics card',
  lines: [
    { title: 'Orders (30 days)', value: '24.1K', delta: '▲3.6K' },
    { title: 'CTR', value: '3.5%', delta: '▼0.5' },
    { title: 'Number of creators', value: '8.8K', delta: '▲1.1K' },
    { title: 'Add-to-cart users', value: '74.1K', delta: '▲13.2K' },
  ],
})

const busyFixture = await buildFixture({
  label: 'Second product card',
  lines: [
    { title: 'Orders (30 days)', value: '190', delta: '▲190' },
    { title: 'CTR', value: '1.8%', delta: '▲1.8%' },
    { title: 'Number of creators', value: '16', delta: '▲16' },
    { title: 'Add-to-cart users', value: '504', delta: '▲504' },
  ],
})

const resized = await downsizeScreenshotForVision(
  await sharp({
    create: { width: 2400, height: 3200, channels: 3, background: '#111' },
  })
    .jpeg()
    .toBuffer(),
)
assert.ok((resized.width ?? 0) <= 1024)
assert.ok((resized.height ?? 0) <= 1024)
assert.equal(resized.mediaType, 'image/jpeg')

// Save prompt/schema artifact for PR review
writeFileSync(
  path.join(artifacts, 'product-scout-ocr-prompt-schema.json'),
  JSON.stringify(
    {
      model: PRODUCT_SCOUT_OCR_MODEL,
      system: PRODUCT_SCOUT_OCR_SYSTEM_PROMPT,
      user: PRODUCT_SCOUT_OCR_USER_PROMPT,
      tool: PRODUCT_SCOUT_OCR_TOOL,
      tool_choice: { type: 'tool', name: PRODUCT_SCOUT_OCR_TOOL.name },
      fixtures: [clearFixture.outPath, busyFixture.outPath],
    },
    null,
    2,
  ),
)

console.log('verify:product-scout-ocr — unit checks passed')
console.log(`fixtures: ${clearFixture.outPath}`)
console.log(`fixtures: ${busyFixture.outPath}`)

// Optional live Anthropic call when key is present
const envPath = path.join(root, '.env')
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const eq = trimmed.indexOf('=')
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value
  }
} catch {
  // ignore
}

const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
if (!apiKey) {
  console.log('ANTHROPIC_API_KEY not set — skipped live Claude vision accuracy run')
  console.log('Add the key to .env and re-run to gauge real extraction accuracy.')
  process.exit(0)
}

console.log('ANTHROPIC_API_KEY found — running live extraction on fixtures…')
for (const fixture of [clearFixture, busyFixture]) {
  const sized = await downsizeScreenshotForVision(fixture.png)
  const result = await extractTrendMetricsFromImage({
    apiKey,
    imageBase64: sized.buffer.toString('base64'),
    mediaType: sized.mediaType,
  })
  console.log(`\nFixture: ${path.basename(fixture.outPath)}`)
  console.log(JSON.stringify(result, null, 2))
  writeFileSync(
    path.join(artifacts, `${path.basename(fixture.outPath, '.png')}-extraction.json`),
    JSON.stringify(result, null, 2),
  )
}
