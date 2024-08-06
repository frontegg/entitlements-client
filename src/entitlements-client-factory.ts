import { ClientConfiguration, FallbackConfiguration } from './client-configuration';
import axios from 'axios';
import { EntitlementsClient } from './entitlements.client';
import { LoggingClient, SimpleLoggingClient } from './logging';
import { OpaQueryClient } from './opa-queries';
import { ConfigurationInputIsMissingException } from './exceptions/configuration-input-is-missing.exception';
import { ConfigurationInputIsInvalidException } from './exceptions/configuration-input-is-invalid.exception';

export class EntitlementsClientFactory {
	public static create(configuration: ClientConfiguration): EntitlementsClient {
		if (!configuration.pdpHost) {
			throw new ConfigurationInputIsMissingException('pdpHost is required');
		}
		if (configuration.timeout !== undefined && configuration.timeout <= 0) {
			throw new ConfigurationInputIsInvalidException('timeout must be positive number');
		}

		const pdpHost = configuration.pdpHost;
		const axiosInstance = configuration.axiosInstance ?? axios.create({ timeout: configuration.timeout });
		const opaQueryClient = new OpaQueryClient(pdpHost, axiosInstance);
		const { loggingClient, logResults } = this.configureLoggingClient(configuration.logging);

		return new EntitlementsClient(opaQueryClient, loggingClient, logResults, configuration.fallbackConfiguration);
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
