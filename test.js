import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // Get command line arguments
  const [toolName, startDate, endDate] = process.argv.slice(2);
  
  if (!toolName || !startDate) {
    console.error('Usage: node test.js <tool_name> <start_date> [end_date]');
    process.exit(1);
  }

  const serverPath = join(__dirname, 'build/index.js');
  
  // Create MCP client
  const transport = new StdioClientTransport({
    command: '/opt/homebrew/bin/node',
    args: [serverPath],
    env: {
      OURA_PERSONAL_ACCESS_TOKEN: process.env.OURA_PERSONAL_ACCESS_TOKEN,
    }
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  try {
    console.error('Connecting to server...');
    await client.connect(transport);

    console.error('Listing resources...');
    const resources = await client.listResources();
    console.error('Available resources:', resources);

    console.error('\nListing tools...');
    const tools = await client.listTools();
    console.error('Available tools:', tools);

    // Test various resources
    const resourceTests = [
      'personal_info',
      'daily_activity',
      'daily_readiness',
      'ring_configuration'
    ];

    for (const resource of resourceTests) {
      console.error(`\nFetching ${resource}...`);
      const data = await client.readResource({
        uri: `oura://${resource}`
      });
      console.error(`${resource} data:`, data);
    }

    // Call the specified tool with the given date
    console.error(`\nCalling ${toolName}...`);
    const data = await client.callTool({
      name: toolName,
      arguments: {
        startDate: startDate,
        endDate: endDate || startDate,
      },
    });
    console.error(`${toolName} data:`, data);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main(); 