export type EntitlementsResult = {
	result?: boolean;
	monitoring?: true;
};

export type EntitlementsBatchResult = Record<string, EntitlementsResult>;
