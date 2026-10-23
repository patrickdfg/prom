/* Shared help and opt-in feedback; manuscript and presentation files are never submitted. */
(()=>{
'use strict';const script=document.currentScript,base=new URL('.',script.src),css=document.createElement('link');css.rel='stylesheet';css.href=new URL('support.css?v=20261023-footer3',base);document.head.appendChild(css);
const mount=document.querySelector('[data-prom-support]');if(!mount)return;
// Keep help in the bottom control row while reading, and at the setup footer otherwise.
const toolbar=mount.classList?.contains('prom-support-floating')?document.getElementById('bar'):null;
if(toolbar){
 const home=mount.parentNode,view=document.getElementById('view');
 const place=()=>{const target=getComputedStyle(view).display==='none'?home:toolbar;if(mount.parentNode!==target)target.appendChild(mount);};
 new MutationObserver(place).observe(view,{attributes:true,attributeFilter:['style','class']});place();
}

const isPpt=location.pathname.includes('/ppt/'),dialog=document.createElement('dialog');dialog.className='prom-support-dialog';dialog.setAttribute('aria-label','사용법·문의 및 건의');
dialog.innerHTML=`<div class="prom-support-heading"><h2>사용법·문의 및 건의</h2><button type="button" data-close aria-label="닫기">닫기</button></div><section data-help><h3>${isPpt?'방송용 PPT 사용법':'PROM 사용법'}</h3><ol>${isPpt?'<li>설교 원고와 방송용 PPTX를 불러옵니다.</li><li>오른쪽 자막의 원고 연결을 확인합니다. 확인 필요·미연결 자막은 연결 설정에서 지정합니다.</li><li>왼쪽 가져오기로 기본예배화면에 쓸 PPTX나 이미지를 선택합니다. PPTX는 원하는 장을 고릅니다.</li><li>송출창을 열고 오른쪽 위의 작은 전체화면 버튼을 누릅니다.</li><li>마이크를 켜고 자동 송출을 체크한 뒤 원고를 읽습니다. 자막이 없는 구간은 지정한 기본예배화면으로 돌아갑니다.</li><li>기본예배화면·이전·다음 버튼은 수동 유지로 전환합니다. 자동으로 돌아가려면 자동 송출을 체크합니다.</li>':'<li>원고 파일을 불러오거나 예시 원고로 체험합니다.</li><li>글자 크기·줄 수를 조절한 뒤 마이크를 켜 원고를 따라갑니다.</li><li>슬라이드쇼·스크롤 슬라이드쇼를 별도 창으로 열어 원하는 모니터에 배치합니다.</li><li>방송용 PPT는 상단 Family 메뉴에서 엽니다.</li>'}</ol><button type="button" data-contact>문의·건의 작성하기</button></section><form data-form hidden><label>분류<select name="kind"><option>사용법 문의</option><option>오류 신고</option><option>기능 건의</option></select></label><label>이름 (선택)<input name="name" maxlength="80" autocomplete="name"></label><label>답변받을 이메일 (선택)<input name="email" type="email" maxlength="200" autocomplete="email"></label><label>내용<textarea name="message" required minlength="2" maxlength="5000" rows="7" placeholder="문의나 건의 내용을 적어 주세요."></textarea></label><label class="prom-support-honey" aria-hidden="true">이 칸은 비워 두세요<input name="website" tabindex="-1" autocomplete="off"></label><p class="prom-support-note">입력한 내용은 FormSubmit을 통해 운영자 이메일로 전달됩니다. 원고·PPT 파일은 보내지 않습니다.</p><div class="prom-support-actions"><button type="submit" data-send>보내기</button><a data-email href="mailto:egibynote105g@gmail.com">메일 앱으로 보내기</a></div><p data-result role="status"></p></form>`;
document.body.appendChild(dialog);const form=dialog.querySelector('[data-form]'),help=dialog.querySelector('[data-help]'),result=dialog.querySelector('[data-result]'),send=dialog.querySelector('[data-send]');
const field=name=>form.elements.namedItem(name);
function emailLink(){const body=`분류: ${field('kind').value}\n이름: ${field('name').value}\n답변 이메일: ${field('email').value}\n\n${field('message').value}\n\n페이지: ${location.origin+location.pathname}`;dialog.querySelector('[data-email]').href='mailto:egibynote105g@gmail.com?subject='+encodeURIComponent('[PROM] '+field('kind').value)+'&body='+encodeURIComponent(body);}
function open(contact){help.hidden=contact;form.hidden=!contact;emailLink();if(!dialog.open)dialog.showModal();if(contact)field('message').focus();}
for(const [label,contact] of [['사용법',false],['문의 및 건의',true]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>open(contact);mount.appendChild(button);}
dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-contact]').onclick=()=>open(true);form.addEventListener('input',emailLink);
form.onsubmit=async e=>{e.preventDefault();if(send.disabled||!form.reportValidity())return;if(field('website').value)return;send.disabled=true;result.textContent='접수 중…';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 const payload={_subject:'[PROM] '+field('kind').value,_template:'table',분류:field('kind').value,이름:field('name').value||'미입력',내용:field('message').value,페이지:location.origin+location.pathname};if(field('email').value)payload.email=field('email').value;
 const response=await fetch('https://formsubmit.co/ajax/egibynote105g@gmail.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json();if(!response.ok||!['true',true].includes(data.success))throw Error('전송 서비스를 확인할 수 없습니다.');
 result.textContent='전송 서비스에 접수했습니다. 운영자의 최초 수신 인증 후 이메일로 전달됩니다. 답변이 필요하면 이메일을 적어 주세요.';
 }catch{result.textContent='접수 확인에 실패했습니다. 재전송하면 중복될 수 있습니다. 아래 메일 앱으로 보내기를 사용할 수 있습니다.';}finally{clearTimeout(timer);send.disabled=false;}};
})();
