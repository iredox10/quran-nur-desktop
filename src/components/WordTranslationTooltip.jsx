import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function WordTranslationTooltip() {
    const { wordTooltipBehavior, translationFontSize } = useAppStore();
    const [tooltip, setTooltip] = useState(null); // { x, y, translation }
    const tooltipRef = useRef(null);

    const handleWordInteraction = useCallback((e) => {
        if (wordTooltipBehavior !== 'translation') {
            if (tooltip) setTooltip(null);
            return;
        }

        const wordEl = e.target.closest('[data-word-translation]');
        if (!wordEl) {
            setTooltip(null);
            return;
        }

        const translation = wordEl.getAttribute('data-word-translation');
        if (!translation || translation === 'null' || translation === 'undefined') {
            setTooltip(null);
            return;
        }

        const rect = wordEl.getBoundingClientRect();

        setTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top,
            translation
        });
    }, [wordTooltipBehavior, tooltip]);

    const handleDismiss = useCallback((e) => {
        if (tooltipRef.current && !tooltipRef.current.contains(e.target) && !e.target.closest('[data-word-translation]')) {
            setTooltip(null);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseover', handleWordInteraction);
        document.addEventListener('click', handleWordInteraction);
        document.addEventListener('scroll', () => setTooltip(null), true);
        window.addEventListener('resize', () => setTooltip(null));

        return () => {
            document.removeEventListener('mouseover', handleWordInteraction);
            document.removeEventListener('click', handleWordInteraction);
            document.removeEventListener('scroll', () => setTooltip(null), true);
            window.removeEventListener('resize', () => setTooltip(null));
        };
    }, [handleWordInteraction]);

    useEffect(() => {
        if (tooltip) {
            document.addEventListener('click', handleDismiss);
            return () => document.removeEventListener('click', handleDismiss);
        }
    }, [tooltip, handleDismiss]);

    if (!tooltip) return null;

    const tooltipWidth = Math.max(120, Math.min(280, tooltip.translation.length * 8 + 40));
    let left = tooltip.x - tooltipWidth / 2;
    if (left < 12) left = 12;
    if (left + tooltipWidth > window.innerWidth - 12) left = window.innerWidth - tooltipWidth - 12;

    return (
        <div
            ref={tooltipRef}
            className="fixed z-[9999] pointer-events-auto"
            style={{
                top: `${tooltip.y - 8}px`,
                left: `${left}px`,
                width: `${tooltipWidth}px`,
                transform: 'translateY(-100%)',
                animation: 'tajweedFadeIn 0.15s ease-out'
            }}
        >
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                <p className="m-0 font-['Outfit',sans-serif] font-medium leading-[1.4] text-[var(--text-primary)]"
                   style={{ fontSize: `${(translationFontSize || 2) * 0.1 + 0.75}rem` }}>
                    {tooltip.translation}
                </p>
            </div>
            <div
                className="relative mx-auto"
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '8px solid var(--bg-secondary)',
                    top: '-1px'
                }}
            />
        </div>
    );
}
