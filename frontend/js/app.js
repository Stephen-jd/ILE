const textInput = document.getElementById('tts-text');
const languageSelect = document.getElementById('tts-language');
const statusBox = document.getElementById('status');
const audioBox = document.getElementById('audio-box');
const audioPlayer = document.getElementById('tts-audio');

async function generateAudio() {
    const text = textInput.value.trim();
    const lang = languageSelect.value;

    if (!text) {
        statusBox.textContent = 'Please type text before generating audio.';
        return;
    }

    statusBox.textContent = 'Generating audio...';

    try {
        const response = await fetch('/api/tools/text-to-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Audio generation failed.');
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        audioPlayer.src = audioUrl;
        audioBox.style.display = 'block';
        statusBox.textContent = 'Audio ready. Click play to listen.';
        audioPlayer.play();
    } catch (error) {
        statusBox.textContent = error.message || 'Something went wrong.';
    }
}

async function copyText() {
    const text = textInput.value.trim();
    if (!text) {
        statusBox.textContent = 'There is no text to copy.';
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        statusBox.textContent = 'Text copied successfully.';
    } catch (error) {
        statusBox.textContent = 'Copy failed. Please copy it manually.';
    }
}

document.getElementById('generate-audio').addEventListener('click', generateAudio);
document.getElementById('copy-text').addEventListener('click', copyText);
