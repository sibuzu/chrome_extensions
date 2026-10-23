const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const version = JSON.parse(read('manifest.json')).version;
const tick = () => new Promise(resolve => setImmediate(resolve));
const composer = `<form data-chatgpt-composer data-thread-find-composer="true">
  <div contenteditable="true" role="textbox" data-composer-markdown><p><br></p></div>
  <button type="button" aria-label="新增檔案和更多內容">+</button>
</form>`;

async function content(t, html = composer) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  t.after(() => dom.window.close());
  const w = dom.window;
  const listeners = new Set();
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; }, set(value) { this.textContent = value; }
  });
  w.HTMLElement.prototype.getClientRects = function () {
    return this.closest('[hidden]') ? [] : [{ width: 100, height: 20 }];
  };
  w.focus = () => {};
  w.setTimeout = callback => setTimeout(callback, 0);
  w.chrome = { runtime: {
    getManifest: () => ({ version }),
    sendMessage: async () => {},
    onMessage: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }
  } };
  const load = () => w.eval(read('content.js'));
  load();
  await tick();
  const request = data => new Promise(resolve => {
    assert.equal(listeners.size, 1);
    for (const listener of listeners) listener(data, {}, resolve);
  });
  const state = async () => (await request({ type: 'queryState' })).state;
  return { w, request, state, load, listeners };
}

test('empty modern editor is idle without any voice or dictation button', async t => {
  const { state } = await content(t);
  assert.equal(await state(), 'input-mode');
});

test('stop control keeps queue waiting; its removal makes the same editor idle', async t => {
  const { w, state } = await content(t);
  const stop = w.document.createElement('button');
  stop.setAttribute('aria-label', '停止');
  w.document.querySelector('form').append(stop);
  assert.equal(await state(), 'running');
  stop.remove();
  assert.equal(await state(), 'input-mode');
});

test('draft and disabled editor are not idle even without recognizable buttons', async t => {
  const { w, state } = await content(t);
  const editor = w.document.querySelector('[role="textbox"]');
  editor.textContent = 'user draft';
  assert.equal(await state(), 'ready-to-send');
  editor.textContent = '';
  editor.setAttribute('aria-disabled', 'true');
  assert.equal(await state(), 'not-found');
});

test('hidden legacy editor and submit button outside composer are ignored', async t => {
  const { state } = await content(t,
    '<div hidden><textarea id="prompt-textarea"></textarea></div><button type="submit">Other</button>' + composer);
  assert.equal(await state(), 'input-mode');
});

test('reinjection replaces old message listener instead of duplicating sends', async t => {
  const { load, listeners, state } = await content(t);
  load();
  assert.equal(listeners.size, 1);
  assert.equal(await state(), 'input-mode');
});

test('multiline send succeeds using new editor and arrow icon, then reports running', async t => {
  const { w, request } = await content(t);
  const editor = w.document.querySelector('[role="textbox"]');
  const button = w.document.createElement('button');
  button.type = 'button';
  button.innerHTML = '<svg><use href="icons.svg#voice-regular-20"></use></svg>';
  button.setAttribute('aria-label', '開始語音對話');
  w.document.querySelector('form').append(button);
  w.document.execCommand = (command, unused, text) => {
    editor.textContent += command === 'insertText' ? text : '\n';
    return true;
  };
  editor.addEventListener('input', () => {
    button.setAttribute('aria-label', '');
    button.querySelector('use').setAttribute('href', 'icons.svg#arrow-up-lg-20');
  });
  let submitted;
  button.addEventListener('click', () => {
    submitted = editor.textContent;
    editor.textContent = '';
    button.setAttribute('aria-label', '停止');
  });
  const result = await request({ action: 'sendMsg', text: '第一行\n第二行' });
  assert.equal(result.ok, true);
  assert.equal(result.state, 'running');
  assert.equal(submitted, '第一行\n第二行');
});

test('missing input returns an explicit failure', async t => {
  const { request } = await content(t, '<main>Loading</main>');
  const result = await request({ action: 'sendMsg', text: 'test' });
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/);
});

async function panel(t) {
  const dom = new JSDOM(read('sidepanel.html'), { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  t.after(() => dom.window.close());
  const w = dom.window;
  const context = dom.getInternalVMContext();
  const calls = [], timeouts = [], polls = [];
  let remoteState = 'input-mode', remoteVersion = version, listener, sendFailure = null;
  w.setTimeout = callback => { timeouts.push(callback); return timeouts.length; };
  w.setInterval = callback => { polls.push(callback); return polls.length; };
  w.clearInterval = () => {};
  w.chrome = {
    runtime: {
      getManifest: () => ({ version }),
      onMessage: { addListener: fn => { listener = fn; } },
      sendMessage: async data => {
        calls.push(data);
        remoteVersion = version;
        return { ok: true };
      }
    },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    tabs: {
      query: async () => [{ id: 10, url: 'https://chatgpt.com/c/test' }],
      sendMessage: async (tabId, data) => {
        calls.push({ tabId, ...data });
        if (data.type === 'queryState') return { ok: true, state: remoteState, version: remoteVersion };
        if (sendFailure) return { ok: false, error: sendFailure };
        remoteState = 'running';
        return { ok: true, state: remoteState };
      }
    }
  };
  vm.runInContext(read('sidepanel.js'), context);
  await tick();
  return {
    w, calls,
    setState: state => { remoteState = state; },
    setVersion: value => { remoteVersion = value; },
    failSend: error => { sendFailure = error; },
    sent: () => calls.filter(call => call.action === 'sendMsg'),
    poll: async () => { polls[0](); await tick(); },
    enqueue: async text => {
      w.document.querySelector('.text-container').textContent = text;
      w.document.querySelector('#sendMsg').click();
      await tick();
    },
    finishCooldown: async () => { assert.ok(timeouts.length); timeouts.shift()(); await tick(); },
    emit: (state, tabId = 10) => listener({ type: 'stateChange', state, version }, { tab: { id: tabId } }, () => {})
  };
}

test('panel reads initial state directly without a stateChange event', async t => {
  const p = await panel(t);
  assert.match(p.w.document.querySelector('#state').textContent, /input-mode/);
});

test('poll recovers missed running and idle events and sends next prompt once', async t => {
  const p = await panel(t);
  await p.enqueue('first');
  await p.enqueue('second');
  assert.deepEqual(p.sent().map(call => call.text), ['first']);
  await p.finishCooldown();
  assert.equal(p.sent().length, 1);
  // No runtime events are emitted anywhere in this test.
  p.setState('input-mode');
  await p.poll();
  assert.deepEqual(p.sent().map(call => call.text), ['first', 'second']);
  await p.poll();
  assert.equal(p.sent().length, 2);
});

test('fast completion during cooldown cannot strand the next item', async t => {
  const p = await panel(t);
  await p.enqueue('first');
  await p.enqueue('second');
  p.setState('input-mode');
  await p.finishCooldown();
  assert.deepEqual(p.sent().map(call => call.text), ['first', 'second']);
});

test('running, draft, and unrelated tab events do not release the queue', async t => {
  const p = await panel(t);
  p.setState('running');
  await p.enqueue('first');
  p.emit('input-mode', 999);
  await tick();
  assert.equal(p.sent().length, 0);
  p.setState('ready-to-send');
  await p.poll();
  assert.equal(p.sent().length, 0);
  p.setState('input-mode');
  await p.poll();
  assert.equal(p.sent().length, 1);
});

test('failed submission keeps the queue and pauses automatic retries', async t => {
  const p = await panel(t);
  p.failSend('not submitted');
  await p.enqueue('keep me');
  assert.equal(p.w.document.querySelector('#pauseQueue').checked, true);
  assert.match(p.w.document.querySelector('#promptList').textContent, /keep me/);
  await p.poll();
  assert.equal(p.sent().length, 1);
  assert.match(p.w.document.querySelector('#state').textContent, /not submitted/);
});

test('outdated content script requests reinjection before reading state', async t => {
  const p = await panel(t);
  p.setVersion('1.0.0');
  await p.poll();
  assert.equal(p.calls.filter(call => call.action === 'ensureContentScript').length, 1);
  assert.match(p.w.document.querySelector('#state').textContent, /input-mode/);
});

function background(pingVersion = version) {
  const calls = [];
  let listener;
  const event = { addListener() {} };
  const context = vm.createContext({
    console: { log() {}, error() {} },
    chrome: {
      action: { onClicked: event },
      contextMenus: { onClicked: event },
      runtime: {
        getManifest: () => ({ version }), onInstalled: event,
        onMessage: { addListener: fn => { listener = fn; } }
      },
      tabs: {
        onUpdated: event, get: async () => ({ url: 'https://chatgpt.com/c/test' }),
        sendMessage: async () => ({ ok: true, version: pingVersion })
      },
      scripting: { executeScript: async request => { calls.push(request); } }
    }
  });
  vm.runInContext(read('background.js'), context);
  return { calls, listener, ensure: () => new Promise(resolve => {
    assert.equal(listener({ action: 'ensureContentScript', tabId: 10 }, {}, resolve), true);
  }) };
}

test('background leaves unrelated message response channels unclaimed', () => {
  const b = background();
  assert.equal(b.listener({ type: 'stateChange' }, {}, () => assert.fail()), undefined);
});

test('background reinjects an outdated script and acknowledges completion', async () => {
  const b = background('1.0.0');
  assert.equal((await b.ensure()).ok, true);
  assert.equal(b.calls.length, 1);
  assert.equal(b.calls[0].target.tabId, 10);
});

test('background keeps a current script without reinjecting it', async () => {
  const b = background();
  assert.equal((await b.ensure()).ok, true);
  assert.equal(b.calls.length, 0);
});
