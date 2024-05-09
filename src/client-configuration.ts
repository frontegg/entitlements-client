import {AxiosInstance} from 'axios';
import {LoggingClient} from './logging';

export interface ClientConfiguration {
    pdpHost: string;
    axiosInstance?: AxiosInstance;
    logging: {
        client?: LoggingClient;
        logResults?: boolean;
    };
}
