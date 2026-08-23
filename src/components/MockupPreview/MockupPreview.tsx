import { useState } from 'react'
import './MockupPreview.css'

export type MockupType = 'tshirt' | 'mug'

interface MockupPreviewProps {
  designDataUrl: string
  onClose: () => void
}

const PRINT_AREAS: Record<MockupType, { x: number; y: number; width: number; height: number }> = {
  tshirt: { x: 100, y: 112, width: 100, height: 120 },
  mug: { x: 108, y: 92, width: 104, height: 96 },
}

export function MockupPreview({ designDataUrl, onClose }: MockupPreviewProps) {
  const [mockupType, setMockupType] = useState<MockupType>('tshirt')
  const area = PRINT_AREAS[mockupType]

  return (
    <div className="mockup-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mockup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mockup-header">
          <h2>상품 목업 미리보기</h2>
          <button type="button" className="mockup-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="mockup-tabs">
          <button
            type="button"
            className={mockupType === 'tshirt' ? 'is-active' : ''}
            onClick={() => setMockupType('tshirt')}
          >
            티셔츠
          </button>
          <button
            type="button"
            className={mockupType === 'mug' ? 'is-active' : ''}
            onClick={() => setMockupType('mug')}
          >
            머그컵
          </button>
        </div>

        <div className="mockup-canvas-wrap">
          <svg viewBox="0 0 320 320" className="mockup-svg">
            <defs>
              <clipPath id={`print-area-${mockupType}`}>
                <rect x={area.x} y={area.y} width={area.width} height={area.height} rx={4} />
              </clipPath>
            </defs>

            {mockupType === 'tshirt' ? (
              <g>
                <polygon points="90,80 50,68 28,118 68,140" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={2} />
                <polygon points="230,80 270,68 292,118 252,140" fill="#e5e7eb" stroke="#9ca3af" strokeWidth={2} />
                <rect x={80} y={78} width={160} height={214} rx={16} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} />
                <ellipse cx={160} cy={76} rx={24} ry={14} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={2} />
              </g>
            ) : (
              <g>
                <path
                  d="M244,100 C286,100 286,182 244,182"
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth={16}
                  strokeLinecap="round"
                />
                <path
                  d="M244,100 C286,100 286,182 244,182"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth={16}
                  strokeLinecap="round"
                  opacity={0.35}
                />
                <rect x={80} y={70} width={160} height={190} rx={10} fill="#f3f4f6" stroke="#9ca3af" strokeWidth={2} />
                <ellipse cx={160} cy={70} rx={80} ry={14} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={2} />
              </g>
            )}

            <g clipPath={`url(#print-area-${mockupType})`}>
              <image
                href={designDataUrl}
                x={area.x}
                y={area.y}
                width={area.width}
                height={area.height}
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
            <rect
              x={area.x}
              y={area.y}
              width={area.width}
              height={area.height}
              rx={4}
              fill="none"
              stroke="#d1d5db"
              strokeDasharray="3 3"
            />
          </svg>
        </div>

        <p className="mockup-hint">
          실제 인쇄 결과물이 아닌 배치 확인용 목업입니다. 디자인은 인쇄 영역에 맞춰 잘려서 표시됩니다.
        </p>
      </div>
    </div>
  )
}
