import {EntitlementsClient} from "./entitlements-client";
import axios from "axios";
import {RequestContextType} from "./types";

describe(EntitlementsClient.name, () => {
    it('should create an instance', async () => {
        const instance = new EntitlementsClient({pdpHost: 'http://localhost:8181'}, axios.create());
        const res = await instance.isEntitledTo(
                {
                    userId: "asd",
                    tenantId: "123123",
                    permissions: ["featurekey"],
                    attributes: {"hello": "world"}
                },
                {type: RequestContextType.Permission, permissionKey: "featurekey2"}
        );

        console.log(res);
    });
});