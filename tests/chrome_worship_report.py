"""Summarize real Chrome events locally; never substitute a transcript for input.

python tests/chrome_worship_report.py <private-root> [--watch]
Raw manuscripts, speech events and reports remain in the private recording root.
Exact unique suffix anchors are diagnostic references, not an accuracy ground truth.
"""
import argparse
import bisect
import csv
import html
import json
import re
import time
from pathlib import Path


def read(p):
    return json.loads(p.read_text(encoding='utf-8'))


def norm(s):
    return re.sub('[^가-힣a-zA-Z0-9]', '', s).lower()


def stamp(s):
    return f'{int(s)//3600:02}:{int(s)//60%60:02}:{int(s)%60:02}'


def audit(root, folder, state):
    meta = read(folder / 'metadata.json')
    layout = read(root / state['date'] / 'pages.json')
    text = layout['text']
    rows = [(a, b, pi+1, li+1) for pi, page in enumerate(layout['ranges'])
            for li, (a, b) in enumerate(page) if b > a]
    rowends = [r[1] for r in rows]
    rowof = lambda p: min(bisect.bisect_left(rowends, p), len(rows)-1)
    trace, errors, starts, ends = [], [], 0, 0
    high = 0
    for line in (folder / 'events.jsonl').open(encoding='utf-8'):
        e = json.loads(line)
        if e['type'] == 'error':
            errors.append({'time': e['audioTime'], 'error': e['error']})
        if e['type'] == 'recognition-start':
            starts += 1
        if e['type'] == 'end':
            ends += 1
        if e['type'] != 'result':
            continue
        heard = e.get('carry', '') + e['sessionText']
        tail = norm(heard)[-80:]
        reference = None
        for length in range(min(60, len(tail)), 15, -1):
            suffix = tail[-length:]
            at = text.find(suffix)
            if at >= 0 and text.find(suffix, at+1) < 0:
                reference = at + length
                break
        actual = e['tracked']['actual']
        ai = rowof(actual)
        ri = None if reference is None else rowof(reference)
        repeat = reference is not None and reference < high-3
        delta = None if ri is None else ri-ai
        status = '판정 유보'
        if delta is not None:
            status = ('재독 가능' if repeat and delta < -1 else
                      '지연 후보' if delta > 2 else
                      '앞섬 후보' if delta < -1 else
                      '두 줄 차이' if delta == 2 else '한 줄 이내')
            high = max(high, reference)
        trace.append(dict(index=len(trace)+1, audioTime=e['audioTime'],
                          elapsed=e['elapsed'], heardTail=heard[-160:],
                          final=e['results'][-1]['isFinal'],
                          actual=actual, page=e['tracked']['page'],
                          line=rows[ai][3], reference=reference,
                          referencePage=None if ri is None else rows[ri][2],
                          referenceLine=None if ri is None else rows[ri][3],
                          rowDifference=delta, status=status,
                          reason=e['tracked']['reason']))
    counts = {s: sum(t['status'] == s for t in trace) for s in
              ['한 줄 이내', '두 줄 차이', '지연 후보', '앞섬 후보', '재독 가능', '판정 유보']}
    summary = {**state, 'probe': meta['probe'], 'duration': meta['duration'],
               'browser': meta['browser'], 'recognitionStarts': starts,
               'recognitionEnds': ends, 'errorEvents': errors, 'anchors': counts,
               'inputMethod': meta['browser'].get('input', 'default-microphone' if state['mode'] == 'mic' else 'recording-track'),
               'referenceMethod': 'globally unique exact normalized suffix, >=16 characters',
               'limitation': 'Anchors verify matching recognized text only; unanchored speech is unscored. '
               'Production functions run in a VM; screen scroll rendering is not measured.'}
    (folder / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding='utf-8')
    with (folder / 'timeline.csv').open('w', encoding='utf-8-sig', newline='') as f:
        if trace:
            writer = csv.DictWriter(f, fieldnames=list(trace[0]))
            writer.writeheader()
            writer.writerows(trace)
    report = [f"# 실제 크롬 시험 · {state['date']} · {state['mode']}", '',
              f"- 입력 방식: {summary['inputMethod']} / 목적: {meta['browser'].get('purpose', 'recording')}",
              f"- 마이크 설정: {json.dumps(meta.get('physicalInput'), ensure_ascii=False)}",
              f"- 상태: {state['status']} / 점검용: {meta['probe']}",
              f"- 재생: {stamp(state['sourceTime'])} / 원본 {stamp(meta['duration'])}",
              f"- 실제 크롬 인식: {state['results']}건 / 오류: {state['errors']}건",
              f"- 끝 위치: {state['cursor']} / {state['manuscriptEnd']}자 · {state['page']}/{state['pages']}쪽",
              f"- 인식 시작 {starts}회 / 종료 {ends}회", '',
              '크롬에서 나온 임시·확정 결과와 타임스탬프를 모두 events.jsonl에 저장했습니다.',
              '운영 원고 위치 판정 함수를 그대로 실행했으며 화면 스크롤 렌더링 검사는 별도입니다.',
              'timeline.csv의 기준점은 인식문 끝 16자 이상이 원문에 유일하게 일치할 때만 붙입니다.',
              '이 기준점은 인식문 자체를 확인하는 보조 지표입니다. 녹음 전체의 정확도나 성공률이 아닙니다.',
              '기준점이 없는 발화와 원고에 없는 설명은 판정 유보이며, 후보는 사람이 녹음과 대조해야 합니다.', '',
              '| 보조 판정 | 인식 이벤트 수 |', '|---|---:|',
              *[f'| {s} | {n} |' for s, n in counts.items()]]
    (folder / '기록.md').write_text('\n'.join(report)+'\n', encoding='utf-8')
    (folder / 'replay-data.json').write_text(json.dumps(trace, ensure_ascii=False), encoding='utf-8')
    player = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>실제 크롬 인식 재검토</title><style>body{font:18px/1.7 sans-serif;max-width:1200px;margin:25px auto;padding:15px;background:#101824;color:#eef4ff}audio{width:100%}a{color:#9ed3ff}button{font:inherit;margin:5px;padding:6px;background:#263d58;color:white;border:1px solid #87a7c9}pre{white-space:pre-wrap;background:#1b2b40;padding:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}#page{font-size:28px}.muted{color:#b7c8dc}h2{font-size:20px}@media(max-width:700px){.grid{display:block}}</style>
<h1>실제 크롬 인식 재검토 · @DATE@ · @MODE@</h1>
<p>실제 녹음과 크롬 인식 이벤트를 다시 살펴보는 화면입니다. 당시 원고 위치 판정 함수를 그대로 실행한 로그이며 실제 브라우저 스크롤 화면을 촬영한 영상은 아닙니다. 자동 기준점은 인식문이 원고에 유일하게 일치할 때의 보조 위치입니다. 판정 유보는 성공으로 세지 않습니다.</p>
<p><a href="기록.md">요약</a> · <a href="events.jsonl">원시 이벤트</a> · <a href="timeline.csv">시간별 기록</a></p>
<audio id="audio" controls src="../../../../@DATE@/audio.mp3"></audio><p id="status">읽는 중</p><div id="candidates"></div>
<div class="grid"><section><h2>당시 판정한 표시 쪽</h2><pre id="page"></pre></section><section><h2>실제 크롬 인식문 끝부분</h2><pre id="heard"></pre><p id="reference" class="muted"></p><p id="reason" class="muted"></p></section></div>
<script>
const $=id=>document.getElementById(id),audio=$('audio');let trace=[],layout;
function show(){if(!trace.length)return;let lo=0,hi=trace.length;while(lo<hi){const m=(lo+hi)>>1;if(trace[m].audioTime<=audio.currentTime)lo=m+1;else hi=m;}const e=trace[lo-1];if(!e){$('status').textContent='아직 인식 결과가 없는 시각';$('page').textContent='';$('heard').textContent='';return;}$('status').textContent='녹음 '+audio.currentTime.toFixed(1)+'초 · 이벤트 '+e.index+' · '+e.page+'쪽 '+e.line+'줄 · '+e.status;$('page').textContent=(layout.pages[e.page-1]||[]).map(row=>row.filter(r=>!['r','n'].includes(r.c)).map(r=>r.t).join('')).join('\n');$('heard').textContent=e.heardTail;$('reference').textContent=e.referencePage===null?'원문 기준점: 판정 유보':'자동 기준점 '+e.referencePage+'쪽 '+e.referenceLine+'줄 · 표시와 '+e.rowDifference+'줄 차이';$('reason').textContent='당시 판정: '+e.reason;}
Promise.all([fetch('replay-data.json').then(r=>r.json()),fetch('../../../../@DATE@/pages.json').then(r=>r.json())]).then(([t,l])=>{trace=t;layout=l;let last=-100;for(const e of t){if(!['지연 후보','앞섬 후보'].includes(e.status)||e.audioTime-last<10)continue;last=e.audioTime;const b=document.createElement('button');b.textContent=Math.floor(e.audioTime/60)+':'+String(Math.floor(e.audioTime%60)).padStart(2,'0')+' '+e.status;b.onclick=()=>{audio.currentTime=Math.max(0,e.audioTime-3);show();};$('candidates').appendChild(b);}show();}).catch(e=>{$('status').textContent='기록 읽기 오류: '+e.message;});audio.ontimeupdate=show;
</script></html>'''
    # Keep the JavaScript newline escape literal in the generated HTML.
    player = player.replace(".join('\n')", ".join('\\n')")
    (folder / '재검토.html').write_text(player.replace('@DATE@', state['date']).replace('@MODE@', state['mode']), encoding='utf-8')
    return summary


def update(root):
    states = []
    for p in sorted((root / 'chrome-tests').glob('*/*/*/state.json')):
        try:
            state = read(p)
            meta = read(p.with_name('metadata.json'))
        except (OSError, json.JSONDecodeError):
            continue
        terminal = state['status'] not in ['starting', 'connected', 'recognizing'] and not state['status'].startswith('error:')
        if terminal and (not p.with_name('summary.json').exists() or not p.with_name('재검토.html').exists() or
                         p.stat().st_mtime > p.with_name('summary.json').stat().st_mtime):
            audit(root, p.parent, state)
        states.append((p.parent, state, meta))
    report = ['# 실제 크롬 시험 기록', '',
              '1번은 스피커→실제 마이크, 2번은 녹음 트랙→크롬 인식입니다. 원속도 재생입니다.',
              '로컬 받아쓰기는 입력하지 않습니다. 운영 추적 로직은 수정하지 않았습니다.',
              'complete 상태만 전체 재생을 마친 기록입니다. 시작·부분·실패 기록도 보존합니다.', '',
              '| 날짜 | 경로 | 점검 | 상태 | 재생 시간 | 인식 수 | 오류 | 끝 위치 |',
              '|---|---|---|---|---|---:|---:|---|']
    cards = []
    maincards = []
    manifest = read(root / 'manifest.json')
    for job in manifest['jobs']:
        for mode, label in [('mic', '1번 실제 마이크'), ('track', '2번 녹음 직접 입력')]:
            found = [(f, s, m) for f, s, m in states if s['date'] == job['id'] and
                     s['mode'] == mode and not m['probe']]
            if not found:
                values = [job['id'], label, '본시험 미시작 · 입력 점검 중', '—', '—', '—']
                links = ''
            else:
                f, s, m = found[-1]
                values = [job['id'], label, s['status'],
                          f"{stamp(s['sourceTime'])}/{stamp(m['duration'])}", s['results'],
                          f"{s['page']}/{s['pages']}쪽"]
                link = f.relative_to(root).as_posix()
                links = f'<a href="{link}/재검토.html">녹음 대조</a>' if s['status'] == 'complete' else '이벤트 수집 중'
            maincards.append('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in values)+f'<td>{links}</td></tr>')
    for folder, s, m in states:
        method = m['browser'].get('input', 'default-microphone' if s['mode'] == 'mic' else 'recording-track')
        if m['browser'].get('purpose') == 'human-voice-calibration':
            method += ' · 직접 말하기 점검'
        report.append(f"| {s['date']} | {method} | {m['probe']} | {s['status']} | {stamp(s['sourceTime'])}/{stamp(m['duration'])} | {s['results']} | {s['errors']} | {s['cursor']}/{s['manuscriptEnd']} |")
        link = folder.relative_to(root).as_posix()
        cards.append('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>' for x in
                     [s['date'], method, '점검' if m['probe'] else '전체', s['status'],
                      stamp(s['sourceTime'])+'/'+stamp(m['duration']), s['results'], s['errors'],
                      f"{s['page']}/{s['pages']}쪽"]) +
                     f'<td><a href="{link}/재검토.html">녹음 대조</a> · <a href="{link}/events.jsonl">원시 기록</a> · <a href="{link}/기록.md">분석</a> · <a href="{link}/timeline.csv">시간별 표</a></td></tr>')
    (root / '크롬시험전체기록.md').write_text('\n'.join(report)+'\n', encoding='utf-8')
    page = '''<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="20">
<title>실제 크롬 시험 기록</title><style>body{font:16px/1.6 sans-serif;padding:24px;background:#101824;color:#eef4ff}a{color:#a4d4ff}table{border-collapse:collapse}td,th{border:1px solid #486078;padding:9px}p{max-width:950px}</style>
<h1>실제 크롬 시험 기록</h1><p>1번: 스피커 → 실제 마이크 · 2번: 녹음 트랙 → 실제 크롬 인식. 원속도로 재생하며, complete 상태만 전체 재생을 마친 기록입니다. 점검·부분·실패 기록도 보존합니다. 운영 추적 함수는 VM에서 실행하며 화면 렌더링은 별도 검사입니다. 이전 로컬 받아쓰기 기록과 구분합니다.</p>
<h2>네 편 본시험</h2><table><tr><th>날짜</th><th>경로</th><th>상태</th><th>재생</th><th>인식</th><th>표시 쪽</th><th>기록</th></tr>'''+''.join(maincards)+'''</table>
<details><summary>연결 점검·실패·부분 기록까지 모두 보기</summary><table><thead><tr><th>날짜</th><th>입력 방식</th><th>종류</th><th>상태</th><th>재생</th><th>인식</th><th>오류</th><th>표시 쪽</th><th>저장 자료</th></tr></thead><tbody>'''+''.join(cards)+'</tbody></table></details>'
    (root / '크롬시험기록.html').write_text(page, encoding='utf-8')
    return states


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    parser.add_argument('--watch', action='store_true')
    args = parser.parse_args()
    while True:
        states = update(args.root)
        if not args.watch:
            print(json.dumps([s for _, s, _ in states], ensure_ascii=False))
            break
        time.sleep(10)
