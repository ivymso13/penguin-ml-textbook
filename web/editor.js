import {COURSE_STORE,MAX_CSV_BYTES,blankCourse,blankActivity,blankQuestion,readCourses,saveCourse,validateCourse,courseFile,parseCourseFile,downloadFile} from './course-format.js';
const $=s=>document.querySelector(s),status=t=>$('#editor-status').textContent=t;
let course=blankCourse(),dirty=false;
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function changed(){dirty=true;$('#dirty-indicator').textContent='저장하지 않은 변경 있음';}
function discardOK(){return !dirty||confirm('저장하지 않은 변경을 버리고 이동할까요?');}
function field(title,value,update,{tag='input',rows=3,code=false}={}){const label=el('label','',title),input=el(tag,code?'code-input':'');if(tag==='textarea')input.rows=rows;input.value=value;input.addEventListener('input',()=>{update(input.value);changed();});label.append(input);return label;}
function refreshLibrary(){const select=$('#my-courses');select.replaceChildren(new Option('저장한 수업 선택',''));readCourses().forEach(c=>select.append(new Option(c.title,c.id)));select.value=readCourses().some(c=>c.id===course.id)?course.id:'';}
function renderNav(){$('#activity-nav').replaceChildren(...course.activities.map((a,i)=>{const n=el('a','activity-anchor',`${String(i+1).padStart(2,'0')}. ${a.title}`);n.href=`#activity-${a.id}`;return n;}));}
function questionEditor(q,a,index){
 const box=el('section','question-editor'),heading=el('div','panel-heading');heading.append(el('h3','',`질문 ${index+1}`));const remove=el('button','button','질문 삭제');remove.type='button';remove.onclick=()=>{a.questions=a.questions.filter(x=>x.id!==q.id);changed();renderActivities();};heading.append(remove);box.append(heading);
 const type=el('select');for(const [value,label] of [['choice','객관식'],['short','단답형'],['written','서술형']])type.append(new Option(label,value));type.value=q.type;type.setAttribute('aria-label',`질문 ${index+1} 유형`);type.onchange=()=>{q.type=type.value;q.options ||= ['',''];q.answer ||= 0;q.answers ||= [];changed();renderActivities();};box.append(type);
 box.append(field('질문',q.prompt,v=>q.prompt=v));
 if(q.type==='choice'){
  box.append(field('보기 · 한 줄에 하나씩 (2~6개)',q.options.join('\n'),v=>{q.options=v.split('\n');renderAnswerOptions();},{tag:'textarea'}));
  const label=el('label','','정답 보기'),answer=el('select');function renderAnswerOptions(){answer.replaceChildren(...q.options.map((o,i)=>new Option(`${i+1}. ${o||'(빈 보기)'}`,i)));answer.value=Math.min(q.answer,q.options.length-1);q.answer=Number(answer.value);}renderAnswerOptions();answer.onchange=()=>{q.answer=Number(answer.value);changed();};label.append(answer);box.append(label);
 }else if(q.type==='short')box.append(field('허용 정답 · 한 줄에 하나씩',q.answers.join('\n'),v=>q.answers=v.split('\n').filter(x=>x.trim()),{tag:'textarea',rows:2}));
 box.append(field(q.type==='written'?'예시 답안 · 자동 채점하지 않음':'정답 해설',q.feedback,v=>q.feedback=v,{tag:'textarea',rows:3}));return box;
}
function renderActivities(){
 $('#activities').replaceChildren();course.activities.forEach((a,i)=>{
  const panel=el('section','edit-panel');panel.id=`activity-${a.id}`;const heading=el('div','panel-heading'),buttons=el('div');heading.append(el('h2','',`활동 ${String(i+1).padStart(2,'0')}`));
  for(const [text,action,disabled] of [['↑',()=>move(i,-1),i===0],['↓',()=>move(i,1),i===course.activities.length-1],['삭제',()=>{if(course.activities.length===1){status('활동은 최소 한 개가 필요합니다.');return;}if(!confirm('이 활동과 질문을 삭제할까요?'))return;course.activities.splice(i,1);changed();renderActivities();},false]]){const b=el('button','button',text);b.type='button';b.disabled=disabled;if(text==='↑'||text==='↓')b.setAttribute('aria-label',`활동 ${i+1} ${text==='↑'?'위로':'아래로'} 이동`);b.onclick=action;buttons.append(b);}heading.append(buttons);panel.append(heading);
  panel.append(field('활동 제목',a.title,v=>{a.title=v;renderNav();}),field('짧은 설명 / 코드 완성 미션',a.explanation,v=>a.explanation=v,{tag:'textarea'}),field('학생이 실행할 Python 코드',a.code,v=>a.code=v,{tag:'textarea',rows:9,code:true}));
  const questions=el('div');a.questions.forEach((q,j)=>questions.append(questionEditor(q,a,j)));panel.append(questions);const tools=el('div','question-tools'),add=el('button','button','＋ 꼬리 질문');add.type='button';add.onclick=()=>{if(a.questions.length>=10){status('활동당 질문은 최대 10개입니다.');return;}a.questions.push(blankQuestion());changed();renderActivities();};tools.append(el('h3','','이 활동의 퀴즈'),add);panel.append(tools);$('#activities').append(panel);
 });renderNav();
}
function move(i,d){[course.activities[i],course.activities[i+d]]=[course.activities[i+d],course.activities[i]];changed();renderActivities();}
function render(){
 for(const [id,key] of [['course-title','title'],['course-topic','topic'],['dataset-name','datasetName'],['description','description'],['introduction','introduction']]){$('#'+id).value=course[key];$('#'+id).oninput=()=>{course[key]=$('#'+id).value;changed();};}
 $('#csv-info').textContent=course.csv?`${course.csv.filename} · ${new TextEncoder().encode(course.csv.text).length.toLocaleString()} bytes`:'첨부한 파일 없음 · sklearn 내장 데이터로도 수업할 수 있습니다.';
 $('#remove-csv').disabled=!course.csv;renderActivities();refreshLibrary();$('#dirty-indicator').textContent=dirty?'저장하지 않은 변경 있음':'저장한 수업';
}
function save(){try{validateCourse(course);const oldRevision=course.revision;if(dirty)course.revision=new Date().toISOString();try{saveCourse(course);}catch(error){course.revision=oldRevision;throw error;}dirty=false;$('#dirty-indicator').textContent='브라우저에 저장됨';refreshLibrary();status('저장했습니다. 다른 PC에서도 사용하려면 파일로 내보내세요.');history.replaceState(null,'',`?course=${course.id}`);return true;}catch(error){status(`저장하지 못했습니다: ${error.message}`);return false;}}
function addActivity(){if(course.activities.length>=30){status('활동은 최대 30개입니다.');return;}const a=blankActivity();course.activities.push(a);changed();renderActivities();document.getElementById(`activity-${a.id}`).scrollIntoView({behavior:'smooth'});}
$('#add-activity').onclick=$('#add-bottom').onclick=addActivity;
$('#save').onclick=save;$('#preview').onclick=()=>{if(save())location.href=`player.html?course=${course.id}`;};$('#export').onclick=()=>{if(save())downloadFile(`course-${course.id}.json`,courseFile(course));};
$('#new-course').onclick=()=>{if(!discardOK())return;course=blankCourse();dirty=true;render();status('새 수업을 작성합니다.');};
$('#copy-course').onclick=()=>{course=structuredClone(course);course.id=crypto.randomUUID();course.title+=' (복사)';course.revision=new Date().toISOString();dirty=true;render();status('별도 수업으로 복제했습니다. 저장해 주세요.');};
$('#my-courses').onchange=event=>{const id=event.target.value;if(!id)return;if(!discardOK()){refreshLibrary();return;}const saved=readCourses().find(c=>c.id===id);if(saved){course=saved;dirty=false;render();history.replaceState(null,'',`?course=${course.id}`);status('저장한 수업을 열었습니다.');}};
$('#csv-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>MAX_CSV_BYTES||! /^[a-zA-Z0-9_-]+\.csv$/.test(file.name))throw Error('영문 파일명(예: penguins.csv), 1 MB 이하의 CSV를 선택하세요.');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(!text.trim()||text.includes('\0'))throw Error('비어 있지 않은 UTF-8 CSV 파일을 선택하세요.');course.csv={filename:file.name,text};changed();render();status(`첨부했습니다. 코드에서 pd.read_csv("${file.name}")로 읽을 수 있습니다.`);}catch(error){status(error.message);}finally{event.target.value='';}};
$('#remove-csv').onclick=()=>{course.csv=null;changed();render();status('CSV 첨부를 해제했습니다. 코드의 파일명도 확인하세요.');};
$('#import-course').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2500000)throw Error('2.5 MB 이하의 수업 파일을 선택하세요.');const imported=parseCourseFile(await file.text());if(!discardOK())return;course=structuredClone(imported);course.id=crypto.randomUUID();course.revision=new Date().toISOString();dirty=true;render();status('새 사본으로 가져왔습니다. 내용을 확인하고 저장하세요.');}catch(error){status(error.message);}finally{event.target.value='';}};
$('#penguin-template').onclick=async()=>{try{if(!discardOK())return;const [l,csv]=await Promise.all([fetch('lesson.json'),fetch('downloads/penguins_size.csv')]);if(!l.ok||!csv.ok)throw Error('예제 파일을 불러오지 못했습니다.');const lesson=await l.json();course={...blankCourse(),title:lesson.title,description:'펭귄 측정값을 정리하고 종을 분류합니다.',topic:'분류',datasetName:'Palmer Penguins',introduction:'penguins_size.csv · 한 행은 펭귄 한 마리입니다. 부리·날개 길이는 mm, 몸무게는 g입니다. species는 펭귄의 종입니다.',csv:{filename:'penguins_size.csv',text:await csv.text()},activities:lesson.steps.map(a=>({id:crypto.randomUUID(),title:a.title,explanation:a.explanation+'\n\n코드 완성 미션: '+a.goal,code:a.code,questions:a.questions.map(q=>({...q,id:crypto.randomUUID()}))}))};dirty=true;render();status('펭귄 교재를 새 수업으로 복제했습니다. 데이터와 코드를 원하는 내용으로 수정하세요.');}catch(error){status(error.message);}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();save();}});
const params=new URLSearchParams(location.search),id=params.get('course'),outline=params.get('outline');const saved=readCourses().find(c=>c.id===id);if(saved){course=saved;dirty=false;}else if(outline){try{const old=JSON.parse(localStorage.getItem('data-classroom:drafts:v1')||'[]').find(d=>d.id===outline);if(old){course.title=old.title;course.topic=old.topic;course.datasetName=old.dataset;course.description=old.description;course.introduction=old.outline;dirty=true;}}catch{}}else dirty=true;
render();
