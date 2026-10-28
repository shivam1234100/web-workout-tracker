// Renders the light Markdown that AI replies use (headings, **bold**, _italic_, `code`, bullet
// lists, --- dividers) without a Markdown library. Newlines are preserved by the parent's
// `white-space: pre-wrap`.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*])|(?<!\w)_[^_\n]+_(?!\w))/g;
const strong = { color: 'var(--text-primary)', fontWeight: 700 };

function renderInline(text) {
    return text.split(INLINE).map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i} style={strong}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
        if (/^([*_]).+\1$/.test(part) && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
    });
}

export default function FormattedText({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
        const newline = i < lines.length - 1 ? '\n' : null;
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return <span key={i} className="md-divider" />;

        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) return <span key={i}><strong style={strong}>{renderInline(heading[1].replace(/\*\*/g, ''))}</strong>{newline}</span>;

        const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (bullet) return <span key={i}>{bullet[1]}{'• '}{renderInline(bullet[2])}{newline}</span>;

        return <span key={i}>{renderInline(line)}{newline}</span>;
    });
}
