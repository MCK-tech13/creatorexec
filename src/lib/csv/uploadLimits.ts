/** Commission report upload limits and file validation. */

export const MAX_COMMISSION_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_COMMISSION_PARSED_ROWS = 50_000
export const COMMISSION_PARSE_TIMEOUT_MS = 30_000

const XLSX_ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const

export function formatMaxUploadSizeMb(): string {
  return String(MAX_COMMISSION_UPLOAD_BYTES / (1024 * 1024))
}

export function isFileTooLarge(file: File): boolean {
  return file.size > MAX_COMMISSION_UPLOAD_BYTES
}

export function fileTooLargeMessage(file: File): string {
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
  return `File is too large (${sizeMb} MB). Please upload a commission report under ${formatMaxUploadSizeMb()} MB.`
}

export function isXlsxZipBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < XLSX_ZIP_SIGNATURE.length) return false
  const bytes = new Uint8Array(buffer.slice(0, XLSX_ZIP_SIGNATURE.length))
  return XLSX_ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

export function invalidXlsxMessage(): string {
  return 'This file is not a valid Excel (.xlsx) workbook. Please export a .xlsx commission report from TikTok Shop.'
}

export function tooManyRowsMessage(rowCount: number): string {
  return `This file has too many rows (${rowCount.toLocaleString()}). Maximum is ${MAX_COMMISSION_PARSED_ROWS.toLocaleString()}. Try a shorter date range in your export.`
}

export function parseTimeoutMessage(): string {
  return 'This file took too long to process. It may be too complex — please check your export and try a smaller file.'
}
