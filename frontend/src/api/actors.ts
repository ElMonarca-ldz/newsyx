import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function fetchActorTimeline(slug: string): Promise<any[]> {
    const { data } = await axios.get(`${API_URL}/actors/${slug}/timeline`);
    return data;
}
