import axios from 'axios';
import type { SituationMonitorData, SituationFilters } from '@/types/situation-monitor';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function fetchSituationMonitor(
    filters: SituationFilters
): Promise<SituationMonitorData> {
    const params: Record<string, string> = {};

    if (filters.fechaDesde) params.desde = filters.fechaDesde;
    if (filters.fechaHasta) params.hasta = filters.fechaHasta;
    if (filters.scoreDesinMax < 1.0) params.scoreDesinMax = String(filters.scoreDesinMax);

    const { data } = await axios.get<SituationMonitorData>(
        `${API_URL}/situation-monitor`,
        { params }
    );
    return data;
}
