# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Testing
- `pnpm build` - Build the project (includes web build and TypeScript compilation)
- `pnpm dev` - Development mode with watch
- `pnpm test` - Run tests once
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:silent` - Run tests silently (for CI)

### Code Quality
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm format` - Format code with Biome
- `pnpm type:check` - Run TypeScript type checking
- `pnpm check` - Run Biome checks
- `pnpm check:fix` - Run Biome checks with auto-fix
- `pnpm check:all` - Run all quality checks (lint, typecheck, spellcheck, duplicate check)

### Additional Quality Tools
- `pnpm spell:check` - Check spelling with cspell
- `pnpm duplicate:check` - Check for duplicate code with jscpd
- `pnpm docs:dev` - Start documentation development server

## Architecture Overview

This is a TypeScript-based MCP (Model Context Protocol) client that connects to Xiaozhi AI services. The project follows a modular architecture with clear separation of concerns.

### Core Components

1. **CLI Layer** (`src/cli/`) - Command-line interface using Commander.js
   - Entry point: `src/cli/index.ts`
   - Dependency injection container: `src/cli/Container.ts`
   - Command registration and handling

2. **Core MCP Layer** (`src/core/`) - MCP protocol implementation
   - `UnifiedMCPServer.ts` - Main MCP server implementation
   - `ServerFactory.ts` - Factory for creating different server types
   - `MCPMessageHandler.ts` - Message processing and routing

3. **Transport Layer** (`src/transports/`) - Communication adapters
   - `WebSocketAdapter.ts` - WebSocket communication
   - `HTTPAdapter.ts` - HTTP communication
   - `StdioAdapter.ts` - Standard I/O communication

4. **Utilities** (`src/utils/`) - Shared utilities and helpers

### Key Features

- **Multi-endpoint support**: Can connect to multiple Xiaozhi AI endpoints simultaneously
- **MCP Server aggregation**: Can aggregate multiple MCP servers
- **Web UI**: Provides a web-based configuration interface
- **Docker support**: Full containerization with Docker Compose
- **Multiple transport protocols**: WebSocket, HTTP, and Stdio
- **ModelScope integration**: Supports ModelScope-hosted MCP services

### Configuration

The main configuration file is `xiaozhi.config.json` which supports:
- `mcpEndpoint` - Single endpoint string or array of endpoints
- `mcpServers` - Object of MCP server configurations
- `modelscope` - ModelScope API configuration
- `connection` - Connection parameters (heartbeat, timeout, etc.)
- `webUI` - Web UI configuration

### Entry Points

The project builds three main entry points:
- `dist/cli.js` - CLI tool (main entry point)
- `dist/mcpServerProxy.js` - MCP server proxy for integration with other clients
- `dist/WebServerStandalone.js` - Standalone web server

### Testing Strategy

- Uses Vitest for testing
- Coverage targets: 80% for branches, functions, lines, statements
- Tests are located in `__tests__` directories alongside source files
- Integration tests for transport adapters and server functionality

### Build Process

- Uses tsup for bundling
- Outputs ESM format for Node.js 18+
- Includes source maps and TypeScript declarations
- Copies templates and configuration files to dist directory

### Code Style

- Uses Biome for linting and formatting
- TypeScript strict mode enabled
- Double quotes, semicolons, ES5 trailing commas
- 2-space indentation
- Line endings: LF

### Important Notes

- The project uses ESM modules exclusively
- Path aliases are configured for cleaner imports (`@cli/*`, etc.)
- External dependencies are not bundled (ws, express, commander, etc.)
- Templates directory is copied to dist for project scaffolding
- Web UI is built separately in the `web/` directory