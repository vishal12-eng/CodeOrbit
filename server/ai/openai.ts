import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
}

export interface CodeEditRequest {
  instruction: string;
  code: string;
  language: string;
  context?: string;
}

export interface BuilderPlan {
  steps: {
    id: string;
    description: string;
    files: string[];
    action: "create" | "modify" | "delete";
  }[];
  summary: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  const allMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: allMessages,
    max_completion_tokens: 4096,
  });

  return {
    content: response.choices[0].message.content || "",
    model: "gpt-5",
  };
}

export async function generateCode(
  prompt: string,
  language: string,
  context?: string
): Promise<string> {
  const systemPrompt = `You are an expert programmer. Generate clean, efficient, and well-documented ${language} code based on the user's request. Only output the code, no explanations unless specifically asked.${context ? `\n\nProject context:\n${context}` : ""}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 8192,
  });

  return response.choices[0].message.content || "";
}

export async function editCode(request: CodeEditRequest): Promise<string> {
  const systemPrompt = `You are an expert code editor. Modify the provided ${request.language} code according to the instruction. Only output the modified code, no explanations.${request.context ? `\n\nProject context:\n${request.context}` : ""}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Instruction: ${request.instruction}\n\nCode to modify:\n\`\`\`${request.language}\n${request.code}\n\`\`\``,
      },
    ],
    max_completion_tokens: 8192,
  });

  const content = response.choices[0].message.content || "";
  const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : content;
}

export async function explainCode(code: string, language: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "You are a helpful programming tutor. Explain code clearly and concisely.",
      },
      {
        role: "user",
        content: `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ],
    max_completion_tokens: 2048,
  });

  return response.choices[0].message.content || "";
}

export async function generateBuilderPlan(
  prompt: string,
  projectStructure: string
): Promise<BuilderPlan> {
  const systemPrompt = `You are an AI development assistant. Create a detailed plan for implementing the user's request across the project.

Current project structure:
${projectStructure}

Respond with a JSON object in this exact format:
{
  "steps": [
    {
      "id": "step-1",
      "description": "Description of what this step does",
      "files": ["path/to/file.js"],
      "action": "create" | "modify" | "delete"
    }
  ],
  "summary": "Brief summary of the overall plan"
}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function generateCommitMessage(diff: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content:
          "Generate a concise, conventional commit message for the given diff. Use the format: type(scope): description. Keep it under 72 characters.",
      },
      { role: "user", content: `Generate a commit message for:\n${diff}` },
    ],
    max_completion_tokens: 100,
  });

  return response.choices[0].message.content || "chore: update code";
}

export async function analyzeImage(base64Image: string, prompt: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0].message.content || "";
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const file = new File([audioBuffer], "audio.webm", { type: "audio/webm" });
  
  const transcription = await getOpenAI().audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text;
}

export async function debugCode(
  code: string,
  error: string,
  language: string
): Promise<{ explanation: string; fix: string }> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a debugging expert. Analyze the error and provide a fix. Respond with JSON: { "explanation": "...", "fix": "corrected code" }`,
      },
      {
        role: "user",
        content: `Language: ${language}\n\nCode:\n\`\`\`\n${code}\n\`\`\`\n\nError:\n${error}`,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  return JSON.parse(response.choices[0].message.content || '{"explanation":"","fix":""}');
}

export async function generateTests(code: string, language: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a testing expert. Generate comprehensive unit tests for the provided code. Use appropriate testing frameworks for ${language}.`,
      },
      {
        role: "user",
        content: `Generate tests for:\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0].message.content || "";
}

export async function generateDocs(code: string, language: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a documentation expert. Generate clear, comprehensive documentation for the provided code including JSDoc/docstrings as appropriate for ${language}.`,
      },
      {
        role: "user",
        content: `Document this code:\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0].message.content || "";
}

export type ImageSize = "1024x1024" | "1792x1024" | "1024x1792";
export type ImageStyle = "vivid" | "natural";

export interface GenerateImageRequest {
  prompt: string;
  size?: ImageSize;
  style?: ImageStyle;
}

export interface GenerateImageResponse {
  url: string;
  revisedPrompt?: string;
}

export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
  const response = await getOpenAI().images.generate({
    model: "dall-e-3",
    prompt: request.prompt,
    n: 1,
    size: request.size || "1024x1024",
    style: request.style || "vivid",
  });

  const imageData = response.data?.[0];
  if (!imageData?.url) {
    throw new Error("No image URL returned from DALL-E");
  }

  return {
    url: imageData.url,
    revisedPrompt: imageData.revised_prompt,
  };
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface GenerateAudioRequest {
  text: string;
  voice?: TTSVoice;
}

export interface GenerateAudioResponse {
  audio: string;
  format: string;
}

export async function generateAudio(request: GenerateAudioRequest): Promise<GenerateAudioResponse> {
  const response = await getOpenAI().audio.speech.create({
    model: "tts-1",
    voice: request.voice || "alloy",
    input: request.text,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Audio = buffer.toString("base64");

  return {
    audio: base64Audio,
    format: "mp3",
  };
}
