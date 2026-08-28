import { EntitlementsSpiceDBQuery } from './entitlements-spicedb.query';
import {
	EntitlementsBatchResult,
	EntitlementsDynamicQuery,
	EntitlementsResult,
	RequestContextType,
	UserSubjectContext
} from '../../types';
import { SpiceDBResponse } from '../../types/spicedb.dto';
import { v1 } from '@authzed/authzed-node';
import { SpiceDBEntities } from '../../types/spicedb-consts';
import { LoggingClient } from '../../logging';
import { SchemaScope } from '../../instances/schema-scope';

export class FeaturesSpiceDBQuery extends EntitlementsSpiceDBQuery {
	constructor(
		protected readonly client: v1.ZedPromiseClientInterface,
		loggingClient?: LoggingClient,
		logResults: boolean = false
	) {
		super(client, loggingClient, logResults);
	}

	async query(
		{ subjectContext, requestContext }: EntitlementsDynamicQuery<RequestContextType.Feature>,
		scope: SchemaScope
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		return this.executeCommonQuery(scope, SpiceDBEntities.Feature, requestContext.featureKey, context);
	}

	async queryMany(
		subjectContext: UserSubjectContext,
		featureKeys: string[],
		scope: SchemaScope
	): Promise<SpiceDBResponse<EntitlementsBatchResult>> {
		return this.executeManyCommonQuery(scope, SpiceDBEntities.Feature, featureKeys, subjectContext);
	}
}
