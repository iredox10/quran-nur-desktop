import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Brain, CalendarDays, TrendingUp, User } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();

    const isSurahPage = /^\/surah\/\d+/.test(location.pathname);
    const isMemorizePage = /^\/memorize\/\d+/.test(location.pathname);
    const isPagePage = /^\/page\/\d+/.test(location.pathname);

    const isActive = (path) => {
        if (path === '/' && location.pathname !== '/') return false;
        return location.pathname.startsWith(path);
    };

    if (isSurahPage || isMemorizePage || isPagePage) return null;

    const tabs = [
        { path: '/', icon: BookOpen, label: 'Quran' },
        { path: '/memorize', icon: Brain, label: 'Memorize' },
        { path: '/planner', icon: CalendarDays, label: 'Planner' },
        { path: '/progress', icon: TrendingUp, label: 'Analytics' },
        { path: '/profile', icon: User, label: 'Profile' }
    ];

    return (
        <div className="fixed bottom-3 left-1/2 z-[1000] flex h-16 w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 items-center justify-between gap-1 rounded-[100px] border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 shadow-[var(--glass-shadow)] backdrop-blur-xl">
            {tabs.map((tab) => {
                const active = isActive(tab.path);
                const Icon = tab.icon;

                if (active) {
                    return (
                        <div
                            key={tab.path}
                            className="flex flex-1 cursor-pointer justify-center"
                            style={{ flex: '1.5' }}
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        >
                            <div className="flex items-center gap-2 rounded-[999px] bg-[var(--accent-light)] px-4 py-[10px] text-accent">
                                <Icon size={22} color="currentColor" />
                                <span className="font-[var(--font-mono)] text-[0.72rem] font-bold">{tab.label}</span>
                            </div>
                        </div>
                    );
                }

                return (
                    <Link key={tab.path} to={tab.path} className="flex flex-1 flex-col items-center justify-center gap-[6px] text-[var(--text-muted)] no-underline transition-colors duration-200 hover:text-accent">
                        <Icon size={22} />
                        <span className="font-[var(--font-mono)] text-[0.6rem] font-semibold opacity-90">{tab.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
