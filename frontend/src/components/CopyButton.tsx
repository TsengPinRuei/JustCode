import { useCallback, useEffect, useRef, useState } from 'react';

const copyTextToClipboard = async (text: string) => {
    // Try the async clipboard API, then fall back if it is unavailable or rejects the write.
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Keep the fallback textarea off screen to avoid visible layout changes while copying.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    const previousFocus = document.activeElement;
    (previousFocus?.closest('dialog[open]') ?? document.body).appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const copied = document.execCommand('copy');
        if (!copied) throw new Error('Copy command failed');
    } finally {
        textarea.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    }
};

export function CopyButton({ getText }: { getText: () => string }) {
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(false);
    const requestRef = useRef(0);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        };
    }, []);

    const handleCopy = useCallback(async () => {
        const request = ++requestRef.current;
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        let state: 'copied' | 'failed' = 'copied';
        try {
            await copyTextToClipboard(getText());
        } catch {
            state = 'failed';
        }
        // Ignore an older copy request or a result received after unmounting.
        if (!mountedRef.current || request !== requestRef.current) return;
        setCopyState(state);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setCopyState('idle');
        }, 2000);
    }, [getText]);

    const label = copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy';

    return (
        <button
            type="button"
            className={`code-copy-btn ${copyState}`}
            onClick={handleCopy}
            title={copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
            aria-label={copyState === 'copied' ? 'Copied code' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
        >
            {copyState === 'copied' && (
                <span className="code-copy-icon" aria-hidden="true">✓</span>
            )}
            <span>{label}</span>
        </button>
    );
}
