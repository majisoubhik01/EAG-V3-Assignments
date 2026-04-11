const isQuestion = (text) => {
    if (!text || typeof text !== 'string') return false;
    const cleanText = text.trim();
    
    // Explicit question mark
    if (cleanText.endsWith('?')) return true;

    // Remove punctuation at the end that might interfere
    const normalized = cleanText.replace(/[.!?]+$/, '').trim().toLowerCase();
    
    // Strong indicator: 5W1H words at the beginning
    const questionWords = /^(who|what|where|when|why|how)\b/i;
    if (questionWords.test(normalized)) return true;

    // Modal verb + pronoun usually indicates a question
    // e.g., "can we", "do you", "is there", "should I"
    const modalPlusPronoun = /^(is|are|am|do|does|did|can|could|would|should|will|shall|may|might|have|has|had)\s+(i|you|he|she|it|we|they|there|this|that|these|those|anyone|anybody|someone)\b/i;
    if (modalPlusPronoun.test(normalized)) return true;

    // Tag questions or indirect asks
    // e.g., "we are still meeting later right", "anyone know if..."
    const tagQuestions = /\b(right|correct|true)\b$/i;
    const anyoneKnows = /\b(anyone|anybody)\b.*\b(know|have|see|can)\b/i;
    if (tagQuestions.test(normalized) || anyoneKnows.test(normalized)) return true;

    return false;
};

console.log("Testing 'hello?':", isQuestion("hello?"));
console.log("Testing 'what time is it':", isQuestion("what time is it"));
console.log("Testing 'can you do this':", isQuestion("can you do this"));
console.log("Testing 'just a statement':", isQuestion("just a statement"));
