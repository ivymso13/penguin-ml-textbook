import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {freshState,restoreState,quizCorrect,exportNotebook} from '../web/model.js';
const lesson=JSON.parse(readFileSync(new URL('../web/lesson.json',import.meta.url)));
const template=JSON.parse(readFileSync(new URL('../content/01-penguins.ipynb',import.meta.url)));
const questions=lesson.steps.flatMap(s=>s.questions);

test('reference course has 8 incomplete exercises and 2 connected questions per exercise',()=>{
 assert.equal(lesson.steps.length,8);assert.equal(questions.length,16);
 assert.ok(lesson.steps.every(s=>s.code.includes('___')&&s.questions.length===2&&s.questions.every(q=>q.context)));
});
test('wrong course, invalid choices and malformed outputs do not corrupt student state',()=>{
 const state=freshState(lesson);assert.deepEqual(restoreState(lesson,{...state,lessonId:'iris-intro-v2'}),state);
 const q=questions.find(q=>q.type==='choice');
 const restored=restoreState(lesson,{...state,quizzes:{[q.id]:{selected:99,checked:true}},results:{1:{outputs:[{output_type:'error',traceback:'invalid'},{output_type:'display_data',data:{'text/html':'<script>bad()</script>'}}]}}});
 assert.equal(restored.quizzes[q.id],undefined);assert.deepEqual(restored.results[1].outputs[0].data,{});
});
test('short answers normalize whitespace/fullwidth digits and require explicit checking',()=>{
 const state=freshState(lesson),q=questions.find(q=>q.type==='short');
 state.quizzes[q.id]={text:' ３ ',checked:false};assert.equal(quizCorrect(q,state),false);
 state.quizzes[q.id].checked=true;assert.equal(quizCorrect(q,state),true);
 state.quizzes[q.id].text='333';assert.equal(quizCorrect(q,state),false);
});
test('written answers are reviewed, never labeled automatically correct in export',()=>{
 const state=freshState(lesson),q=questions.find(q=>q.type==='written');
 state.quizzes[q.id]={text:'그래프에서 겹치는 점이 보인다.',checked:true};assert.equal(quizCorrect(q,state),false);
 state.quizzes[q.id].review=q.rubric.map(()=>true);assert.equal(quizCorrect(q,state),true);
 const nb=exportNotebook(template,lesson,state);assert.ok(nb.cells.at(-1).source.includes('자동 채점 아님'));
 const restored=restoreState(lesson,nb.metadata.textbook);
 assert.equal(restored.quizzes[q.id].text,state.quizzes[q.id].text);
 assert.deepEqual(restored.quizzes[q.id].review,state.quizzes[q.id].review);
 assert.ok(nb.cells.at(-1).source.includes('- [x]'));
});

test('old question answers are not carried into revised questions while code is preserved',()=>{
 const state=freshState(lesson);state.codes[1]='df = pd.read_csv("penguins_size.csv")\ndf';
 state.quizzes={'1-rows':{text:'344',checked:true},'1-target':{selected:0,checked:true}};
 const restored=restoreState(lesson,state);
 assert.deepEqual(restored.quizzes,{});assert.equal(restored.codes[1],state.codes[1]);
});

test('experiment snippets are executable Python, not natural-language instructions',()=>{
 const trials=questions.filter(q=>q.tryCode);
 assert.equal(trials.length,6);
 assert.ok(trials.find(q=>q.id==='p4-try-culmen').tryCode.includes('sns.scatterplot('));
 assert.ok(trials.find(q=>q.id==='p7-depth1').tryCode.includes('m1 ='));
 assert.ok(!trials.find(q=>q.id==='p7-depth1').tryCode.includes('model ='));
});
test('edited code, output and free experiments survive export without stale output or duplicate blank cells',()=>{
 const state=freshState(lesson);state.codes[1]='print(42)';state.results[1]={code:'print(42)',count:2,outputs:[{output_type:'stream',name:'stdout',text:'42\n'}]};
 state.sandboxes[1]=[{id:'trial-1',code:'print(len(df))',result:{code:'print(len(df))',count:3,outputs:[{output_type:'stream',name:'stdout',text:'344\n'}]}}];
 const nb=exportNotebook(template,lesson,state);const cell=nb.cells.find(c=>c.metadata.tags?.includes('practice'));
 assert.equal(cell.source,'print(42)');assert.equal(cell.outputs[0].text,'42\n');
 assert.equal(nb.cells.filter(c=>c.metadata.tags?.includes('sandbox')).length,1);
 assert.equal(restoreState(lesson,nb.metadata.textbook).sandboxes[1][0].code,'print(len(df))');
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/web-export-validated.ipynb',JSON.stringify(nb));
 state.codes[1]='print(43)';const stale=exportNotebook(template,lesson,state).cells.find(c=>c.metadata.tags?.includes('practice'));
 assert.deepEqual(stale.outputs,[]);assert.equal(stale.execution_count,null);
});

test('DataFrame HTML is retained on restore so df remains a table after reload and import',()=>{
 const state=freshState(lesson);
 const html='<table class="dataframe"><thead><tr><th>species</th></tr></thead><tbody><tr><td>Adelie</td></tr></tbody></table>';
 state.results[1]={code:'df',count:2,outputs:[{output_type:'execute_result',execution_count:2,metadata:{},data:{'text/plain':'species Adelie','text/html':html}}]};
 const restored=restoreState(lesson,state);
 assert.equal(restored.results[1].outputs[0].data['text/html'],html);
 assert.equal(restored.results[1].outputs[0].data['text/plain'],'species Adelie');
});
