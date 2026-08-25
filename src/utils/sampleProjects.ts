import type { TextLayer } from '../types/editor'

export interface SampleProject {
  id: string
  label: string
  presetId: string
  layers: TextLayer[]
}

const textLayer = (
  overrides: Partial<TextLayer> & Pick<TextLayer, 'id' | 'text' | 'x' | 'y' | 'width' | 'height'>,
): TextLayer => ({
  type: 'text',
  name: overrides.id,
  locked: false,
  visible: true,
  rotation: 0,
  fontFamily: 'Noto Sans KR',
  fontSize: 14,
  color: '#111827',
  align: 'left',
  ...overrides,
})

export const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'sample-business-card',
    label: '샘플: 명함',
    presetId: 'business-card',
    layers: [
      textLayer({
        id: 'sample-card-brand',
        text: 'STUDIO KIM',
        x: 190,
        y: 24,
        width: 126,
        height: 14,
        fontSize: 10,
        color: '#2563eb',
        align: 'right',
      }),
      textLayer({
        id: 'sample-card-name',
        text: '이서연',
        x: 24,
        y: 54,
        width: 200,
        height: 32,
        fontSize: 26,
        color: '#111827',
      }),
      textLayer({
        id: 'sample-card-title',
        text: 'Product Designer',
        x: 24,
        y: 90,
        width: 220,
        height: 18,
        fontSize: 12,
        color: '#6b7280',
      }),
      textLayer({
        id: 'sample-card-contact',
        text: 'hello@studiokim.com  ·  010-1234-5678',
        x: 24,
        y: 150,
        width: 290,
        height: 16,
        fontSize: 10,
        color: '#374151',
      }),
    ],
  },
  {
    id: 'sample-poster-a4',
    label: '샘플: 포스터',
    presetId: 'poster-a4',
    layers: [
      textLayer({
        id: 'sample-poster-eyebrow',
        text: '2026 EXHIBITION',
        x: 97,
        y: 90,
        width: 600,
        height: 22,
        fontSize: 16,
        color: '#2563eb',
        align: 'center',
      }),
      textLayer({
        id: 'sample-poster-title',
        text: '빛과 색의 대화',
        x: 47,
        y: 160,
        width: 700,
        height: 170,
        fontFamily: 'Nanum Myeongjo',
        fontSize: 64,
        color: '#111827',
        align: 'center',
      }),
      textLayer({
        id: 'sample-poster-subtitle',
        text: '현대미술 특별전',
        x: 97,
        y: 360,
        width: 600,
        height: 36,
        fontSize: 26,
        color: '#4b5563',
        align: 'center',
      }),
      textLayer({
        id: 'sample-poster-info',
        text: '2026. 9. 12 – 11. 15   |   서울시립미술관',
        x: 97,
        y: 1000,
        width: 600,
        height: 26,
        fontSize: 18,
        color: '#374151',
        align: 'center',
      }),
      textLayer({
        id: 'sample-poster-footer',
        text: '주최 · 서울문화재단',
        x: 97,
        y: 1040,
        width: 600,
        height: 18,
        fontSize: 12,
        color: '#9ca3af',
        align: 'center',
      }),
    ],
  },
]
