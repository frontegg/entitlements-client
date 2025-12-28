<br />

<div align="center">
<img src="https://fronteggstuff.blob.core.windows.net/frongegg-logos/logo-transparent.png" alt="Frontegg Logo" width="400" height="90">

<h3 align="center">Entitlements NodeJS Client</h3>
</div>

## Table of Contents

-   [Installation](#installation)
-   [Prerequisite](#prerequisite)
-   [Usage](#usage)
-   [Lookup Operations](#lookup-operations)
-   [Justifications](#justifications)
-   [Monitoring](#monitoring)

## Installation

To install the package using npm, run the following

```
$ npm install @frontegg/e10s-client
```

## Prerequisite

The Entitlements Client connects directly to a SpiceDB instance for authorization queries.

You need:

-   A running SpiceDB instance
-   SpiceDB endpoint URL (e.g., `localhost:50051`)
-   SpiceDB authentication token

## Usage

### Initialize the client

```typescript
import { EntitlementsClientFactory, RequestContextType } from '@frontegg/e10s-client';

const e10sClient = EntitlementsClientFactory.create({
	spiceDBEndpoint: 'localhost:50051', // SpiceDB endpoint
	spiceDBToken: 'your-spicedb-token' // SpiceDB authentication token
});
```

### Configuration Options

```typescript
import { EntitlementsClientFactory } from '@frontegg/e10s-client';

const e10sClient = EntitlementsClientFactory.create({
	spiceDBEndpoint: 'localhost:50051',
	spiceDBToken: 'your-spicedb-token',
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
	console.log(`User is not entitled to "my-cool-feature" feature, reason: ${e10sResult.justification}`);
}
```

#### Query for Permission

```typescript
const e10sResult = await e10sClient.isEntitledTo(subjectContext, {
	type: RequestContextType.Permission,
	permissionKey: 'read'
});

if (!e10sResult.result) {
	console.log(`User is not entitled to "read" permission, reason: ${e10sResult.justification}`);
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
	console.log(`User is not entitled to "GET /users" route, reason: ${e10sResult.justification}`);
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
	console.log(`User is not allowed to read document, reason: ${e10sResult.justification}`);
}
```

## Lookup Operations

The client provides lookup operations to query SpiceDB for resources and subjects.

### Lookup Resources

Find all resources of a given type that a subject has a specific permission on.

```typescript
const response = await e10sClient.lookupResources({
	subjectType: 'user',
	subjectId: 'user-123',
	resourceType: 'document',
	permission: 'read',
	limit: 100, // Optional: limit number of results (default: 50, max: 1000)
	cursor: undefined // Optional: pagination cursor
});

console.log(`Found ${response.totalReturned} resources`);

response.resources.forEach((resource) => {
	console.log(`${resource.resourceType}:${resource.resourceId}`);
	// resource.permissionship: 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION'
});

// For pagination, use the returned cursor
if (response.cursor) {
	const nextPage = await e10sClient.lookupResources({
		// ... same params
		cursor: response.cursor
	});
}
```

### Lookup Subjects

Find all subjects of a given type that have a specific permission on a resource.

```typescript
const response = await e10sClient.lookupSubjects({
	resourceType: 'document',
	resourceId: 'doc-456',
	subjectType: 'user',
	permission: 'read'
});

console.log(`Found ${response.totalReturned} subjects`);

response.subjects.forEach((subject) => {
	console.log(`${subject.subjectType}:${subject.subjectId}`);
	// subject.permissionship: 'HAS_PERMISSION' | 'CONDITIONAL_PERMISSION' | 'NO_PERMISSION'
});
```

## Justifications

List of possible justifications

| Justification      | Meaning                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| MISSING_FEATURE    | User is missing the feature                                                                           |
| MISSING_PERMISSION | User is missing the permission                                                                        |
| PLAN_EXPIRED       | User has a plan that covers the feature, but the plan is expired                                      |
| MISSING_ROUTE      | Requested route is not configured                                                                     |
| ROUTE_DENIED       | Requested route is configured to be blocked                                                           |
| MISSING_RELATION   | Missing ReBAC relation that enables a subject-entity to perform a specified action on a target-entity |

## Monitoring

In case monitoring mode is enabled, the real results will only be logged, and the following payload will always return

```json
{
	"result": true,
	"monitoring": true
}
```
