document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('question-list');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');

    const renderEmptyState = () => {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <p>No questions captured yet.<br>Wait for questions or ensure the chat panel is open!</p>
            </div>
        `;
    };

    const loadQuestions = () => {
        chrome.storage.local.get({ questions: [] }, (result) => {
            const questions = result.questions || [];
            
            if (questions.length === 0) {
                renderEmptyState();
                return;
            }

            listContainer.innerHTML = '';
            questions.forEach((q, index) => {
                const date = new Date(q.timestamp);
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const card = document.createElement('div');
                card.className = `question-card ${q.answered ? 'answered' : ''}`;
                card.innerHTML = `
                    <div class="card-header">
                        <div class="sender-info">
                            <span class="sender-name">${escapeHTML(q.sender)}</span>
                            <span class="timestamp">${timeString}</span>
                        </div>
                        <label class="custom-checkbox" title="Mark as Answered">
                            <input type="checkbox" class="answered-cb" data-index="${index}" ${q.answered ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                    </div>
                    <p class="question-text">${escapeHTML(q.text)}</p>
                `;
                listContainer.appendChild(card);
            });

            // Bind checkbox events
            document.querySelectorAll('.answered-cb').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const idx = e.target.getAttribute('data-index');
                    chrome.storage.local.get({ questions: [] }, (res) => {
                        let updated = res.questions;
                        if (updated[idx]) {
                            updated[idx].answered = e.target.checked;
                            chrome.storage.local.set({ questions: updated });
                        }
                    });
                });
            });
        });
    };

    const escapeHTML = (str) => {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    };

    copyBtn.addEventListener('click', () => {
        chrome.storage.local.get({ questions: [] }, (result) => {
            const questions = result.questions || [];
            if (questions.length === 0) return;
            
            const textToCopy = questions.map(q => {
                const prefix = q.answered ? '[Answered] ' : '';
                return `${prefix}[${q.sender}] - ${q.text}`;
            }).join('\n\n');
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            });
        });
    });

    clearBtn.addEventListener('click', () => {
        chrome.storage.local.set({ questions: [] }, () => {
            loadQuestions();
        });
    });

    // Initial load
    loadQuestions();
    
    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.questions) {
            loadQuestions();
        }
    });
});
