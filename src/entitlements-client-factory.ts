import { ClientConfiguration } from './client-configuration';
import { LoggingClient, SimpleLoggingClient } from './logging';
import { ConfigurationInputIsMissingException } from './exceptions/configuration-input-is-missing.exception';
import { SpiceDBEntitlementsClient } from './spicedb/spicedb-entitlements.client';

export class EntitlementsClientFactory {
	public static create(configuration: ClientConfiguration): SpiceDBEntitlementsClient {
		if (!configuration.spiceDBEndpoint) {
			throw new ConfigurationInputIsMissingException('spiceDBEndpoint is required');
		}

		if (!configuration.spiceDBToken) {
			throw new ConfigurationInputIsMissingException('spiceDBToken is required');
		}

		const { loggingClient, logResults } = this.configureLoggingClient(configuration.logging);

		return new SpiceDBEntitlementsClient(
			configuration,
			loggingClient,
			logResults,
			configuration.fallbackConfiguration
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
