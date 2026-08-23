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
- **(스트레치) 상품 목업 미리보기**: 티셔츠/머그컵 SVG 목업 위에 현재 디자인을 오버레이해서 미리보기

## 기술 스택

React 18 · TypeScript · Vite · Zustand · Fabric.js 7 · 순수 CSS(반응형)

## 프로젝트 구조

```
src/
  components/
    Canvas/            Fabric.js 캔버스 래퍼 (렌더링 + 좌표 변환 + 이벤트 동기화)
    Toolbar/           프리셋 선택, 레이어 추가, 실행취소/저장/내보내기
    LayerPanel/         레이어 목록 및 조작
    PropertiesPanel/    선택 객체 속성 편집
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
| REST/GraphQL API 연동, 반응형/모바일웹 | JSON 파일 저장/불러오기(직렬화 흐름), 모바일 탭 레이아웃 + 터치 핀치 줌 |
| Canvas 2D, SVG, 좌표 변환, Fabric.js | Fabric.js 캔버스 렌더링, bleed/safe area 가이드는 SVG 오버레이, center↔top-left 좌표 변환 로직 |
| 그래픽 에디터 서비스 개발 경험 | 레이어 추가/선택/transform/레이어 순서/속성 편집 등 에디터 핵심 플로우 구현 |
| 재사용 가능한 컴포넌트/디자인 시스템 | `PropertiesPanel`의 `NumberField`처럼 공통 입력 컴포넌트를 재사용 가능한 형태로 분리 |
| AI 기반 개발 도구 활용 경험 | 이 프로젝트 자체를 Claude Code와 함께 PDCA(계획→설계→구현→검증) 방식으로 진행 |

## 남은 스트레치 목표

- 다중 선택 및 그룹화
- 정렬 스냅 라인(스마트 가이드)
- 더미 REST API(json-server) 연동 데모
- 공통 컴포넌트 라이브러리화
