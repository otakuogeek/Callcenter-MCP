/**
 * @module whatsapp/ai/AIProvider
 * @description Abstract AI provider interface + response parser.
 *              Every LLM backend (Groq, ChatGPT, etc.) implements AIProvider.
 */

import axios, { AxiosError } from 'axios';
import { logger, getAIProviderConfig } from '../config';
import type { AIResponse, ConversationContext } from '../types';

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider: string;
  /** GPT-5+ uses max_completion_tokens instead of max_tokens */
  isGPT5: boolean;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface RawAIResult {
  text: string;
  toolCalls: Array<{ name: string; args: Record<string, any> }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  model?: string;
}

// ─── Tool Call Parser ──────────────────────────────────────────────────────

const TOOL_PATTERN = /\[(?:TOOL|TODOL|TOOl|tool):(\w+):(\{[^]*?\})\]/gi;

/**
 * Parse [TOOL:name:{args}] patterns from AI text response.
 * Deduplicates identical calls. Attempts JSON recovery on malformed args.
 */
export function parseToolCalls(message: string): { text: string; toolCalls: Array<{ name: string; args: Record<string, any> }> } {
  const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset lastIndex because of the g flag
  TOOL_PATTERN.lastIndex = 0;

  while ((match = TOOL_PATTERN.exec(message)) !== null) {
    const [, toolName, argsJson] = match;
    const parsed = tryParseToolArgs(toolName, argsJson);
    if (parsed) {
      const key = `${toolName}:${JSON.stringify(parsed)}`;
      if (!seen.has(key)) {
        seen.add(key);
        toolCalls.push({ name: toolName, args: parsed });
      }
    }
  }

  // Clean text: remove tool patterns, raw JSON results, "un momento" filler
  let cleanText = message.replace(TOOL_PATTERN, '').trim();
  cleanText = cleanText.replace(/\[(?:TOOL|TODOL|TOOl|tool):\s*\w+[^\]]*\]/gi, '').trim();
  cleanText = cleanText.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\}(?=\n\n|$|\[|¡|[A-Z])/gi, '').trim();
  cleanText = cleanText.replace(/^\s*\{\s*"success":\s*(true|false)[\s\S]*?\}\s*$/gm, '').trim();
  cleanText = cleanText.replace(/¡?Un momento,?\s*por favor!?\s*[🔄⏳]?\s*(Estoy verificando|voy a verificar|verificando)[^\n]*\n*/gi, '').trim();
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, toolCalls };
}

function tryParseToolArgs(toolName: string, argsJson: string): Record<string, any> | null {
  try {
    return JSON.parse(argsJson);
  } catch {
    // Attempt recovery of malformed JSON
    try {
      const fixed = argsJson
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/'/g, '"')
        .replace(/(\w+)\s*:/g, '"$1":')
        .replace(/""+/g, '"');
      const args = JSON.parse(fixed);
      logger.info({ tool: toolName }, 'Recovered malformed JSON in tool call');
      return args;
    } catch {
      logger.warn({ tool: toolName, argsJson: argsJson.substring(0, 200) }, 'Error parsing tool args (unrecoverable)');
      return null;
    }
  }
}

// ─── Provider Implementation ───────────────────────────────────────────────

/**
 * Call the configured AI provider (Groq or ChatGPT).
 * Returns parsed text + tool calls ready for pipeline processing.
 */
export async function callAIProvider(messages: ChatMessage[]): Promise<RawAIResult> {
  const config = getAIProviderConfig();
  const options = buildProviderOptions(config);

  logger.debug({ provider: options.provider, model: options.model, messagesCount: messages.length }, 'Calling AI provider');

  const contextSize = JSON.stringify(messages).length;
  logger.info({ messagesCount: messages.length, contextSizeBytes: contextSize }, 'Sending context to AI');

  try {
    // Build request body
    const tokenParam = options.isGPT5
      ? { max_completion_tokens: 3000 }
      : { max_tokens: options.maxTokens };
    const tempParam = options.isGPT5
      ? {}
      : { temperature: options.temperature };

    const response = await axios.post(
      options.apiUrl,
      {
        model: options.model,
        messages,
        ...tokenParam,
        ...tempParam,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: options.timeoutMs,
      },
    );

    const aiMessage: string = response.data.choices[0]?.message?.content || '';
    const finishReason = response.data.choices[0]?.finish_reason;
    const usage = response.data.usage;

    logger.info({
      responseLength: aiMessage.length,
      finishReason,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      model: response.data.model,
      messagePreview: aiMessage.substring(0, 200) || '(VACÍO)',
    }, 'AI response received');

    if (!aiMessage || aiMessage.trim().length === 0) {
      logger.warn({
        fullResponse: JSON.stringify(response.data).substring(0, 1000),
        finishReason,
        choices: response.data.choices?.length || 0,
      }, 'AI returned empty response');
    }

    const { text, toolCalls } = parseToolCalls(aiMessage);

    return {
      text,
      toolCalls,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
      finishReason,
      model: response.data.model,
    };
  } catch (error: any) {
    const axiosErr = error as AxiosError;
    logger.error({
      provider: options.provider,
      error: axiosErr.response?.data || error.message,
    }, 'AI provider error');
    throw error;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildProviderOptions(config: ReturnType<typeof getAIProviderConfig>): AIProviderOptions {
  return {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
    provider: config.provider,
    isGPT5: config.isGPT5,
    maxTokens: 1200,
    temperature: 0, // Deterministic — no hallucinations
    timeoutMs: 60_000,
  };
}

/**
 * Build the full messages array for a single AI call.
 * Combines system prompt + the last N conversation messages.
 */
export function buildChatMessages(
  systemPrompt: string,
  conversationMessages: ChatMessage[],
  maxHistory: number = 15,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...conversationMessages.slice(-maxHistory),
  ];
}
