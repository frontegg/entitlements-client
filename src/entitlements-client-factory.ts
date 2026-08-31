import { ClientConfiguration } from './client-configuration';
import { LoggingClient, SimpleLoggingClient } from './logging';
import { ConfigurationInputIsMissingException } from './exceptions/configuration-input-is-missing.exception';
import { SpiceDBEntitlementsClient } from './spicedb/spicedb-entitlements.client';
import { InstanceRegistry } from './instances/instance-registry';

export class EntitlementsClientFactory {
	public static create(configuration: ClientConfiguration): SpiceDBEntitlementsClient {
		if (!configuration.engineEndpoint) {
			throw new ConfigurationInputIsMissingException('engineEndpoint is required');
		}

		if (!configuration.engineToken) {
			throw new ConfigurationInputIsMissingException('engineToken is required');
		}

		const registry = new InstanceRegistry(configuration);

		const { loggingClient, logResults } = this.configureLoggingClient(configuration.logging);

		return new SpiceDBEntitlementsClient(
			configuration,
			loggingClient,
			logResults,
			configuration.fallbackConfiguration,
			registry
		);
	}

	private static configureLoggingClient(logging: ClientConfiguration['logging']): {
		loggingClient: LoggingClient;
		logResults: boolean;
	} {
		const client = logging?.client ?? new SimpleLoggingClient();
		const logResults = logging?.logResults ?? false;
		return { loggingClient: client, logResults };
	}
}
