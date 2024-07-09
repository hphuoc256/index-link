# Project Service CheckLink BE

## Requirements
Environment: Node 20.x

Database: MongoDB

## Installation

```bash
cp .env.example .env

$ npm install

# Run Seeder
$ node seeder.js
```

## Running the app
```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

#### Repository Pattern Architecture

- Model
  → Define DB object and attribute.
- Controller
  → Receive requests, use Service, pass data to View or return json response.
- Request
  → Validation
- Service
  → Business logic. Receive requests from Controller and use Repository interface
- Repository Interface
  → Call repository. Only used for Service.
- Repository
  → Execute SQL Query. Only called from Repository interface.
