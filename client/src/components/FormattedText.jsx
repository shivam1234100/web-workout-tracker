// Renders the light markdown that AI responses use (**bold** and # headings) without a
// markdown library. Newlines are preserved by the parent's `white-space: pre-wrap`.
export default function FormattedText({ text }) {
    if (!text) return null;
    return text.split('\n').map((line, i, lines) => {
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const content = heading ? heading[1] : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') && part.length > 4
                ? <strong key={j} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>
                : part
        );
        return (
            <span key={i}>
                {heading ? <strong style={{ color: 'var(--text-primary)' }}>{parts}</strong> : parts}
                {i < lines.length - 1 && '\n'}
            </span>
        );
    });
}
