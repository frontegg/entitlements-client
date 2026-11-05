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
import { SchemaNamespace } from '../../instances/schema-namespace';

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
		namespace: SchemaNamespace
	): Promise<SpiceDBResponse<EntitlementsResult>> {
		const context = subjectContext as UserSubjectContext;
		return this.executeCommonQuery(namespace, SpiceDBEntities.Feature, requestContext.featureKey, context);
	}

	async queryMany(
		subjectContext: UserSubjectContext,
		featureKeys: string[],
		namespace: SchemaNamespace
	): Promise<SpiceDBResponse<EntitlementsBatchResult>> {
		return this.executeManyCommonQuery(namespace, SpiceDBEntities.Feature, featureKeys, subjectContext);
	}
}
