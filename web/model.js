export function freshState(lesson) {
  return {version: 1, lessonId: lesson.id,
    codes: Object.fromEntries(lesson.steps.map(s => [s.id, s.code])),
    quizzes: {}, results: {}, sandboxes: {}, reflection: ''};
}

function safeOutput(output) {
  if (!output || typeof output !== 'object') return null;
  const stringValue = value => Array.isArray(value) && value.every(x => typeof x === 'string') ? value.join('') : value;
  if (output.output_type === 'stream') {
    const text = stringValue(output.text);
    return typeof text === 'string' ? {output_type: 'stream', name: output.name === 'stderr' ? 'stderr' : 'stdout', text: text.slice(0, 100000)} : null;
  }
  if (output.output_type === 'error') {
    if (typeof output.ename !== 'string' || typeof output.evalue !== 'string' || !Array.isArray(output.traceback)) return null;
    return {output_type: 'error', ename: output.ename, evalue: output.evalue,
      traceback: output.traceback.filter(x => typeof x === 'string').slice(-20).map(x => x.slice(0, 10000))};
  }
  if (['execute_result', 'display_data'].includes(output.output_type)) {
    const data = {};
    const text = stringValue(output.data?.['text/plain']);
    if (typeof text === 'string') data['text/plain'] = text.slice(0, 100000);
    const html = stringValue(output.data?.['text/html']);
    if (typeof html === 'string' && html.length < 1500000 && /<table\b[^>]*\bdataframe\b/i.test(html)) data['text/html'] = html;
    const png = output.data?.['image/png'];
    if (typeof png === 'string' && png.length < 6000000) data['image/png'] = png;
    const safe = {output_type: output.output_type, data, metadata: {}};
    if (output.output_type === 'execute_result') safe.execution_count = Number.isInteger(output.execution_count) ? output.execution_count : null;
    return safe;
  }
  return null;
}

export function restoreState(lesson, input) {
  const state = freshState(lesson);
  if (!input || input.version !== 1 || ![lesson.id, ...(lesson.legacyIds || [])].includes(input.lessonId)) return state;
  for (const step of lesson.steps) {
    if (typeof input.codes?.[step.id] === 'string' && input.codes[step.id].length < 100000)
      state.codes[step.id] = input.codes[step.id];
    const result = input.results?.[step.id];
    if (result && Array.isArray(result.outputs) && result.outputs.length <= 100) {
      // Store only notebook output shapes used by this textbook; never render HTML.
      const outputs = result.outputs.map(safeOutput).filter(Boolean);
      state.results[step.id] = {outputs, code: typeof result.code === 'string' ? result.code : '',
        count: Number.isInteger(result.count) ? result.count : null, status: 'saved'};
    }
    if (Array.isArray(input.sandboxes?.[step.id])) {
      const seen = new Set();
      state.sandboxes[step.id] = input.sandboxes[step.id].filter(cell => {
        if (!cell || typeof cell.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(cell.id) || seen.has(cell.id)
            || typeof cell.code !== 'string' || cell.code.length > 100000) return false;
        seen.add(cell.id); return true;
      }).map(cell => ({id: cell.id, code: cell.code,
        result: cell.result && Array.isArray(cell.result.outputs) ? {
          code: typeof cell.result.code === 'string' ? cell.result.code : '',
          count: Number.isInteger(cell.result.count) ? cell.result.count : null,
          outputs: cell.result.outputs.slice(0, 100).map(safeOutput).filter(Boolean), status: 'saved',
        } : null}));
    }
  }
  for (const question of [...(lesson.dataset?.questions || []), ...lesson.steps.flatMap(s => s.questions || [])]) {
      const quiz = input.quizzes?.[question.id];
      if (question.type === 'choice' && Number.isInteger(quiz?.selected) && quiz.selected >= 0 && quiz.selected < question.options.length)
        state.quizzes[question.id] = {selected: quiz.selected, checked: quiz.checked === true};
      else if (question.type !== 'choice' && typeof quiz?.text === 'string')
        state.quizzes[question.id] = {text: quiz.text.slice(0,10000), checked: quiz.checked === true,
          review: (question.rubric || []).map((_,i) => quiz.review?.[i] === true)};
    }
  if (typeof input.reflection === 'string') state.reflection = input.reflection.slice(0, 100000);
  return state;
}

export function quizCorrect(question, state) {
  const quiz = state.quizzes[question.id];
  if (!quiz?.checked) return false;
  if (question.type === 'choice') return quiz.selected === question.answer;
  if (question.type === 'written') return !!quiz.text?.trim() &&
    (question.rubric || []).every((_,i) => quiz.review?.[i] === true); // Self-reviewed, not automatically graded.
  const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
  return (question.answers || []).some(answer => normalize(answer) === normalize(quiz.text));
}

export function exportNotebook(template, lesson, state) {
  const notebook = structuredClone(template);
  notebook.metadata.textbook = structuredClone(state);
  for (const cell of notebook.cells) {
    const id = cell.metadata.lesson_step;
    if (cell.metadata.tags?.includes('practice')) {
      cell.source = state.codes[id];
      const result = state.results[id];
      const current = result && result.code === state.codes[id];
      cell.outputs = current ? structuredClone(result.outputs) : [];
      cell.execution_count = current ? result.count : null;
    }
  }
  notebook.cells = notebook.cells.filter(cell => !cell.metadata.tags?.includes('sandbox')).flatMap(cell => {
    if (!cell.metadata.tags?.includes('practice')) return [cell];
    const id = cell.metadata.lesson_step;
    return [cell, ...(state.sandboxes?.[id] || []).map(free => {
      const current = free.result?.code === free.code;
      return {cell_type: 'code', id: `free-${id}-${free.id}`, source: free.code,
        metadata: {tags: ['sandbox'], lesson_step: id, sandbox_id: free.id},
        execution_count: current ? free.result.count : null,
        outputs: current ? structuredClone(free.result.outputs) : []};
    })];
  });
  const quizSummary = [...(lesson.dataset?.questions || []), ...lesson.steps.flatMap(step => step.questions)].map(q => {
    const answer = state.quizzes[q.id];
    const text = q.type === 'choice' ? q.options[answer?.selected] : answer?.text;
    const status = q.type === 'written' ? (quizCorrect(q,state) ? '자기점검 완료 · 자동 채점 아님' : (answer?.checked ? '예시 확인 · 자기점검 중' : '미확인')) : (quizCorrect(q,state) ? '정답 확인' : '미완료');
    const rubric=(q.rubric || []).map((criterion,i)=>`- [${answer?.review?.[i] ? 'x' : ' '}] ${criterion}`).join('\n');
    return `${q.id}. ${q.prompt}\n\n내 답: ${text || '(미작성)'} · ${status}${rubric ? '\n\n'+rubric : ''}`;
  }).join('\n\n');
  notebook.cells.push({cell_type: 'markdown', id: 'web-reflection', metadata: {},
    source: `## 웹 교재 학습 기록\n\n${quizSummary}\n\n### 내 말로 정리하기\n\n${state.reflection || '(아직 작성하지 않았습니다.)'}`});
  return notebook;
}
