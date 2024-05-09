import {AxiosInstance} from 'axios';
import {EntitlementsResult} from './types';

export interface ClientConfiguration {
    // clientId: string;
    // apiKey: string;
    pdpHost: string;
    axiosRef?: AxiosInstance;
    logging?: true | ((res: EntitlementsResult) => void); // TODO is it EntitlementsResult or OPA result??
}
