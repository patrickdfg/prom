# 2026-10-29 의미 단위 줄바꿈 검증

## 변경

- 자동 제작의 기존 줄 수와 최대 너비는 유지한다. 기존 줄바꿈 다음에 공통 보조 규칙을 실행한다.
- 관형사·관형형 어미·주요 부사로 판단한 꾸밈말이 줄 끝에 있으면, 인접 두 줄의 어절 경계를 다시 평가한다. 형태소 분석기나 새 사용자 설정은 추가하지 않았다.
- 후보 문장 전체의 짧은 줄이 긴 줄의 75% 이상일 때만 선택한다. `일에 대해`, `말씀을 통해`, 의존 명사·보조용언·번호 결합을 새로 끊는 후보는 제외한다. 기존 쉼표·문장 끝 줄바꿈은 이동하지 않는다.
- 프롬프터는 강조색 구간을 더 많이 분리하지 않고 원고 쪽번호가 있는 문장은 기존 분할을 보존한다. PPT도 원래 문자 객체를 다시 잘라 색·원고 연결 위치를 유지한다.
- 저장한 페이지, 직접 편집한 줄바꿈, 원본 PPT 재현과 템플릿·그림·저장 자료는 변경하지 않는다.

## 같은 HWP의 재현 결과

입력은 사용자가 제공한 2026-10-27 화요일 새벽 잠언이며 HWP 자체는 저장소에 추가하지 않았다. 프롬프터 5줄 기준으로 확인했다.

| 항목 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 페이지 수 | 11 | 11 |
| 1쪽 | `그가 행한 / 일에 대해` | 그대로 유지 |
| 8쪽 | `아닌 것은 온 / 인류가 주장해도 아니다.` | `아닌 것은 / 온 인류가 주장해도 아니다.` |
| 나머지 페이지 | 기준 | 기존 내용·색상·배치와 동일 |

8쪽의 변경 문장 너비는 현행 한글 1·공백/부호 0.5 단위로 10 / 13, 차이는 23.08%다. 꾸밈말을 붙이기 위해 `일에 / 대해`로 바꾸던 비교안은 배포하지 않는다.

## 통과한 확인

- `node --check korean-line-breaks.js`, `node --check ppt/builder.js`, 메인 HTML 인라인 스크립트 문법 검사, `git diff --check`.
- `tests/korean_line_breaks.cjs`: 두 승인 사례, 25% 조건, 최대 너비, 의미 단위 보호, 원본 불변, 여러 PPT 너비, 자동/수동 줄바꿈.
- `tests/manuscript_pagination.cjs`와 실제 HWP 인수: 5/6/7줄, 번호, 문단·쪽 경계, 색상, 모바일, 붙여넣기, 내용 보존. VM 배열의 내용이 같아도 다른 영역의 배열 원형 때문에 실패하던 짧은 원고 검사는 문자열 값으로 비교하도록 수정했다.
- 음성·색상/번호 자동 인식·원고 연결·원본 재현·Make 입력/전달 관련 단위 시험 13개: `safe_follow`, `lexicon_live`, `speech_follow`, `speech_match`, `optional_speech`, `scripture_speech`, `ppt/core`, `ppt/content_rules`, `ppt/automatic_manuscript`, `ppt/pair_reproduction`, `ppt/pair_template`, `ppt/make_inputs`, `ppt/make_transfer`.
- Chrome에서 실제 HWP 가져오기 → 5줄 시작 → 8쪽 확인 → PPT 저장. 내려받은 PPTX를 열어 슬라이드 수 11, 1쪽 `일에 대해`, 8쪽 `온 인류가`를 확인했다.
- Chrome에서 PPT와 Make의 공통 모듈 로딩 및 실제 글꼴 기준 여러 너비의 자동 줄바꿈·원문 보존을 확인했다.
- 브라우저 시험 `ppt/automatic_manuscript_browser`, `ppt/import_fidelity_browser`, `ppt/mic_watchdog_browser` 통과. 실제 마이크 입력과 물리 OBS/외부 모니터 송출은 이번 시험에서 실행하지 않았다.

## 기존 시험의 별도 실패

아래 여섯 시험은 기준 커밋 `8b438a399524e1573168cdbd3a096c970ac24fff`의 코드로도 같은 오류/결과를 재현했다. 이번 변경의 새 회귀로 분류하지 않았으며, 관계없는 코드와 시험 기대값은 수정하지 않았다.

- `ppt/tests/caption_split.cjs`: 줄바꿈 검사 이전의 원고 범위 기대 장수 2와 실제 4가 다름.
- `tests/far_jump.cjs`: 현재 PPT 코드에서 옛 `farConfirm` 함수 문자열을 찾지 못함.
- `tests/speech_match_handlers.cjs`: 분리한 VM 시험 문맥에 `sentenceOrderAllows`가 없음.
- `tests/overview.cjs`: 모의 문서에 `document.head`가 없음.
- `ppt/tests/proverb_browser.cjs`: 원고 범위 기대와 실제 잠언 대상 2개가 다름.
- `ppt/tests/make_automatic_browser.cjs`: 예전 `자동 인식` 안내 문구 기대와 현재 화면이 다름.

따라서 전체 저장소 시험이 모두 통과했다고 주장하지 않는다. 이번 변경의 재현·내용 보존·관련 자동 제작 경로는 별도로 통과했다.
