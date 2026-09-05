import { useEffect, useState } from 'react'
import './NumberField.css'

interface NumberFieldProps {
  label: string
  value: number
  suffix?: string
  // Precision follows step (e.g. 0.1 -> 1 decimal place); default 1 keeps
  // the original whole-number-only behavior for x/y/width/height/etc.
  step?: number
  onCommit: (value: number) => void
}

const decimalsFor = (step: number) => Math.max(0, -Math.floor(Math.log10(step)))
const formatValue = (value: number, step: number) => value.toFixed(decimalsFor(step))

export function NumberField({ label, value, suffix, step = 1, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(formatValue(value, step))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(formatValue(value, step))
  }, [value, step, focused])

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      onCommit(parsed)
    } else {
      setDraft(formatValue(value, step))
    }
  }

  return (
    <label className="ui-number-field">
      <span>{label}</span>
      <div className="ui-number-field-wrap">
        <input
          type="number"
          step={step}
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {suffix && <span className="ui-number-field-suffix">{suffix}</span>}
      </div>
    </label>
  )
}
