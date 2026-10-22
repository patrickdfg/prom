# 이미지 보관함 및 PPT 만들기 이름 변경 검증 (2026-10-23)

- PROM·방송용 PPT 공통 이동 메뉴와 Make 화면 제목: `PPT 만들기`.
- Make·방송용 PPT 자막 편집: 그림/배경 보관함을 Make 마스터와 공유. 기존 템플릿과 백업은 덮어쓰지 않음.
- 후속 첨부 5개를 원본 그대로 등록: 성삼위.png·하나님.jpg 전체 사진은 배경 보관함, 예수님.png·성령님.png·3줄.png는 그림 보관함. 이미지 편집·배경 제거·인물 분리본은 사용하지 않음. 원본과 저장 파일의 SHA-256 일치 확인.
- 카탈로그는 템플릿 저장소와 분리하여 읽고, 선택 시 이미지 데이터를 자막에 포함하므로 PPTX와 저장/재열기에 보존됨.

## 통과

- `builtin_assets_browser.cjs`: 양쪽 편집 화면에서 원본 5개 모두 선택·저장, 3개 그림의 투명도, 배경 교체, PPTX 왕복 및 저장 템플릿 불변성 확인.

- 변경 JavaScript 문법 검사 및 `git diff --check`.
- `image_library.cjs`: 배경/장식 분류, 중복 제거, 원본 불변성, 백업 제외.
- `image_library_browser.cjs` (Windows Chrome/Playwright): 두 화면의 3번 자막에서 선택, 미리보기, 위치/크기 저장, 재열기, PPTX 왕복, 배경 삭제, 다른 자막/원고 연결/템플릿 보존. 방송용 PPT 새로고침 복원, Make 마스터 목록/저장, PROM/PPT 메뉴 이름 확인.
- `master_media_browser.cjs`: 기존 업로드/붙여넣기/교체/복제/삭제/레이어/배경/마스터/PPTX.
- `template_isolation_browser.cjs`: 템플릿 전환 및 저장 격리.
- 단위 검사 19개 파일 통과 (편집 이동, 이미지, 마스터, 줄간격, 원고 입력, Make 전환, 템플릿 재현, 음성 매칭 등).

## 수정 전에도 재현된 실패 / 미검증

기준 커밋 `75c3e5217b1d80a325397836be23b24e12a35020`을 별도로 풀어 같은 환경에서 동일 실패를 확인함:

- `caption_split.cjs:7`: 4장 / 예상 2장.
- `content_rules.cjs:31`: 3개 / 예상 2개.
- `standby.cjs:14`: 수동 이동 후 자막 내용 예상 불일치.
- `make_automatic_browser.cjs:6`: 테스트의 단일 파랑 원고에서 caption 외 레이아웃을 기대하는 조건 실패.

`transition_crossfade.cjs`는 Playwright 경로 없이 실행하여 건너뜀. 실제 마이크·외부 모니터 송출·클라우드 동기화는 미검증. 기본 브랜치 병합과 실제 배포는 수행하지 않음.
