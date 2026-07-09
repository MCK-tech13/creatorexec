/**
 * Commission upload parser verification (XLSX + guards).
 * Usage: npm run test:commission-upload
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from '@e965/xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const fixtureXlsx = path.join(root, 'tmp-test-commission.xlsx')
const spoofedXlsx = path.join(root, 'tmp-spoofed.xlsx')

const { parseCommissionFile, isParseError } = await import('../src/lib/csv/parser.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function buildTikTokStyleXlsx(outputPath) {
  const csv = readFileSync(path.join(root, 'src/data/sample-commission.csv'), 'utf8')
  const rows = csv
    .trim()
    .split('\n')
    .map((line) => line.split(','))

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Commission')
  writeFileSync(outputPath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

async function fileFromPath(filePath, name) {
  const buffer = readFileSync(filePath)
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

console.log('Commission upload parser tests\n' + '='.repeat(60))

buildTikTokStyleXlsx(fixtureXlsx)
console.log('PASS  built TikTok-style XLSX fixture from sample-commission.csv')

const xlsxFile = await fileFromPath(fixtureXlsx, 'tiktok-commission-export.xlsx')
const xlsxResult = await parseCommissionFile(xlsxFile)
assert(!isParseError(xlsxResult), `XLSX parse failed: ${xlsxResult.message}`)
assert(xlsxResult.products.length > 0, 'XLSX parse returned no products')
console.log(
  `PASS  parsed XLSX: ${xlsxResult.products.length} products, headers: ${xlsxResult.headers.join(', ')}`,
)

const csvText = readFileSync(path.join(root, 'src/data/sample-commission.csv'), 'utf8')
const csvFile = new File([csvText], 'sample-commission.csv', { type: 'text/csv' })
const csvResult = await parseCommissionFile(csvFile)
assert(!isParseError(csvResult), `CSV parse failed: ${csvResult.message}`)
console.log(`PASS  parsed CSV: ${csvResult.products.length} products`)

writeFileSync(spoofedXlsx, 'not a zip file but named xlsx')
const spoofedFile = await fileFromPath(spoofedXlsx, 'fake.xlsx')
const spoofedResult = await parseCommissionFile(spoofedFile)
assert(isParseError(spoofedResult), 'Spoofed xlsx should fail')
assert(
  spoofedResult.message.includes('not a valid Excel'),
  `Unexpected spoof error: ${spoofedResult.message}`,
)
console.log('PASS  rejected extension-spoofed file (magic bytes)')

const bigBuffer = new Uint8Array(11 * 1024 * 1024)
bigBuffer.set([0x50, 0x4b, 0x03, 0x04], 0)
const bigFile = new File([bigBuffer], 'huge.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
const bigResult = await parseCommissionFile(bigFile)
assert(isParseError(bigResult), 'Oversized file should fail')
assert(bigResult.message.includes('too large'), `Unexpected size error: ${bigResult.message}`)
console.log('PASS  rejected file over 10 MB')

console.log('\n' + '='.repeat(60))
console.log('All commission upload parser tests passed.')

for (const filePath of [fixtureXlsx, spoofedXlsx]) {
  if (existsSync(filePath)) unlinkSync(filePath)
}
