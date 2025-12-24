import { v1 } from '@authzed/authzed-node';
import { Permissionship } from '../types';

export const DEFAULT_LOOKUP_LIMIT = 50;

export const permissionshipMap = new Map<v1.LookupPermissionship, Permissionship>([
	[v1.LookupPermissionship.HAS_PERMISSION, 'HAS_PERMISSION'],
	[v1.LookupPermissionship.CONDITIONAL_PERMISSION, 'CONDITIONAL_PERMISSION']
]);
