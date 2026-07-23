import { useCallback, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { REPORT_DOWNLOAD_STEPS } from '../../lib/onboarding/reportDownloadSteps'
import { EditorialMark } from '../ui/EditorialMark'

interface CsvUploadZoneProps {
  onFileLoaded: (file: File) => void
  onEnterSampleMode: () => void
  onEnterMomentumMode?: () => void
  isProcessing?: boolean
  showAlternatePaths?: boolean
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function ReportDownloadHelp() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="link-elegant font-body text-sm text-ink"
        aria-expanded={expanded}
      >
        How do I get this file?
      </button>

      {expanded && (
        <div className="mx-auto mt-6 max-w-md text-left fade-in">
          <h3 className="font-body text-sm font-semibold uppercase tracking-[0.14em] text-stone">
            Downloading your TikTok Shop report
          </h3>
          <ol className="mt-4 space-y-4 font-body text-base text-stone">
            {REPORT_DOWNLOAD_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="shrink-0 font-medium text-grey">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function CsvUploadZone({
  onFileLoaded,
  onEnterSampleMode,
  onEnterMomentumMode,
  isProcessing,
  showAlternatePaths = false,
}: CsvUploadZoneProps) {
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
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`flex min-h-[calc(100vh-14rem)] w-full flex-col items-center justify-center bg-white transition-colors ${
        isDragging ? 'bg-white outline outline-1 outline-ink' : ''
      }`}
    >
      {isProcessing ? (
        <div className="flex flex-col items-center text-center">
          <Loader2 className="mb-6 h-9 w-9 animate-spin text-emerald" />
          <p className="font-display text-2xl font-bold text-ink">Analyzing your report...</p>
        </div>
      ) : (
        <div className="w-full text-center">
          <div className="mb-5 flex justify-center">
            <EditorialMark />
          </div>
          <h2 className="font-display mx-auto max-w-md text-2xl leading-tight font-bold text-ink sm:text-3xl md:text-4xl">
            Know exactly what to film. Every sprint.
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-body text-sm text-stone sm:mt-6 sm:text-base">
            Upload your TikTok Shop commission report — or add a sample or favorite product —
            and get a personalized filming schedule.
          </p>
          <div className="mx-auto mt-10 flex w-full max-w-[400px] flex-col gap-3">
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
              <span className="btn-primary inline-flex w-full items-center justify-center gap-3 py-4 font-body">
                <Upload className="h-4 w-4" />
                Choose File
              </span>
            </label>
            <button
              type="button"
              onClick={onEnterSampleMode}
              className="btn-outline w-full py-4 font-body"
            >
              Add a sample or favorite product
            </button>
          </div>

          {showAlternatePaths && onEnterMomentumMode && (
            <div className="mt-10 space-y-3 border-t border-border-warm pt-8 text-center">
              <button
                type="button"
                onClick={onEnterMomentumMode}
                className="link-elegant block w-full font-body text-sm text-stone"
              >
                Have some sales but not many? Try adding more products to your catalog
              </button>
            </div>
          )}

          <ReportDownloadHelp />

          <p className="label-caps mt-10">Supports .csv and .xlsx files</p>
        </div>
      )}
      {fileError && (
        <p className="mt-6 font-body text-sm text-tier-deadline">{fileError}</p>
      )}
    </div>
  )
}
