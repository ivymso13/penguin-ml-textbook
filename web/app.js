import {TextbookRuntime} from './runtime.js';
import {freshState, restoreState, quizCorrect, exportNotebook} from './model.js';
import {renderOutputs} from './outputs.js';

const $ = selector => document.querySelector(selector);
let key;
let lesson, template, state;
let working = false;
const executed = new Set();
const runtime = new TextbookRuntime($('#python-engine'), (status, detail) => {
  const labels = {off: 'Python · 준비 전', loading: 'Python · 준비 중', ready: 'Python · 실행 준비 완료', error: 'Python · 연결 확인 필요'};
  $('#runtime-status').textContent = labels[status];
  $('#runtime-detail').textContent = detail;
  document.querySelector('.runtime-bar').dataset.status = status;
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    $('#save-status').textContent = '현재 브라우저에 저장됨 · 변수는 새로고침 후 01부터 다시 실행하세요.';
  } catch {
    $('#save-status').textContent = '브라우저 저장 공간에 저장하지 못했습니다. 내 노트북 저장으로 파일을 내려받으세요.';
  }
}
function updateProgress() {
  const questions = [...(lesson.dataset.questions || []), ...lesson.steps.flatMap(s => s.questions)];
  const correct = questions.filter(q => quizCorrect(q, state)).length;
  $('#progress-label').textContent = `확인한 질문 ${correct} / ${questions.length}`;
  $('#quiz-progress').max = questions.length;
  $('#quiz-progress').value = correct;
  $('#execution-progress').textContent = `이번 접속에서 목표를 확인한 코드 ${executed.size} / ${lesson.steps.length}`;
  for (const step of lesson.steps) {
    const link = document.querySelector(`[data-step-link="${step.id}"]`);
    link.dataset.complete = String(step.questions.every(q => quizCorrect(q, state)));
    link.querySelector('.step-check').textContent = step.questions.every(q => quizCorrect(q, state)) ? '✓' : '';
  }
}
function renderFeedback(question) {
  const box = document.querySelector(`[data-question="${question.id}"] .quiz-feedback`);
  const answer = state.quizzes[question.id];
  box.className = 'quiz-feedback';
  if (!answer?.checked) { box.textContent = question.type === 'written' ? '자신의 생각을 먼저 적은 뒤 예시와 비교하세요. 자동 정오 판정은 하지 않습니다.' : '실행 결과를 근거로 답한 뒤 확인하세요.'; return; }
  if (question.type === 'written') {
    box.classList.add('reviewed'); box.replaceChildren(node('p','',`예시와 비교해 보세요 · ${question.feedback} (자동 채점 아님)`));
    if (question.rubric?.length) {
      const checklist=node('fieldset','self-review');
      checklist.append(node('legend','','내 답에 담았는지 점검하기'));
      question.rubric.forEach((criterion,index)=>{
        const label=node('label','quiz-option'),input=node('input');
        input.type='checkbox';input.checked=answer.review?.[index]===true;
        input.addEventListener('change',()=>{answer.review ||= [];answer.review[index]=input.checked;updateProgress();persist();});
        label.append(input,node('span','',criterion));checklist.append(label);
      });
      box.append(checklist,node('p','dataset-note','부족한 내용이 있으면 답을 고쳐 보세요. 체크는 학생의 자기점검이며 자동 채점이 아닙니다.'));
    }
    return;
  }
  const correct = quizCorrect(question, state);
  box.classList.add(correct ? 'correct' : 'incorrect');
  box.textContent = correct ? `✓ 확인했습니다. ${question.feedback}` : (question.optionFeedback?.[answer.selected] || '결과를 다시 살펴보세요. 앞의 출력이나 그래프에서 근거를 찾고 다시 답할 수 있습니다.');
}
function renderQuestions(step, section) {
  const group = node('div', 'followup-questions');
  group.append(node('h3', '', '퀴즈와 이어지는 질문'));
  step.questions.forEach((q, index) => {
    const form = node('form', 'web-quiz'); form.dataset.question = q.id; form.id = `question-${q.id}`;
    const fieldset = node('fieldset');
    fieldset.append(node('legend', 'quiz-title', `질문 ${index+1}. ${q.prompt}`));
    fieldset.append(node('p', 'question-context', q.context));
    if (q.type === 'choice') {
      q.options.forEach((text,i) => {
        const label = node('label','quiz-option'), radio=node('input');
        radio.type='radio';radio.name=`question-${q.id}`;radio.value=i;
        radio.checked=state.quizzes[q.id]?.selected===i;
        radio.addEventListener('change',()=>{state.quizzes[q.id]={selected:i,checked:false};renderFeedback(q);updateProgress();persist();});
        label.append(radio,node('span','',text));fieldset.append(label);
      });
    } else {
      const input=node(q.type==='written'?'textarea':'input',q.type==='written'?'written-answer':'short-answer');
      input.id=`answer-${q.id}`; input.setAttribute('aria-label',q.prompt);input.value=state.quizzes[q.id]?.text || '';
      if(q.type==='written') {input.rows=4;input.placeholder=q.writingFrame || q.placeholder || '방금 실행한 값이나 그래프를 근거로 설명해 보세요.';}
      else {input.type='text';input.placeholder='답을 입력하세요';input.autocomplete='off';}
      input.addEventListener('input',()=>{state.quizzes[q.id]={text:input.value,checked:false};renderFeedback(q);updateProgress();persist();});
      fieldset.append(input);
    }
    const actions=node('div','quiz-actions'),button=node('button','check-answer',q.type==='written'?'예시 답안과 비교':'답 확인');button.type='submit';actions.append(button);
    if (q.tryCode) {
      const trial=node('button','try-experiment add-sandbox','실험 코드 넣기');trial.type='button';
      trial.addEventListener('click',()=>addSandbox(step,q.tryCode));actions.append(trial);
      const preview=node('details','question-experiment'),pre=node('pre','output-text',q.tryCode);
      preview.append(node('summary','','확인할 코드 살펴보기'),pre);fieldset.append(preview);
    }
    const feedback=node('div','quiz-feedback');feedback.setAttribute('role','status');form.append(fieldset,actions,feedback);
    form.addEventListener('submit',event=>{
      event.preventDefault();const answer=state.quizzes[q.id];
      if(!answer || (q.type!=='choice'&&!answer.text.trim())) {feedback.textContent='먼저 자신의 답을 작성하거나 선택하세요.';return;}
      answer.checked=true;renderFeedback(q);updateProgress();persist();
    });
    group.append(form);
  });
  section.append(group);
}
function formatInline(text, parent) {
  // Content is authored locally. Use text nodes for both prose and inline code.
  for (const token of text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
    if (token.startsWith('`')) parent.append(node('code', '', token.slice(1, -1)));
    else if (token.startsWith('**')) parent.append(node('strong', '', token.slice(2, -2)));
    else parent.append(document.createTextNode(token));
  }
}
function setBusy(value) {
  working = value;
  document.querySelectorAll('.run-cell, .add-sandbox, .remove-sandbox, #prepare-runtime, #restart-runtime, #import-notebook, #import-trigger').forEach(e => { e.disabled = value; });
  document.querySelectorAll('.code-editor').forEach(e => { e.readOnly = value; });
  if (!value) document.querySelectorAll('.remove-sandbox').forEach(e => {
    e.disabled = !!e.closest('.sandbox-cell').querySelector('textarea').value.trim();
  });
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function markPreviousOutput(area) {
  if (!area.querySelector('.output-stale-note')) {
    area.prepend(node('p', 'output-stale-note dataset-note', '이전 실행의 출력입니다. 바꾼 코드를 실행하면 갱신됩니다.'));
  }
}

async function runStep(step, free = null) {
  if (working) return;
  const code = free ? free.code : state.codes[step.id];
  const container = free ? document.getElementById(`sandbox-${step.id}-${free.id}`) : $(`#step-${step.id} .exercise-cell`);
  const status = container.querySelector('.cell-status');
  const outputArea = container.querySelector('.cell-output');
  if (!code.trim()) { status.textContent = '실행할 코드를 입력하세요.'; return; }
  const assessment = free ? null : $(`#assessment-${step.id}`);
  if (!free) {
    executed.delete(step.id); updateProgress();
    assessment.className = 'assessment-feedback pending';
    if (/\b___\b/.test(code)) {
      status.textContent = '빈칸을 먼저 완성하세요.';
      assessment.textContent = '___를 알맞은 코드로 바꿔 보세요. 아래 작성 힌트를 참고할 수 있습니다.';
      return;
    }
    assessment.textContent = '코드를 실행하고 목표를 확인하고 있습니다…';
  }
  setBusy(true);
  status.textContent = 'Python 준비 및 실행 중…';
  const result = {code, outputs: [], count: null, status: 'running'};
  let clearPending = false;
  try {
    await runtime.prepare(lesson.runtimeSetup.replace("__DATA_URL__", JSON.stringify(new URL(`downloads/${lesson.dataset.filename}`, location.href).href)));
    status.textContent = '실행 중…';
    outputArea.replaceChildren(node('span', 'output-empty', '실행 결과를 기다리고 있습니다.'));
    const reply = await runtime.execute(code, message => {
      const {content, header} = message;
      const type = header.msg_type;
      if (type === 'clear_output') {
        if (content.wait) clearPending = true;
        else { result.outputs = []; renderOutputs(outputArea, []); }
        return;
      }
      if (!['stream', 'execute_result', 'display_data', 'error'].includes(type)) return;
      if (clearPending) { result.outputs = []; clearPending = false; }
      // Bound retained output as well as visible output to keep browser saving usable.
      if (result.outputs.length >= 100) return;
      const output = {output_type: type, ...structuredClone(content)};
      delete output.transient;
      if (type === 'stream') output.text = output.text.slice(0, 10000);
      if (type === 'error') output.traceback = output.traceback.map(t => t.slice(0, 10000)).slice(-20);
      const previous = result.outputs.at(-1);
      if (type === 'stream' && previous?.output_type === 'stream' && previous.name === output.name)
        previous.text = (previous.text + output.text).slice(0, 100000);
      else result.outputs.push(output);
      renderOutputs(outputArea, result.outputs);
    });
    result.count = reply.execution_count ?? null;
    result.status = reply.status;
    if (free) free.result = result;
    else state.results[step.id] = result;
    if (reply.status === 'ok') {
      status.textContent = `실행 [${result.count}] · 완료`;
      renderOutputs(outputArea, result.outputs);
      if (!free) {
        const passed = await runtime.check(step.id, code);
        result.passed = passed;
        if (passed) executed.add(step.id);
        assessment.className = `assessment-feedback ${passed ? 'correct' : 'incorrect'}`;
        assessment.textContent = passed ? '✓ 목표를 달성했습니다. 아래 자유 실험 셀에서 다른 값도 시도해 보세요.' : `코드는 실행됐지만 아직 목표와 다릅니다. ${step.goal}`;
      }
    } else {
      if (!free) { executed.delete(step.id); assessment.className = 'assessment-feedback incorrect'; assessment.textContent = '오류를 수정한 뒤 다시 실행·확인해 보세요.'; }
      status.textContent = '실행 오류 · 코드를 확인하고 앞 단계부터 실행해 보세요.';
      if (!result.outputs.length) outputArea.textContent = `${reply.ename || '실행 오류'}: ${reply.evalue || ''}`;
    }
  } catch (error) {
    status.textContent = '실행하지 못했습니다.';
    outputArea.replaceChildren(node('pre', 'error-output', errorMessage(error)));
    if (assessment) assessment.textContent = '실행 환경을 확인한 뒤 다시 시도하세요.';
  } finally {
    setBusy(false);
    updateProgress();
    persist();
  }
}

function datasetTable(caption, headers, rows) {
  const wrap = node('div', 'dataset-table-wrap');
  wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
  const table = node('table', 'dataset-table');
  table.append(node('caption', '', caption));
  const thead = node('thead'), tr = node('tr');
  for (const text of headers) { const th = node('th', '', text); th.scope = 'col'; tr.append(th); }
  thead.append(tr); table.append(thead);
  const tbody = node('tbody');
  for (const values of rows) {
    const row = node('tr');
    values.forEach((value, i) => {
      const cell = node(i === 0 ? 'th' : 'td', '', String(value));
      if (i === 0) cell.scope = 'row'; row.append(cell);
    });
    tbody.append(row);
  }
  table.append(tbody); wrap.append(table); return wrap;
}

function renderDataset() {
  const data=lesson.dataset,area=$('#dataset-content');area.replaceChildren();
  const workspace=node('div','activity-workspace');
  const overview=node('div','activity-practice');
  const questions=node('div','activity-questions');
  overview.append(node('h3','activity-practice-title','표 살펴보기'));
  overview.append(node('p','','penguins_size.csv에는 남극 펭귄의 종·서식 섬·측정값이 담겨 있습니다. 표를 읽고 두 질문에 답해 보세요.'));
  const download=node('a','dataset-download',`↓ ${data.filename} 내려받기`);download.href=`downloads/${data.filename}`;download.download=data.filename;
  overview.append(datasetTable('펭귄 관측 기록 일부',data.previewHeaders.slice(1),data.preview.slice(0,3).map(r=>r.values)));
  renderQuestions({questions:data.questions},questions);
  const details=node('details');details.append(node('summary','','열 이름·단위와 파일 정보 보기'));
  details.append(datasetTable('열 이름과 뜻',['열 이름','뜻','단위'],data.columns.map(c=>[c.name,c.meaning,c.unit])));
  details.append(node('p','dataset-note',`${data.rowCount}행 × ${data.columnCount}열 · 제공된 CSV를 그대로 읽습니다.`),download);
  const link=node('a','',data.sourceLabel);link.href=data.sourceUrl;link.target='_blank';link.rel='noopener';details.append(link);overview.append(details);
  workspace.append(overview,questions);area.append(workspace);
  data.questions.forEach(renderFeedback);
}

function renderSandbox(step, free, list) {
  const cell = node('div', 'sandbox-cell code-cell');
  cell.id = `sandbox-${step.id}-${free.id}`;
  const toolbar = node('div', 'cell-toolbar');
  const label = node('label', 'cell-label', '나의 자유 실험 · Python');
  label.htmlFor = `free-code-${step.id}-${free.id}`;
  const status = node('span', 'cell-status', free.result ? '저장된 실험 결과 · 변수는 다시 실행해야 합니다.' : '자유롭게 코드를 작성하세요.');
  status.setAttribute('role', 'status');
  const run = node('button', 'run-cell', '▶ 실험 실행');
  run.type = 'button'; run.addEventListener('click', () => runStep(step, free));
  const remove = node('button', 'remove-sandbox', '빈 셀 삭제'); remove.type = 'button';
  remove.disabled = !!free.code.trim();
  remove.addEventListener('click', () => {
    if (working || free.code.trim()) return;
    state.sandboxes[step.id] = state.sandboxes[step.id].filter(c => c.id !== free.id); cell.remove(); persist();
  });
  toolbar.append(label, status, run, remove);
  const editor = node('textarea', 'code-editor');
  editor.id = label.htmlFor; editor.value = free.code; editor.rows = 5; editor.spellcheck = false;
  editor.placeholder = '# 앞에서 만든 df, clean, X, model 등을 사용해 자유롭게 실험하세요.';
  editor.addEventListener('input', () => {
    free.code = editor.value; status.textContent = '코드가 변경되었습니다. 실행해 보세요.';
    if (free.result) markPreviousOutput(cell.querySelector('.cell-output'));
    remove.disabled = !!free.code.trim(); persist();
  });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); runStep(step, free); }
  });
  const output = node('div', 'cell-output');
  if (free.result) renderOutputs(output, free.result.outputs);
  else output.append(node('span', 'output-empty', '이 셀도 앞 단계와 같은 Python 변수를 사용합니다.'));
  cell.append(toolbar, editor, output); list.append(cell);
}

function addSandbox(step, code='') {
  if (working) return;
  const list=document.getElementById(`sandbox-list-${step.id}`);
  const existing=code && (state.sandboxes[step.id] || []).find(cell=>cell.code===code);
  let id=existing?.id;
  if(!existing){
    const free={id:crypto.randomUUID(),code,result:null};id=free.id;
    (state.sandboxes[step.id] ||= []).push(free);renderSandbox(step,free,list);persist();
  }
  const editor=document.getElementById(`free-code-${step.id}-${id}`);
  editor.focus();editor.scrollIntoView({behavior:'smooth',block:'center'});
}

function render() {
  renderDataset();
  $('#lesson-steps').replaceChildren();
  $('#step-links').replaceChildren();
  for (const step of lesson.steps) {
    const number = String(step.id).padStart(2, '0');
    const link = node('a', 'step-nav-link');
    link.href = `#step-${step.id}`;
    link.dataset.stepLink = step.id;
    link.append(node('span', 'nav-number', number), node('span', '', step.title), node('span', 'step-check'));
    $('#step-links').append(link);

    const section = node('section', 'lesson-step');
    section.id = `step-${step.id}`;
    section.setAttribute('aria-labelledby', `step-title-${step.id}`);
    const heading = node('h2', 'step-title', `${number}. ${step.title}`);
    heading.id = `step-title-${step.id}`;
    section.append(node('p', 'eyebrow', `STEP ${number}`), heading);
    const explanation = node('div', 'step-explanation');
    for (const paragraph of step.explanation.split('\n\n')) {
      const p = node('p'); formatInline(paragraph, p); explanation.append(p);
    }
    section.append(explanation);
    const workspace = node('div', 'activity-workspace');
    const practice = node('div', 'activity-practice');
    const questions = node('div', 'activity-questions');
    practice.append(node('h3', 'activity-practice-title', '직접 실행하며 확인하기'));
    practice.append(node('p', 'exercise-goal', `코드 완성 미션 · ${step.goal}`));
    const codingHint = node('details', 'exercise-hint');
    codingHint.append(node('summary', '', '작성 힌트 보기'), node('p', '', step.codingHint));
    practice.append(codingHint);
    const cell = node('div', 'code-cell exercise-cell');
    const toolbar = node('div', 'cell-toolbar');
    const label = node('label', 'cell-label', `In [ ] · Python ${number}`);
    label.htmlFor = `code-${step.id}`;
    const status = node('span', 'cell-status', '아직 실행하지 않았습니다.');
    status.setAttribute('role', 'status');
    const run = node('button', 'run-cell', '▶ 실행·확인');
    run.type = 'button'; run.setAttribute('aria-label', `${number} 코드 실행`);
    run.addEventListener('click', () => runStep(step));
    toolbar.append(label, status, run);
    const editor = node('textarea', 'code-editor');
    editor.id = `code-${step.id}`; editor.value = state.codes[step.id];
    editor.rows = Math.max(4, editor.value.split('\n').length + 1);
    editor.spellcheck = false; editor.autocapitalize = 'off'; editor.autocomplete = 'off'; editor.wrap = 'off';
    editor.addEventListener('input', () => {
      state.codes[step.id] = editor.value;
      if (state.results[step.id]) markPreviousOutput(cell.querySelector('.cell-output'));
      executed.delete(step.id);
      status.textContent = '코드가 변경되었습니다. 다시 실행하세요.';
      const assessment = $(`#assessment-${step.id}`);
      assessment.className = 'assessment-feedback pending'; assessment.textContent = '코드를 수정했습니다. 다시 실행·확인하세요.';
      updateProgress(); persist();
    });
    editor.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); runStep(step); }
    });
    const output = node('div', 'cell-output');
    output.setAttribute('aria-label', `${number} 코드 실행 결과`);
    const previous = state.results[step.id];
    if (previous) {
      renderOutputs(output, previous.outputs);
      status.textContent = previous.code === editor.value ? '이전에 저장한 결과 · 변수는 다시 실행해야 합니다.' : '이전 코드의 결과 · 변경한 코드를 실행하세요.';
    } else output.append(node('span', 'output-empty', '실행하면 이곳에 결과가 나타납니다.'));
    cell.append(toolbar, editor, output);
    practice.append(cell);
    const assessment = node('p', 'assessment-feedback pending', '코드를 완성한 뒤 실행·확인하세요. 변수와 결과로 목표 달성 여부를 확인합니다.');
    assessment.id = `assessment-${step.id}`; assessment.setAttribute('role', 'status'); practice.append(assessment);
    renderQuestions(step, questions);
    workspace.append(practice, questions); section.append(workspace);
    const sandbox = node('div', 'sandbox-zone');
    sandbox.append(node('h3', '', '자유롭게 실험하기'), node('p', '', '값을 바꾸거나 코드를 새로 작성해 보세요. 이 셀은 정답을 검사하지 않으며, 앞에서 만든 변수를 함께 사용합니다.'));
    const sandboxList = node('div', 'sandbox-list');
    sandboxList.id = `sandbox-list-${step.id}`;
    for (const free of state.sandboxes[step.id] || []) renderSandbox(step, free, sandboxList);
    const add = node('button', 'add-sandbox', '+ 자유 실험 셀 추가'); add.type = 'button';
    add.addEventListener('click', () => addSandbox(step));
    sandbox.append(sandboxList, add); section.append(sandbox);

    $('#lesson-steps').append(section);
    step.questions.forEach(renderFeedback);
  }
  $('#reflection-answer').value = state.reflection;
  updateProgress();
}

$('#help-toggle').addEventListener('click', () => {
  const open = $('#help-toggle').getAttribute('aria-expanded') === 'true';
  $('#help-toggle').setAttribute('aria-expanded', String(!open)); $('#help-panel').hidden = open;
});
$('#reflection-answer').addEventListener('input', event => { if (state) { state.reflection = event.target.value; persist(); } });
$('#prepare-runtime').addEventListener('click', async () => {
  if (working) return;
  setBusy(true);
  try { await runtime.prepare(lesson.runtimeSetup.replace("__DATA_URL__", JSON.stringify(new URL(`downloads/${lesson.dataset.filename}`, location.href).href))); }
  catch (error) { $('#runtime-detail').textContent = errorMessage(error); }
  finally { setBusy(false); }
});
$('#restart-runtime').addEventListener('click', () => {
  if (working) return;
  runtime.reset(); executed.clear();
  document.querySelectorAll('.cell-status').forEach(e => { e.textContent = '변수가 초기화되었습니다. 01부터 다시 실행하세요.'; });
  updateProgress();
});
$('#export-notebook').addEventListener('click', () => {
  const notebook = exportNotebook(template, lesson, state);
  const url = URL.createObjectURL(new Blob([JSON.stringify(notebook, null, 2)], {type: 'application/x-ipynb+json'}));
  const link = node('a'); link.href = url; link.download = lesson.exportFile; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#save-status').textContent = '노트북 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인하세요.';
});
$('#import-trigger').addEventListener('click', () => $('#import-notebook').click());
$('#import-notebook').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file || working) return;
  try {
    if (file.size > 15000000) throw new Error('15MB 이하의 실습 노트북을 선택하세요.');
    const notebook = JSON.parse(await file.text());
    if (!Array.isArray(notebook.cells)) throw new Error('올바른 노트북 파일이 아닙니다.');
    let imported = notebook.metadata?.textbook;
    if (imported && ![lesson.id, ...(lesson.legacyIds || [])].includes(imported.lessonId)) throw new Error('다른 단원의 노트북입니다. 펭귄 분류 실습 파일을 선택하세요.');
    if (!imported) {
      imported = freshState(lesson);
      let matched = 0;
      for (const cell of notebook.cells) {
        if (cell.metadata?.tags?.includes('practice') && lesson.steps.some(s => s.id === cell.metadata.lesson_step)) {
          imported.codes[cell.metadata.lesson_step] = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
          matched++;
        }
      }
      if (matched !== lesson.steps.length) throw new Error('이 교재에서 저장한 펭귄 분류 노트북을 선택하세요.');
    }
    // Prefer actual notebook cells, including edits made later in Jupyter/Colab,
    // over the embedded web snapshot.
    for (const cell of notebook.cells) {
      if (cell.metadata?.tags?.includes('practice') && lesson.steps.some(s => s.id === cell.metadata.lesson_step))
        imported.codes[cell.metadata.lesson_step] = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
    }
    for (const step of lesson.steps) {
      const freeCells = notebook.cells.filter(c => c.metadata?.tags?.includes('sandbox') && c.metadata.lesson_step === step.id);
      if (freeCells.length) {
        imported.sandboxes ||= {};
        imported.sandboxes[step.id] = freeCells.map(c => ({id: c.metadata.sandbox_id,
          code: Array.isArray(c.source) ? c.source.join('') : c.source,
          result: {code: Array.isArray(c.source) ? c.source.join('') : c.source, outputs: c.outputs || [], count: c.execution_count}}));
      }
    }
    state = restoreState(lesson, imported); runtime.reset(); executed.clear(); render(); persist();
    $('#save-status').textContent = '노트북을 불러왔습니다. 변수는 01부터 다시 실행하세요.';
  } catch (error) { $('#save-status').textContent = `불러오기 실패: ${errorMessage(error)}`; }
  finally { event.target.value = ''; }
});

try {
  const lessonResponse = await fetch('lesson.json');
  if(!lessonResponse.ok) throw new Error('교재 파일을 불러올 수 없습니다.');
  lesson = await lessonResponse.json();
  const notebookResponse = await fetch(`downloads/${lesson.notebookFile}`);
  if(!notebookResponse.ok) throw new Error('실습 노트북을 불러올 수 없습니다.');
  template = await notebookResponse.json();
  key = `ml-textbook:${lesson.id}`;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* unavailable or invalid saved data */ }
  state = restoreState(lesson, saved);
  render();
  // The lesson is populated asynchronously; restore a shared section link only
  // after its tables and code cells have their final layout.
  if (location.hash) requestAnimationFrame(() => {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior: 'instant', block: 'start'});
  });
  $('#prepare-runtime').disabled = false; $('#restart-runtime').disabled = false; $('#export-notebook').disabled = false; $('#import-trigger').disabled = false;
  persist();
} catch (error) {
  $('#page-error').hidden = false; $('#page-error').textContent = errorMessage(error);
  $('#save-status').textContent = '교재를 불러오지 못했습니다.';
}
