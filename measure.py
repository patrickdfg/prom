# 현수 목소리(edge-tts) 기본 속도에서 1초에 몇 글자를 읽는지 잰다
import asyncio, re, edge_tts
from mutagen.mp3 import MP3
V='ko-KR-HyunsuMultilingualNeural'
T=[
"사랑하는 성도 여러분, 오늘 우리가 함께 나눌 말씀은 믿음에 관한 이야기입니다.\n\n아브라함은 갈 바를 알지 못하고 나아갔습니다. 하나님께서 가라 하시니 그 말씀 하나만 붙들고 고향을 떠났습니다.\n\n우리의 삶도 이와 같습니다. 내일 일을 알 수 없지만, 주님의 약속을 믿고 한 걸음씩 걸어가는 것이 믿음입니다.",
"여러분, 기도는 하나님과 나누는 대화입니다. 말만 하고 듣지 않는 대화는 대화가 아닙니다.\n\n조용히 주님 앞에 앉아 그분의 음성을 기다리는 시간이 필요합니다. 바쁜 하루 가운데에서도 오 분, 십 분이라도 주님께 마음을 드려 보십시오.\n\n그 작은 시간이 쌓여서 우리의 영혼이 새로워지고, 세상을 이길 힘을 얻게 됩니다.",
"성경은 말합니다. 범사에 감사하라, 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라.\n\n감사는 형편이 좋을 때만 하는 것이 아닙니다. 어려울 때 드리는 감사가 진짜 감사입니다.\n\n이번 한 주간, 하루에 세 가지씩 감사 제목을 적어 보시기 바랍니다. 우리의 눈이 열리고 삶이 달라질 것입니다.",
]
def n(s): return len(re.sub(r'[^0-9A-Za-z가-힣]','',s))
async def main():
    tc=0; td=0
    for i,t in enumerate(T):
        f=f'h{i}.mp3'; await edge_tts.Communicate(t,V,rate='+0%').save(f)
        d=MP3(f).info.length; c=n(t); tc+=c; td+=d
        print(f'sample{i}: chars={c} sec={d:.2f} cps={c/d:.3f}')
    print(f'TOTAL chars={tc} sec={td:.2f} cps={tc/td:.3f} cpm={tc/td*60:.1f}')
asyncio.run(main())
