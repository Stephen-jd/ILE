const dialog = document.getElementById('tool-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogContent = document.getElementById('dialog-content');
const toolCards = [...document.querySelectorAll('[data-tool]')];
const toolSearch = document.getElementById('tool-search');

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
        const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
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

const toolViews = {
    resume: {
        title: 'Resume Analyzer (AI)',
        content: `<div class="tool-form">
          <div class="field"><label for="resume-jd">Job description</label><textarea id="resume-jd" placeholder="Paste the job description"></textarea></div>
          <div class="field"><label for="resume-file">Resume PDF</label><input id="resume-file" type="file" accept="application/pdf,.pdf"></div>
          <button class="primary-button" id="resume-run" type="button">Analyze resume</button>
          <p class="status-message" id="resume-status" role="status"></p>
          <section class="result-panel" id="resume-result" hidden></section>
        </div>`
    },
    image: {
        title: 'Text to Image',
        content: `<div class="tool-form">
          <div class="field"><label for="image-prompt">Image prompt</label><textarea id="image-prompt" placeholder="Describe the image you want to create"></textarea></div>
          <button class="primary-button" id="image-run" type="button">Generate image</button>
          <p class="status-message" id="image-status" role="status"></p>
          <section class="result-panel" id="image-result" hidden><img id="generated-image" alt="Generated from your prompt"></section>
        </div>`
    },
    code: {
        title: 'Code Explainer',
        content: `<div class="tool-form">
          <div class="field"><label for="code-input">Code</label><textarea id="code-input" placeholder="Paste code to explain"></textarea></div>
          <button class="primary-button" id="code-run" type="button">Explain code</button>
          <p class="status-message" id="code-status" role="status"></p>
          <section class="result-panel" id="code-result" hidden><pre></pre></section>
        </div>`
    },
    markdown: {
        title: 'Markdown to HTML',
        content: `<div class="tool-form">
          <div class="field"><label for="markdown-input">Markdown</label><textarea id="markdown-input" placeholder="# A heading&#10;Write markdown here"></textarea></div>
          <button class="primary-button" id="markdown-run" type="button">Convert to HTML</button>
          <section class="result-panel" id="markdown-result" hidden>
            <textarea id="markdown-output" readonly aria-label="Generated HTML"></textarea>
            <div class="result-actions"><button class="subtle-button" id="markdown-copy" type="button">Copy HTML</button><button class="subtle-button" id="markdown-download" type="button">Download HTML</button></div>
            <div class="result-preview" id="markdown-preview"></div>
          </section>
        </div>`
    },
    beautify: {
        title: 'Message Beautifier',
        content: `<div class="tool-form">
          <div class="field"><label for="message-input">Draft message</label><textarea id="message-input" placeholder="Paste your draft"></textarea></div>
          <button class="primary-button" id="message-run" type="button">Improve message</button>
          <p class="status-message" id="message-status" role="status"></p>
          <section class="result-panel" id="message-result" hidden><pre></pre><div class="result-actions"><button class="subtle-button" id="message-copy" type="button">Copy message</button></div></section>
        </div>`
    },
    pdf: {
        title: 'PDF to Text',
        content: `<div class="tool-form">
          <div class="field"><label for="pdf-file">PDF file</label><input id="pdf-file" type="file" accept="application/pdf,.pdf"></div>
          <button class="primary-button" id="pdf-run" type="button">Extract text</button>
          <p class="status-message" id="pdf-status" role="status"></p>
          <section class="result-panel" id="pdf-result" hidden><textarea id="pdf-output" readonly aria-label="Extracted PDF text"></textarea><div class="result-actions"><button class="subtle-button" id="pdf-copy" type="button">Copy text</button></div></section>
        </div>`
    },
    audio: {
        title: 'Text to Audio',
        content: `<div class="tool-form">
          <div class="field"><label for="audio-language">Language</label><select id="audio-language">${languages.map(([code, name]) => `<option value="${code}">${name}</option>`).join('')}</select></div>
          <div class="field"><label for="audio-text">Text to speak</label><textarea id="audio-text" placeholder="Type or paste the text here"></textarea></div>
          <div class="result-actions"><button class="primary-button" id="audio-run" type="button">Generate audio</button><button class="subtle-button" id="audio-copy" type="button">Copy text</button></div>
          <p class="status-message" id="audio-status" role="status"></p>
          <section class="result-panel" id="audio-result" hidden><audio id="audio-player" controls></audio></section>
        </div>`
    },
    resize: {
        title: 'Image Resize',
        content: `<div class="tool-form">
          <div class="field"><label for="resize-file">Image file</label><input id="resize-file" type="file" accept="image/*"></div>
          <div class="field"><label for="resize-width">Width in pixels</label><input id="resize-width" type="number" min="1" max="8000" value="800"></div>
          <div class="field"><label for="resize-height">Height in pixels</label><input id="resize-height" type="number" min="1" max="8000" value="600"></div>
          <button class="primary-button" id="resize-run" type="button">Resize and download</button>
          <p class="status-message" id="resize-status" role="status"></p>
        </div>`
        },
        hyperlink: {
                title: 'Hyperlink Generator',
                content: `<div class="tool-form">
                    <div class="field"><label for="hyperlink-url">URL</label><input id="hyperlink-url" type="text" inputmode="url" placeholder="https://example.com"></div>
                    <div class="field"><label for="hyperlink-label">Link text</label><input id="hyperlink-label" type="text" placeholder="Visit our website"></div>
                    <button class="primary-button" id="hyperlink-run" type="button">Generate HTML link</button>
                    <p class="status-message" id="hyperlink-status" role="status"></p>
                    <section class="result-panel" id="hyperlink-result" hidden>
                        <textarea id="hyperlink-output" readonly aria-label="Generated HTML link"></textarea>
                        <div class="result-actions"><button class="subtle-button" id="hyperlink-copy" type="button">Copy HTML</button><button class="subtle-button" id="hyperlink-download" type="button">Download HTML</button></div>
                        <div class="result-preview" id="hyperlink-preview"></div>
                    </section>
                </div>`
        },
        shortener: {
                title: 'URL Shortener',
                content: `<div class="tool-form">
                    <div class="field"><label for="shortener-url">Long URL</label><input id="shortener-url" type="text" inputmode="url" placeholder="https://example.com/page"></div>
                    <button class="primary-button" id="shortener-run" type="button">Shorten URL</button>
                    <p class="status-message" id="shortener-status" role="status"></p>
                    <section class="result-panel" id="shortener-result" hidden>
                        <div class="field"><label for="shortener-output">Short URL</label><input id="shortener-output" type="text" readonly></div>
                        <div class="result-actions"><button class="subtle-button" id="shortener-copy" type="button">Copy URL</button><a class="subtle-button" id="shortener-open" target="_blank" rel="noopener noreferrer">Open short URL</a></div>
                    </section>
                </div>`
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

async function runOllamaTool({ endpoint, body, statusId, resultId, resultProperty, buttonId }) {
    const button = document.getElementById(buttonId);
    const result = document.getElementById(resultId);
    button.disabled = true;
    setStatus(statusId, 'Working...');
    result.hidden = true;
    try {
        const data = await readResponse(await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }));
        result.querySelector('pre').textContent = data[resultProperty];
        result.hidden = false;
        setStatus(statusId, 'Done.');
    } catch (error) {
        setStatus(statusId, error.message);
    } finally {
        button.disabled = false;
    }
}

function wireTool(toolId) {
    if (toolId === 'resume') {
        document.getElementById('resume-run').addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const file = document.getElementById('resume-file').files[0];
            const job = document.getElementById('resume-jd').value.trim();
            if (!file || !job) return setStatus('resume-status', 'Choose a PDF and enter the job description.');
            const form = new FormData();
            form.append('job_description', job);
            form.append('resume', file);
            button.disabled = true;
            setStatus('resume-status', 'Analyzing resume with your local AI model...');
            try {
                const data = await readResponse(await fetch('/api/tools/resume-analyzer', { method: 'POST', body: form }));
                const result = document.getElementById('resume-result');
                result.replaceChildren();
                const heading = document.createElement('strong');
                heading.textContent = `ATS match: ${data.score}/100`;
                const details = document.createElement('pre');
                details.textContent = `Analysis\n${data.analysis}\n\nSuggested improvements\n${data.corrections}`;
                result.append(heading, details);
                result.hidden = false;
                setStatus('resume-status', 'Analysis complete.');
            } catch (error) {
                setStatus('resume-status', error.message);
            } finally {
                button.disabled = false;
            }
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
            runOllamaTool({ endpoint: '/api/tools/explain-code', body: { code }, statusId: 'code-status', resultId: 'code-result', resultProperty: 'explanation', buttonId: 'code-run' });
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
        document.getElementById('markdown-copy').addEventListener('click', () => copyText('markdown-output', 'HTML copied.'));
        document.getElementById('markdown-download').addEventListener('click', () => downloadText('converted.html', document.getElementById('markdown-output').value, 'text/html'));
    } else if (toolId === 'beautify') {
        document.getElementById('message-run').addEventListener('click', () => {
            const message = document.getElementById('message-input').value.trim();
            if (!message) return setStatus('message-status', 'Enter a draft message first.');
            runOllamaTool({ endpoint: '/api/tools/beautify-message', body: { message }, statusId: 'message-status', resultId: 'message-result', resultProperty: 'beautified', buttonId: 'message-run' });
        });
        document.getElementById('message-copy').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(document.querySelector('#message-result pre').textContent);
                setStatus('message-status', 'Message copied.');
            } catch { setStatus('message-status', 'Copy failed.'); }
        });
    } else if (toolId === 'pdf') {
        document.getElementById('pdf-run').addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const file = document.getElementById('pdf-file').files[0];
            if (!file) return setStatus('pdf-status', 'Choose a PDF file first.');
            const form = new FormData();
            form.append('pdf', file);
            button.disabled = true;
            setStatus('pdf-status', 'Extracting text...');
            try {
                const data = await readResponse(await fetch('/api/tools/pdf-to-text', { method: 'POST', body: form }));
                document.getElementById('pdf-output').value = data.text;
                document.getElementById('pdf-result').hidden = false;
                setStatus('pdf-status', 'Text extracted.');
            } catch (error) { setStatus('pdf-status', error.message); }
            finally { button.disabled = false; }
        });
        document.getElementById('pdf-copy').addEventListener('click', () => copyText('pdf-output', 'Extracted text copied.'));
    } else if (toolId === 'audio') {
        document.getElementById('audio-run').addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const text = document.getElementById('audio-text').value.trim();
            const lang = document.getElementById('audio-language').value;
            if (!text) return setStatus('audio-status', 'Enter text to speak.');
            button.disabled = true;
            setStatus('audio-status', 'Generating audio...');
            try {
                const response = await fetch('/api/tools/text-to-audio', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang })
                });
                if (!response.ok) throw new Error((await response.json()).detail || 'Audio generation failed.');
                const player = document.getElementById('audio-player');
                player.src = URL.createObjectURL(await response.blob());
                document.getElementById('audio-result').hidden = false;
                setStatus('audio-status', 'Audio ready.');
                await player.play().catch(() => {});
            } catch (error) { setStatus('audio-status', error.message); }
            finally { button.disabled = false; }
        });
        document.getElementById('audio-copy').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(document.getElementById('audio-text').value);
                setStatus('audio-status', 'Text copied.');
            } catch { setStatus('audio-status', 'Copy failed.'); }
        });
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
        document.getElementById('hyperlink-copy').addEventListener('click', () => copyText('hyperlink-output', 'HTML link copied.'));
        document.getElementById('hyperlink-download').addEventListener('click', () => {
            const markup = document.getElementById('hyperlink-output').value;
            downloadText('hyperlink.html', `<!doctype html><html><body>${markup}</body></html>`, 'text/html');
        });
    } else if (toolId === 'shortener') {
        document.getElementById('shortener-run').addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const url = document.getElementById('shortener-url').value.trim();
            if (!url) return setStatus('shortener-status', 'Enter a URL to shorten.');
            button.disabled = true;
            setStatus('shortener-status', 'Creating your short URL...');
            document.getElementById('shortener-result').hidden = true;
            try {
                const data = await readResponse(await fetch('/api/tools/shorten', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                }));
                document.getElementById('shortener-output').value = data.short_url;
                document.getElementById('shortener-open').href = data.short_url;
                document.getElementById('shortener-result').hidden = false;
                setStatus('shortener-status', 'Short URL created and saved.');
            } catch (error) {
                setStatus('shortener-status', error.message);
            } finally {
                button.disabled = false;
            }
        });
        document.getElementById('shortener-copy').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(document.getElementById('shortener-output').value);
                setStatus('shortener-status', 'Short URL copied.');
            } catch { setStatus('shortener-status', 'Copy failed.'); }
        });
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

async function copyText(elementId, successMessage) {
    try {
        await navigator.clipboard.writeText(document.getElementById(elementId).value);
        const status = document.querySelector('.status-message');
        if (status) status.textContent = successMessage;
    } catch { /* Clipboard permissions may be unavailable outside a secure context. */ }
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

document.getElementById('tool-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const firstVisible = toolCards.find((card) => !card.hidden);
    if (firstVisible) firstVisible.click();
});

document.getElementById('auth-logout').addEventListener('click', () => {
    localStorage.removeItem('ile_token');
    window.google?.accounts?.id?.disableAutoSelect();
    window.location.reload();
});

setupGoogleSignIn();
