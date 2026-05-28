<br />

<div align="center">
<img src="https://fronteggstuff.blob.core.windows.net/frongegg-logos/logo-transparent.png" alt="Frontegg Logo" width="400" height="90">

<h3 align="center">Entitlements NodeJS Client</h3>
</div>

## Table of Contents

-   [Installation](#installation)
-   [Prerequisite](#prerequisite)
-   [Usage](#usage)
-   [Examples](#examples)
-   [Lookup Operations](#lookup-operations)
-   [Monitoring](#monitoring)

## Installation

To install the package using npm, run the following

```
$ npm install @frontegg/e10s-client
```

## Prerequisite

The Entitlements Client interacts with Frontegg’s ReBAC authorization engine to evaluate permissions and query access relationships.

Look for instructions [here](https://developers.frontegg.com/ciam/guides/authorization/entitlements/agent/setup)

## Usage

### Initialize the client

```typescript
import { EntitlementsClientFactory, RequestContextType } from '@frontegg/e10s-client';

const e10sClient = EntitlementsClientFactory.create({
	engineEndpoint: 'localhost:50051',
	engineToken: 'your-engine-token'
});
```

### Configuration Options

```typescript
import { EntitlementsClientFactory } from '@frontegg/e10s-client';

const e10sClient = EntitlementsClientFactory.create({
	engineEndpoint: 'localhost:50051',
	engineToken: 'your-engine-token',
	logging: {
		client: customLoggingClient, // Optional: custom logging client
		logResults: true // Optional: log all query results
	},
	fallbackConfiguration: {
		// Optional: fallback behavior on errors
		defaultFallback: false
	}
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
const e10sResult = await e10sClient.isEntitledTo(subjectContext, {
	type: RequestContextType.Feature,
	featureKey: 'my-cool-feature'
});

if (!e10sResult.result) {
	console.log(`User is not entitled to "my-cool-feature" feature`);
}
```

#### Query for Permission

```typescript
const e10sResult = await e10sClient.isEntitledTo(subjectContext, {
	type: RequestContextType.Permission,
	permissionKey: 'read'
});

if (!e10sResult.result) {
	console.log(`User is not entitled to "read" permission`);
}
```

#### Query for Route

```typescript
const e10sResult = await e10sClient.isEntitledTo(subjectContext, {
	type: RequestContextType.Route,
	method: 'GET',
	path: '/users'
});

if (!e10sResult.result) {
	console.log(`User is not entitled to "GET /users" route`);
}
```

#### Query for FGA (Fine-Grained Authorization)

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	{
		entityType: 'user',
		key: 'some@user.com'
	},
	{
		type: RequestContextType.Entity,
		entityType: 'document',
		key: 'README.md',
		action: 'read'
	}
);

if (!e10sResult.result) {
	console.log(`User is not allowed to read document`);
}
```

#### Query for FGA with Time-Based Access (active_at caveat)

For relationships that use the `active_at` caveat to control time-based access, you can specify the `at` parameter to evaluate access at a specific point in time.

```typescript
const e10sResult = await e10sClient.isEntitledTo(
	{
		entityType: 'user',
		key: 'some@user.com'
	},
	{
		type: RequestContextType.Entity,
		entityType: 'document',
		key: 'README.md',
		action: 'read',
		at: '2026-01-15T12:00:00Z'
	}
);

if (!e10sResult.result) {
	console.log(`User is not allowed to read document at the specified time`);
}
```

The `at` parameter accepts ISO 8601 format strings:

-   UTC format: `2025-12-31T23:59:59Z`
-   Timezone offset: `2025-12-31T23:59:59+02:00`

If `at` not provided, it defaults to the current UTC time.

> **Note:** The `at` parameter is also supported in [Lookup Operations](#lookup-operations) with the same format and behavior.

## Examples

Runnable demos live in [`examples/`](./examples/). They use a **separate `package.json`** and are **not** installed when you run `yarn` at the repo root.

```bash
cd examples
yarn install   # pulls @frontegg/e10s-client@latest from npm
```

See [examples/Readme.md](./examples/Readme.md) for Docker/SpiceDB setup and demo scripts.

## Lookup Operations

The client provides lookup operations that query the ReBAC authorization model to discover access relationships between entities.

FGA lookup operations support the optional `at` parameter for time-based access control (see [Time-Based Access](#query-for-fga-with-time-based-access-active_at-caveat)).

### Lookup Entitlements

Find all entitlement feature keys granted to a tenant or user.

This lookup returns **effective feature entitlements** for the requested subject:

- When only `tenantId` is provided, the response contains feature grants available to that tenant.
- When both `tenantId` and `userId` are provided, the response contains the user's effective feature grants: tenant-inherited grants plus user-direct grants.
- If `userId` is provided but the user is not a member of the tenant, the response is empty.
- If the same feature key is granted through both the tenant and the user, it is returned once in the page response.

Use a tenant-only subject when you need tenant-level entitlements. Use a subject with `userId` when you need the feature set that should apply to a specific user.

> **Pagination note:** For user lookups, tenant and user grants are looked up and paginated independently. A feature key that is reachable through both streams may appear on different pages, so callers that aggregate multiple pages should deduplicate feature keys across pages if needed.

```typescript
const response = await e10sClient.lookupEntitlements({
	subject: {
		tenantId: 'tenant-123',
		userId: 'user-456', // Optional: include for effective user entitlements
		attributes: { plan: 'pro' } // Optional: evaluated by targeting rules
	},
	criteria: {
		type: RequestContextType.Feature
	},
	limit: 100, // Optional: default 50
	cursor: undefined // Optional: pagination cursor
});

console.log(`Found ${response.totalReturned} entitlement features`);

response.entitlements.forEach((entitlement) => {
	console.log(`${entitlement.type}:${entitlement.key}`);
	// entitlement.permissionship: 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION'
});

if (response.cursor) {
	const nextPage = await e10sClient.lookupEntitlements({
		// ... same params
		cursor: response.cursor
	});
}
```

### Lookup Target Entities

Find all TargetEntity instances (i.e. documents) of a given type that an entity (i.e user) is entitled to perform a specific action on.

```typescript
const response = await e10sClient.lookupTargetEntities({
	entityType: 'user',
	entityId: 'user-123',
	TargetEntityType: 'document',
	action: 'read',
	limit: 100, // Optional: limit number of results (default: 50, max: 1000)
	cursor: undefined, // Optional: pagination cursor
	at: '2026-01-15T12:00:00Z' // Optional: ISO 8601 timestamp for active_at caveat
});

console.log(`Found ${response.totalReturned} Target Entities`);

response.targets.forEach((target) => {
	console.log(`${target.TargetEntityType}:${target.TargetEntityId}`);
	// target.permissionship: 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION'
});

// For pagination, use the returned cursor
if (response.cursor) {
	const nextPage = await e10sClient.lookupTargetEntities({
		// ... same params
		cursor: response.cursor
	});
}
```

### Lookup Entities

Find all entities (i.e. users) of a given type that are entitled to perform a specific action on a given entity instance (i.e. documents)

```typescript
const response = await e10sClient.lookupEntities({
	TargetEntityType: 'document',
	TargetEntityId: 'doc-456',
	entityType: 'user',
	action: 'read',
	at: '2026-01-15T12:00:00Z'
});

console.log(`Found ${response.totalReturned} entities`);

response.entities.forEach((entity) => {
	console.log(`${entity.entityType}:${entity.entityId}`);
	// entity.permissionship: 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION'
});
```

## Monitoring

In case monitoring mode is enabled, the real results will only be logged, and the following payload will always return

```json
{
	"result": true,
	"monitoring": true
}
```
