import { useCallback, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'

interface CsvUploadZoneProps {
  onFileLoaded: (file: File) => void
  isProcessing?: boolean
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function CsvUploadZone({ onFileLoaded, isProcessing }: CsvUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!isAcceptedFile(file)) {
        setFileError('Please upload a .csv or .xlsx file.')
        return
      }
      setFileError(null)
      onFileLoaded(file)
    },
    [onFileLoaded],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="flex flex-col items-center">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex w-full max-w-xl flex-col items-center rounded-2xl border-2 border-dashed px-8 py-16 transition-all ${
          isDragging
            ? 'border-emerald bg-emerald/5'
            : 'border-border-warm bg-cream-card shadow-sm hover:border-emerald/40'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald" />
            <p className="font-heading text-xl font-semibold text-ink">Analyzing your report...</p>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream">
              <FileSpreadsheet className="h-8 w-8 text-emerald" />
            </div>
            <h2 className="font-heading mb-2 text-2xl font-semibold text-ink">
              Upload Commission Report
            </h2>
            <p className="mb-6 max-w-sm text-center font-sans text-sm text-stone">
              Drop your TikTok Shop commission report here, or click to browse. We&apos;ll
              analyze performance and build your filming schedule.
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
              <span className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm">
                <Upload className="h-4 w-4" />
                Choose File
              </span>
            </label>
          </>
        )}
      </div>
      {fileError && (
        <p className="mt-4 font-sans text-sm text-tier-deadline">{fileError}</p>
      )}
      <p className="mt-4 font-sans text-xs text-stone">Supports .csv and .xlsx files</p>
    </div>
  )
}
