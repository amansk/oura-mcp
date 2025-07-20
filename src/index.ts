import { config as dotenvConfig } from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OuraProvider } from './provider/oura_provider.js';

dotenvConfig();

// Prevent debug modules from outputting to stdout
process.env.DEBUG = '';
process.env.NODE_DEBUG = '';

// Filter stdout to prevent any accidental debug output
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
  // Only allow JSON-RPC messages to go through stdout
  const str = chunk.toString();
  
  // Check if this is a JSON-RPC message (starts with { and contains jsonrpc)
  if (str.trim().startsWith('{') && str.includes('"jsonrpc"')) {
    return originalStdoutWrite(chunk, encoding, callback);
  }
  
  // Filter out any debug messages or large data dumps
  if (str.includes('Fetching') || str.includes('Response') || str.includes('more items') || str.includes('2024-')) {
    // Redirect to stderr instead
    return process.stderr.write(chunk, encoding, callback);
  }
  
  // For other non-JSON-RPC messages, redirect to stderr
  return process.stderr.write(chunk, encoding, callback);
};

// Redirect console methods to stderr
console.log = console.error;
console.info = console.error;
console.warn = console.error;
console.debug = console.error;

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Uncaught exception: ${errorMessage}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const errorMessage = reason instanceof Error ? reason.message : 'Unknown error';
  process.stderr.write(`Unhandled promise rejection: ${errorMessage}\n`);
  process.exit(1);
});

const config = {
  api: {
    baseUrl: 'https://api.ouraring.com/v2',
  },
  auth: {
    personalAccessToken: process.env.OURA_PERSONAL_ACCESS_TOKEN || '',
    clientId: process.env.OURA_CLIENT_ID || '',
    clientSecret: process.env.OURA_CLIENT_SECRET || '',
    redirectUri: process.env.OURA_REDIRECT_URI || 'http://localhost:3000/callback'
  },
  server: {
    name: 'oura-provider',
    version: '1.0.0'
  }
};

function validateConfig() {
  const { personalAccessToken, clientId, clientSecret } = config.auth;
  
  if (!personalAccessToken && (!clientId || !clientSecret)) {
    throw new Error('Either OURA_PERSONAL_ACCESS_TOKEN or both OURA_CLIENT_ID and OURA_CLIENT_SECRET must be provided');
  }
}

async function main() {
  // Validate configuration
  validateConfig();

  // Create and initialize the provider
  const provider = new OuraProvider({
    personalAccessToken: config.auth.personalAccessToken,
    clientId: config.auth.clientId,
    clientSecret: config.auth.clientSecret,
    redirectUri: config.auth.redirectUri
  });
  
  const transport = new StdioServerTransport();
  
  await provider.getServer().connect(transport);
}

main().catch(error => {
  // Use stderr and sanitize error to prevent large data logging
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Server error: ${errorMessage}\n`);
  process.exit(1);
});
