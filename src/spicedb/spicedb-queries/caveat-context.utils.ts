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
