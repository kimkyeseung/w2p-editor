---
template: analysis
version: 1.2
---

# w2p-editor Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation) + 수동 브라우저 QA
>
> **Project**: w2p-editor
> **Version**: 0.1.0
> **Analyst**: Claude Code
> **Date**: 2026-08-24
> **Design Doc**: [w2p-editor.design.md](../02-design/features/w2p-editor.design.md)

이 프로젝트는 백엔드/API/DB가 없는 Starter 레벨 정적 SPA이므로, 원본 analysis 템플릿의 API 명세·DB 스키마·보안(OWASP)·성능(응답시간)·테스트 커버리지(%) 섹션은 N/A 처리하고, MVP 요구사항 충족 여부와 컴포넌트/아키텍처 일치도에 집중했다.

---

## 1. 분석 개요

### 1.1 목적

`w2p-editor.plan.md`의 MVP 1~9번 요구사항과 `w2p-editor.design.md`의 아키텍처 설계가 실제 구현·동작과 얼마나 일치하는지 검증한다. 자동화 테스트가 없는 프로젝트이므로 Playwright 기반 브라우저 자동화(Claude Browser)로 실제 클릭/드래그/키보드 조작을 수행해 검증했다.

### 1.2 범위

- 설계 문서: `docs/02-design/features/w2p-editor.design.md`
- 구현 경로: `src/` 전체 (App, components/, store/, types/, utils/)
- 검증 방법: `npm run build` 타입 체크 + `npm run dev` 브라우저 수동 QA (클릭/드래그/키보드 실측, DOM/Store/Fabric 객체 상태 직접 조회로 검증)

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 MVP 기능 체크리스트

| # | MVP 요구사항 | 상태 | 검증 방법 |
|---|---|:---:|---|
| 1 | 캔버스 워크스페이스 (프리셋, bleed/safe area) | ✅ Match | 명함/A4/정사각 프리셋 전환 시 캔버스 크기·SVG 가이드 갱신 확인 |
| 2 | 텍스트 레이어 (추가, 폰트/크기/색상/정렬) | ✅ Match | 텍스트 추가, 폰트 변경(Georgia), 내용 변경 캔버스 반영 확인 |
| 3 | 이미지 레이어 (업로드, 이동/리사이즈/회전) | ✅ Match | 업로드 → 배치, 코너 핸들 드래그 리사이즈(W 200→290) 확인 |
| 4 | 레이어 패널 (순서/잠금/삭제/복제) | ✅ Match | 맨뒤로 이동 시 z-order 변경, 복제·삭제 동작 확인 |
| 5 | 속성 패널 (x/y/w/h/rotation, 정렬 버튼) | ✅ Match | 숫자 입력 커밋, 회전, "가로 중앙" 정렬 좌표 계산 확인 |
| 6 | Undo/Redo (+ 키보드 단축키) | ✅ Match | 툴바 버튼 및 Cmd+Z 키보드 단축키 모두 확인 |
| 7 | 저장/불러오기 (localStorage, 파일) | ✅ Match | 저장 → 새로고침 → 불러오기 라운드트립, JSON 파일 불러오기 확인 |
| 8 | PNG 내보내기 | ✅ Match | `canvas.toDataURL` 호출 및 에러 없음 확인 (가이드라인이 SVG 오버레이라 내보낸 PNG에 섞이지 않음) |
| 9 | 반응형/모바일 (터치, 핀치 줌) | ✅ Match | 375px 뷰포트에서 탭 전환 레이아웃 확인, 핀치 줌은 코드 리뷰로 검증(2-touch 좌표 계산 로직) |

### 2.2 컴포넌트 구조

| 설계 문서 컴포넌트 | 구현 파일 | 상태 |
|---|---|:---:|
| Canvas | `src/components/Canvas/Canvas.tsx` | ✅ Match |
| Toolbar | `src/components/Toolbar/Toolbar.tsx` | ✅ Match |
| LayerPanel | `src/components/LayerPanel/LayerPanel.tsx` | ✅ Match |
| PropertiesPanel | `src/components/PropertiesPanel/PropertiesPanel.tsx` | ✅ Match |
| editorStore | `src/store/editorStore.ts` | ✅ Match |
| types/editor.ts | `src/types/editor.ts` | ✅ Match |
| canvasSerialization.ts | `src/utils/canvasSerialization.ts` | ✅ Match |
| presets.ts | `src/utils/presets.ts` | ✅ Match |

### 2.3 설계 문서에 없던 추가 구현 (⚠️)

| 항목 | 내용 | 비고 |
|---|---|---|
| origin 좌표 변환 로직 | `Canvas.tsx`의 `centerFromTopLeft`/`topLeftFromObject` | Fabric.js v6+ 가 객체 기준점을 top-left→center로 변경한 것을 흡수하기 위해 설계 단계에서 예상 못한 변환 계층 추가 (아래 3장 참고) |
| Delete/Backspace로 레이어 삭제 | `App.tsx` 키보드 핸들러 | 설계 문서엔 없었지만 표준 에디터 UX라 추가 |

### 2.4 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 100% (9/9 MVP 항목)     │
├─────────────────────────────────────────────┤
│  ✅ Match:            9 항목                 │
│  ⚠️ 설계에 없던 추가:  2 항목 (합리적 확장)   │
│  ❌ 미구현:            0 항목                 │
└─────────────────────────────────────────────┘
```

---

## 3. QA 중 발견 및 수정한 실제 버그

**Fabric.js v6+ origin 기본값 변경으로 인한 좌표 오프셋 버그** (🔴 Critical, 수정 완료)

- **증상**: 텍스트/이미지 레이어를 생성하면 의도한 위치(`x=40,y=40`)가 아니라 캔버스 좌측 밖으로 절반 가까이 밀려서 렌더링됨.
- **원인**: Fabric.js 6부터 객체의 `originX`/`originY` 기본값이 `'left'/'top'`에서 `'center'`로 바뀌었다(공식 변경사항이지만 널리 알려지지 않음). `left`/`top`을 top-left 좌표로 가정하고 그대로 넘기면, 실제로는 "중심 좌표"로 해석되어 `width/2`만큼 어긋난다.
- **발견 경위**: 브라우저 스크린샷만으로는 미세한 오프셋을 확신할 수 없어, `canvas.toDataURL()` 결과를 실제 PNG 파일로 저장해 픽셀 단위로 분석하고, Fabric 객체의 `getBoundingRect()`를 직접 조회해 `left=40`인데 실제 렌더링 좌표는 `-60.5`인 것을 확인함으로써 원인을 특정했다.
- **수정**: `Canvas.tsx`에 `centerFromTopLeft`/`topLeftFromObject` 변환 헬퍼를 추가하고, 모든 객체 생성/업데이트에서 `originX:'center', originY:'center'`를 명시한 뒤 store의 top-left 좌표 ↔ Fabric의 center 좌표를 양방향 변환하도록 수정. 회전은 Figma/Canva와 동일하게 객체 중심 기준으로 유지.
- **영향 범위**: 텍스트 생성, 이미지 생성, 드래그/리사이즈/회전 반영, 정렬 버튼 계산 등 좌표를 다루는 모든 경로. 수정 후 전체 재검증 완료.

---

## 4. 코드 품질

`npm run lint` (oxlint) 기준 에러 0건, 경고 2건 — 둘 다 의도적 패턴(비-DOM ref를 effect cleanup에서 정리, 외부 상태 변화에 따른 로컬 draft state 동기화)이라 실제 문제는 아님.

`npm run build` (`tsc -b && vite build`) 타입 에러 0건.

---

## 5. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Score: MVP 요구사항 100% 충족        │
├─────────────────────────────────────────────┤
│  설계 일치도:        100% (9/9)              │
│  빌드/타입 체크:      통과                    │
│  Lint:                통과 (경고 2건, 무해)   │
│  실제 버그 발견/수정:  1건 (좌표계, 수정 완료) │
└─────────────────────────────────────────────┘
```

---

## 6. Next Steps

- [x] MVP 전 항목 구현 및 브라우저 검증
- [x] 좌표계 버그 수정
- [ ] 완료 보고서 작성 (`w2p-editor.report.md`)
- [ ] 스트레치 목표(상품 목업 미리보기 등) 진행
- [ ] Vercel 배포

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-24 | 최초 Gap 분석 (MVP 100% 매치) | Claude Code |
