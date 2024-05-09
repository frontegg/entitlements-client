import {EntitlementJustifications} from './entitlements-justifications.enum';

export type EntitlementsResult = {
    result?: boolean;
    justification?: EntitlementJustifications;
    monitoring?: boolean;
};