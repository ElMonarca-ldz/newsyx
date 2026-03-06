// /src/config/variants.ts — Configuration for product variants (C4)

export type ProductVariant = 'full' | 'analyzer' | 'executive';

export interface VariantConfig {
    name: string;
    features: {
        situationMonitor: boolean;
        advancedAnalysis: boolean;
        financialSignals: boolean;
        itlScore: boolean;
        storySharing: boolean;
        sourceManagement: boolean;
    };
    theme: {
        primaryColor: string;
        accentColor: string;
    };
}

export const VARIANTS: Record<ProductVariant, VariantConfig> = {
    full: {
        name: 'Newsyx OSINT Full',
        features: {
            situationMonitor: true,
            advancedAnalysis: true,
            financialSignals: true,
            itlScore: true,
            storySharing: true,
            sourceManagement: true,
        },
        theme: {
            primaryColor: 'emerald',
            accentColor: 'cyan',
        }
    },
    analyzer: {
        name: 'Newsyx Analysis Studio',
        features: {
            situationMonitor: false,
            advancedAnalysis: true,
            financialSignals: false,
            itlScore: false,
            storySharing: false,
            sourceManagement: true,
        },
        theme: {
            primaryColor: 'indigo',
            accentColor: 'violet',
        }
    },
    executive: {
        name: 'Newsyx Executive Brief',
        features: {
            situationMonitor: true,
            advancedAnalysis: false,
            financialSignals: true,
            itlScore: true,
            storySharing: true,
            sourceManagement: false,
        },
        theme: {
            primaryColor: 'amber',
            accentColor: 'orange',
        }
    }
};

// Current variant (can be controlled via ENV)
export const CURRENT_VARIANT: ProductVariant = (import.meta.env.VITE_APP_VARIANT as ProductVariant) || 'full';
export const config = VARIANTS[CURRENT_VARIANT];
