import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { aggregateOrdersByProduct } from '../analysis/orderAggregator'
import { mapColumns, normalizeHeader } from './columnMapper'
import { cleanString, parseCurrency, parseInteger } from './normalizer'
import type { ParseError, ParseResult, RawOrderRow } from '../../types'
import type { ColumnMapping } from '../../types'

function isLikelyHeaderRow(row: string[]): boolean {
  const normalized = row.map(normalizeHeader)
  const hasProduct = normalized.some((h) => h.includes('product'))
  const hasCommission = normalized.some((h) => h.includes('commission'))
  return hasProduct && hasCommission
}

function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (isLikelyHeaderRow(rows[i])) return i
  }
  return 0
}

function cellToString(cell: unknown): string {
  if (cell == null) return ''
  return String(cell).trim()
}

function normalizeSheetRows(rows: unknown[][]): string[][] {
  return rows
    .map((row) => (row ?? []).map(cellToString))
    .filter((row) => row.some((cell) => cell.length > 0))
}

function parseOrderRow(row: string[], mapping: ColumnMapping): RawOrderRow | null {
  const productName = cleanString(row[mapping.productName])
  const productId = cleanString(row[mapping.productId])

  if (!productName || !productId) return null

  return {
    productName,
    productId,
    gmv: mapping.gmv >= 0 ? parseCurrency(row[mapping.gmv]) : 0,
    itemsSold: mapping.itemsSold >= 0 ? parseInteger(row[mapping.itemsSold]) : 0,
    estStandardCommission:
      mapping.estStandardCommission >= 0
        ? parseCurrency(row[mapping.estStandardCommission])
        : 0,
    estShopAdsCommission:
      mapping.estShopAdsCommission >= 0
        ? parseCurrency(row[mapping.estShopAdsCommission])
        : 0,
  }
}

function parseCommissionRows(allRows: string[][]): ParseResult | ParseError {
  if (allRows.length === 0) {
    return { message: 'The file appears to be empty.', foundHeaders: [] }
  }

  const headerIndex = findHeaderRowIndex(allRows)
  const headers = allRows[headerIndex]
  const mapping = mapColumns(headers)

  if (!mapping) {
    return {
      message:
        'Required columns not found. Expected Product name, Product ID, and commission columns (Est. standard commission and/or Est. Shop Ads commission).',
      foundHeaders: headers.filter(Boolean),
    }
  }

  const orders: RawOrderRow[] = []

  for (let i = headerIndex + 1; i < allRows.length; i++) {
    const order = parseOrderRow(allRows[i], mapping)
    if (order) orders.push(order)
  }

  if (orders.length === 0) {
    return {
      message: 'No valid order rows found in the file.',
      foundHeaders: headers.filter(Boolean),
    }
  }

  const products = aggregateOrdersByProduct(orders)

  if (products.length === 0) {
    return {
      message: 'No products could be aggregated from the order data.',
      foundHeaders: headers.filter(Boolean),
    }
  }

  return { products, headers: headers.filter(Boolean) }
}

export function parseCommissionCsv(text: string): ParseResult | ParseError {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    header: false,
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      message: 'Failed to parse CSV file. Please check the format and try again.',
      foundHeaders: [],
    }
  }

  const allRows = parsed.data.filter((row) => row.some((cell) => cell?.trim()))
  return parseCommissionRows(allRows)
}

export function parseCommissionXlsx(buffer: ArrayBuffer): ParseResult | ParseError {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]

    if (!sheetName) {
      return { message: 'The Excel file contains no worksheets.', foundHeaders: [] }
    }

    const sheet = workbook.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]

    const allRows = normalizeSheetRows(raw)
    return parseCommissionRows(allRows)
  } catch {
    return {
      message: 'Failed to parse Excel file. Please check the format and try again.',
      foundHeaders: [],
    }
  }
}

export async function parseCommissionFile(file: File): Promise<ParseResult | ParseError> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCommissionCsv(text)
  }

  if (name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer()
    return parseCommissionXlsx(buffer)
  }

  return {
    message: 'Unsupported file type. Please upload a .csv or .xlsx file.',
    foundHeaders: [],
  }
}

export function isParseError(result: ParseResult | ParseError): result is ParseError {
  return 'message' in result
}
