# Mission Briefing: Refactor Dependency Management

## Overall Goal

- To refactor our monorepo's dependency management for better organization and optimization.
- We will move dependencies from the root `package.json` to the specific application or library that actually requires them. This improves encapsulation and can reduce final bundle sizes.

## Current Branch

- Ensure all work is done on the `refactor/dependency-management` branch.

## Step-by-Step Instructions for AI

### Step 1: Analyze Root `package.json`

- Review the `dependencies` and `devDependencies` in the root `package.json` file. We will be moving most of the `dependencies` to the relevant sub-packages.

### Step 2: Relocate Dependencies to `kimp-core`

- Open `packages/kimp-core/package.json`.
- Move the following dependencies from the root `package.json` to the `dependencies` section of `packages/kimp-core/package.json`, as they are core to its functionality:
  - `@nestjs/config`
  - `@nestjs/typeorm`
  - `typeorm`
  - `mysql2`
  - `axios`
  - `jsonwebtoken`
  - `uuid`
  - `dotenv`

### Step 3: Relocate Dependencies to Applications

- For each application, analyze which specific dependencies it uses and move them accordingly. For now, we will move `@nestjs/schedule` as an example.
- Open `apps/kim-p-finalizer/package.json`.
- Move the `@nestjs/schedule` dependency from the root `package.json` to the `dependencies` section here, as only the Finalizer uses cron jobs.

### Step 4: Define Workspace Dependencies

- Open the `package.json` file for each of the three applications (`kimP-Feeder`, `kimP-Initiator`, `kimP-Finalizer`).
- Add a dependency to our core library using the `workspace:*` protocol. This tells Yarn/NPM to use the local version from our `packages` folder.
  ```json
  "dependencies": {
    "@app/kimp-core": "workspace:*"
  }
  ```
  Make sure to add this to all three application package.json files.

Step 5: Clean Up Root package.json
After moving the dependencies, the dependencies section in the root package.json should be much smaller. It should only contain packages truly shared by all apps at runtime (like @nestjs/common, reflect-metadata, rxjs).

The devDependencies section (for tools like TypeScript, Jest, ESLint, Prettier) should remain in the root package.json.

Verification
After modifying all package.json files, run yarn install from the root directory. This will update node_modules according to the new structure.

After installation, run a build for all projects to ensure dependencies are correctly resolved:

yarn build kimp-core

yarn build kim-p-feeder

yarn build kim-p-initiator

yarn build kim-p-finalizer

All builds must complete without any errors.
