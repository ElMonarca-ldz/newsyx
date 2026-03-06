import { useSituationMonitorStore } from '@/stores/situationMonitorStore';

export function LiveIndicator() {
    const isLiveConnected = useSituationMonitorStore((s) => s.isLiveConnected);

    return (
        <div className="flex items-center gap-1.5 ml-1">
            <div className={`w-2 h-2 rounded-full ${isLiveConnected
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                : 'bg-zinc-600'
                }`}
            />
            <span className={`text-xs font-medium ${isLiveConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isLiveConnected ? 'LIVE' : 'OFFLINE'}
            </span>
        </div>
    );
}
