"""Prepare, transcribe and reference private worship recordings without publishing content.

Input manifest: {"sourceCommit": "...", "jobs": [{"id": "20261004", "test": 2,
"hwp": "absolute path", "audio": "absolute path", "output": "absolute folder"}]}.
Run each stage with: python tests/worship_recordings.py prepare|transcribe|reference manifest.json
"""
import argparse
import base64
from concurrent.futures import ProcessPoolExecutor, as_completed
import difflib
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import time

REPO = Path(__file__).resolve().parent.parent


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write(path, data):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    temporary.replace(path)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def prepare(manifest):
    import av
    import olefile
    for job in manifest['jobs']:
        out = Path(job['output']); out.mkdir(parents=True, exist_ok=True)
        with olefile.OleFileIO(job['hwp']) as ole:
            streams = {'/'.join(p): base64.b64encode(ole.openstream(p).read()).decode('ascii')
                       for p in ole.listdir() if p[0] in ['FileHeader', 'DocInfo', 'BodyText']}
        write(out / 'ole-streams.json', streams)
        subprocess.run(['node', str(REPO / 'tests/recording_replay.cjs'), 'prepare',
                        str(out / 'ole-streams.json'), str(out / 'pages.json')], cwd=REPO, check=True)
        with av.open(job['audio']) as audio:
            duration = audio.duration / 1000000
        metadata = {**job, 'sourceCommit': manifest['sourceCommit'], 'duration': duration,
                    'hwpSha256': sha(job['hwp']), 'audioSha256': sha(job['audio']),
                    'speechSourceSha256': {name: sha(REPO / name) for name in
                        ['index.html', 'speech-match.js', 'optional-speech.js', 'scripture-speech.js', 'video-cues.js']}}
        write(out / 'metadata.json', metadata)
        print(job['id'], 'prepared', round(duration, 1), 'seconds', flush=True)


def transcribe_one(job, threads):
    from faster_whisper import WhisperModel
    out = Path(job['output']); metadata = read(out / 'metadata.json')
    if (out / 'transcript.json').exists():
        old = read(out / 'transcript.json')
        if old.get('audioSha256') == metadata['audioSha256']:
            print(job['id'], 'cached complete transcript', flush=True)
            return job['id']
        raise ValueError('Existing transcript belongs to different audio: ' + job['id'])
    print(job['id'], 'transcription started', flush=True)
    model = WhisperModel('base', device='cpu', compute_type='int8', cpu_threads=threads)
    started = time.time()
    gen, info = model.transcribe(job['audio'], language='ko', vad_filter=True,
        word_timestamps=True, vad_parameters={'min_silence_duration_ms': 400})
    segments = []
    for seg in gen:
        segments.append({'s': round(seg.start, 3), 'e': round(seg.end, 3), 't': seg.text.strip(),
            'avgLogprob': seg.avg_logprob, 'noSpeechProbability': seg.no_speech_prob,
            'words': [{'s': round(w.start, 3), 'e': round(w.end, 3), 't': w.word,
                       'probability': w.probability} for w in seg.words or []]})
        if len(segments) % 20 == 0:
            write(out / 'transcript.partial.json', segments)
            print(job['id'], 'audio', round(seg.end), '/', round(info.duration),
                  'elapsed', round(time.time() - started), 'seconds', flush=True)
    write(out / 'transcript.json', {'model': 'faster-whisper-base', 'duration': info.duration,
        'elapsed': round(time.time() - started, 2), 'audioSha256': metadata['audioSha256'],
        'settings': {'language': 'ko', 'word_timestamps': True, 'vad_filter': True,
                     'vad_parameters': {'min_silence_duration_ms': 400}, 'initial_prompt': None},
        'versions': {name: importlib.metadata.version(name) for name in ['faster-whisper', 'ctranslate2']},
        'segments': segments})
    print(job['id'], 'COMPLETE', len(segments), 'segments, elapsed', round(time.time() - started), flush=True)
    return job['id']


def reference(manifest):
    normalize = lambda s: re.sub('[^가-힣a-z0-9]', '', s.lower())
    for job in manifest['jobs']:
        out = Path(job['output']); layout = read(out / 'pages.json'); audio = read(out / 'transcript.json')
        target = layout['text']; heard = ''; words = []
        for si, segment in enumerate(audio['segments']):
            for wi, w in enumerate(segment['words']):
                start = len(heard); heard += normalize(w['t'])
                words.append({**w, 'a': start, 'b': len(heard), 'segment': si,
                              'segmentEnd': wi == len(segment['words']) - 1})
        blocks = [b for b in difflib.SequenceMatcher(None, target, heard, autojunk=False).get_matching_blocks()
                  if b.size >= 12 and target.count(target[b.a:b.a + b.size]) == 1]
        def point(end):
            for b in blocks:
                if b.b + 10 <= end <= b.b + b.size:
                    return b.a + end - b.b
            return None
        # No manual jumps, corrections or synthetic utterances are inserted.
        events = []; session = ''; carry = ''; session_at = 0
        for w in words:
            if w['e'] - session_at > 45 and session:
                carry = (carry + session)[-60:]; session = ''; session_at = w['s']
            session += w['t']
            literal = None
            sample = heard[max(0, w['b'] - 64):w['b']]
            for length in range(min(64, len(sample)), 23, -1):
                tail = sample[-length:]; at = target.find(tail)
                if at >= 0 and target.find(tail, at + 1) < 0:
                    literal = at + length
                    break
            events.append({'time': w['e'], 'start': w['s'], 'text': session, 'word': w['t'],
                'carry': carry, 'expected': point(w['b']), 'asrOffset': w['b'],
                'literalReference': literal, 'segment': w['segment'],
                'segmentEnd': w['segmentEnd'], 'probability': w['probability']})
        reference_info = {'method': 'Offline full-recording alignment; unique exact blocks >=12 characters; '
            'score word ends only after 10 exact anchor characters. No human ground truth.',
            'anchorCount': len(blocks), 'anchorChars': sum(b.size for b in blocks),
            'targetChars': len(target), 'asrChars': len(heard), 'words': len(words),
            'duration': audio['duration'], 'sessionSeconds': 45, 'carryCharacters': 60}
        write(out / 'fixture.json', {'sourceCommit': manifest['sourceCommit'], 'pages': layout['pages'],
            'reference': reference_info, 'scenarios': [{'name': job['id'] + '_original_recording',
             'targetEnd': len(target), 'events': events}]})
        write(out / 'reference-private.json', {'blocks': [list(b) for b in blocks], 'words': words,
                                               'reference': reference_info})
        print(job['id'], 'reference ready', len(events), 'word events,', len(blocks), 'anchors', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('stage', choices=['prepare', 'transcribe', 'reference'])
    parser.add_argument('manifest')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--threads', type=int, default=3)
    args = parser.parse_args(); manifest = read(args.manifest)
    if args.stage == 'prepare': prepare(manifest)
    elif args.stage == 'reference': reference(manifest)
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(transcribe_one, job, args.threads) for job in manifest['jobs']]
            for future in as_completed(futures): future.result()


if __name__ == '__main__':
    main()
