import axios from 'axios';
import {RequestContextType} from './types';
import {EntitlementsClientFactory} from './entitlements-client-factory';

describe(EntitlementsClientFactory.name, () => {
    it('should create an instance', async () => {
        const instance = EntitlementsClientFactory.create({
            pdpHost: 'http://localhost:8181',
            axiosInstance: axios.create(),
            logging: {logResults: true}
        });
        const res = await instance.isEntitledTo(
                {
                    userId: 'asd',
                    tenantId: '123123',
                    permissions: ['featurekey'],
                    attributes: {'hello': 'world'}
                },
                {type: RequestContextType.Permission, permissionKey: 'featurekey2'}
        );

        console.log(res);
    });
});