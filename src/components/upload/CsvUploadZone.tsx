import { useCallback, useState } from 'react'
import { ChevronDown, Loader2, Upload } from 'lucide-react'

interface CsvUploadZoneProps {
  onFileLoaded: (file: File) => void
  isProcessing?: boolean
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

const DOWNLOAD_STEPS = [
  'Open TikTok Shop for Creators and go to the Earnings page',
  'Tap Affiliate Orders',
  'Tap the download arrow in the top right corner',
  'Select your date range',
  'Under filter, select Video',
  'Download the file — it will save as an .xlsx file',
]

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function ReportDownloadHelp() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-emerald transition hover:text-emerald-light"
        aria-expanded={expanded}
      >
        How do I get this file?
        <ChevronDown
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="mx-auto mt-8 max-w-md text-left fade-in">
          <h3 className="font-body text-base font-semibold text-stone">
            Downloading your TikTok Shop report
          </h3>
          <ol className="mt-5 space-y-4 font-body text-[0.9375rem] leading-relaxed text-stone">
            {DOWNLOAD_STEPS.map((step, index) => (
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
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`flex min-h-[calc(100vh-14rem)] w-full flex-col items-center justify-center px-8 py-20 transition-colors ${
        isDragging ? 'bg-emerald-muted' : 'bg-cream'
      }`}
    >
      {isProcessing ? (
        <div className="flex flex-col items-center text-center">
          <Loader2 className="mb-6 h-12 w-12 animate-spin text-emerald" />
          <p className="font-display text-2xl font-semibold text-ink">Analyzing your report...</p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl text-center">
          <section className="mb-16">
            <h2 className="font-display text-2xl font-semibold text-ink md:text-3xl">
              Your TikTok Shop command center.
            </h2>
            <p className="mx-auto mt-5 max-w-xl font-body text-base leading-relaxed text-stone md:text-lg">
              CreatorExec analyzes your commission data, ranks your products by performance, and
              builds a personalized filming schedule for your next sprint — so you always know
              exactly what to film and when.
            </p>
          </section>

          <h2 className="font-display text-4xl leading-tight font-bold text-ink md:text-5xl lg:text-[3.25rem] lg:leading-[1.15]">
            Know exactly what to film. Every sprint.
          </h2>
          <p className="mx-auto mt-8 max-w-lg font-body text-lg leading-relaxed text-stone">
            Upload your TikTok Shop commission report and get a personalized filming schedule
            in seconds.
          </p>
          <label className="mt-12 inline-block cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <span className="btn-cta inline-flex min-w-[300px] items-center justify-center gap-3 px-12 py-5 font-body text-base">
              <Upload className="h-5 w-5" />
              Choose File
            </span>
          </label>

          <ReportDownloadHelp />

          <p className="label-caps mt-10">Supports .csv and .xlsx files</p>
        </div>
      )}
      {fileError && (
        <p className="mt-8 font-body text-sm text-tier-deadline">{fileError}</p>
      )}
    </div>
  )
}
