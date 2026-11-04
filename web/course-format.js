// Portable authored lessons: no server credentials or executable HTML in this format.
export const COURSE_STORE='data-classroom:courses:v1';
export const MAX_CSV_BYTES=1000000;
const str=(v,max=10000)=>typeof v==='string'&&v.length<=max;
const uid=v=>str(v,80)&&/^[a-zA-Z0-9-]+$/.test(v);
export function validateCourse(c){
 if(!c||!uid(c.id)||!str(c.title,150)||!c.title.trim()||!str(c.description,3000)||!['분류','회귀','탐색'].includes(c.topic)||!str(c.datasetName,150)||!str(c.introduction,10000)||!str(c.revision,100))throw Error('수업 기본 정보를 확인하세요.');
 if(c.csv!==null&&(!c.csv||!str(c.csv.filename,100)||! /^[a-zA-Z0-9_-]+\.csv$/.test(c.csv.filename)||!str(c.csv.text,MAX_CSV_BYTES)||new TextEncoder().encode(c.csv.text).length>MAX_CSV_BYTES))throw Error('CSV는 영문 파일명과 1 MB 이하의 UTF-8 파일을 사용하세요.');
 if(!Array.isArray(c.activities)||c.activities.length<1||c.activities.length>30)throw Error('활동은 1~30개로 구성하세요.');
 const ids=new Set();
 for(const a of c.activities){
  if(!a||!uid(a.id)||ids.has(a.id)||!str(a.title,150)||!a.title.trim()||!str(a.explanation)||!str(a.code,30000)||!Array.isArray(a.questions)||a.questions.length>10)throw Error('활동 제목, 코드와 질문을 확인하세요.');ids.add(a.id);
  for(const q of a.questions){
   if(!q||!uid(q.id)||ids.has(q.id)||!['choice','short','written'].includes(q.type)||!str(q.prompt,1000)||!q.prompt.trim()||!str(q.feedback,5000))throw Error('질문 내용과 유형을 확인하세요.');ids.add(q.id);
   if(q.type==='choice'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||!q.options.every(o=>str(o,1000)&&o.trim())||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length))throw Error('객관식은 보기 2~6개와 정답이 필요합니다.');
   if(q.type==='short'&&(!Array.isArray(q.answers)||!q.answers.length||q.answers.length>20||!q.answers.every(o=>str(o,1000)&&o.trim())))throw Error('단답형 정답을 한 개 이상 입력하세요.');
  }
 }
 return c;
}
export function blankQuestion(){return {id:crypto.randomUUID(),type:'choice',prompt:'',options:['',''],answer:0,answers:[],feedback:''};}
export function blankActivity(){return {id:crypto.randomUUID(),title:'새 활동',explanation:'',code:'# 코드를 작성하세요\n',questions:[]};}
export function blankCourse(){return {id:crypto.randomUUID(),revision:new Date().toISOString(),title:'새 데이터 수업',description:'',topic:'탐색',datasetName:'',introduction:'',csv:null,activities:[blankActivity()]};}
export function readCourses(storage=localStorage){try{const data=JSON.parse(storage.getItem(COURSE_STORE)||'[]');return Array.isArray(data)?data.filter(c=>{try{validateCourse(c);return true;}catch{return false;}}):[];}catch{return [];}}
export function saveCourse(c,storage=localStorage){validateCourse(c);const courses=readCourses(storage);const next=[c,...courses.filter(x=>x.id!==c.id)];storage.setItem(COURSE_STORE,JSON.stringify(next));}
export function parseCourseFile(text){const data=JSON.parse(text);if(data.format!=='data-classroom-course'||data.version!==1)throw Error('수업 편집기에서 내보낸 수업 JSON 파일을 선택하세요.');return validateCourse(data.course);}
export function courseFile(c){validateCourse(c);return JSON.stringify({format:'data-classroom-course',version:1,course:c},null,2);}
export function asLesson(c){return {id:`authored-${c.id}-${c.revision}`,steps:c.activities.map(a=>({...a,code:a.code,questions:a.questions.map(q=>({...q,rubric:[]}))})),dataset:{questions:[]}};}
export function courseNotebook(c,state){
 const lesson=asLesson(c),cells=[{cell_type:'markdown',id:'intro',metadata:{},source:`# ${c.title}\n\n${c.description}\n\n${c.introduction}`}];
 cells.push({cell_type:'markdown',id:'setup-note',metadata:{},source:'CSV를 이 노트북과 같은 폴더에 두세요. 필요한 라이브러리는 사용하는 환경에 설치하세요.'});
 cells.push({cell_type:'code',id:'setup',metadata:{},execution_count:null,outputs:[],source:baseImports});
 for(const a of lesson.steps){cells.push({cell_type:'markdown',id:`text-${a.id}`,metadata:{},source:`## ${a.title}\n\n${a.explanation}`});const r=state?.results?.[a.id],code=state?.codes?.[a.id]??a.code,current=r?.code===code;cells.push({cell_type:'code',id:a.id,metadata:{tags:['practice'],lesson_step:a.id},execution_count:current?r.count:null,outputs:current?r.outputs:[],source:code});}
 return {nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python'}},cells};
}
export const baseImports=`import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, mean_squared_error, r2_score
from sklearn.datasets import load_iris, load_wine, load_diabetes
from IPython import get_ipython
if get_ipython() is not None:
    get_ipython().run_line_magic("matplotlib", "inline")
sns.set_theme(style="whitegrid")`;
export function runtimeSetup(c){return `import piplite\nawait piplite.install(["pandas", "matplotlib", "seaborn", "scikit-learn"])\n${baseImports}\n`+(c.csv?`from pathlib import Path\nPath(${JSON.stringify(c.csv.filename)}).write_text(${JSON.stringify(c.csv.text)}, encoding="utf-8")\n`:'');}
export function downloadFile(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
