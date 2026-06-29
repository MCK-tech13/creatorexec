import { useCallback, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { REPORT_DOWNLOAD_STEPS } from '../../lib/onboarding/reportDownloadSteps'
import { EditorialMark } from '../ui/EditorialMark'

interface CsvUploadZoneProps {
  onFileLoaded: (file: File) => void
  onEnterSampleMode: () => void
  onEnterMomentumMode: () => void
  isProcessing?: boolean
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
      className={`flex min-h-[calc(100vh-14rem)] w-full flex-col items-center justify-center bg-white px-8 py-16 transition-colors ${
        isDragging ? 'bg-white outline outline-1 outline-ink' : ''
      }`}
    >
      {isProcessing ? (
        <div className="flex flex-col items-center text-center">
          <Loader2 className="mb-6 h-9 w-9 animate-spin text-emerald" />
          <p className="font-display text-2xl font-bold text-ink">Analyzing your report...</p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-xl text-center">
          <div className="mb-5 flex justify-center">
            <EditorialMark />
          </div>
          <h2 className="font-display mx-auto max-w-md text-3xl leading-tight font-bold text-ink md:text-4xl">
            Know exactly what to film. Every sprint.
          </h2>
          <p className="mx-auto mt-6 max-w-lg font-body text-base text-stone">
            Upload your TikTok Shop commission report and get a personalized filming schedule
            in seconds.
          </p>
          <div className="mt-10 flex justify-center">
            <label className="block w-full max-w-[400px] cursor-pointer">
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
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <button
                type="button"
                onClick={onEnterSampleMode}
                className="font-body text-sm font-medium text-emerald transition hover:underline hover:underline-offset-4 hover:decoration-blush"
              >
                New to TikTok Shop? Start with your samples →
              </button>
              <p className="mt-1 font-body text-xs text-stone">
                No commission report needed — just add your current samples
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={onEnterMomentumMode}
                className="font-body text-sm font-medium text-emerald transition hover:underline hover:underline-offset-4 hover:decoration-blush"
              >
                Have some sales but not many? Try Momentum Mode →
              </button>
              <p className="mt-1 font-body text-xs text-stone">
                Upload your report and we&apos;ll build a balanced starter schedule
              </p>
            </div>
          </div>

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
