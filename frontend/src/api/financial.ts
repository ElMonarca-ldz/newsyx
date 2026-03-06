const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function fetchLatestFinancialSignals() {
    const response = await fetch(`${API_URL}/financial-signals/latest`);
    if (!response.ok) {
        throw new Error('Failed to fetch financial signals');
    }
    return response.json();
}
