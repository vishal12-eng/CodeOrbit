import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type ModelType = "openai" | "anthropic" | "gemini" | "grok";

export type ModelId = 
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-3-5-sonnet"
  | "claude-3-opus"
  | "gemini-pro"
  | "gemini-1.5-pro"
  | "gemini-2.5-flash"
  | "grok-2"
  | "grok-2-vision";

export interface ModelConfig {
  id: ModelId;
  name: string;
  type: ModelType;
  contextWindow: number;
  maxOutputTokens: number;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  { id: "gpt-4o", name: "GPT-4o", type: "openai", contextWindow: 128000, maxOutputTokens: 16384 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", type: "openai", contextWindow: 128000, maxOutputTokens: 16384 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", type: "openai", contextWindow: 128000, maxOutputTokens: 4096 },
  { id: "gpt-4", name: "GPT-4", type: "openai", contextWindow: 8192, maxOutputTokens: 4096 },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", type: "anthropic", contextWindow: 200000, maxOutputTokens: 8192 },
  { id: "claude-3-opus", name: "Claude 3 Opus", type: "anthropic", contextWindow: 200000, maxOutputTokens: 4096 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", type: "gemini", contextWindow: 1000000, maxOutputTokens: 8192 },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", type: "gemini", contextWindow: 1000000, maxOutputTokens: 8192 },
  { id: "gemini-pro", name: "Gemini Pro", type: "gemini", contextWindow: 32000, maxOutputTokens: 2048 },
  { id: "grok-2", name: "Grok 2", type: "grok", contextWindow: 131072, maxOutputTokens: 4096 },
  { id: "grok-2-vision", name: "Grok 2 Vision", type: "grok", contextWindow: 8192, maxOutputTokens: 4096 },
];

export function getModelConfig(modelId: ModelId): ModelConfig {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!model) {
    return AVAILABLE_MODELS[0];
  }
  return model;
}

export function getModelType(modelId: ModelId): ModelType {
  return getModelConfig(modelId).type;
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenAI | null = null;
let grokClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your secrets.");
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Please add GEMINI_API_KEY to your secrets.");
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function getGrokClient(): OpenAI {
  if (!grokClient) {
    if (!process.env.XAI_API_KEY) {
      throw new Error("xAI API key not configured. Please add XAI_API_KEY to your secrets.");
    }
    grokClient = new OpenAI({ 
      baseURL: "https://api.x.ai/v1", 
      apiKey: process.env.XAI_API_KEY 
    });
  }
  return grokClient;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModelResponse {
  content: string;
  model: string;
  tokensUsed?: number;
}

function getOpenAIModelName(modelId: ModelId): string {
  const mapping: Record<string, string> = {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-4": "gpt-4",
  };
  return mapping[modelId] || "gpt-4o";
}

function getAnthropicModelName(modelId: ModelId): string {
  const mapping: Record<string, string> = {
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3-opus": "claude-3-opus-20240229",
  };
  return mapping[modelId] || "claude-3-5-sonnet-20241022";
}

function getGeminiModelName(modelId: ModelId): string {
  const mapping: Record<string, string> = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-1.5-pro",
    "gemini-pro": "gemini-1.5-flash",
  };
  return mapping[modelId] || "gemini-2.5-flash";
}

function getGrokModelName(modelId: ModelId): string {
  const mapping: Record<string, string> = {
    "grok-2": "grok-2-1212",
    "grok-2-vision": "grok-2-vision-1212",
  };
  return mapping[modelId] || "grok-2-1212";
}

async function chatWithOpenAI(
  messages: ChatMessage[],
  modelId: ModelId,
  maxTokens: number = 4096
): Promise<ModelResponse> {
  const client = getOpenAIClient();
  const modelName = getOpenAIModelName(modelId);
  
  const response = await client.chat.completions.create({
    model: modelName,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
  });

  return {
    content: response.choices[0].message.content || "",
    model: modelName,
    tokensUsed: response.usage?.total_tokens,
  };
}

async function chatWithAnthropic(
  messages: ChatMessage[],
  modelId: ModelId,
  maxTokens: number = 4096
): Promise<ModelResponse> {
  const client = getAnthropicClient();
  const modelName = getAnthropicModelName(modelId);
  
  const systemMessage = messages.find(m => m.role === "system");
  const nonSystemMessages = messages.filter(m => m.role !== "system");
  
  const response = await client.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    system: systemMessage?.content || undefined,
    messages: nonSystemMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const textContent = response.content.find(c => c.type === "text");
  return {
    content: textContent?.type === "text" ? textContent.text : "",
    model: modelName,
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
  };
}

async function chatWithGemini(
  messages: ChatMessage[],
  modelId: ModelId,
  maxTokens: number = 4096
): Promise<ModelResponse> {
  const client = getGeminiClient();
  const modelName = getGeminiModelName(modelId);
  
  const systemMessage = messages.find(m => m.role === "system");
  const nonSystemMessages = messages.filter(m => m.role !== "system");
  
  const contents = nonSystemMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await client.models.generateContent({
    model: modelName,
    contents: contents,
    config: {
      systemInstruction: systemMessage?.content || undefined,
      maxOutputTokens: maxTokens,
    },
  });

  return {
    content: response.text || "",
    model: modelName,
    tokensUsed: response.usageMetadata?.totalTokenCount,
  };
}

async function chatWithGrok(
  messages: ChatMessage[],
  modelId: ModelId,
  maxTokens: number = 4096
): Promise<ModelResponse> {
  const client = getGrokClient();
  const modelName = getGrokModelName(modelId);
  
  const response = await client.chat.completions.create({
    model: modelName,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
  });

  return {
    content: response.choices[0].message.content || "",
    model: modelName,
    tokensUsed: response.usage?.total_tokens,
  };
}

export async function chatWithModel(
  messages: ChatMessage[],
  modelId: ModelId = "gpt-4o",
  maxTokens?: number
): Promise<ModelResponse> {
  const modelConfig = getModelConfig(modelId);
  const tokens = maxTokens || modelConfig.maxOutputTokens;

  try {
    switch (modelConfig.type) {
      case "openai":
        return await chatWithOpenAI(messages, modelId, tokens);
      case "anthropic":
        return await chatWithAnthropic(messages, modelId, tokens);
      case "gemini":
        return await chatWithGemini(messages, modelId, tokens);
      case "grok":
        return await chatWithGrok(messages, modelId, tokens);
      default:
        return await chatWithOpenAI(messages, "gpt-4o", tokens);
    }
  } catch (error: any) {
    if (modelConfig.type !== "openai" && process.env.OPENAI_API_KEY) {
      console.warn(`${modelConfig.type} failed, falling back to OpenAI:`, error.message);
      return await chatWithOpenAI(messages, "gpt-4o", tokens);
    }
    throw error;
  }
}

export async function generateWithModel(
  prompt: string,
  systemPrompt: string,
  modelId: ModelId = "gpt-4o",
  maxTokens?: number
): Promise<ModelResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];
  return chatWithModel(messages, modelId, maxTokens);
}

export async function generateJSONWithModel(
  prompt: string,
  systemPrompt: string,
  modelId: ModelId = "gpt-4o"
): Promise<any> {
  const modelConfig = getModelConfig(modelId);
  
  if (modelConfig.type === "openai") {
    const client = getOpenAIClient();
    const modelName = getOpenAIModelName(modelId);
    
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: modelConfig.maxOutputTokens,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } else if (modelConfig.type === "grok") {
    const client = getGrokClient();
    const modelName = getGrokModelName(modelId);
    
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt + "\n\nRespond ONLY with valid JSON, no additional text." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: modelConfig.maxOutputTokens,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } else if (modelConfig.type === "gemini") {
    const client = getGeminiClient();
    const modelName = getGeminiModelName(modelId);
    
    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt + "\n\nRespond ONLY with valid JSON, no additional text.",
        responseMimeType: "application/json",
      },
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    }
    return {};
  } else {
    const response = await chatWithModel(
      [
        { role: "system", content: systemPrompt + "\n\nRespond ONLY with valid JSON, no additional text." },
        { role: "user", content: prompt },
      ],
      modelId
    );
    
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response.content);
  }
}

export function isModelAvailable(modelId: ModelId): boolean {
  const modelConfig = getModelConfig(modelId);
  
  switch (modelConfig.type) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    case "grok":
      return !!process.env.XAI_API_KEY;
    default:
      return false;
  }
}

export function getAvailableModels(): ModelConfig[] {
  return AVAILABLE_MODELS.filter(model => {
    switch (model.type) {
      case "openai":
        return !!process.env.OPENAI_API_KEY;
      case "anthropic":
        return !!process.env.ANTHROPIC_API_KEY;
      case "gemini":
        return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      case "grok":
        return !!process.env.XAI_API_KEY;
      default:
        return false;
    }
  });
}
