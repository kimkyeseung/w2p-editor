import { useEffect, useState } from 'react'
import './NumberField.css'

interface NumberFieldProps {
  label: string
  value: number
  suffix?: string
  onCommit: (value: number) => void
}

export function NumberField({ label, value, suffix, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(Math.round(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(Math.round(value)))
  }, [value, focused])

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      onCommit(parsed)
    } else {
      setDraft(String(Math.round(value)))
    }
  }

  return (
    <label className="ui-number-field">
      <span>{label}</span>
      <div className="ui-number-field-wrap">
        <input
          type="number"
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
