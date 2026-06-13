import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, groups, placeholder = 'Select...' }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find selected item label
    let selectedLabel = placeholder;
    if (options) {
        const found = options.find(o => o.value === value);
        if (found) selectedLabel = found.label;
    } else if (groups) {
        for (const g of groups) {
            const found = g.items.find(i => i.value === value);
            if (found) {
                selectedLabel = found.label;
                break;
            }
        }
    }

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    const renderOption = (item) => (
        <button
            key={item.value}
            type="button"
            onClick={() => handleSelect(item.value)}
            className={`w-full flex items-center justify-between px-4 py-[14px] text-left transition-all duration-200 border-none cursor-pointer rounded-xl my-1 mx-2 ${
                value === item.value 
                ? 'bg-[var(--accent-light)] text-accent font-semibold' 
                : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-primary)] hover:translate-x-1'
            }`}
            style={{ width: 'calc(100% - 16px)' }} // accommodate mx-2
        >
            <span className="truncate">{item.label}</span>
            <div className="flex items-center gap-2">
                {item.renderRight && item.renderRight()}
                {value === item.value && <Check size={16} className="text-accent shrink-0" />}
            </div>
        </button>
    );

    return (
        <div className="relative w-full text-[0.95rem]" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[var(--text-primary)] outline-none transition-all duration-300 cursor-pointer shadow-sm ${
                    isOpen ? 'border-accent shadow-[0_0_0_2px_var(--accent-light)]' : 'hover:border-[var(--text-muted)] hover:shadow-md'
                }`}
            >
                <span className="truncate font-medium">{selectedLabel}</span>
                <ChevronDown size={18} className={`text-[var(--text-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} // smooth spring-like curve
                        className="absolute z-50 w-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[16px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] max-h-[320px] overflow-y-auto backdrop-blur-xl"
                    >
                        <div className="py-2">
                            {options && options.map(renderOption)}
                            
                            {groups && groups.map((group, idx) => (
                                <div key={group.label}>
                                    {idx > 0 && <div className="h-px bg-[var(--border-color)] mx-4 my-2 opacity-50" />}
                                    <div className="px-5 py-2 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                        {group.label}
                                    </div>
                                    {group.items.map(renderOption)}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
