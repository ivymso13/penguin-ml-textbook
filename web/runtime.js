// One JupyterLite kernel is shared by every visible textbook code block.
export class TextbookRuntime {
  constructor(frame, onStatus) {
    this.frame = frame;
    this.onStatus = onStatus;
    this.kernel = null;
    this.starting = null;
    this.busy = false;
  }

  async prepare(setup) {
    if (this.kernel) return;
    if (this.starting) return this.starting;
    this.starting = this._start(setup);
    try { await this.starting; }
    catch (error) {
      this.kernel?.dispose();
      this.kernel = null;
      this.frame.removeAttribute('src');
      this.onStatus('error', '실행 환경을 준비하지 못했습니다. 인터넷 연결을 확인하고 다시 준비하세요.');
      throw error;
    } finally { this.starting = null; }
  }

  async _start(setup) {
    this.onStatus('loading', 'Python 화면과 실행 엔진을 불러오는 중입니다.');
    this.frame.src = 'lite/repl/index.html?kernel=python';
    const started = Date.now();
    let app;
    while (Date.now() - started < 120000) {
      try { app = this.frame.contentWindow?.jupyterapp; } catch { /* still loading */ }
      if (app?.serviceManager) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!app?.serviceManager) throw new Error('Python 엔진 연결 시간이 초과되었습니다.');
    await this._timeout(app.started, 120000);
    await this._timeout(app.serviceManager.ready, 120000);
    await this._timeout(app.restored, 120000);
    const consoleWidget = app.shell.currentWidget;
    if (consoleWidget?.sessionContext) await this._timeout(consoleWidget.sessionContext.ready, 120000);
    this.kernel = consoleWidget?.sessionContext?.session?.kernel ||
      await this._timeout(app.serviceManager.kernels.startNew({name: 'python'}), 120000);
    this.onStatus('loading', 'Python과 sklearn을 준비하는 중입니다. 처음에는 시간이 걸릴 수 있습니다.');
    const result = await this._execute(setup, () => {});
    if (result.status !== 'ok') throw new Error('라이브러리 준비 중 오류가 발생했습니다.');
    this.onStatus('ready', '모든 코드창이 같은 변수를 공유합니다. 01부터 순서대로 실행하세요.');
  }

  _timeout(promise, ms) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('실행 응답 시간이 초과되었습니다. Python을 다시 준비하세요.')), ms);
    })]).finally(() => clearTimeout(timer));
  }

  async execute(code, onMessage) {
    if (!this.kernel) throw new Error('Python을 먼저 준비하세요.');
    if (this.busy) throw new Error('다른 코드가 실행 중입니다. 완료 후 다시 실행하세요.');
    this.busy = true;
    try { return await this._execute(code, onMessage); }
    finally { this.busy = false; }
  }

  async check(number, source) {
    // Pyodide's kernel does not return user_expressions in execute_reply.
    // Run a separate bounded feedback request and keep its output out of the cell.
    let text = '';
    const reply = await this.execute(`print(_tb_check(${number}, ${JSON.stringify(source)}))`, message => {
      if (message.header.msg_type === 'stream') text += message.content.text;
    });
    if (reply.status !== 'ok') throw new Error('목표를 확인하지 못했습니다. 다시 실행해 보세요.');
    return text.trim() === 'True';
  }

  async _execute(code, onMessage) {
    const future = this.kernel.requestExecute({code, stop_on_error: true, store_history: true, allow_stdin: false});
    future.onIOPub = message => onMessage(message);
    try {
      const reply = await this._timeout(future.done, 180000);
      return reply.content;
    } catch (error) {
      this.reset();
      throw error;
    } finally { future.dispose(); }
  }

  reset() {
    this.kernel?.dispose();
    this.kernel = null;
    this.busy = false;
    this.frame.src = 'about:blank';
    this.onStatus('off', '변수가 초기화되었습니다. 01부터 다시 실행하세요. 작성한 코드는 유지됩니다.');
  }
}
