# W2P Editor

인쇄물(명함, 포스터 등)에 텍스트/이미지를 배치해서 디자인하는 웹 기반 W2P(Web-to-Print) 그래픽 에디터의 축소판입니다. 위시켓 "React/TypeScript 기반 W2P 그래픽 에디터 프론트엔드 개발" 공고 지원용 개인 포트폴리오 프로젝트로 제작했습니다.

**라이브 데모**: https://w2p-kappa.vercel.app

## 실행 방법

```bash
npm install
npm run dev       # http://localhost:5173
```

빌드 / 프리뷰:

```bash
npm run build      # tsc -b && vite build
npm run preview
```

더미 REST API(json-server) — "프로젝트 목록" 기능용, 별도 터미널에서 실행:

```bash
npm run api        # http://localhost:4000 (db.json 기반)
```

## 주요 기능

- **캔버스 워크스페이스**: 명함(90x50mm) / A4 포스터 / 정사각 카드 프리셋 선택, 재단선(bleed)·안전 영역(safe area) 가이드 표시
- **텍스트 레이어**: 추가, 폰트/크기/색상/정렬 편집
- **이미지 레이어**: 로컬 업로드 후 드래그 이동 / 리사이즈 / 회전
- **레이어 패널**: 목록, 순서 변경(맨 앞/뒤), 잠금, 삭제, 복제
- **속성 패널**: 선택 객체의 x/y/width/height/rotation 직접 수정, 캔버스 기준 정렬
- **Undo/Redo**: `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`
- **저장/불러오기**: localStorage 저장, JSON 파일로 내보내기/불러오기
- **PNG 내보내기**
- **반응형/모바일**: 좁은 화면에서는 레이어/속성 패널이 하단 탭으로 전환, 캔버스에서 두 손가락 핀치 줌 지원
- **줌/팬**: 우측 하단 플로팅 컨트롤 또는 Ctrl/Cmd+휠로 커서 위치 기준 확대·축소, 손 도구(스페이스바)로 자유 패닝 (Photoshop CS4+ 방식 — 줌 상태와 무관하게 항상 이동 가능)
- **정렬 스냅 가이드**: 오브젝트를 드래그하면 캔버스 중심/가장자리나 다른 오브젝트의 가장자리·중심에 자동으로 스냅 (Figma/일러스트레이터 스타일)
- **다중 선택 및 그룹 이동**: Shift/Cmd/Ctrl+클릭으로 여러 레이어를 선택해 한 번에 드래그·복제·삭제 (Fabric.js `ActiveSelection` 활용)
- **(스트레치) 상품 목업 미리보기**: 명함/포스터/정사각 카드 각각 실제 비율에 맞춘 SVG 목업 위에 현재 디자인을 오버레이해서 미리보기 (현재 캔버스 규격과 일치하는 목업이 기본 선택됨)
- **(스트레치) 더미 REST API 연동**: json-server로 "프로젝트 목록"을 GET/POST/DELETE — 이름 붙여 저장·불러오기·삭제 흐름을 실제 REST 호출로 시연 (`npm run api`)

## 기술 스택

React 18 · TypeScript · Vite · Zustand · Fabric.js 7 · 순수 CSS(반응형) · json-server(더미 REST API, 개발용)

## 프로젝트 구조

```
src/
  components/
    Canvas/            Fabric.js 캔버스 래퍼 (렌더링 + 좌표 변환 + 이벤트 동기화)
    Toolbar/           프리셋 선택, 레이어 추가, 실행취소/저장/내보내기
    LayerPanel/         레이어 목록 및 조작 (다중 선택 지원)
    PropertiesPanel/    선택 객체 속성 편집
    MockupPreview/      명함/포스터/정사각 카드 SVG 목업 미리보기
    ProjectList/         더미 REST API 기반 프로젝트 목록 저장/불러오기
    common/              여러 화면에서 재사용하는 Modal, NumberField 등
  store/editorStore.ts  Zustand 스토어 (레이어, 선택, undo/redo 히스토리)
  types/editor.ts        레이어/프리셋 타입 정의
  utils/
    presets.ts                템플릿 사이즈 프리셋, mm↔px 변환
    canvasSerialization.ts    저장/불러오기/PNG 내보내기
```

### 좌표 설계 노트

Fabric.js 6+ 는 객체의 기준점(`originX`/`originY`)이 기본값 `center`로 바뀌었습니다. 이 프로젝트의 `EditorLayer`는 (디자인 툴에서 익숙한) 좌상단 x/y 좌표계를 쓰기 때문에, `Canvas.tsx`에서 store ↔ Fabric 객체를 동기화할 때마다 중심 좌표로 변환해서 반영하고, 회전은 항상 객체 중심을 기준으로 처리합니다 (Figma/Canva와 동일한 방식).

## 공고 요구사항 대응

| 요구사항 | 대응 |
|---|---|
| TypeScript, React, 컴포넌트 설계 | React 18 + TS로 Canvas/Toolbar/LayerPanel/PropertiesPanel을 역할별로 분리 |
| Zustand 등 상태관리로 복잡한 UI 상태 설계 | `editorStore.ts`에서 레이어 목록·선택·undo/redo 히스토리 스택을 단일 스토어로 관리 |
| REST/GraphQL API 연동, 반응형/모바일웹 | json-server 기반 REST API로 프로젝트 목록 GET/POST/DELETE(`src/utils/api.ts`), JSON 파일 저장/불러오기, 모바일 탭 레이아웃 + 터치 핀치 줌 |
| Canvas 2D, SVG, 좌표 변환, Fabric.js | Fabric.js 캔버스 렌더링, bleed/safe area 가이드는 SVG 오버레이, center↔top-left 좌표 변환 로직 |
| 그래픽 에디터 서비스 개발 경험 | 레이어 추가/선택/transform/레이어 순서/속성 편집 등 에디터 핵심 플로우 구현 |
| 재사용 가능한 컴포넌트/디자인 시스템 | `src/components/common/`에 `Modal`, `NumberField` 등 여러 화면에서 재사용하는 컴포넌트를 분리 |
| AI 기반 개발 도구 활용 경험 | 이 프로젝트 자체를 Claude Code와 함께 PDCA(계획→설계→구현→검증) 방식으로 진행 |
