# 송출창 자동 전체화면 조사 · 2026-10-17

새 팝업에서 200ms 뒤 requestFullscreen()을 호출하는 시험을 수행했다. 사용한 브라우저에서는 navigator.userActivation.isActive=false, TypeError: Permissions check failed로 실패했다. 지연은 로딩 순서 문제를 해결할 수 있지만 새 사용자 클릭 권한을 만들지 않는다. 이 결과가 모든 브라우저 설정을 대표하지는 않는다.

웹 방식은 모니터 선택과 팝업 배치를 유지하고, 자동 요청이 거부되면 직접 클릭을 제공한다. 추가 클릭 없이 브라우저 창 전체화면을 제어하는 경로로 Chrome Manifest V3 확장을 추가했다. chrome.windows.update(windowId, {state:'fullscreen'})를 사용한다. 송출 팝업에서만 실행하고, 일반 조작창과 다른 사이트는 거부한다. 다른 모니터로 바꿀 때는 normal → 좌표/크기 이동 → fullscreen 순서로 처리한다. 브라우저 전체화면은 DOM 전체화면과 별도 상태이므로, 상태를 확인하여 웹 시작 안내를 숨긴다. F11/창 크기 변경 시 실제 상태를 다시 조회한다.

확장은 방문 기록, 쿠키, 모든 사이트 접근 권한을 요청하지 않는다. 지정된 GitHub Pages 송출 URL 및 로컬 개발 송출 URL만 content_scripts에 등록한다. broad tabs 권한도 요청하지 않는다. 확장 설치는 사용자가 Chrome/Edge 관리 화면에서 수행해야 한다. 코드 모의 검사와 ZIP 구성은 확인했으며, 실제 사용자 브라우저에 설치한 뒤의 하드웨어 다중 모니터 검증은 아직 수행하지 않았다.

- [Chrome fullscreen popup 실험 배경](https://developer.chrome.com/blog/fullscreen-popups-origin-trial)
- [Chrome 공식 windows API](https://developer.chrome.com/docs/extensions/reference/api/windows#method-update)
- [설치 안내](../fullscreen-extension.html)
- [테스트](../tests/fullscreen_extension.cjs)
