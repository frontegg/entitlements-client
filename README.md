<br />
<div align="center">
<img src="https://fronteggstuff.blob.core.windows.net/frongegg-logos/logo-transparent.png" alt="Frontegg Logo" width="400" height="90">

<h3 align="center">Entitlements NodeJS Client</h3>
</div>

## Table of Contents

-   [Installation](#installation)
-   [Prerequisite](#prerequisite)
-   [Usage](#usage)
-   [Justifications](#justifications)
-   [Monitoring](#monitoring)

## Installation

To install the package using npm, run the following

```
$ npm install @frontegg/e10s-client
```

## Prerequisite

Since the Entitlements Client is interacting with the Entitlements Agent, it is required to setup and run the agent.

Look for instructions [here](https://docs.frontegg.com/docs/configuration)

## Usage

### Initialize the client

```typescript
import { EntitlementsClientFactory, RequestContextType } from '@frontegg/e10s-client';

const e10sClient = EntitlementsClientFactory.create({
	pdpHost: 'localhost:8181' // Entitlements Agent Host
});
```

### Setting up the Subject Context

Subject context describes the user which performs the action, these can be taken from Frontegg JWT if authenticating with Frontegg

```typescript
const subjectContext: SubjectContext = {
	tenantId: 'my-tenant-id',
	userId: 'my-user-id', // Optional
	permissions: ['read', 'write'], // Optional
	attributes: { 'my-custom-attribute': 'some-value' } // Optional
};
```

### Query
The Entitlements client allows you to query for a feature, permission or a route entitlement, each requires different context information.

#### Query for Feature

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	subjectContext,
	{
		type: RequestContextType.Feature,
		featureKey: 'my-cool-feature'
	}
);

if (!e10sResult.result) {
	console.log(`User is not entitled to "my-cool-feature" feature, reason: ${e10sResult.justification}`);
}
```

#### Query for Permission

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	subjectContext,
	{
		type: RequestContextType.Permission,
		permissionKey: 'read'
	}
);

if (!e10sResult.result) {
	console.log(`User is not entitled to "read" permission, reason: ${e10sResult.justification}`);
}
```

#### Query for Route

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	subjectContext,
	{
		type: RequestContextType.Route,
		method: "GET",
        path: "/users"
	}
);

if (!e10sResult.result) {
	console.log(`User is not entitled to "GET /users" route, reason: ${e10sResult.justification}`);
}
```

#### Query for FGA

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	{
		entityType: "user",
		key: "some@user.com"
	},
	{
		type: RequestContextType.Entity,
		entityType: "document",
        key: "README.md",
		action: "read"
	}
);

if (!e10sResult.result) {
	console.log(`User is not allowed to read document, reason: ${e10sResult.justification}`);
}
```

## Justifications

List of possible justifications

| Justification      | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| MISSING_FEATURE    | User is missing the feature                                      |
| MISSING_PERMISSION | User is missing the permission                                   |
| PLAN_EXPIRED       | User has a plan that covers the feature, but the plan is expired |
| MISSING_ROUTE      | Requested route is not configured                                |
| ROUTE_DENIED       | Requested route is configured to be blocked                      |
| MISSING_RELATION   | Missing ReBAC relation that enables a subject-entity to perform a specified action on a target-entity                       |

## Monitoring

In case monitoring mode is enabled, the real results will only be logged, and the following payload will always return

```json
{
	"result": true,
	"monitoring": true
}
```