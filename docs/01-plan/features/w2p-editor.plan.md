---
template: plan
version: 1.2
---

# w2p-editor Planning Document

> **Summary**: 위시켓 "React/TypeScript 기반 W2P 그래픽 에디터 프론트엔드 개발" 공고 지원용 포트폴리오 — 캔버스 기반 인쇄물(명함/포스터) 디자인 에디터 미니 구현체
>
> **Project**: w2p-editor
> **Version**: 0.1.0
> **Author**: chickenboys
> **Date**: 2026-08-24
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

위시켓의 "React/TypeScript 기반 W2P 그래픽 에디터 프론트엔드 개발" 공고에 지원하면서 첨부할 개인 포트폴리오 프로젝트. 공고의 필수/우대 기술 스택을 실제로 손으로 다뤄본 증거를 남기고, 인터뷰에서 코드를 설명할 수 있는 수준으로 완성하는 것이 목표. 완성도 그 자체보다 "실제로 동작하는 상태"와 "면접관이 코드를 열어봤을 때 실무 감각이 느껴지는 구조"를 우선한다.

### 1.2 Background

- 지원 마감이 임박한 상황이라 MVP 범위를 먼저 완성하고, 남는 시간에 스트레치 목표를 진행하는 순서로 작업한다.
- 이 저장소(`/Users/kimkyeseung/Documents/w2p`)가 프로젝트 루트다. `web/` 같은 하위 디렉토리를 새로 만들지 않고, `package.json`/`src/` 등을 루트에 바로 둔다.
- 최종 산출물은 이력서/지원서에 링크로 첨부될 라이브 데모 + GitHub 저장소이므로, 코드 품질과 README 설명력도 결과물의 일부로 취급한다.

### 1.3 Related Documents

- 요구사항 원본: [w2p-editor-build-prompt.md](../../../w2p-editor-build-prompt.md)

---

## 2. Scope

### 2.1 In Scope (MVP, 우선순위 순)

- [ ] 캔버스 워크스페이스 — 인쇄 템플릿 사이즈 프리셋(명함 90x50mm, 포스터 A4) 선택, 재단선(bleed)/안전 영역(safe area) 가이드
- [ ] 텍스트 레이어 — 추가 + 폰트 패밀리/크기/색상/정렬 속성 패널
- [ ] 이미지 레이어 — 로컬 업로드 → 배치, Fabric.js transform(이동/리사이즈/회전)
- [ ] 레이어 패널 — 목록, 순서 변경(맨앞/맨뒤), 잠금, 삭제, 복제
- [ ] 선택 객체 속성 패널 — x/y/width/height/rotation 숫자 입력, 정렬 버튼
- [ ] Undo/Redo — Zustand 히스토리 스택, Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z
- [ ] 저장/불러오기 — Fabric `toJSON`/`loadFromJSON`, localStorage 또는 파일 다운로드
- [ ] PNG 내보내기 — `canvas.toDataURL()`
- [ ] 반응형/모바일 대응 — 터치 드래그, 핀치 줌 기본 편집

### 2.2 Out of Scope (MVP 단계에서는 제외, 스트레치로 이월)

- 상품 목업(티셔츠/머그컵) 미리보기 오버레이
- 다중 선택 및 그룹화
- Figma 스타일 스마트 가이드(스냅 라인)
- 더미 REST API(json-server) 연동 데모
- 재사용 컴포넌트 라이브러리화(디자인 시스템 분리)
- 실제 로그인/회원/서버 저장 등 백엔드 기능 (BaaS 불필요 — 정적 SPA)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 템플릿 사이즈 프리셋 선택 시 캔버스 크기 및 bleed/safe area 가이드가 갱신된다 | High | Pending |
| FR-02 | 텍스트 객체를 캔버스에 추가하고 폰트/크기/색상/정렬을 속성 패널에서 편집할 수 있다 | High | Pending |
| FR-03 | 로컬 이미지를 업로드해 캔버스에 배치하고 드래그/리사이즈/회전할 수 있다 | High | Pending |
| FR-04 | 레이어 패널에서 전체 객체 목록을 보고 순서/잠금/삭제/복제를 제어할 수 있다 | High | Pending |
| FR-05 | 선택된 객체의 x/y/width/height/rotation을 숫자로 직접 수정하고, 정렬 버튼으로 캔버스 기준 정렬할 수 있다 | High | Pending |
| FR-06 | Undo/Redo가 Zustand 히스토리 스택과 키보드 단축키로 동작한다 | High | Pending |
| FR-07 | 캔버스 상태를 JSON으로 저장(localStorage/파일)하고 다시 불러올 수 있다 | High | Pending |
| FR-08 | 현재 디자인을 PNG로 내보낼 수 있다 | High | Pending |
| FR-09 | 모바일 터치(드래그, 핀치 줌)로 기본 편집이 가능하다 | Medium | Pending |
| FR-10 (Stretch) | 상품 목업 이미지 위에 디자인을 오버레이해 미리보기 | Medium | Pending |
| FR-11 (Stretch) | 다중 선택/그룹화 | Low | Pending |
| FR-12 (Stretch) | 정렬 스냅 라인(스마트 가이드) | Low | Pending |
| FR-13 (Stretch) | json-server 기반 더미 REST API로 "디자인 프로젝트 목록" 저장/불러오기 연동 | Low | Pending |
| FR-14 (Stretch) | 버튼/패널/입력 필드 등 공통 컴포넌트 라이브러리 분리 | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 빌드 정확성 | `npm run build`가 타입 에러 없이 성공 | tsc/vite build |
| 실행 가능성 | `npm run dev`로 로컬 정상 구동, MVP 1~9번이 버튼으로 실제 동작 | 수동 브라우저 QA |
| 반응형 | 모바일 뷰포트에서 캔버스 조작 가능 | 브라우저 리사이즈/모바일 에뮬레이션 |
| 배포 가능성 | Vercel 등에 배포되어 라이브 링크로 접근 가능 | 배포 후 URL 접속 확인 |
| 설명 가능성 | README에 실행 방법 + 공고 요구사항 대응표 정리 | README 리뷰 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `npm run dev`로 로컬에서 정상 구동
- [ ] `npm run build`가 타입 에러 없이 성공
- [ ] MVP 1~9번이 실제로 동작 (버튼 눌러서 확인 가능한 수준)
- [ ] README에 실행 방법 + 공고 요구사항(Fabric.js, Zustand, 반응형 등) 대응 정리
- [ ] 가능하면 Vercel/Netlify 등에 배포하여 라이브 링크 확보

### 4.2 Quality Criteria

- [ ] 빌드 시 타입 에러 0건
- [ ] 콘솔 에러 없이 MVP 전 기능 수동 QA 통과
- [ ] 인터뷰에서 설명 가능한 수준의 코드 구조(과도한 추상화 없이 읽기 쉬운 컴포넌트/스토어 분리)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 지원 마감 임박으로 시간 부족 | High | High | MVP 1~9 우선순위 순서 엄수, 스트레치는 시간 남을 때만 |
| Fabric.js와 Zustand 상태 동기화 복잡도(캔버스 이벤트 ↔ 스토어) | Medium | Medium | Fabric 캔버스 이벤트(object:modified 등)를 단일 진입점으로 스토어에 반영하는 패턴으로 단순화 |
| 모바일 터치/핀치 줌 처리 | Medium | Medium | Fabric.js 자체 터치 지원 우선 활용, 필요한 최소 범위만 커스텀 |
| 과도한 기능 확장으로 완성도 저하 | Medium | Medium | Out of Scope 명시, 스트레치 목표는 MVP 완료 후에만 착수 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☑ |
| **Dynamic** | Feature-based modules, BaaS integration (bkend.ai) | Web apps with backend, SaaS MVPs, fullstack apps | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

**선정 사유**: 서버/인증/DB가 필요 없는 정적 SPA(로컬 저장 + 클라이언트 PNG 내보내기)이며, 스트레치의 더미 REST 연동도 로컬 json-server를 붙이는 수준이라 BaaS나 레이어 분리가 과함. 포트폴리오 성격상 구조를 단순하고 읽기 쉽게 유지하는 것이 인터뷰 설명에 유리.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | React 18 + Vite | 공고 고정 스택, SPA로 충분하고 빌드/배포가 단순 |
| Language | JS / TS | TypeScript | 공고 필수 요건, 레이어/객체 타입 안정성 확보 |
| State Management | Context / Zustand / Redux / Jotai | Zustand | 공고 필수 요건, 히스토리(undo/redo) 포함 복잡 UI 상태를 가볍게 관리 |
| Canvas Engine | Canvas 2D 직접 / SVG / Fabric.js | Fabric.js | 공고 우대 요건, 객체 선택/transform/좌표 변환을 표준화된 API로 구현 |
| API Client | fetch / axios / react-query | fetch (스트레치에서만 사용) | MVP는 API 연동 없음, 스트레치 REST 데모는 fetch로 충분 |
| Styling | Tailwind / CSS Modules / styled-components | 순수 CSS(반응형 미디어쿼리) | 별도 빌드 의존성 최소화, 터치/모바일 대응에 집중 |
| Testing | Jest / Vitest / Playwright | 수동 QA (시간 제약) | DoD가 "버튼 눌러 동작 확인" 수준이라 자동 테스트는 스트레치 이후로 |
| Backend | BaaS (bkend.ai) / Custom Server / Serverless | 없음 (localStorage) | Starter 레벨, 서버 불필요 |

### 6.3 Clean Architecture Approach

```
Selected Level: Starter

src/
  components/
    Canvas/            - Fabric.js 캔버스 래퍼 컴포넌트
    LayerPanel/        - 레이어 목록 패널
    PropertiesPanel/   - 선택 객체 속성 편집 패널
    Toolbar/           - 텍스트 추가, 이미지 업로드, 내보내기 등 툴바
  store/
    editorStore.ts     - Zustand 스토어 (레이어, 선택, 히스토리)
  types/
    editor.ts          - 레이어/객체 타입 정의
  utils/
    canvasSerialization.ts - 저장/불러오기 로직
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [ ] `CLAUDE.md` — 없음, 필요 시 최소 수준으로 추가
- [ ] `docs/01-plan/conventions.md` — 없음 (Starter 레벨이라 별도 컨벤션 문서 생략)
- [ ] `CONVENTIONS.md` — 없음
- [ ] ESLint — Vite 템플릿 기본 설정 사용
- [ ] Prettier — 선택 사항, 기본 포맷터로 충분
- [ ] `tsconfig.json` — Vite React-TS 템플릿 기본값 사용

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | 없음 | 컴포넌트 PascalCase, 훅/유틸 camelCase, 타입은 `types/editor.ts`에 집중 | High |
| **폴더 구조** | 없음 | 위 6.3 구조를 그대로 사용 (components/store/types/utils) | High |
| **Import order** | 없음 | 외부 라이브러리 → 내부 절대/상대 경로 순 | Low |
| **환경 변수** | 해당 없음 | 없음 (백엔드 없음, 스트레치 json-server URL만 `.env`로 분리 고려) | Low |
| **에러 처리** | 없음 | 이미지 업로드 실패/저장소 용량 초과 등 사용자 피드백(토스트/alert 수준)만 최소 처리 | Medium |

### 7.3 Environment Variables Needed

MVP 단계에서는 없음. 스트레치 FR-13(더미 REST API) 진행 시 `VITE_API_BASE_URL`(json-server 주소)을 추가로 정의.

### 7.4 Pipeline Integration

9-phase Development Pipeline은 사용하지 않는다 (Starter 포트폴리오 단일 기능 프로젝트, PDCA 사이클 하나로 충분).

---

## 8. Next Steps

1. [ ] 설계 문서 작성 (`w2p-editor.design.md`) — Zustand 스토어 스키마, Fabric ↔ Store 동기화 전략, 컴포넌트 인터페이스 확정
2. [ ] Vite React-TS 프로젝트를 이 저장소 루트에 초기화 (`web/` 등 하위 디렉토리 생성 금지)
3. [ ] MVP 1~9 순서대로 구현 착수

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-24 | 최초 작성 | chickenboys |
