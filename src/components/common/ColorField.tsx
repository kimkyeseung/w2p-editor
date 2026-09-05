import { useEditorStore } from '../../store/editorStore'
import './ColorField.css'

interface ColorFieldProps {
  label: string
  value: string
  onChange: (color: string) => void
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const recentColors = useEditorStore((s) => s.recentColors)
  const addRecentColor = useEditorStore((s) => s.addRecentColor)

  const pick = (color: string) => {
    onChange(color)
    addRecentColor(color)
  }

  return (
    <label className="prop-field">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => addRecentColor(e.target.value)}
      />
      {recentColors.length > 0 && (
        <div className="color-swatches">
          {recentColors.map((color) => (
            <button
              key={color}
              type="button"
              className="color-swatch"
              style={{ backgroundColor: color }}
              title={color}
              onClick={() => pick(color)}
            />
          ))}
        </div>
      )}
    </label>
  )
}
