import { useCallback, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { EditorialMark } from '../ui/EditorialMark'

interface MomentumModeScreenProps {
  onFileLoaded: (file: File) => void
  onBack: () => void
  isProcessing?: boolean
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function MomentumModeScreen({
  onFileLoaded,
  onBack,
  isProcessing,
}: MomentumModeScreenProps) {
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
      className={`mx-auto w-full max-w-xl fade-in ${
        isDragging ? 'outline outline-1 outline-ink' : ''
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        className="link-elegant mb-8 font-body text-sm text-stone"
      >
        ← Back to upload
      </button>

      {isProcessing ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Loader2 className="mb-6 h-9 w-9 animate-spin text-emerald" />
          <p className="font-display text-2xl font-bold text-ink">Analyzing your report...</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex justify-center">
            <EditorialMark />
          </div>
          <h1 className="font-display text-center text-3xl font-bold text-ink md:text-4xl">
            You&apos;re building momentum.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-center font-body text-base text-stone">
            Upload your commission report and we&apos;ll build a balanced schedule that rotates
            all your products evenly while your data builds up.
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

          <p className="label-caps mt-8 text-center">Supports .csv and .xlsx files</p>
        </>
      )}

      {fileError && (
        <p className="mt-6 text-center font-body text-sm text-tier-deadline">{fileError}</p>
      )}
    </div>
  )
}
