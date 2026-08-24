import { useState } from 'react'
import { Modal } from '../common/Modal'
import './MockupPreview.css'

export type MockupType = 'card' | 'poster' | 'square'

interface MockupPreviewProps {
  designDataUrl: string
  presetId: string
  onClose: () => void
}

const PRESET_TO_MOCKUP: Record<string, MockupType> = {
  'business-card': 'card',
  'poster-a4': 'poster',
  'square-card': 'square',
}

const MOCKUP_LABELS: Record<MockupType, string> = {
  card: '명함',
  poster: '포스터',
  square: '정사각 카드',
}

const PRINT_AREAS: Record<MockupType, { x: number; y: number; width: number; height: number }> = {
  card: { x: 40, y: 93, width: 240, height: 134 },
  poster: { x: 98, y: 28, width: 124, height: 182 },
  square: { x: 70, y: 70, width: 180, height: 180 },
}

export function MockupPreview({ designDataUrl, presetId, onClose }: MockupPreviewProps) {
  const [mockupType, setMockupType] = useState<MockupType>(
    PRESET_TO_MOCKUP[presetId] ?? 'card',
  )
  const area = PRINT_AREAS[mockupType]
  const matchesCurrentPreset = mockupType === PRESET_TO_MOCKUP[presetId]

  return (
    <Modal title="상품 목업 미리보기" onClose={onClose} dialogClassName="mockup-dialog">
        <div className="mockup-tabs">
          {(Object.keys(MOCKUP_LABELS) as MockupType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={mockupType === type ? 'is-active' : ''}
              onClick={() => setMockupType(type)}
            >
              {MOCKUP_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="mockup-canvas-wrap">
          <svg viewBox="0 0 320 320" className="mockup-svg">
            <defs>
              <clipPath id={`print-area-${mockupType}`}>
                <rect x={area.x} y={area.y} width={area.width} height={area.height} rx={mockupType === 'poster' ? 0 : 6} />
              </clipPath>
            </defs>

            {mockupType === 'card' && (
              <g>
                <rect x={0} y={0} width={320} height={320} fill="#e7dfd3" />
                <ellipse cx={160} cy={236} rx={130} ry={14} fill="#00000022" />
                <rect x={area.x} y={area.y} width={area.width} height={area.height} rx={8} fill="#ffffff" stroke="#c8c0b2" strokeWidth={2} />
              </g>
            )}

            {mockupType === 'poster' && (
              <g>
                <rect x={0} y={0} width={320} height={320} fill="#f1f3f5" />
                <rect x={78} y={8} width={164} height={222} fill="none" stroke="#c9ccd1" strokeWidth={1} />
                <rect
                  x={area.x - 8}
                  y={area.y - 8}
                  width={area.width + 16}
                  height={area.height + 16}
                  fill="#ffffff"
                  stroke="#6b7280"
                  strokeWidth={4}
                />
                <ellipse cx={160} cy={244} rx={90} ry={10} fill="#00000014" />
              </g>
            )}

            {mockupType === 'square' && (
              <g>
                <rect x={0} y={0} width={320} height={320} fill="#e7dfd3" />
                <ellipse cx={160} cy={266} rx={110} ry={12} fill="#00000022" />
                <rect x={area.x} y={area.y} width={area.width} height={area.height} rx={10} fill="#ffffff" stroke="#c8c0b2" strokeWidth={2} />
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
              rx={mockupType === 'poster' ? 0 : 6}
              fill="none"
              stroke="#d1d5db"
              strokeDasharray="3 3"
            />
          </svg>
        </div>

        <p className="mockup-hint">
          {matchesCurrentPreset
            ? '현재 캔버스 규격과 일치하는 목업입니다.'
            : '현재 캔버스 규격과 다른 목업입니다. 비율이 다르게 표시될 수 있어요.'}
          {' '}실제 인쇄 결과물이 아닌 배치 확인용 이미지입니다.
        </p>
    </Modal>
  )
}
