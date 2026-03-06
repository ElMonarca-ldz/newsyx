import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSituationMonitorStore } from '@/stores/situationMonitorStore';
import type { LiveAlert } from '@/types/situation-monitor';

const getWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:4000/ws/alerts`;
};

const WS_URL = getWsUrl();
const RECONNECT_DELAY = 5000;

export function useLiveAlerts() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
    const queryClient = useQueryClient();
    const { addLiveAlert, setLiveConnected } = useSituationMonitorStore();

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                if (wsRef.current === ws) {
                    setLiveConnected(true);
                    console.log('[Newsyx WS] Connected to live alerts');
                }
            };

            ws.onmessage = (event) => {
                if (wsRef.current !== ws) return;
                try {
                    const alert: LiveAlert = JSON.parse(event.data);
                    addLiveAlert(alert);

                    // Invalidate situation monitor query to refetch
                    if (alert.tipo === 'nuevo_evento' || alert.tipo === 'nuevo_cluster') {
                        queryClient.invalidateQueries({ queryKey: ['situation-monitor'] });
                    }

                    // Breaking news toast (browser notification)
                    if (alert.tipo === 'breaking' && Notification.permission === 'granted') {
                        new Notification('🚨 Newsyx Breaking', { body: alert.titulo });
                    }
                } catch (e) {
                    console.error('[Newsyx WS] Parse error:', e);
                }
            };

            ws.onclose = (event) => {
                if (wsRef.current === ws) {
                    setLiveConnected(false);
                    console.log(`[Newsyx WS] Disconnected (Code: ${event.code}, Reason: ${event.reason || 'None'}), reconnecting in ${RECONNECT_DELAY}ms...`);
                    reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
                } else {
                    console.log('[Newsyx WS] Old connection closed, ignoring.');
                }
            };

            ws.onerror = (err) => {
                console.error('[Newsyx WS] Error:', err);
                ws.close();
            };
        } catch (e) {
            console.error('[Newsyx WS] Connection failed:', e);
            reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
    }, [addLiveAlert, setLiveConnected, queryClient]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, [connect]);
}
