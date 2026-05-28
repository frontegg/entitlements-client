## Installation

1. [Docker Desktop](https://docs.docker.com/desktop/)

2. [zed cli](https://authzed.com/docs/spicedb/getting-started/installing-zed)

## Setup

This folder is a **standalone demo app** — it is not installed by `yarn` at the repo root. From this directory:

```bash
cd examples
yarn install
docker compose -f docker-compose.sync.yml up -d
zed import ./schema-relationships.yaml --insecure --endpoint localhost:50051 --token spicedb
```

## Running Examples

### 1. is-entitled-demo-alice-inheritance

```bash
yarn demo:alice
```

### 2. is-entitled-demo-tim-direct

```bash
yarn demo:tim
```

### 3. lookupTargetEntities-demo

```bash
yarn demo:lookup-targets
```

### 4. lookupEntities-demo

```bash
yarn demo:lookup-entities
```

### 5. lookupEntitlements-demo

```bash
yarn demo:lookup-entitlements
```
