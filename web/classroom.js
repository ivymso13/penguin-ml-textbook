const $=s=>document.querySelector(s);
const storageKey='data-classroom:drafts:v1';
let catalog,filter='전체',view='courses',drafts=[];
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function validDraft(d){return d&&typeof d.id==='string'&&/^[\w-]{1,80}$/.test(d.id)&&['title','dataset','description','outline'].every(k=>typeof d[k]==='string'&&d[k].length<10001)&&d.title.trim()&&d.dataset.trim()&&['분류','회귀','탐색'].includes(d.topic);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(drafts));return true;}catch{$('#page-status').textContent='브라우저에 저장하지 못했습니다. 초안을 파일로 내보내 보관하세요.';return false;}}
function download(d){const blob=new Blob([JSON.stringify({version:1,draft:d},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`lesson-draft-${d.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function progress(course){try{const s=JSON.parse(localStorage.getItem(`ml-textbook:${course.id}`)||'null');if(s?.lessonId!==course.id)return null;const count=Object.values(s.quizzes||{}).filter(q=>q?.checked).length;return Math.min(count,course.questions);}catch{return null;}}
function card(course,isDraft=false){
 const c=el('article','course-card'),cover=el('div','card-cover');cover.append(el('span','topic',course.topic),el('strong','',course.dataset),el('span','card-symbol',isDraft?'✎':course.symbol||'D'));c.append(cover);
 const body=el('div','card-body');body.append(el('h3','',course.title),el('p','',course.description));
 if(!isDraft){const tags=el('div','tags');(course.tags||[]).forEach(t=>tags.append(el('span','tag',t)));body.append(tags);const done=progress(course);if(done!==null&&done>0){const wrap=el('div','card-progress',`답안 확인 ${done} / ${course.questions} · 이 브라우저`),bar=el('progress');bar.max=course.questions;bar.value=done;bar.setAttribute('aria-label','답안 확인 진행');wrap.append(bar);body.append(wrap);}}
 c.append(body);const foot=el('div','card-footer');
 if(isDraft){const actions=el('div','draft-actions'),exportButton=el('button','button','파일 내보내기'),remove=el('button','button','삭제');exportButton.type=remove.type='button';exportButton.onclick=()=>download(course);remove.onclick=()=>{drafts=drafts.filter(d=>d.id!==course.id);persist();renderDrafts();};actions.append(exportButton,remove);foot.append(actions);}
 else{foot.append(el('small','',`${course.duration} · 실습 ${course.activities}개`));const link=el('a','',progress(course)>0?'이어서 실습 →':'수업 열기 →');const url=new URL(course.href,location.href);if(url.origin===location.origin&&['http:','https:'].includes(url.protocol))link.href=url.href;link.setAttribute('aria-label',`${course.title} 수업 열기`);foot.append(link);}
 c.append(foot);return c;
}
function renderCourses(){const query=$('#search').value.trim().toLocaleLowerCase();const courses=catalog.courses.filter(c=>c.status==='published'&&(filter==='전체'||c.topic===filter)&&[c.title,c.description,c.dataset,...c.tags].join(' ').toLocaleLowerCase().includes(query));$('#course-grid').replaceChildren(...courses.map(c=>card(c)));$('#empty').hidden=!!courses.length;$('#view-count').textContent=`공개 수업 ${courses.length}개`;}
function renderDrafts(){$('#draft-list').replaceChildren(...drafts.map(d=>card(d,true)));$('#draft-empty').hidden=!!drafts.length;$('#draft-count').textContent=drafts.length;if(view==='drafts')$('#view-count').textContent=`내 초안 ${drafts.length}개`;}
function setView(next){view=next;for(const name of ['courses','stream','drafts'])$(`#${name}-view`).hidden=name!==next;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===next);if(b.dataset.view===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('#view-title').textContent={courses:'수업 둘러보기',stream:'안내 게시판',drafts:'수업 초안'}[next];$('#view-count').textContent=next==='stream'?`안내 ${catalog.announcements.length}개`:'';if(next==='courses')renderCourses();if(next==='drafts')renderDrafts();}
async function init(){
 try{const response=await fetch('catalog.json');if(!response.ok)throw Error();catalog=await response.json();$('#class-title').textContent=catalog.title;$('#class-description').textContent=catalog.description;
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))drafts=saved.filter(validDraft).slice(0,100);}catch{}
 renderDrafts();renderCourses();
 for(const p of catalog.announcements){const post=el('article','post');post.append(el('small','',p.label),el('h3','',p.title),el('p','',p.body));$('#announcements').append(post);}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));renderCourses();});$('#search').oninput=renderCourses;
 $('#compose').onclick=()=>$('#composer').showModal();$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#composer').close();
 $('#draft-form').onsubmit=event=>{event.preventDefault();const form=new FormData(event.currentTarget),d={id:crypto.randomUUID(),title:form.get('title').trim(),topic:form.get('topic'),dataset:form.get('dataset').trim(),description:form.get('description').trim(),outline:form.get('outline').trim()};if(!validDraft(d)||!d.description){$('#page-status').textContent='수업 제목, 데이터 이름과 설명을 입력하세요.';return;}drafts.unshift(d);const saved=persist();$('#composer').close();event.currentTarget.reset();setView('drafts');if(saved)$('#page-status').textContent='이 브라우저에 초안을 저장했습니다. 학생 화면에는 게시되지 않습니다.';};
 $('#import-draft').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>100000)throw Error();const data=JSON.parse(await file.text());if(data.version!==1||!validDraft(data.draft))throw Error();const d={...data.draft,id:crypto.randomUUID()};drafts.unshift(d);persist();setView('drafts');$('#page-status').textContent='초안을 가져왔습니다.';}catch{$('#page-status').textContent='올바른 수업 초안 JSON 파일을 선택하세요.';}finally{event.target.value='';}};
 }catch{$('#page-status').textContent='수업 목록을 불러오지 못했습니다. 새로고침해 주세요.';}
}
init();
