console.log("Google Meet Q&A Extractor activated.");

let observer = null;

const saveQuestion = (sender, text) => {
    const timestamp = Date.now();
    chrome.storage.local.get({ questions: [] }, (result) => {
        let questions = result.questions;
        
        // Find if this exact text has already been caught (reduces repetition)
        let existingIndex = questions.findIndex(q => q.text.toLowerCase() === text.toLowerCase());
        
        if (existingIndex !== -1) {
            // Update sender if previously Unknown/You and new sender is valid
            const oldSender = questions[existingIndex].sender;
            if ((oldSender === "Unknown" || oldSender === "You" || oldSender === "Participant") && sender !== "Unknown" && sender !== "You" && sender !== "Participant") {
                questions[existingIndex].sender = sender;
                chrome.storage.local.set({ questions });
                console.log("Updated question sender:", { sender, text });
            }
            return; // Skip adding a new card, since the body is a duplicate
        }

        questions.push({ sender, text, timestamp, answered: false });
        chrome.storage.local.set({ questions });
        console.log("Saved question:", { sender, text });
    });
};

const isQuestion = (text) => {
    if (!text || typeof text !== 'string') return false;
    
    // Explicit question mark check anywhere in the text is an instant pass
    if (text.includes('?')) return true;
    
    // Split text into individual sentences to catch questions buried in other statements
    // Delimiters: newline, period, exclamation mark
    const sentences = text.split(/[.\n!]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    for (let sentence of sentences) {
        let normalized = sentence.toLowerCase();
        
        // Strip common conversational filler at the beginning of the sentence
        // e.g. "hey guys, how are you?" -> "how are you?"
        normalized = normalized.replace(/^(hey( there)?|hi|hello|so|well|anyway|listen|btw|dude|guys|ok|okay|alright|yes|no|yeah|yep|nope|ah|oh)\b\s*,?\s*/g, '');
        
        // Pattern 1: 5W1H words at the beginning
        const questionWords = /^(who|what|where|when|why|how)\b/i;
        if (questionWords.test(normalized)) return true;

        // Pattern 2: Modal verb + pronoun usually indicates a question
        const modalPlusPronoun = /^(is|are|am|do|does|did|can|could|would|should|will|shall|may|might|have|has|had)\s+(i|you|he|she|it|we|they|there|this|that|these|those|anyone|anybody|someone|somebody)\b/i;
        if (modalPlusPronoun.test(normalized)) return true;

        // Pattern 3: Unmistakable conversational question clusters anywhere in the text
        const strongQuestionClusters = /\b((who|what|where|when|why|how)\s+(is|are|am|was|were|do|does|did|can|could|would|should|will|shall|may|might)|what about|how about|are you|do you|can you|could you|would you|should we|can we|do we|is there|are there|would it|will it|could it|should it|wondering if|i wonder|let see if|let's see if|let me know)\b/i;
        if (strongQuestionClusters.test(normalized)) return true;

        // Pattern 4: Tag questions or indirect asks anywhere in the text
        const tagQuestions = /\b(right|correct|true)\b$/i;
        const anyoneKnows = /\b(anyone|anybody|someone|somebody)\b.*\b(know|have|see|can)\b/i;
        if (tagQuestions.test(normalized) || anyoneKnows.test(normalized)) return true;
    }

    return false;
};

const startObservingChat = (chatLogContainer) => {
    if (observer) {
        observer.disconnect();
    }
    
    let lastKnownSender = "You";
    
    const extractSender = (node, messageBody) => {
        // Strategy 1: Hidden attributes (Meet sometimes uses data-sender-name)
        let current = node;
        while (current && current !== document.body) {
            if (current.dataset && current.dataset.senderName) return current.dataset.senderName.trim();
            
            // Meet sometimes uses aria-label on the message container like "Message from User Name" or "Your message"
            if (current.hasAttribute('aria-label')) {
                const aria = current.getAttribute('aria-label');
                if (aria.toLowerCase().includes('your message')) return "You";
                if (aria.toLowerCase().includes('message from')) {
                    return aria.replace(/message from /i, '').trim();
                }
            }
            current = current.parentElement;
        }

        // Strategy 2: Look for the Avatar image's Alt text
        current = node;
        while (current && current.parentElement) {
            const role = current.getAttribute('role');
            if (role === 'log' || role === 'main') break;
            
            const img = current.querySelector ? current.querySelector('img') : null;
            if (img && img.alt) {
                const altText = img.alt.toLowerCase();
                 // Exclude UI images
                if (!altText.includes('logo') && !altText.includes('presentation') && !altText.includes('pin')) {
                    // Avatar alt text is usually the person's name 
                    let nameMatch = img.alt.replace(/(profile picture|avatar|'s)/ig, '').trim();
                    if (nameMatch) return nameMatch;
                }
            }
            current = current.parentElement;
        }

        // Strategy 3: Fully recursive text search of structural sibling blocks
        current = node;
        while (current && current.parentElement) {
            let parent = current.parentElement;
            const role = parent.getAttribute('role');
            const ariaLive = parent.getAttribute('aria-live');
            
            if (role === 'log' || ariaLive === 'polite' || parent.dataset.qnaObserved === "true") {
                break;
            }
            current = parent;
        }
        
        const text = current.innerText || "";
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length > 0) {
            let potentialName = lines[0]; 
            
            const inlineTimeMatch = potentialName.match(/^(.*?)\s+\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i);
            if (inlineTimeMatch) return inlineTimeMatch[1].trim();

            const inlineTimeMatch2 = potentialName.match(/^(.*?)\s+\d{1,2}:\d{2}$/i);
            if (inlineTimeMatch2) return inlineTimeMatch2[1].trim();

            const isTimeOnly = /^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i.test(potentialName);

            // A name usually doesn't have typical sentence punctuation and isn't too long
            const isSentenceNotName = /[,.?]/.test(potentialName) || potentialName.length > 30;

            if (isTimeOnly || potentialName === messageBody || isSentenceNotName) {
                // If the block header is just a time, or the message itself, or abnormally long,
                // it implies there is NO sender name explicitly rendered for this block.
                // In Google Meet, the local user's messages are grouped in blocks that intentionally omit the name.
                // Other participants always have explicitly named blocks.
                return "You";
            }

            return potentialName;
        }
        
        return "You";
    };
    
    observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    setTimeout(() => {
                        const text = node.innerText || node.textContent;
                        if (isQuestion(text)) {
                            // Extract actual message body cleanly
                            let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                            
                            // 1. Pop Google Meet action buttons that get dynamically appended to text nodes
                            const uiArtifacts = ["pin message", "unpin message", "reply", "delete", "report abuse"];
                            while (lines.length > 0 && uiArtifacts.includes(lines[lines.length - 1].toLowerCase())) {
                                lines.pop(); // Remove the trailing UI text
                            }
                            
                            // 2. Locate the header barrier. Usually Time or Name \n Time
                            let startIdx = 0;
                            if (lines.length > 0 && /^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i.test(lines[0])) {
                                startIdx = 1; // It's just a time block
                            } else if (lines.length > 1 && /^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i.test(lines[1])) {
                                startIdx = 2; // It's Name \n Time
                            }

                            // 3. The true message is everything after the header
                            const messageBody = lines.slice(startIdx).join('\n') || text.trim();
                            
                            // To prevent crashing the regex heuristics on fully empty artifacts
                            if (!messageBody) return;
                            
                            let sender = extractSender(node, messageBody);
                            if (sender) {
                                lastKnownSender = sender;
                            } else {
                                sender = lastKnownSender;
                            }
                            
                            saveQuestion(sender, messageBody);
                        }
                    }, 500); // 500ms delay to allow full text rendering
                }
            }
        }
    });

    observer.observe(chatLogContainer, { childList: true, subtree: true });
    console.log("Joined and monitoring chat panel.");
};

setInterval(() => {
    // Relying on accessible attributes since classes change
    const chatContainers = document.querySelectorAll('[aria-live="polite"], [role="log"]');
    
    for (let container of chatContainers) {
        if (!container.dataset.qnaObserved) {
            container.dataset.qnaObserved = "true";
            startObservingChat(container);
        }
    }
}, 3000);
