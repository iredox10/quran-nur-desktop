import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Play, Pause, Minus, Plus, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function AutoScroller() {
    const {
        autoScroll, setAutoScroll,
        autoScrollSpeed, setAutoScrollSpeed,
        isAutoScrollPaused, setIsAutoScrollPaused
    } = useAppStore();

    const scrollRafRef = useRef(null);
    const lastScrollTimestampRef = useRef(null);
    const scrollRemainderRef = useRef(0);

    useEffect(() => {
        if (!autoScroll) {
            if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
            lastScrollTimestampRef.current = null;
            scrollRemainderRef.current = 0;
            return;
        }

        const speedMap = { 1: 5, 2: 10, 3: 18, 4: 36, 5: 60, 6: 108, 7: 180 };
        const pxPerSecond = speedMap[autoScrollSpeed] || 60;

        const tick = (timestamp) => {
            if (lastScrollTimestampRef.current == null) {
                lastScrollTimestampRef.current = timestamp;
            }

            const deltaMs = timestamp - lastScrollTimestampRef.current;
            lastScrollTimestampRef.current = timestamp;

            if (!isAutoScrollPaused) {
                const nextDistance = scrollRemainderRef.current + (pxPerSecond * deltaMs) / 1000;
                const wholePixels = Math.trunc(nextDistance);
                scrollRemainderRef.current = nextDistance - wholePixels;

                if (wholePixels !== 0) {
                    window.scrollBy(0, wholePixels);
                }
            }
            if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 10) {
                setAutoScroll(false);
                return;
            }
            scrollRafRef.current = requestAnimationFrame(tick);
        };

        scrollRafRef.current = requestAnimationFrame(tick);

        return () => {
            if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
            lastScrollTimestampRef.current = null;
            scrollRemainderRef.current = 0;
        };
    }, [autoScroll, autoScrollSpeed, setAutoScroll, isAutoScrollPaused]);

    useEffect(() => {
        return () => setAutoScroll(false);
    }, [setAutoScroll]);

    return (
        <AnimatePresence>
            {autoScroll && (
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ duration: 0.25 }}
                    className="fixed left-0 right-0 mx-auto w-fit z-[100]"
                    style={{
                        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
                    }}
                >
                    <div className="flex items-center gap-3 px-4 py-[0.6rem] rounded-full bg-[var(--glass-bg)] backdrop-blur-[16px] border-[var(--glass-border)] shadow-[var(--shadow-xl)]">
                        <div className="flex gap-1">
                            <button
                                className="btn-icon w-7 h-7 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                onClick={() => window.scrollBy({ top: -200, behavior: 'smooth' })}
                            >
                                <ArrowLeft size={14} className="rotate-90" />
                            </button>
                            <button
                                className="btn-icon w-7 h-7 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                                onClick={() => window.scrollBy({ top: 200, behavior: 'smooth' })}
                            >
                                <ArrowRight size={14} className="rotate-90" />
                            </button>
                        </div>

                        <div className="w-px h-6 bg-[var(--border-color)]" />

                        <button
                            className="btn-icon w-7 h-7 border border-[var(--border-color)] rounded-full"
                            onClick={() => setAutoScrollSpeed(Math.max(1, autoScrollSpeed - 1))}
                        >
                            <Minus size={14} />
                        </button>
                        <span className="font-mono text-[0.8rem] font-bold text-[var(--text-primary)] min-w-[40px] text-center">
                            {autoScrollSpeed}x
                        </span>
                        <button
                            className="btn-icon w-7 h-7 border border-[var(--border-color)] rounded-full"
                            onClick={() => setAutoScrollSpeed(Math.min(7, autoScrollSpeed + 1))}
                        >
                            <Plus size={14} />
                        </button>

                        <button
                            className="btn-icon w-8 h-8 text-accent"
                            style={{
                                background: isAutoScrollPaused ? 'var(--accent-light)' : 'transparent',
                            }}
                            onClick={() => setIsAutoScrollPaused(!isAutoScrollPaused)}
                        >
                            {isAutoScrollPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                        </button>

                        <div className="w-px h-6 bg-[var(--border-color)]" />

                        <button
                            className="btn-icon w-8 h-8 bg-[rgba(239,68,68,0.1)] text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            onClick={() => setAutoScroll(false)}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
