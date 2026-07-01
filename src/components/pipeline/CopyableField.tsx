import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CopyableFieldProps {
  label: string
  value: string
  placeholder?: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function CopyableField({
  label,
  value,
  placeholder,
  onChange,
  readOnly = false,
}: CopyableFieldProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <label className="label-caps mb-2 block">{label}</label>
      <div className="flex gap-2">
        {readOnly || !onChange ? (
          <div className="input-field min-w-0 flex-1 truncate px-4 py-3 font-body text-sm text-ink">
            {value || placeholder || '—'}
          </div>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input-field min-w-0 flex-1 px-4 py-3 font-body text-sm"
          />
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!value.trim()}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center border border-border-warm text-stone transition hover:border-emerald hover:text-emerald disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Copy ${label}`}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
