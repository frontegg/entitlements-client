export type EntitlementsResult = {
	result?: boolean;
	monitoring?: true;
	error?: string;
};

export type EntitlementsBatchResult = Record<string, EntitlementsResult>;
export type EntitlementsManyResult = EntitlementsResult[];
