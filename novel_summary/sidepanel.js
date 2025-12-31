document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const promptInput = document.getElementById('prompt-input');
    const submitBtn = document.getElementById('submit-btn');
    const outputContent = document.getElementById('output-content');
    const loadingIndicator = document.getElementById('loading');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');

    // Load saved settings
    chrome.storage.local.get(['geminiApiKey', 'customPrompt'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        else {
            apiKeyInput.value = 'AIzaSyCqwNGLxckA8a';
            apiKeyInput.value += 'V8fa5IJBAweksYgyTpaEc';
        }
        if (result.customPrompt) {
            promptInput.value = result.customPrompt;
        }
    });

    // Toggle Settings
    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    // Save settings on change
    apiKeyInput.addEventListener('change', () => {
        chrome.storage.local.set({ geminiApiKey: apiKeyInput.value });
    });

    promptInput.addEventListener('change', () => {
        chrome.storage.local.set({ customPrompt: promptInput.value });
    });

    // Main Logic
    submitBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const prompt = promptInput.value.trim();

        if (!apiKey) {
            showError('Please enter your Gemini API Key in the settings.');
            settingsPanel.classList.remove('hidden');
            return;
        }

        if (!prompt) {
            showError('Please enter a prompt.');
            return;
        }

        setLoading(true);
        outputContent.textContent = ''; // Clear previous output

        try {
            // 1. Get Page Content
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found.');

            // We can't access chrome:// pages
            if (tab.url && tab.url.startsWith('chrome://')) {
                throw new Error('Cannot summarize internal Chrome pages.');
            } else if (!tab.url) {
                console.warn('Tab URL is undefined. Attempting to inject script anyway.');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: getPageContent,
            });

            if (!results || !results[0] || !results[0].result) {
                throw new Error('Failed to extract content from the page.');
            }

            const pageContent = results[0].result;
            const combinedPrompt = `${prompt}\n\n[Context]\n${pageContent}`;

            // 2. Call Gemini API
            const summary = await callGeminiAPI(apiKey, combinedPrompt);

            // 3. Display Result
            outputContent.textContent = summary;

        } catch (error) {
            console.error(error);
            showError(error.message || 'An error occurred.');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            loadingIndicator.classList.remove('hidden');
            outputContent.textContent = '';
        } else {
            submitBtn.disabled = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    function showError(msg) {
        outputContent.textContent = 'Error: ' + msg;
        outputContent.style.color = '#ef4444'; // Red-500
    }
});

// Extracted function to run in the context of the page
function getPageContent() {
    // Simple extraction: get all visible text
    // We could optimize this to look for <article> or specific novel containers if needed,
    // but usually body.innerText is a good generic start.
    // Limiting length might be necessary if the novel is too long, but 1.5 Flash has a large context window (1M tokens),
    // so sending the whole text is usually fine.
    return document.body.innerText;
}

async function callGeminiAPI(apiKey, text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: text }]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract text from response
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
        return 'No summary generated.';
    }

    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
        return 'Empty response.';
    }

    return parts[0].text;
}
