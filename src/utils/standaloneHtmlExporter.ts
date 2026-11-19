import { EngineParameters, RoleItem, ThemeMode } from '../types/ai';

export function exportStandaloneAiHtml(
  params: EngineParameters,
  activeRole: RoleItem,
  theme: ThemeMode
) {
  const htmlContent = `<!DOCTYPE html>
<html lang="id" data-theme="${theme}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Vinns Studio — Local & Cloud AI Workspace</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"></script>
<style>
:root, [data-theme="vanilla"] {
  --bg-canvas: #F4F2EE; --bg-surface: #FFFFFF; --bg-muted: #F3F1ED; --bg-code: #F8F6F2;
  --text-primary: #1C1B1A; --text-secondary: #6E6A66; --border-subtle: rgba(28,27,26,0.09);
  --accent: #C65D3B; --accent-hover: #B24F2F; --accent-soft: rgba(198,93,59,0.10);
}
[data-theme="white"] {
  --bg-canvas: #F8FAFC; --bg-surface: #FFFFFF; --bg-muted: #F1F5F9; --bg-code: #F8FAFC;
  --text-primary: #0F172A; --text-secondary: #475569; --border-subtle: rgba(15,23,42,0.09);
  --accent: #C65D3B; --accent-hover: #B24F2F; --accent-soft: rgba(198,93,59,0.09);
}
[data-theme="dark"] {
  --bg-canvas: #0E0D0C; --bg-surface: #161311; --bg-muted: #22201E; --bg-code: #1B1917;
  --text-primary: #F2EFE9; --text-secondary: #A6A29D; --border-subtle: rgba(255,255,255,0.10);
  --accent: #C65D3B; --accent-hover: #D66946; --accent-soft: rgba(198,93,59,0.16);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: var(--bg-canvas); color: var(--text-primary);
  height: 100dvh; display: flex; overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}
aside {
  width: 260px; background: var(--bg-surface); border-right: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; padding: 12px; gap: 10px;
}
main { flex: 1; display: flex; flex-direction: column; padding: 12px 16px; min-width: 0; }
.workspace-card {
  flex: 1; background: var(--bg-surface); border: 1px solid var(--border-subtle);
  border-radius: 10px; display: flex; flex-direction: column; overflow: hidden;
}
.topbar {
  height: 46px; border-bottom: 1px solid var(--border-subtle);
  display: flex; align-items: center; justify-content: space-between; padding: 0 14px;
}
.chat-scroll { flex: 1; overflow-y: auto; padding: 20px; max-width: 920px; width: 100%; margin: 0 auto; }
.input-dock {
  border-top: 1px solid var(--border-subtle); padding: 10px 14px;
  display: flex; gap: 8px; align-items: center; background: var(--bg-surface);
}
.btn-accent {
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 8px 14px; font-weight: 600; font-size: 13px; cursor: pointer;
  transition: transform 0.14s ease, background 0.18s ease;
}
.btn-accent:active { transform: scale(0.97); }
.btn-outline {
  background: var(--bg-muted); color: var(--text-primary); border: 1px solid var(--border-subtle);
  border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
input, textarea, select {
  font-family: inherit; background: var(--bg-muted); color: var(--text-primary);
  border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; font-size: 13px;
}
pre {
  background: var(--bg-code); border: 1px solid var(--border-subtle);
  border-radius: 8px; padding: 12px; overflow-x: auto; font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px; margin: 10px 0;
}
code {
  font-family: 'JetBrains Mono', monospace; background: var(--accent-soft);
  color: var(--accent); padding: 2px 5px; border-radius: 4px; font-size: 0.85em;
}
pre code { background: transparent; color: inherit; padding: 0; }
.msg-user {
  align-self: flex-end; background: var(--accent); color: #fff;
  padding: 10px 14px; border-radius: 8px; max-width: 80%; margin: 8px 0 8px auto;
}
.msg-ai { margin: 12px 0; line-height: 1.65; font-size: 14.5px; }
</style>
</head>
<body>
  <aside>
    <button class="btn-accent" onclick="resetChat()">+ Chat AI Baru</button>
    <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">SERVER ENDPOINT</div>
    <input id="server-url" value="${params.serverUrl}" onchange="connectModels()" />
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border-subtle);">
      <span style="font-size:12px;color:var(--text-secondary);">Tema Tampilan</span>
      <button class="btn-outline" onclick="cycleTheme()" id="theme-btn">${theme}</button>
    </div>
  </aside>
  <main>
    <div class="workspace-card">
      <div class="topbar">
        <select id="model-select"><option>Memuat model...</option></select>
        <span style="font-size:12px;color:var(--text-secondary);">Role: ${activeRole.name}</span>
      </div>
      <div class="chat-scroll" id="chat-box"></div>
      <div class="input-dock">
        <input id="prompt-input" style="flex:1" placeholder="Ask anything..." onkeydown="if(event.key==='Enter')sendMsg()" />
        <button class="btn-accent" onclick="sendMsg()">Kirim</button>
      </div>
    </div>
  </main>
<script>
const SYSTEM_PROMPT = ${JSON.stringify(activeRole.systemPrompt)};
let messages = [];
const themes = ['vanilla', 'white', 'dark'];
function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'vanilla';
  const next = themes[(themes.indexOf(cur) + 1) % themes.length];
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('theme-btn').textContent = next;
}
function resetChat() {
  messages = [];
  document.getElementById('chat-box').innerHTML = '';
}
async function connectModels() {
  const url = document.getElementById('server-url').value.replace(/\\/$/, '');
  const sel = document.getElementById('model-select');
  try {
    const r = await fetch(url + '/v1/models');
    const d = await r.json();
    sel.innerHTML = (d.data || []).map(m => '<option value="'+m.id+'">'+m.id+'</option>').join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Server Offline</option>';
  }
}
async function sendMsg() {
  const inp = document.getElementById('prompt-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const box = document.getElementById('chat-box');
  messages.push({ role: 'user', content: text });
  box.innerHTML += '<div class="msg-user">' + text.replace(/</g,'&lt;') + '</div>';
  const aiDiv = document.createElement('div');
  aiDiv.className = 'msg-ai';
  aiDiv.textContent = 'Thinking...';
  box.appendChild(aiDiv);
  box.scrollTop = box.scrollHeight;
  const url = document.getElementById('server-url').value.replace(/\\/$/, '');
  const model = document.getElementById('model-select').value;
  try {
    const r = await fetch(url + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: ${params.temperature},
        stream: false
      })
    });
    const d = await r.json();
    const reply = d.choices?.[0]?.message?.content || '';
    messages.push({ role: 'assistant', content: reply });
    aiDiv.innerHTML = marked.parse(reply);
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    aiDiv.textContent = 'Error: ' + e.message;
  }
}
connectModels();
</script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai.html';
  a.click();
  URL.revokeObjectURL(url);
}
