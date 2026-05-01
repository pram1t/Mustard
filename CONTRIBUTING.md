# Contributing to OpenAgent

Thank you for your interest in contributing to OpenAgent. This guide covers the development workflow, coding standards, and contribution process.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/openagent/openagent.git
cd openagent

# Install all dependencies (npm workspaces)
npm install

# Build all packages and apps
npm run build

# Run the full test suite
npm test
```

## Project Structure

OpenAgent is a monorepo managed with Turbo and npm workspaces:

```
openagent/
  apps/
    cli/              # Command-line interface application
    desktop/          # Electron desktop application (thin client)
  packages/
    core/             # Agent orchestration, session management
    llm/              # LLM provider abstraction and adapters
    tools/            # Built-in tools and tool registry
    mcp/              # Model Context Protocol client
    config/           # Configuration loading and validation
    logger/           # Structured logging
    hooks/            # Lifecycle hook system
    test-utils/       # Shared testing utilities
  docs/               # Documentation
```

Each package is independently versioned and published under the `@openagent` scope.

## Code Style

- **TypeScript strict mode** is enabled across all packages. Do not use `// @ts-ignore` or `// @ts-nocheck`.
- **No `any` type.** Use `unknown` and narrow with type guards when dealing with untyped data.
- **ES2022 target.** You can use top-level await, `Array.at()`, `Object.hasOwn()`, and similar modern features.
- **Naming conventions:**
  - Files: `kebab-case.ts`
  - Classes: `PascalCase`
  - Functions and variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Interfaces: `PascalCase` (no `I` prefix)
- **Imports:** Use explicit named imports. Avoid `import *`.
- **Error handling:** Throw typed errors. Avoid swallowing errors silently.

## Adding a New LLM Provider

1. Create a new adapter file in `packages/llm/src/adapters/`:

```typescript
// packages/llm/src/adapters/my-provider.ts
import { LLMProvider, ChatMessage, ChatResponse, TokenCount, ChatOptions } from '../types';

export class MyProviderAdapter implements LLMProvider {
  readonly name = 'my-provider';

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    // Implement chat completion against your LLM API.
  }

  async countTokens(messages: ChatMessage[]): Promise<TokenCount> {
    // Implement token counting.
  }

  async validate(): Promise<boolean> {
    // Verify API key and connectivity.
  }
}
```

2. Register the provider in the router (`packages/llm/src/router.ts`):

```typescript
import { MyProviderAdapter } from './adapters/my-provider';

registerProvider('my-provider', (config) => new MyProviderAdapter(config));
```

3. Add tests in `packages/llm/src/adapters/__tests__/my-provider.test.ts`.

4. Update the CLI's `--provider` help text if the provider should be user-facing.

## Adding a New Tool

1. Create the tool in `packages/tools/src/builtin/`:

```typescript
// packages/tools/src/builtin/my-tool.ts
import { Tool, ToolResult } from '../types';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does in one sentence.',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Description of the parameter' },
    },
    required: ['input'],
  },

  async execute(params: { input: string }): Promise<ToolResult> {
    // Implement tool logic.
    return { content: 'result' };
  },
};
```

2. Register the tool in `packages/tools/src/registry.ts`:

```typescript
import { myTool } from './builtin/my-tool';

registerTool(myTool);
```

3. Add tests in `packages/tools/src/builtin/__tests__/my-tool.test.ts`.

4. If the tool performs destructive operations (writes, deletes, executes), ensure it is gated by the permission system.

## Testing

OpenAgent uses **Vitest** for all tests. The minimum coverage threshold is **80%** across all packages.

```bash
# Run all tests
npm test

# Run tests for a specific package
npm test -w packages/llm

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run a specific test file
npx vitest run packages/tools/src/builtin/__tests__/my-tool.test.ts
```

### Testing Guidelines

- Place test files in a `__tests__/` directory adjacent to the source, or use the `.test.ts` suffix.
- Use `describe` / `it` blocks with clear, descriptive test names.
- Mock external dependencies (API calls, file system) rather than making real requests.
- When mocking file paths on Windows, use `path.join()` instead of hardcoded `/` separators.
- Use `@pram1t/mustard-test-utils` for common mocks (`createMockProvider`, `createMockTool`, etc.).

## Building

Turbo handles the build dependency graph automatically:

```bash
# Build all packages and apps
npm run build

# Build a specific package
npm run build -w packages/core

# Type-check without emitting
npm run typecheck
```

Build order is determined by inter-package dependencies. For example, `@pram1t/mustard-core` depends on `@pram1t/mustard-llm` and `@pram1t/mustard-tools`, so those are built first.

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement** your changes following the code style guidelines above.

3. **Write tests** for all new functionality. Ensure existing tests still pass.

4. **Build and test** the full project:

   ```bash
   npm run build && npm test
   ```

5. **Commit** with a clear, descriptive message. Use conventional commit format:

   ```
   feat(llm): add support for My Provider
   fix(tools): handle empty file path in read_file
   docs: update getting-started guide
   test(core): add session resume edge case tests
   ```

6. **Push** your branch and open a pull request against `main`.

7. **Describe** your changes in the PR body. Include:
   - What the change does and why
   - How to test it
   - Any breaking changes

8. **Address review feedback** promptly. All PRs require at least one approving review before merge.

## Reporting Issues

When filing a bug report, include:

- Node.js and npm versions
- Operating system
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs (with `--verbose` flag output if applicable)

---

Thank you for contributing to OpenAgent.
