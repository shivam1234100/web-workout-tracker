// Minimal Google Gemini client (free tier: https://aistudio.google.com/apikey).
// Uses the REST API directly so there is no SDK to keep up to date.

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

// Google retires model names over time. If the configured model 404s, the next one is tried,
// so a single retirement doesn't take the coach down.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

// Newer Gemini models spend part of the output budget on internal reasoning before writing
// the answer, so a tight limit cuts replies off mid-sentence. This is headroom, not a target.
const MAX_OUTPUT_TOKENS = 4096;

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

const candidateModels = () => {
    const configured = process.env.GEMINI_MODEL;
    return configured ? [configured, ...FALLBACK_MODELS.filter(m => m !== configured)] : FALLBACK_MODELS;
};

// Gemini expects alternating user/model turns starting with the user
function toGeminiContents(turns: ChatTurn[]) {
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const turn of turns) {
        const role = turn.role === 'assistant' ? 'model' : 'user';
        const last = contents[contents.length - 1];
        if (last && last.role === role) last.parts[0].text += `\n\n${turn.content}`;
        else contents.push({ role, parts: [{ text: turn.content }] });
    }
    while (contents.length > 0 && contents[0].role !== 'user') contents.shift();
    return contents;
}

async function openStream(model: string, body: string, signal?: AbortSignal) {
    return fetch(`${BASE_URL}/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
        body,
        signal,
    });
}

/** Streams the reply text in chunks. Throws if no model could be reached. */
export async function* streamChat(system: string, turns: ChatTurn[], signal?: AbortSignal): AsyncGenerator<string> {
    if (!aiEnabled()) throw new Error('GEMINI_API_KEY is not configured');

    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: toGeminiContents(turns),
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
    });

    let res: Response | null = null;
    for (const model of candidateModels()) {
        res = await openStream(model, body, signal);
        if (res.ok) break;
        const detail = (await res.text()).slice(0, 300);
        // Only a missing model is worth retrying; a bad key or exhausted quota fails the same way for every model
        if (res.status !== 404) throw new Error(`Gemini ${res.status}: ${detail}`);
        console.warn(`Gemini model ${model} unavailable, trying the next one`);
        res = null;
    }
    if (!res || !res.body) throw new Error('No Gemini model is available');

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith('data:')) continue;

            const event = JSON.parse(line.slice(5));
            if (event.promptFeedback?.blockReason) throw new Error(`Gemini blocked the request: ${event.promptFeedback.blockReason}`);
            const candidate = event.candidates?.[0];
            // Skip internal "thought" parts; join every visible text part (a reply can span several)
            const text = (candidate?.content?.parts || [])
                .filter((p: any) => !p.thought && typeof p.text === 'string')
                .map((p: any) => p.text)
                .join('');
            if (text) yield text;
            if (candidate?.finishReason === 'MAX_TOKENS') console.warn('Gemini reply hit the output token limit');
        }
    }
}

/** Convenience wrapper that returns the whole reply at once. */
export async function generateText(system: string, turns: ChatTurn[]): Promise<string> {
    let text = '';
    for await (const chunk of streamChat(system, turns)) text += chunk;
    if (!text.trim()) throw new Error('Gemini returned an empty reply');
    return text;
}
