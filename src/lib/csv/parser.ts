import Papa from 'papaparse'
import { aggregateOrdersByProduct } from '../analysis/orderAggregator'
import { mapColumns, normalizeHeader } from './columnMapper'
import { cleanString, parseCurrency, parseInteger } from './normalizer'
import {
  COMMISSION_PARSE_TIMEOUT_MS,
  fileTooLargeMessage,
  invalidXlsxMessage,
  isFileTooLarge,
  isXlsxZipBuffer,
  MAX_COMMISSION_PARSED_ROWS,
  parseTimeoutMessage,
  tooManyRowsMessage,
} from './uploadLimits'
import type { ParseError, ParseResult, RawOrderRow } from '../../types'
import type { ColumnMapping } from '../../types'

type XlsxModule = typeof import('@e965/xlsx')

let xlsxModulePromise: Promise<XlsxModule> | null = null

function loadXlsxModule(): Promise<XlsxModule> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('@e965/xlsx')
  }
  return xlsxModulePromise
}

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

function rowLimitError(rowCount: number): ParseError {
  return {
    message: tooManyRowsMessage(rowCount),
    foundHeaders: [],
  }
}

function enforceRowLimit(allRows: string[][]): ParseError | null {
  if (allRows.length > MAX_COMMISSION_PARSED_ROWS) {
    return rowLimitError(allRows.length)
  }
  return null
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

  const rowLimit = enforceRowLimit(allRows)
  if (rowLimit) return rowLimit

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

export async function parseCommissionXlsx(buffer: ArrayBuffer): Promise<ParseResult | ParseError> {
  if (!isXlsxZipBuffer(buffer)) {
    return { message: invalidXlsxMessage(), foundHeaders: [] }
  }

  try {
    const XLSX = await loadXlsxModule()
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

class ParseTimeoutError extends Error {
  constructor() {
    super('PARSE_TIMEOUT')
    this.name = 'ParseTimeoutError'
  }
}

function withParseTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ParseTimeoutError()), COMMISSION_PARSE_TIMEOUT_MS)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function parseCommissionFileInner(file: File): Promise<ParseResult | ParseError> {
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

export async function parseCommissionFile(file: File): Promise<ParseResult | ParseError> {
  if (isFileTooLarge(file)) {
    return { message: fileTooLargeMessage(file), foundHeaders: [] }
  }

  try {
    return await withParseTimeout(parseCommissionFileInner(file))
  } catch (error) {
    if (error instanceof ParseTimeoutError) {
      return { message: parseTimeoutMessage(), foundHeaders: [] }
    }
    return { message: 'Failed to read the file. Please try again.', foundHeaders: [] }
  }
}

export function isParseError(result: ParseResult | ParseError): result is ParseError {
  return 'message' in result
}
