import {ClientConfiguration} from './client-configuration';
import axios from 'axios';
import {EntitlementsResult} from './types';
import {EntitlementsClient} from './entitlements-client';


export const DEFAULT_LOGGING = (res: EntitlementsResult): void => console.log(res);

export class EntitlementsClientFactory {
    public static create(configuration: ClientConfiguration): EntitlementsClient {
        const axiosRef = configuration.axiosRef ?? axios.create();
        const normalizedConfiguration: ClientConfiguration = {
            pdpHost: configuration.pdpHost,

            logging: EntitlementsClientFactory.normalizeLogging(configuration.logging)
        };

        return new EntitlementsClient(normalizedConfiguration, axiosRef); // TODO add logging wrapper
    }

    private static normalizeLogging(logging: ClientConfiguration['logging']): ClientConfiguration['logging'] {
        if (!logging) {
            return undefined;
        }

        if (logging === true) {
            return DEFAULT_LOGGING;
        }

        return logging;
    }
}