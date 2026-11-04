// Render notebook MIME bundles without executing HTML, scripts or event handlers.
function textValue(value) {
  return Array.isArray(value) ? value.join('') : (typeof value === 'string' ? value : '');
}

function dataframe(source, area) {
  if (!source || source.length > 1500000) return false;
  const document = area.ownerDocument;
  const parsed = new document.defaultView.DOMParser().parseFromString(source, 'text/html');
  const original = parsed.querySelector('table.dataframe');
  if (!original) return false;
  const allowed = new Set(['TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','CAPTION','COLGROUP','COL']);
  function clone(node) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent);
    if (node.nodeType !== 1 || !allowed.has(node.tagName)) return null;
    const copy = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'TABLE') copy.className = 'dataframe';
    if (node.tagName === 'TH') copy.scope = node.closest('thead') ? 'col' : 'row';
    for (const attribute of ['colspan','rowspan']) {
      const count = Number(node.getAttribute(attribute));
      if (Number.isInteger(count) && count > 0 && count <= 100) copy.setAttribute(attribute, String(count));
    }
    for (const child of node.childNodes) { const safe = clone(child); if (safe) copy.append(safe); }
    return copy;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'dataframe-output'; wrapper.tabIndex = 0;
  wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','DataFrame 표 실행 결과');
  wrapper.append(clone(original)); area.append(wrapper);
  for (const paragraph of parsed.querySelectorAll('p')) {
    if (!paragraph.closest('table')) {
      const summary = document.createElement('p'); summary.className = 'dataframe-summary';
      summary.textContent = paragraph.textContent; area.append(summary);
    }
  }
  return true;
}

export function renderOutputs(area, outputs) {
  const document = area.ownerDocument;
  area.replaceChildren();
  let length = 0;
  for (const output of outputs) {
    let text = '';
    if (output.output_type === 'stream') text = textValue(output.text);
    else if (output.output_type === 'error') text = (output.traceback || []).join('\n') || `${output.ename}: ${output.evalue}`;
    else {
      const data = output.data || {};
      // Prefer pandas' notebook table representation to its console fallback.
      if (dataframe(textValue(data['text/html']), area)) continue;
      const png = textValue(data['image/png']);
      if (png && png.length < 6000000) {
        const image = document.createElement('img'); image.className = 'cell-figure';
        image.src = `data:image/png;base64,${png}`;
        image.alt = 'Python 코드 실행으로 생성한 그래프'; area.append(image);
        continue;
      }
      text = textValue(data['text/plain']);
    }
    text = text.replace(/\x1b\[[0-9;]*m/g, '');
    const bounded = text.slice(0, Math.max(0, 100000-length)); length += bounded.length;
    if (bounded) {
      const pre = document.createElement('pre');
      pre.className = output.output_type === 'error' ? 'output-text error-output' : 'output-text';
      pre.textContent = bounded; area.append(pre);
    }
  }
  if (!area.childNodes.length) {
    const empty = document.createElement('span'); empty.className = 'output-empty';
    empty.textContent = '실행 완료 · 표시할 출력이 없습니다.'; area.append(empty);
  }
  area.scrollTop = 0;
}
