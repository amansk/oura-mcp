# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Oura MCP Server - a Model Context Protocol server that provides access to Oura Ring health and fitness data. It bridges Oura's API with MCP clients like Claude Desktop.

## Essential Commands

### Build & Development
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Manual testing of tools/resources
node test.js <tool_name> <date>
# Example: node test.js get_daily_sleep 2023-05-01
```

## Architecture Overview

### Core Components

1. **MCP Server Setup** (`src/index.ts`):
   - Initializes the MCP server with stdio transport
   - **Critical**: Filters stdout to ensure only JSON-RPC messages reach stdout
   - Redirects console methods to stderr to prevent protocol contamination

2. **Provider Logic** (`src/provider/oura_provider.ts`):
   - Defines all available resources and tools
   - Handles MCP protocol interactions
   - Maps Oura API endpoints to MCP resources/tools
   - Default 7-day window for date-based resources when accessed without parameters

3. **Authentication** (`src/provider/oura_connection.ts`):
   - Supports both Personal Access Token and OAuth2 flows
   - Handles token refresh for OAuth2 (partial implementation)
   - Environment variables: `OURA_PERSONAL_ACCESS_TOKEN` or OAuth2 credentials

### Key Implementation Details

- **Stdout Filtering**: The server filters all stdout output to prevent non-JSON-RPC messages from breaking the MCP protocol. This is crucial for proper operation.
- **Error Handling**: Large API responses are caught and handled to prevent protocol disruption
- **Resource URI Scheme**: All resources use `oura://` prefix (e.g., `oura://daily_sleep`)
- **Date-based Tools**: Tools like `get_daily_sleep` accept `startDate` and `endDate` parameters in YYYY-MM-DD format

### Available Resources (15 total)

Non-date-based:
- `personal_info`, `ring_configuration`

Date-based (default 7-day window):
- Daily metrics: `daily_activity`, `daily_readiness`, `daily_sleep`, `daily_stress`, `daily_resilience`, `daily_spo2`, `daily_cardiovascular_age`
- Detailed data: `sleep`, `sleep_time`, `workout`, `session`, `rest_mode_period`, `vO2_max`

## Testing Approach

- Integration tests in `src/__tests__/oura_provider.test.ts`
- Manual testing via `test.js` for quick verification
- Test both resource listing and tool execution

## Important Constraints

1. **Rate Limiting**: Oura API allows 5000 requests per 5 minutes
2. **MCP Protocol**: Never output non-JSON-RPC data to stdout
3. **Authentication**: Always check for valid credentials before making API calls
4. **Error Messages**: Keep error messages concise to avoid protocol issues