import { v1 } from '@authzed/authzed-node';

export function createActiveAtCaveatContext(at?: string): v1.PbStruct {
	return {
		fields: {
			at: {
				kind: {
					oneofKind: 'stringValue',
					stringValue: at ?? new Date().toISOString()
				}
			}
		}
	};
}

export function createTargetingCaveatContext(attributes?: Record<string, unknown>): v1.PbStruct {
	return {
		fields: {
			user_context: {
				kind: {
					oneofKind: 'structValue',
					structValue: {
					fields: {
						...Object.entries(attributes ?? {}).reduce<
							Record<string, { kind: { oneofKind: 'stringValue'; stringValue: string } }>
						>((acc, [attrName, attrValue]) => {
							acc[attrName] = {
								kind: {
									oneofKind: 'stringValue',
									stringValue: String(attrValue)
								}
							};
							return acc;
						}, {}),
						now: {
							kind: {
								oneofKind: 'stringValue',
								stringValue: new Date().toISOString()
							}
						}
					}
					}
				}
			}
		}
	};
}
