import {
	FeatureEntitlementsContext,
	PermissionsEntitlementsContext,
	RouteEntitlementsContext
} from './request-context';
import { SubjectContext } from './subject-context';

export type EntitlementsQueryRequestContext =
	| FeatureEntitlementsContext
	| PermissionsEntitlementsContext
	| RouteEntitlementsContext;

export type EntitlementsQuery =
	| {
			subjectContext: SubjectContext;
			requestContext: EntitlementsQueryRequestContext;
	  }
	| {
			subjectContext: SubjectContext;
			requestContextList: EntitlementsQueryRequestContext[];
	  };
