/**
 * LLM Layer Test File
 *
 * Tests basic chat completion and tool calling with OpenAI.
 * Run with: OPENAI_API_KEY=sk-... npx ts-node src/test.ts
 */

import { OpenAIProvider } from './adapters/openai';
import { LLMRouter, createRouter } from './router';
import type { Message, ToolDefinition, StreamChunk } from './types';

// ============================================================================
// Test Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  console.error('Usage: OPENAI_API_KEY=sk-... npx ts-node src/test.ts');
  process.exit(1);
}

// ============================================================================
// Test 1: Basic Chat
// ============================================================================

async function testBasicChat(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Basic Chat Completion');
  console.log('='.repeat(60));

  const provider = new OpenAIProvider({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant. Be concise.' },
    { role: 'user', content: 'What is 2 + 2? Reply with just the number.' },
  ];

  console.log('\nSending messages...');
  console.log('Response: ', '');

  let fullResponse = '';
  let usage = { input: 0, output: 0 };

  for await (const chunk of provider.chat({ messages })) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.content);
      fullResponse += chunk.content;
    } else if (chunk.type === 'usage') {
      usage = { input: chunk.input_tokens, output: chunk.output_tokens };
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n');
  console.log(`Tokens used: ${usage.input} input, ${usage.output} output`);
  console.log('✓ Basic chat test completed');
}

// ============================================================================
// Test 2: Tool Calling
// ============================================================================

async function testToolCalling(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Tool Calling');
  console.log('='.repeat(60));

  const provider = new OpenAIProvider({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  // Define a test tool
  const tools: ToolDefinition[] = [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
          },
        },
        required: ['location'],
      },
    },
  ];

  const messages: Message[] = [
    { role: 'user', content: 'What is the weather like in Tokyo?' },
  ];

  console.log('\nSending message with tool...');

  let textContent = '';
  const toolCalls: StreamChunk[] = [];

  for await (const chunk of provider.chat({ messages, tools })) {
    if (chunk.type === 'text') {
      textContent += chunk.content;
    } else if (chunk.type === 'tool_call') {
      toolCalls.push(chunk);
      console.log('\nTool call received:');
      console.log(`  Name: ${chunk.tool_call.name}`);
      console.log(`  ID: ${chunk.tool_call.id}`);
      console.log(`  Arguments: ${JSON.stringify(chunk.tool_call.arguments, null, 2)}`);
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  if (textContent) {
    console.log(`\nText response: ${textContent}`);
  }

  console.log(`\nTotal tool calls: ${toolCalls.length}`);
  console.log('✓ Tool calling test completed');
}

// ============================================================================
// Test 3: Token Counting
// ============================================================================

async function testTokenCounting(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Token Counting');
  console.log('='.repeat(60));

  const provider = new OpenAIProvider({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you today?' },
    { role: 'assistant', content: 'I am doing well, thank you for asking! How can I help you?' },
    { role: 'user', content: 'Can you explain what machine learning is in simple terms?' },
  ];

  const tokenCount = await provider.countTokens(messages);
  console.log(`\nMessages token count: ${tokenCount}`);
  console.log('✓ Token counting test completed');
}

// ============================================================================
// Test 4: Router with Fallback
// ============================================================================

async function testRouter(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Router');
  console.log('='.repeat(60));

  const provider = new OpenAIProvider({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  // Create router with single provider
  const router = createRouter(provider);

  console.log(`\nRegistered providers: ${router.listProviders().join(', ')}`);

  const messages: Message[] = [
    { role: 'user', content: 'Say "Router test successful" exactly.' },
  ];

  console.log('Sending via router...');
  console.log('Response: ', '');

  for await (const chunk of router.chat({ messages })) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.content);
    }
  }

  console.log('\n');
  console.log('✓ Router test completed');
}

// ============================================================================
// Test 5: Provider Validation
// ============================================================================

async function testValidation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: Provider Validation');
  console.log('='.repeat(60));

  const provider = new OpenAIProvider({
    apiKey: OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  console.log('\nValidating provider...');
  const result = await provider.validate();

  if (result.valid) {
    console.log('✓ Provider is valid and connected');
  } else {
    console.log(`✗ Provider validation failed: ${result.error}`);
  }
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('OpenAgent LLM Layer Tests');
  console.log('Using model: gpt-4o-mini');

  try {
    await testValidation();
    await testBasicChat();
    await testToolCalling();
    await testTokenCounting();
    await testRouter();

    console.log('\n' + '='.repeat(60));
    console.log('All tests completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n\nTest failed with error:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
