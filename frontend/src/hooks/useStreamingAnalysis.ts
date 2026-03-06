import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useStreamingAnalysis = (id: string, url: string, isEnabled: boolean) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [progress, setProgress] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isEnabled || !id || !url) return;

        setIsStreaming(true);
        setProgress(['Iniciando análisis...']);

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const eventSource = new EventSource(`${API_URL}/stream/${id}/stream?url=${encodeURIComponent(url)}`);

        eventSource.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);

                if (update.done) {
                    setIsStreaming(false);
                    eventSource.close();
                    // Refetch the full analysis from the cache once done
                    queryClient.invalidateQueries({ queryKey: ['analysis', id] });
                    return;
                }

                if (update.error) {
                    setError(update.error);
                    setIsStreaming(false);
                    eventSource.close();
                    return;
                }

                // Update progress list
                setProgress((prev) => [...prev, `Completado: ${update.step}`]);

                // Update the cache immediately with partial data if needed
                // For now we just invalidate at the end, but we could merge state here
            } catch (err) {
                console.error('Error parsing SSE event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('EventSource failed:', err);
            setError('Error en la conexión con el servidor de análisis');
            setIsStreaming(false);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [id, url, isEnabled, queryClient]);

    return { isStreaming, progress, error };
};
