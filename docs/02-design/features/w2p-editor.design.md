---
template: design
version: 1.2
---

# w2p-editor Design Document

> **Summary**: React + TypeScript + Zustand + Fabric.js 기반 W2P(Web-to-Print) 캔버스 그래픽 에디터 미니 구현
>
> **Project**: w2p-editor
> **Version**: 0.1.0
> **Author**: chickenboys
> **Date**: 2026-08-24
> **Status**: Draft
> **Planning Doc**: [w2p-editor.plan.md](../../01-plan/features/w2p-editor.plan.md)

> 백엔드/DB/인증이 없는 정적 SPA이므로 원본 템플릿의 API 명세, DB 스키마, 보안 섹션은 N/A 처리하고 캔버스 아키텍처·상태 모델·컴포넌트 설계에 집중한다.

---

## 1. Overview

### 1.1 Design Goals

- Fabric.js 캔버스와 Zustand 스토어를 단방향에 가까운 흐름으로 동기화해, "캔버스에서 뭘 하든 스토어가 진실의 원천(source of truth) 역할을 한다"는 원칙을 명확히 유지한다.
- 레이어/속성/undo-redo/저장-내보내기 로직을 컴포넌트가 아닌 스토어·유틸에 모아, 인터뷰에서 "상태 설계"를 설명하기 쉬운 구조로 만든다.
- 데스크톱 마우스 조작과 모바일 터치 조작을 같은 Fabric 인스턴스로 처리하되, 반응형 레이아웃(패널 접기 등)은 CSS로 분리한다.

### 1.2 Design Principles

- **단일 진실 원천**: 레이어 목록/선택 상태/히스토리는 Zustand 스토어에만 존재한다. Fabric 캔버스는 스토어를 렌더링하는 뷰이자 입력 소스다.
- **이벤트 게이트웨이 단일화**: Fabric 캔버스 이벤트(`object:modified`, `selection:created` 등)는 `Canvas` 컴포넌트 한 곳에서만 구독해 스토어 액션으로 변환한다. 다른 컴포넌트는 Fabric 인스턴스를 직접 건드리지 않는다.
- **작지만 실무적인 범위**: 과도한 추상화(레이어 시스템 플러그인화 등) 대신, MVP 요구사항에 딱 맞는 타입과 함수로 구성한다.

---

## 2. Architecture

### 2.1 Component Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                              App                                    │
│  ┌───────────┐   ┌───────────────────────┐   ┌───────────────────┐│
│  │  Toolbar   │   │        Canvas          │   │   LayerPanel      ││
│  │ (텍스트추가/│   │  (Fabric.Canvas 래핑)  │   │ (목록/순서/잠금/  ││
│  │ 이미지업로드│──▶│  ─ object:added        │◀──│  삭제/복제)       ││
│  │ /내보내기) │   │  ─ object:modified     │   │                    ││
│  └───────────┘   │  ─ selection:created   │   └───────────────────┘│
│                   └───────────┬────────────┘                        │
│                                │ dispatch                            │
│                                ▼                                     │
│                        ┌───────────────┐        ┌───────────────────┐│
│                        │ editorStore    │◀──────▶│ PropertiesPanel   ││
│                        │ (Zustand)      │  read/  │ (x/y/w/h/rotation ││
│                        │ layers/select/ │  write  │ 폰트/색상/정렬)   ││
│                        │ history        │         └───────────────────┘│
│                        └───────┬────────┘                              │
│                                │ serialize/deserialize                  │
│                                ▼                                        │
│                     canvasSerialization.ts                              │
│                     (localStorage / 파일 다운로드 / PNG export)          │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
[사용자 조작]
  캔버스에서 드래그/리사이즈/회전
    → Fabric 이벤트(object:modified) 발생
    → Canvas 컴포넌트가 이벤트 핸들러에서 스토어 액션 호출(updateLayerTransform)
    → editorStore 갱신 + 히스토리 스택에 스냅샷 push
    → PropertiesPanel/LayerPanel이 구독 중인 상태 변경으로 리렌더

[속성 패널에서 조작]
  PropertiesPanel의 x 입력값 변경
    → 스토어 액션 호출(updateLayerTransform)
    → 스토어가 갱신되면 Canvas가 useEffect로 해당 Fabric 객체에 set() 적용 + canvas.requestRenderAll()

[Undo/Redo]
  Ctrl/Cmd+Z
    → 스토어의 history.undo() 호출 → 이전 스냅샷으로 layers 교체
    → Canvas가 layers 변경을 감지해 loadFromJSON으로 캔버스 재구성
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `Canvas` | `editorStore`, `fabric` | 캔버스 렌더링, Fabric↔Store 이벤트 브릿지 |
| `Toolbar` | `editorStore`, `canvasSerialization` | 텍스트/이미지 추가, 저장/불러오기/PNG 내보내기 트리거 |
| `LayerPanel` | `editorStore` | 레이어 목록 표시 및 순서/잠금/삭제/복제 액션 디스패치 |
| `PropertiesPanel` | `editorStore` | 선택 객체의 transform/스타일 속성 편집 |
| `canvasSerialization.ts` | `fabric` (JSON 직렬화만, React 비의존) | 저장/불러오기/PNG export 순수 함수 |

---

## 3. Data Model

### 3.1 Entity Definition

```typescript
// src/types/editor.ts

export type LayerType = 'text' | 'image';

export interface LayerBase {
  id: string;            // Fabric object의 커스텀 id와 동일하게 유지
  type: LayerType;
  name: string;           // 레이어 패널 표시용 이름 (예: "텍스트 1")
  locked: boolean;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;         // 캔버스 stacking order와 동기화
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  src: string;            // data URL (로컬 업로드 결과)
}

export type EditorLayer = TextLayer | ImageLayer;

export interface CanvasPreset {
  id: string;
  label: string;          // "명함 90x50mm" 등
  widthMm: number;
  heightMm: number;
  bleedMm: number;        // 재단선 여백
  safeMarginMm: number;   // 안전 영역 여백
}

export interface EditorSnapshot {
  layers: EditorLayer[];
  selectedId: string | null;
}
```

### 3.2 Entity Relationships

```
[CanvasPreset] 1 ──── 1 [EditorState.activePreset]
                              │
                              └── N [EditorLayer] (layers 배열)
                                        │
                              selectedId ──▶ 1 [EditorLayer] (선택 참조, id 매칭)

[EditorSnapshot] N ──── 1 [History Stack] (undo/redo용 과거/미래 스냅샷 배열)
```

### 3.3 Persistence (localStorage / File, DB 아님)

```typescript
// localStorage key: "w2p-editor:project"
interface PersistedProject {
  version: 1;
  presetId: string;
  fabricJson: unknown;   // canvas.toJSON()의 원본 결과 (Fabric이 복원을 책임짐)
  layers: EditorLayer[]; // 레이어 패널 메타(zIndex, locked, name 등) 별도 보관
  savedAt: string;       // ISO timestamp
}
```

> Fabric.js의 `toJSON`/`loadFromJSON`이 도형 자체의 직렬화를 담당하므로, 별도 DB 스키마는 불필요. 우리가 관리하는 건 Fabric JSON 위에 얹는 "레이어 메타데이터"뿐이다.

---

## 4. API Specification

MVP 범위에는 REST/GraphQL 연동이 없음 (N/A). 스트레치 FR-13(더미 REST API 연동 데모)에서만 아래를 사용한다.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | json-server 목데이터 — 저장된 디자인 프로젝트 목록 조회 |
| POST | `/projects` | 현재 캔버스 JSON을 새 프로젝트로 저장 |

---

## 5. UI/UX Design

### 5.1 Screen Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar: [사이즈 프리셋 ▾] [텍스트 추가] [이미지 업로드] [Undo][Redo] [저장][불러오기][PNG 내보내기] │
├───────────────┬──────────────────────────────────┬────────────────┤
│  LayerPanel    │            Canvas (Fabric)        │ PropertiesPanel │
│  - 레이어 1    │   ┌ bleed ─────────────────┐      │  x [   ]         │
│  - 레이어 2    │   │ ┌ safe area ─────────┐ │      │  y [   ]         │
│  - ...         │   │ │                     │ │      │  w [   ]         │
│  [▲][▼][🔒][🗑][⧉]│   │ │                     │ │      │  h [   ]         │
│                │   │ └─────────────────────┘ │      │  rotation [  ]°  │
│                │   └──────────────────────────┘      │  (텍스트만) 폰트/│
│                │                                      │  크기/색상/정렬  │
└───────────────┴──────────────────────────────────┴────────────────┘
```

### 5.2 Screen Layout (Mobile / narrow viewport)

```
┌───────────────────────┐
│ Toolbar (아이콘, 가로스크롤)│
├───────────────────────┤
│                       │
│   Canvas (핀치줌 가능) │
│                       │
├───────────────────────┤
│ [레이어] [속성] 탭 전환 │  ← LayerPanel/PropertiesPanel을 바텀시트/탭으로 축소
└───────────────────────┘
```

### 5.3 User Flow

```
프리셋 선택 → 캔버스 크기/가이드 갱신
  → 텍스트/이미지 추가 → 캔버스에서 드래그·리사이즈·회전 (또는 속성 패널로 수치 입력)
  → 레이어 패널에서 순서/잠금/삭제/복제
  → (필요시 Undo/Redo)
  → 저장(localStorage/파일) 또는 PNG 내보내기
```

### 5.4 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `Canvas` | `src/components/Canvas/` | Fabric 인스턴스 생성/파괴, 프리셋별 크기+가이드라인 렌더, Fabric↔Store 이벤트 동기화, 터치/핀치줌 처리 |
| `Toolbar` | `src/components/Toolbar/` | 프리셋 선택, 텍스트/이미지 추가 트리거, Undo/Redo 버튼, 저장/불러오기/PNG 내보내기 버튼 |
| `LayerPanel` | `src/components/LayerPanel/` | 레이어 목록, 순서 변경/잠금/삭제/복제 액션 |
| `PropertiesPanel` | `src/components/PropertiesPanel/` | 선택 객체 x/y/w/h/rotation 입력, 텍스트 스타일 편집, 정렬 버튼 |

---

## 6. Error Handling

MVP는 서버 통신이 없어 HTTP 에러 코드 체계는 N/A. 대신 클라이언트 예외 시나리오만 다룬다.

| Situation | Cause | Handling |
|-----------|-------|----------|
| 이미지 업로드 파일이 이미지가 아님 | 사용자가 잘못된 파일 선택 | `accept="image/*"` + 업로드 시 MIME 체크, 실패 시 alert |
| localStorage 저장 실패(용량 초과 등) | 브라우저 저장소 한도 | try/catch로 감싸고 "파일로 다운로드" 대안 안내 |
| 불러오기한 JSON이 손상됨 | 사용자가 다른 파일 업로드 | `loadFromJSON` 실패 시 alert, 기존 캔버스 유지 |

---

## 7. Security Considerations

- [x] 입력 검증: 이미지 업로드 MIME 타입 체크 정도만 (서버 없음, XSS/SQLi 벡터 최소)
- [ ] 인증/인가 — N/A (백엔드 없음)
- [ ] 민감정보 암호화 — N/A
- [ ] HTTPS 강제 — 배포 플랫폼(Vercel 등)이 기본 제공
- [ ] Rate Limiting — N/A

---

## 8. Test Plan

시간 제약상 자동화 테스트는 스트레치 이후로 미루고, MVP는 수동 QA 체크리스트로 검증한다.

### 8.1 수동 QA 체크리스트 (Definition of Done과 매핑)

- [ ] 프리셋 변경 시 캔버스 크기/bleed/safe area가 즉시 갱신된다
- [ ] 텍스트 추가 → 폰트/크기/색상/정렬 변경이 캔버스에 반영된다
- [ ] 이미지 업로드 → 드래그/리사이즈/회전이 정상 동작한다
- [ ] 레이어 패널의 순서변경/잠금/삭제/복제가 캔버스와 동기화된다
- [ ] 속성 패널 숫자 입력이 캔버스 객체를 정확히 이동/리사이즈/회전시킨다
- [ ] Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z가 정상 동작한다
- [ ] 저장 후 새로고침/불러오기로 동일한 디자인이 복원된다
- [ ] PNG 내보내기 결과물이 실제 디자인과 일치한다
- [ ] 모바일 뷰포트(또는 터치 에뮬레이션)에서 드래그/핀치줌이 동작한다

---

## 9. Clean Architecture (Starter 레벨 축약)

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | Canvas/Toolbar/LayerPanel/PropertiesPanel | `src/components/` |
| **State** | 레이어/선택/히스토리 상태 및 액션 | `src/store/editorStore.ts` |
| **Domain** | 레이어/프리셋 타입 정의 | `src/types/editor.ts` |
| **Infrastructure** | Fabric JSON 직렬화, localStorage/파일 IO, PNG export | `src/utils/canvasSerialization.ts` |

### 9.2 Dependency Rules

```
Presentation ──▶ State(Zustand) ──▶ Domain(types)
     │                                    ▲
     └──────────▶ Infrastructure(utils) ──┘

Rule: Presentation은 Fabric 인스턴스를 Canvas 컴포넌트 밖으로 노출하지 않는다.
      Infrastructure(utils)는 React를 import하지 않는다 (순수 함수 유지, 테스트 용이성).
```

---

## 10. Coding Convention Reference

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `Canvas`, `LayerPanel`, `PropertiesPanel` |
| Store actions | camelCase 동사형 | `addTextLayer`, `updateLayerTransform`, `undo`, `redo` |
| Types | PascalCase | `EditorLayer`, `CanvasPreset` |
| Files (component) | PascalCase.tsx (폴더당 index.tsx) | `Canvas/Canvas.tsx` |
| Files (utility/store) | camelCase.ts | `editorStore.ts`, `canvasSerialization.ts` |

### 10.2 Import Order

```typescript
// 1. External libraries
import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'

// 2. Internal absolute/relative imports
import { useEditorStore } from '@/store/editorStore'

// 3. Type imports
import type { EditorLayer } from '@/types/editor'

// 4. Styles
import './Canvas.css'
```

### 10.3 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| State management | Zustand 단일 스토어(`editorStore`), `layers`/`selectedId`/`past`/`future` 필드로 히스토리 관리 |
| Fabric↔Store 동기화 | `Canvas` 컴포넌트 내부에서만 Fabric 이벤트 구독, 액션 호출로 스토어에 반영 |
| 에러 처리 | try/catch + 최소한의 사용자 피드백(alert), 별도 에러 바운더리는 과함 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
w2p (repo root, "web/" 하위 디렉토리 없이 바로 여기)
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── mockups/            (스트레치: 목업 이미지)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── components/
    │   ├── Canvas/
    │   │   ├── Canvas.tsx
    │   │   └── Canvas.css
    │   ├── Toolbar/
    │   │   ├── Toolbar.tsx
    │   │   └── Toolbar.css
    │   ├── LayerPanel/
    │   │   ├── LayerPanel.tsx
    │   │   └── LayerPanel.css
    │   └── PropertiesPanel/
    │       ├── PropertiesPanel.tsx
    │       └── PropertiesPanel.css
    ├── store/
    │   └── editorStore.ts
    ├── types/
    │   └── editor.ts
    └── utils/
        ├── canvasSerialization.ts
        └── presets.ts        (mm → px 변환 포함 프리셋 상수)
```

### 11.2 Implementation Order (MVP 1~9 매핑)

1. [ ] Vite React-TS 프로젝트를 저장소 루트에 초기화, `fabric`/`zustand` 설치
2. [ ] `types/editor.ts` — `EditorLayer`, `CanvasPreset` 등 타입 정의
3. [ ] `utils/presets.ts` — 명함(90x50mm)/A4 포스터 프리셋 + mm→px 변환 + bleed/safe area 계산
4. [ ] `store/editorStore.ts` — layers/selectedId/activePreset + history(past/future) + 액션(add/update/remove/duplicate/reorder/undo/redo)
5. [ ] `components/Canvas/Canvas.tsx` — Fabric 캔버스 초기화, 프리셋 크기 반영, bleed/safe area 가이드라인 렌더, Fabric 이벤트 → 스토어 액션 브릿지 (MVP 1)
6. [ ] 텍스트 레이어 추가 + `PropertiesPanel`의 폰트/크기/색상/정렬 편집 (MVP 2)
7. [ ] 이미지 업로드 + Fabric transform(이동/리사이즈/회전) (MVP 3)
8. [ ] `components/LayerPanel/LayerPanel.tsx` — 목록/순서/잠금/삭제/복제 (MVP 4)
9. [ ] `PropertiesPanel`에 x/y/w/h/rotation 숫자 입력 + 정렬 버튼 추가 (MVP 5)
10. [ ] Undo/Redo 스토어 로직 + 키보드 단축키 바인딩 (MVP 6)
11. [ ] `utils/canvasSerialization.ts` — `toJSON`/`loadFromJSON` 기반 저장/불러오기 (localStorage + 파일 다운로드) (MVP 7)
12. [ ] PNG 내보내기 (`canvas.toDataURL()`) (MVP 8)
13. [ ] 반응형 CSS + 터치/핀치 줌 대응, 모바일 레이아웃(탭 전환) (MVP 9)
14. [ ] README 작성 (실행 방법 + 공고 요구사항 대응표) + 배포

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-24 | 최초 작성 | chickenboys |
