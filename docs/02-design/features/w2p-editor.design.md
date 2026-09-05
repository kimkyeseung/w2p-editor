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
> **Status**: Completed — 핵심 아키텍처는 유지된 채 이후에도 기능이 계속 확장됨 ([README.md](../../../README.md) 참고)
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

> 위 타입은 최초 설계 당시(MVP) 스냅샷이며, 이후 도형/경로 레이어·폴더·클리핑 마스크·가이드 등이 추가되며 계속 확장되었다. 현재 정확한 정의는 [src/types/editor.ts](../../../src/types/editor.ts)를 참고.

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

MVP 설계 당시엔 REST 연동이 없었다 (N/A). 실제로는 스트레치 단계에서 json-server 대신 Vercel Functions + Blob으로
`api/projects`(GET/POST/DELETE)를 구현했다 — 상세는 README의 "API/저장소 설계 노트" 참고.

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

서버/인증/DB가 없는 정적 SPA라 대부분 N/A. 실질적인 유일한 입력 검증은 이미지 업로드 시
`accept="image/*"` + MIME 체크 정도이고, HTTPS는 배포 플랫폼(Vercel)이 기본 제공한다.

---

## 8. Test Plan

초기(MVP)엔 수동 브라우저 QA로만 검증했고, 이후 스토어 로직(정렬/분포, undo/redo, 클리핑 마스크,
레이어 병합 등)이 복잡해지면서 `src/store/editorStore.test.ts` / `canvasHelpers.test.ts`에 Vitest
유닛 테스트를 추가했다. UI 동작 자체는 여전히 실제 브라우저(Claude Browser)로 클릭/드래그까지
재현해 검증하는 방식을 유지한다.

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

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-24 | 최초 작성 | chickenboys |
| 0.2 | 2026-09-06 | MVP 이후 계속 유효한 아키텍처 원칙(단방향 상태 흐름, 이벤트 게이트웨이 단일화, 좌표 변환)은 유지하고, 완료 시점에 이미 다 체크된 구현 순서·범용 코딩 컨벤션·구현 당시 파일 구조 등 실제 코드가 훨씬 정확한 출처인 섹션은 정리 — 최신 프로젝트 구조/기능은 [README.md](../../../README.md) 참고 | Claude Code |
