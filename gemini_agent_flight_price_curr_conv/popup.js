let GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

const system_prompt = `You are a helpful AI agent that can use tools to answer questions accurately.

You have access to the following tools:

1. calculate(expression: str) -> str
   Evaluate a mathematical expression safely. (Use basic operators like +, -, *, /, **, math functions)
   Examples: calculate("2**10"), calculate("Math.sqrt(144)"), calculate("120 * 83.25")

2. get_flight_prices(origin: str, destination: str, date: str) -> str
   Get the current flight prices for a given origin, destination, and date.
   Examples: get_flight_prices("Mumbai", "Delhi", "2022-12-25")

3. get_currency_conversion_rate(amount: float, from_currency: str, to_currency: str) -> str
   Get the current currency conversion rate to convert from_currency to to_currency. (Note: this returns the multiplier rate. You must then use the calculate tool to multiply the original amount by this rate).
   Examples: get_currency_conversion_rate(120, "USD", "INR")

You must respond in ONE of these two JSON formats:

If you need to use a tool:
{"tool_name": "<name>", "tool_arguments": {"<arg_name>": "<value>"}}

If you have the final answer:
{"answer": "<your final answer>"}

IMPORTANT RULES:
- Respond with ONLY the JSON. No other text. No markdown code fences.
- Use tools when you need real data or precise calculations.
- After receiving a tool result, either use another tool or provide your final answer.
- For complex calculations, break them down into steps if needed.
- ALWAYS use the calculate tool for math — do NOT try to compute in your head.
- MULTI-STEP REASONING: Do not give a final answer until all constraints of the user's query are met. If the user asks for a price in a specific currency (e.g., INR) and the tool returns it in another (e.g., USD), you MUST call \`get_currency_conversion_rate\`, and then MUST call \`calculate\` to multiply the price by the rate before providing the final answer.`;

let chat_history = [
    { role: "system", content: system_prompt }
];

const tools = {
    calculate: async (args) => {
        try {
            const response = await fetch('https://api.mathjs.org/v4/?expr=' + encodeURIComponent(args.expression));
            if (!response.ok) {
                const err = await response.text();
                throw new Error(err);
            }
            const result = await response.text();
            return JSON.stringify({ result: String(result) });
        } catch (e) {
            return JSON.stringify({ error: `Calculation failed: ${e.message}` });
        }
    },
    get_flight_prices: (args) => {
        const flight_prices = {
            "Kolkata": {
                "Bangkok": {
                    "2026-06-03": {"price": "$155", "airline": "Thai Airways", "duration": "2h 5m"},
                    "2026-06-04": {"price": "$146", "airline": "IndiGo", "duration": "2h 10m"},
                },
            },
        };
        const { origin, destination, date } = args;
        if (flight_prices[origin] && flight_prices[origin][destination] && flight_prices[origin][destination][date]) {
            return JSON.stringify({ flight_prices: flight_prices[origin][destination][date] });
        }
        return JSON.stringify({ error: `Flight prices not available for ${origin} to ${destination} on ${date}` });
    },
    get_currency_conversion_rate: (args) => {
        const rates = {
            "USD": { "INR": 94.20, "EUR": 0.85, "GBP": 0.74 },
            "EUR": { "USD": 1.18, "INR": 109.50, "GBP": 0.87 },
        };
        const { from_currency, to_currency } = args;
        if (rates[from_currency] && rates[from_currency][to_currency]) {
            return JSON.stringify({ conversion_rate: rates[from_currency][to_currency] });
        }
        return JSON.stringify({ error: `Currency conversion rate not available for ${from_currency} to ${to_currency}` });
    }
};

async function callLLM(messages) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const contents = [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            contents.push({ role: 'user', parts: [{ text: `System Instructions: ${msg.content}` }] });
            contents.push({ role: 'model', parts: [{ text: "Understood." }] });
        } else {
            const role = (msg.role === 'tool' || msg.role === 'user') ? 'user' : 'model';
            const text = msg.role === 'tool' ? `Tool Result: ${msg.content}` : msg.content;
            
            // Avoid sequential messages of the same role
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += `\\n\\n${text}`;
            } else {
                contents.push({ role: role, parts: [{ text: text }] });
            }
        }
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "API Error");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

function parseLLMResponse(text) {
    let cleanText = text.trim();
    if (cleanText.startsWith("\`\`\`")) {
        const lines = cleanText.split("\\n");
        lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("\`\`\`")) {
            lines.pop();
        }
        cleanText = lines.join("\\n").trim();
        if (cleanText.startsWith("json")) {
            cleanText = cleanText.substring(4).trim();
        }
    }
    
    try {
        return JSON.parse(cleanText);
    } catch (e) {}

    const jsonMatch = cleanText.match(/\\{.*\\}/s);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {}
    }

    throw new Error("Could not parse JSON from LLM response");
}

async function runAgent(userQuery) {
    const maxIterations = 5;
    
    chat_history.push({ role: "user", content: userQuery });

    for (let i = 0; i < maxIterations; i++) {
        try {
            removeThinking();
            addMessageToUI(`⏳ Waiting 10s to respect API rate limits...`, 'system-msg');
            await new Promise(resolve => setTimeout(resolve, 10000));
            showThinking();

            const responseText = await callLLM(chat_history);
            console.log("LLM:", responseText);
            
            removeThinking();
            addMessageToUI(`🤖 LLM Output:\n${responseText}`, 'tool-msg');
            showThinking();

            let parsed;
            try {
                parsed = parseLLMResponse(responseText);
            } catch (e) {
                chat_history.push({ role: "assistant", content: responseText });
                chat_history.push({ role: "user", content: "Please respond with valid JSON only. No markdown, no extra text." });
                continue;
            }

            if (parsed.answer) {
                chat_history.push({ role: "assistant", content: JSON.stringify(parsed) });
                return parsed.answer;
            }

            if (parsed.tool_name) {
                const toolName = parsed.tool_name;
                const toolArgs = parsed.tool_arguments || {};
                
                addMessageToUI(`→ Tool Call: ${toolName}(${JSON.stringify(toolArgs)})`, 'tool-msg');

                if (!tools[toolName]) {
                    const errorMsg = JSON.stringify({ error: `Unknown tool: ${toolName}` });
                    chat_history.push({ role: "assistant", content: responseText });
                    chat_history.push({ role: "tool", content: errorMsg });
                    continue;
                }

                const toolResult = await tools[toolName](toolArgs);
                addMessageToUI(`→ Tool Result: ${toolResult}`, 'tool-msg');
                
                chat_history.push({ role: "assistant", content: responseText });
                chat_history.push({ role: "tool", content: toolResult });
            }
        } catch (error) {
            console.error("Agent Loop Error:", error);
            return `Error: ${error.message}`;
        }
    }

    return "Max iterations reached. Task incomplete.";
}

const views = {
    settings: document.getElementById('settings-view'),
    chat: document.getElementById('chat-view')
};
const els = {
    apiKeyInput: document.getElementById('api-key-input'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    settingsError: document.getElementById('settings-error'),
    settingsBtn: document.getElementById('settings-btn'),
    chatHistory: document.getElementById('chat-history'),
    queryInput: document.getElementById('query-input'),
    sendBtn: document.getElementById('send-btn')
};

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

function addMessageToUI(text, className) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;
    msgDiv.textContent = text;
    els.chatHistory.appendChild(msgDiv);
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
    return msgDiv;
}

function showThinking() {
    const indicator = document.createElement('div');
    indicator.className = 'message bot-msg thinking-indicator';
    indicator.id = 'thinking';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    els.chatHistory.appendChild(indicator);
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
}

function removeThinking() {
    const indicator = document.getElementById('thinking');
    if (indicator) indicator.remove();
}

async function handleSend() {
    const query = els.queryInput.value.trim();
    if (!query) return;

    els.queryInput.value = '';
    els.sendBtn.disabled = true;
    els.queryInput.disabled = true;

    addMessageToUI(query, 'user-msg');
    showThinking();

    const answer = await runAgent(query);
    
    removeThinking();
    addMessageToUI(answer, 'bot-msg');

    els.sendBtn.disabled = false;
    els.queryInput.disabled = false;
    els.queryInput.focus();
}

els.sendBtn.addEventListener('click', handleSend);
els.queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});

els.settingsBtn.addEventListener('click', () => {
    els.apiKeyInput.value = GEMINI_API_KEY;
    showView('settings');
});

els.saveKeyBtn.addEventListener('click', () => {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
        els.settingsError.textContent = "API Key cannot be empty.";
        els.settingsError.classList.remove('hidden');
        return;
    }
    
    chrome.storage.local.set({ GEMINI_API_KEY: key }, () => {
        GEMINI_API_KEY = key;
        els.settingsError.classList.add('hidden');
        showView('chat');
    });
});

chrome.storage.local.get(['GEMINI_API_KEY'], (result) => {
    if (result.GEMINI_API_KEY) {
        GEMINI_API_KEY = result.GEMINI_API_KEY;
        showView('chat');
    } else {
        showView('settings');
    }
});
