
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('ile_token');
    if (!options.headers) options.headers = {};
    if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
    }
    const response = await fetch(url, options);
    if (response.status === 401) {
        setAuthStatus('You must be logged in to use this tool.');
        throw new Error('You must be logged in to use this tool.');
    }
    return response;
}

const dialog = document.getElementById('tool-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogContent = document.getElementById('dialog-content');
const toolCards = [...document.querySelectorAll('[data-tool]')];
const toolSearch = document.getElementById('tool-search');
let audioObjectUrl;

function getAuthToken() {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token');
    if (queryToken) {
        localStorage.setItem('ile_token', queryToken);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    return queryToken || localStorage.getItem('ile_token');
}

function setAuthStatus(message) {
    const status = document.getElementById('auth-status');
    if (status) status.textContent = message;
}

async function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return;
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
    });
}

async function handleGoogleCredential(response) {
    setAuthStatus('Signing in...');
    try {
        const result = await readResponse(await fetch('/api/auth/onetap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        }));
        localStorage.setItem('ile_token', result.token);
        window.location.reload();
    } catch (error) {
        setAuthStatus(error.message);
    }
}

async function loadSignedInUser(token) {
    if (!token) return;
    try {
                const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Session expired');
        const user = await response.json();
        document.getElementById('oauth-login').hidden = true;
        document.getElementById('auth-user').textContent = user.name || user.email;
        document.getElementById('auth-user').hidden = false;
        document.getElementById('auth-logout').hidden = false;
    } catch {
        localStorage.removeItem('ile_token');
    }
}
async function setupGoogleSignIn() {
    const token = getAuthToken();
    await loadSignedInUser(token);
    try {
        const config = await readResponse(await fetch('/api/auth/config'));
        if (!config.enabled || !config.client_id || localStorage.getItem('ile_token')) return;
        await loadGoogleIdentityServices();
        window.google.accounts.id.initialize({
            client_id: config.client_id,
            callback: handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: false,
            context: 'signin'
        });
        window.google.accounts.id.prompt();
    } catch (error) {
        setAuthStatus('Google sign-in could not load. Use Login instead.');
        console.error('Google sign-in setup failed:', error);
    }
}

const languages = [
    ['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'],
    ['de', 'German'], ['it', 'Italian'], ['ja', 'Japanese'], ['pt', 'Portuguese'],
    ['ta', 'Tamil'], ['te', 'Telugu']
];

const field = (id, label, control) => `<div class="field"><label for="${id}">${label}</label>${control}</div>`;
const input = (id, type, attributes = '') => `<input id="${id}" type="${type}" ${attributes}>`;
const button = (id, label, style = 'primary') => `<button class="${style}-button" id="${id}" type="button">${label}</button>`;
const status = (id) => `<p class="status-message" id="${id}" role="status"></p>`;
const result = (id, content) => `<section class="result-panel" id="${id}" hidden>${content}</section>`;
const form = (...content) => `<div class="tool-form">${content.join('')}</div>`;
const toolViews = {
    resume: {
        title: 'Resume Analyzer (AI)',
        content: form(
            field('resume-jd', 'Job description', '<textarea id="resume-jd" placeholder="Paste the job description"></textarea>'),
            field('resume-file', 'Resume PDF', input('resume-file', 'file', 'accept="application/pdf,.pdf"')),
            button('resume-run', 'Analyze resume'), status('resume-status'), result('resume-result', '')
        )
    },
    image: {
        title: 'Text to Image',
        content: form(
            field('image-prompt', 'Image prompt', '<textarea id="image-prompt" placeholder="Describe the image you want to create"></textarea>'),
            button('image-run', 'Generate image'), status('image-status'),
            result('image-result', '<img id="generated-image" alt="Generated from your prompt">')
        )
    },
    code: {
        title: 'Code Explainer',
        content: form(
            field('code-input', 'Code', '<textarea id="code-input" placeholder="Paste code to explain"></textarea>'),
            button('code-run', 'Explain code'), status('code-status'), result('code-result', '<pre></pre>')
        )
    },
    markdown: {
        title: 'Markdown to HTML',
        content: form(
            field('markdown-input', 'Markdown', '<textarea id="markdown-input" placeholder="# A heading&#10;Write markdown here"></textarea>'),
            button('markdown-run', 'Convert to HTML'),
            result('markdown-result', '<textarea id="markdown-output" readonly aria-label="Generated HTML"></textarea><div class="result-actions"><button class="subtle-button" id="markdown-copy" type="button">Copy HTML</button><button class="subtle-button" id="markdown-download" type="button">Download HTML</button></div><div class="result-preview" id="markdown-preview"></div>')
        )
    },
    beautify: {
        title: 'Message Beautifier',
        content: form(
            field('message-input', 'Draft message', '<textarea id="message-input" placeholder="Paste your draft"></textarea>'),
            button('message-run', 'Improve message'), status('message-status'),
            result('message-result', '<pre></pre><div class="result-actions"><button class="subtle-button" id="message-copy" type="button">Copy message</button></div>')
        )
    },
    pdf: {
        title: 'PDF to Text',
        content: form(
            field('pdf-file', 'PDF file', input('pdf-file', 'file', 'accept="application/pdf,.pdf"')),
            button('pdf-run', 'Extract text'), status('pdf-status'),
            result('pdf-result', '<textarea id="pdf-output" readonly aria-label="Extracted PDF text"></textarea><div class="result-actions"><button class="subtle-button" id="pdf-copy" type="button">Copy text</button></div>')
        )
    },
    audio: {
        title: 'Text to Audio',
        content: form(
            field('audio-language', 'Language', `<select id="audio-language">${languages.map(([code, name]) => `<option value="${code}">${name}</option>`).join('')}</select>`),
            field('audio-text', 'Text to speak', '<textarea id="audio-text" placeholder="Type or paste the text here"></textarea>'),
            `<div class="result-actions">${button('audio-run', 'Generate audio')}${button('audio-copy', 'Copy text', 'subtle')}</div>`,
            status('audio-status'), result('audio-result', '<audio id="audio-player" controls></audio>')
        )
    },
    resize: {
        title: 'Image Resize',
        content: form(
            field('resize-file', 'Image file', input('resize-file', 'file', 'accept="image/*"')),
            field('resize-width', 'Width in pixels', input('resize-width', 'number', 'min="1" max="8000" value="800"')),
            field('resize-height', 'Height in pixels', input('resize-height', 'number', 'min="1" max="8000" value="600"')),
            button('resize-run', 'Resize and download'), status('resize-status')
        )
    },
    hyperlink: {
        title: 'Hyperlink Generator',
        content: form(
            field('hyperlink-url', 'URL', input('hyperlink-url', 'text', 'inputmode="url" placeholder="https://example.com"')),
            field('hyperlink-label', 'Link text', input('hyperlink-label', 'text', 'placeholder="Visit our website"')),
            button('hyperlink-run', 'Generate HTML link'), status('hyperlink-status'),
            result('hyperlink-result', '<textarea id="hyperlink-output" readonly aria-label="Generated HTML link"></textarea><div class="result-actions"><button class="subtle-button" id="hyperlink-copy" type="button">Copy HTML</button><button class="subtle-button" id="hyperlink-download" type="button">Download HTML</button></div><div class="result-preview" id="hyperlink-preview"></div>')
        )
    },
    shortener: {
        title: 'URL Shortener',
        content: form(
            field('shortener-url', 'Long URL', input('shortener-url', 'text', 'inputmode="url" placeholder="https://example.com/page"')),
            button('shortener-run', 'Shorten URL'), status('shortener-status'),
            result('shortener-result', `${field('shortener-output', 'Short URL', input('shortener-output', 'text', 'readonly'))}<div class="result-actions"><button class="subtle-button" id="shortener-copy" type="button">Copy URL</button><a class="subtle-button" id="shortener-open" target="_blank" rel="noopener noreferrer">Open short URL</a></div>`)
        )
    }
};

function openTool(toolId) {
    const view = toolViews[toolId];
    if (!view) return;
    dialogTitle.textContent = view.title;
    dialogContent.innerHTML = view.content;
    dialog.showModal();
    wireTool(toolId);
}

function setStatus(id, message) {
    document.getElementById(id).textContent = message;
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'The request could not be completed.');
    return data;
}

async function postJson(url, body) {
    const response = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return readResponse(response);
}

async function runTask(buttonId, statusId, workingMessage, task) {
    const button = document.getElementById(buttonId);
    button.disabled = true;
    setStatus(statusId, workingMessage);
    try {
        await task();
    } catch (error) {
        setStatus(statusId, error.message);
    } finally {
        button.disabled = false;
    }
}

async function runOllamaTool({ endpoint, body, statusId, resultId, resultProperty, buttonId }) {
    const result = document.getElementById(resultId);
    result.hidden = true;
    await runTask(buttonId, statusId, 'Working...', async () => {
        const data = await postJson(endpoint, body);
        result.querySelector('pre').textContent = data[resultProperty];
        result.hidden = false;
        setStatus(statusId, 'Done.');
    });
}

function wireTool(toolId) {
    if (toolId === 'resume') {
        document.getElementById('resume-run').addEventListener('click', async () => {
            const file = document.getElementById('resume-file').files[0];
            const job = document.getElementById('resume-jd').value.trim();
            if (!file || !job) return setStatus('resume-status', 'Choose a PDF and enter the job description.');
            const form = new FormData();
            form.append('job_description', job);
            form.append('resume', file);
            await runTask('resume-run', 'resume-status', 'Analyzing resume with your local AI model...', async () => {
                const data = await readResponse(await authFetch('/api/tools/resume-analyzer', { method: 'POST', body: form }));
                const result = document.getElementById('resume-result');
                result.replaceChildren();
                const heading = document.createElement('strong');
                heading.textContent = `ATS match: ${data.score}/100`;
                const details = document.createElement('pre');
                details.textContent = `Analysis\n${data.analysis}\n\nSuggested improvements\n${data.corrections}`;
                result.append(heading, details);
                result.hidden = false;
                setStatus('resume-status', 'Analysis complete.');
            });
        });
    } else if (toolId === 'image') {
        document.getElementById('image-run').addEventListener('click', () => {
            const prompt = document.getElementById('image-prompt').value.trim();
            if (!prompt) return setStatus('image-status', 'Enter a description first.');
            const image = document.getElementById('generated-image');
            document.getElementById('image-result').hidden = true;
            setStatus('image-status', 'Generating image through the online image service...');
            image.onload = () => {
                document.getElementById('image-result').hidden = false;
                setStatus('image-status', 'Image ready.');
            };
            image.onerror = () => setStatus('image-status', 'Image generation failed. Check your internet connection and try again.');
            image.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
        });
    } else if (toolId === 'code') {
        document.getElementById('code-run').addEventListener('click', () => {
            const code = document.getElementById('code-input').value.trim();
            if (!code) return setStatus('code-status', 'Paste code to explain.');
            runOllamaTool({
                endpoint: '/api/tools/explain-code',
                body: { code },
                statusId: 'code-status',
                resultId: 'code-result',
                resultProperty: 'explanation',
                buttonId: 'code-run'
            });
        });
    } else if (toolId === 'markdown') {
        document.getElementById('markdown-run').addEventListener('click', () => {
            const markdown = document.getElementById('markdown-input').value;
            const html = markdownToHtml(markdown);
            const result = document.getElementById('markdown-result');
            document.getElementById('markdown-output').value = html;
            document.getElementById('markdown-preview').innerHTML = html;
            result.hidden = false;
        });
        document.getElementById('markdown-copy').addEventListener('click', () => copyText('markdown-output', null, 'HTML copied.'));
        document.getElementById('markdown-download').addEventListener('click', () => downloadText('converted.html', document.getElementById('markdown-output').value, 'text/html'));
    } else if (toolId === 'beautify') {
        document.getElementById('message-run').addEventListener('click', () => {
            const message = document.getElementById('message-input').value.trim();
            if (!message) return setStatus('message-status', 'Enter a draft message first.');
            runOllamaTool({
                endpoint: '/api/tools/beautify-message',
                body: { message },
                statusId: 'message-status',
                resultId: 'message-result',
                resultProperty: 'beautified',
                buttonId: 'message-run'
            });
        });
        document.getElementById('message-copy').addEventListener('click', () => copyText('message-result pre', 'message-status', 'Message copied.'));
    } else if (toolId === 'pdf') {
        document.getElementById('pdf-run').addEventListener('click', async () => {
            const file = document.getElementById('pdf-file').files[0];
            if (!file) return setStatus('pdf-status', 'Choose a PDF file first.');
            const form = new FormData();
            form.append('pdf', file);
            await runTask('pdf-run', 'pdf-status', 'Extracting text...', async () => {
                const data = await readResponse(await authFetch('/api/tools/pdf-to-text', { method: 'POST', body: form }));
                document.getElementById('pdf-output').value = data.text;
                document.getElementById('pdf-result').hidden = false;
                setStatus('pdf-status', 'Text extracted.');
            });
        });
        document.getElementById('pdf-copy').addEventListener('click', () => copyText('pdf-output', 'pdf-status', 'Extracted text copied.'));
    } else if (toolId === 'audio') {
        document.getElementById('audio-run').addEventListener('click', async () => {
            const text = document.getElementById('audio-text').value.trim();
            const lang = document.getElementById('audio-language').value;
            if (!text) return setStatus('audio-status', 'Enter text to speak.');
            await runTask('audio-run', 'audio-status', 'Generating audio...', async () => {
                const response = await authFetch('/api/tools/text-to-audio', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang })
                });
                if (!response.ok) throw new Error((await response.json()).detail || 'Audio generation failed.');
                const player = document.getElementById('audio-player');
                if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
                audioObjectUrl = URL.createObjectURL(await response.blob());
                player.src = audioObjectUrl;
                document.getElementById('audio-result').hidden = false;
                setStatus('audio-status', 'Audio ready.');
                await player.play().catch(() => {});
            });
        });
        document.getElementById('audio-copy').addEventListener('click', () => copyText('audio-text', 'audio-status', 'Text copied.'));
    } else if (toolId === 'resize') {
        document.getElementById('resize-run').addEventListener('click', async () => {
            const file = document.getElementById('resize-file').files[0];
            const width = Number(document.getElementById('resize-width').value);
            const height = Number(document.getElementById('resize-height').value);
            if (!file) return setStatus('resize-status', 'Choose an image first.');
            if (!width || !height || width > 8000 || height > 8000) return setStatus('resize-status', 'Enter dimensions between 1 and 8000 pixels.');
            try {
                const bitmap = await createImageBitmap(file);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
                bitmap.close();
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error('The image could not be resized.');
                downloadBlob(`resized-${width}x${height}.png`, blob);
                setStatus('resize-status', `Downloaded ${width} × ${height} image.`);
            } catch (error) { setStatus('resize-status', error.message || 'Image resizing failed.'); }
        });
    } else if (toolId === 'hyperlink') {
        document.getElementById('hyperlink-run').addEventListener('click', () => {
            const rawUrl = document.getElementById('hyperlink-url').value.trim();
            const label = document.getElementById('hyperlink-label').value.trim();
            if (!rawUrl || !label) return setStatus('hyperlink-status', 'Enter both a URL and link text.');
            try {
                const candidate = /^[a-z][a-z\d+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
                const url = new URL(candidate);
                if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS links are supported.');
                const link = document.createElement('a');
                link.href = url.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = label;
                document.getElementById('hyperlink-output').value = link.outerHTML;
                document.getElementById('hyperlink-preview').replaceChildren(link.cloneNode(true));
                document.getElementById('hyperlink-result').hidden = false;
                setStatus('hyperlink-status', 'HTML link generated.');
            } catch (error) {
                setStatus('hyperlink-status', error.message || 'Enter a valid web URL.');
            }
        });
        document.getElementById('hyperlink-copy').addEventListener('click', () => copyText('hyperlink-output', 'hyperlink-status', 'HTML link copied.'));
        document.getElementById('hyperlink-download').addEventListener('click', () => {
            const markup = document.getElementById('hyperlink-output').value;
            downloadText('hyperlink.html', `<!doctype html><html><body>${markup}</body></html>`, 'text/html');
        });
    } else if (toolId === 'shortener') {
        document.getElementById('shortener-run').addEventListener('click', async () => {
            const url = document.getElementById('shortener-url').value.trim();
            if (!url) return setStatus('shortener-status', 'Enter a URL to shorten.');
            document.getElementById('shortener-result').hidden = true;
            await runTask('shortener-run', 'shortener-status', 'Creating your short URL...', async () => {
                const data = await postJson('/api/tools/shorten', { url });
                document.getElementById('shortener-output').value = data.short_url;
                document.getElementById('shortener-open').href = data.short_url;
                document.getElementById('shortener-result').hidden = false;
                setStatus('shortener-status', 'Short URL created and saved.');
            });
        });
        document.getElementById('shortener-copy').addEventListener('click', () => copyText('shortener-output', 'shortener-status', 'Short URL copied.'));
    }
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function markdownToHtml(markdown) {
    const blocks = markdown.trim().split(/\n\s*\n/);
    return blocks.map((block) => {
        const lines = block.split('\n');
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
            return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
        }
        const heading = lines.length === 1 ? lines[0].match(/^(#{1,6})\s+(.+)$/) : null;
        if (heading) {
            const level = heading[1].length;
            return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
        }
        return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
    }).join('\n');
}

async function copyText(elementId, statusId, successMessage) {
    try {
        const element = document.querySelector(`#${elementId}`);
        await navigator.clipboard.writeText(element.value ?? element.textContent);
        if (statusId) setStatus(statusId, successMessage);
    } catch {
        if (statusId) setStatus(statusId, 'Copy failed.');
    }
}

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function downloadText(filename, text, type) {
    downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));
}

toolCards.forEach((card) => card.addEventListener('click', () => openTool(card.dataset.tool)));
document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => {
    const player = document.getElementById('audio-player');
    player?.pause();
    player?.removeAttribute('src');
    player?.load();
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = undefined;
});

toolSearch.addEventListener('input', () => {
    const query = toolSearch.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    toolCards.forEach((card) => {
        const visible = card.textContent.toLocaleLowerCase().includes(query);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
    });
    document.getElementById('empty-state').hidden = visibleCount > 0;
});

document.getElementById('tool-search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = toolSearch.value.trim();
    if (!input) return;
    
    const container = document.getElementById('ai-response-container');
    const content = container.querySelector('.ai-content');
    container.hidden = false;
    content.innerHTML = '<span style="color:#727a86;"><i>Thinking...</i></span>';
    
    try {
        const data = await postJson('/api/tools/chat', { prompt: input });
        content.innerHTML = markdownToHtml(data.response);
    } catch (error) {
        content.innerHTML = '<span style="color:#fa4e59;">Error: ' + error.message + '</span>';
    }
});

document.getElementById('auth-logout').addEventListener('click', () => {
    localStorage.removeItem('ile_token');
    window.google?.accounts?.id?.disableAutoSelect();
    window.location.reload();
});

setupGoogleSignIn();
