const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

export interface TwitterProfile {
    id: string;
    username: string;
    xUserId: string | null;
    displayName: string | null;
    bio: string | null;
    followersCount: number | null;
    verifiedType: string | null;
    profileImageUrl: string | null;
    tier: string;
    category: string;
    country: string;
    politicalLean: string | null;
    isStateAffiliated: boolean;
    scrapeEnabled: boolean;
    scrapeInterval: number;
    scrapeRTs: boolean;
    scrapeReplies: boolean;
    minTweetLength: number;
    actorNetworkSlug: string | null;
    lastScrapedAt: string | null;
    lastTweetId: string | null;
    consecutiveFails: number;
    isActive: boolean;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    // Enriched fields from API
    tweetCount?: number;
    pendingAnalysis?: number;
}

export interface TwitterStats {
    totalProfiles: number;
    activeProfiles: number;
    totalTweets: number;
    pendingAnalysis: number;
    completedAnalysis: number;
    tweetsLast24h: number;
    byTier: Record<string, number>;
}

export interface PoolHealth {
    total: number;
    active: number;
    circuit_open: number;
    health_pct: number;
    degraded: boolean;
    accounts: Array<{
        username: string;
        active: boolean;
        logged_in: boolean;
        total_req: number;
        error: string | null;
        circuit_open: boolean;
    }>;
}

export interface ScraperAccount {
    id: string;
    username: string;
    isActive: boolean;
    isLoggedIn: boolean;
    lastUsedAt: string | null;
    totalRequests: number;
    consecutiveFails: number;
    errorMsg: string | null;
    circuitOpen: boolean;
    circuitOpenAt: string | null;
    circuitRetryAt: string | null;
    tier: string;
    proxyUrl: string | null;
    email: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function getTwitterProfiles(): Promise<TwitterProfile[]> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles`);
    if (!res.ok) throw new Error('Failed to fetch profiles');
    return res.json();
}

export async function createTwitterProfile(data: Partial<TwitterProfile>): Promise<TwitterProfile> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create profile');
    }
    return res.json();
}

export async function updateTwitterProfile(id: string, data: Partial<TwitterProfile>): Promise<TwitterProfile> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
}

export async function toggleTwitterProfile(id: string, data: { scrapeEnabled?: boolean; isActive?: boolean }): Promise<TwitterProfile> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to toggle profile');
    return res.json();
}

export async function deleteTwitterProfile(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete profile');
}

export async function scrapeNow(id: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/twitter/profiles/${id}/scrape-now`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to trigger scrape');
    return res.json();
}

export async function getTwitterStats(): Promise<TwitterStats> {
    const res = await fetch(`${API_BASE_URL}/twitter/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
}

export async function getPoolHealth(): Promise<PoolHealth> {
    const res = await fetch(`${API_BASE_URL}/twitter/pool-health`);
    if (!res.ok) throw new Error('Failed to fetch pool health');
    return res.json();
}

// ─── Scraper Accounts API ──────────────────────────────────────────────────

export async function getScraperAccounts(): Promise<ScraperAccount[]> {
    const res = await fetch(`${API_BASE_URL}/twitter/accounts`);
    if (!res.ok) throw new Error('Failed to fetch scraper accounts');
    return res.json();
}

export async function createScraperAccount(data: any): Promise<ScraperAccount> {
    const res = await fetch(`${API_BASE_URL}/twitter/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create account');
    }
    return res.json();
}

export async function updateScraperAccount(id: string, data: any): Promise<ScraperAccount> {
    const res = await fetch(`${API_BASE_URL}/twitter/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update account');
    return res.json();
}

export async function deleteScraperAccount(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/twitter/accounts/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete account');
}
