export declare const BUSINESS_CATEGORIES: {
    readonly RESTAURANTS: "restaurants";
    readonly RETAIL: "retail";
    readonly SERVICES: "services";
    readonly HEALTH: "health";
    readonly ENTERTAINMENT: "entertainment";
    readonly AUTOMOTIVE: "automotive";
    readonly BEAUTY: "beauty";
    readonly FITNESS: "fitness";
    readonly EDUCATION: "education";
    readonly PROFESSIONAL: "professional";
    readonly HOME_GARDEN: "home_garden";
    readonly TRAVEL: "travel";
    readonly PETS: "pets";
    readonly TECHNOLOGY: "technology";
    readonly EVENTS: "events";
};
export type BusinessCategory = typeof BUSINESS_CATEGORIES[keyof typeof BUSINESS_CATEGORIES];
export declare const BUSINESS_CATEGORY_OPTIONS: ({
    value: "restaurants";
    label: string;
    subcategories: string[];
} | {
    value: "retail";
    label: string;
    subcategories: string[];
} | {
    value: "services";
    label: string;
    subcategories: string[];
} | {
    value: "health";
    label: string;
    subcategories: string[];
} | {
    value: "entertainment";
    label: string;
    subcategories: string[];
} | {
    value: "automotive";
    label: string;
    subcategories: string[];
} | {
    value: "beauty";
    label: string;
    subcategories: string[];
} | {
    value: "fitness";
    label: string;
    subcategories: string[];
} | {
    value: "education";
    label: string;
    subcategories: string[];
} | {
    value: "professional";
    label: string;
    subcategories: string[];
} | {
    value: "home_garden";
    label: string;
    subcategories: string[];
} | {
    value: "travel";
    label: string;
    subcategories: string[];
} | {
    value: "pets";
    label: string;
    subcategories: string[];
} | {
    value: "technology";
    label: string;
    subcategories: string[];
} | {
    value: "events";
    label: string;
    subcategories: string[];
})[];
export declare const getAllCategories: () => string[];
export declare const getCategoryLabel: (category: string) => string;
export declare const getCategorySubcategories: (category: string) => string[];
export declare const isValidCategory: (category: string) => boolean;
//# sourceMappingURL=businessCategories.d.ts.map