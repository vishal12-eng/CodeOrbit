import { Router, Request, Response } from "express";
import {
  chatCompletion,
  generateCode,
  editCode,
  explainCode,
  generateCommitMessage,
  analyzeImage,
  transcribeAudio,
  debugCode,
  generateTests,
  generateDocs,
  generateImage,
  generateAudio,
  ChatMessage as OpenAIChatMessage,
  ImageSize,
  ImageStyle,
  TTSVoice,
} from "./openai";
import {
  chatWithModel,
  generateWithModel,
  getAvailableModels,
  streamWithModel,
  ModelId,
  AVAILABLE_MODELS,
  ChatMessage,
} from "./models";
import { createSSEWriter, simulateThinkingSteps } from "./events";
import {
  generateBuildPlan,
  executeBuildStep,
  executeBuildPlan,
  generateCodeEdit,
  BuildStep,
  ProjectFile,
} from "./builder";
import {
  generateFullApp,
  generateAppFromImage,
  enhanceExistingApp,
  PROJECT_TEMPLATES,
  ProjectType,
} from "./oneshot";
import { formatAIResponse } from "./formatResponse";
import { getSystemPromptForMode, BOLT_STYLE_SYSTEM_PROMPT } from "./systemPrompts";

const router = Router();

router.get("/models", async (req: Request, res: Response) => {
  try {
    const available = getAvailableModels();
    const allModels = AVAILABLE_MODELS.map(model => ({
      ...model,
      available: available.some(m => m.id === model.id),
    }));
    res.json({ models: allModels, available });
  } catch (error: any) {
    console.error("Get models error:", error);
    res.status(500).json({ message: error.message || "Failed to get models" });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { messages, systemPrompt, model } = req.body as {
      messages: ChatMessage[];
      systemPrompt?: string;
      model?: ModelId;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: "Messages array required" });
    }

    if (model) {
      const allMessages: ChatMessage[] = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;
      
      const response = await chatWithModel(allMessages, model);
      res.json(response);
    } else {
      const response = await chatCompletion(messages as OpenAIChatMessage[], systemPrompt);
      res.json(response);
    }
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({ message: error.message || "AI request failed" });
  }
});

router.post("/chat/structured", async (req: Request, res: Response) => {
  try {
    const { messages, context, model, mode } = req.body as {
      messages: ChatMessage[];
      context?: string;
      model?: ModelId;
      mode?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: "Messages array required" });
    }

    const systemPrompt = mode === "bolt" || mode === "builder" 
      ? getSystemPromptForMode("bolt", context)
      : getSystemPromptForMode(mode || "chat", context);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const startTime = Date.now();
    const response = model 
      ? await chatWithModel(allMessages, model)
      : await chatCompletion(allMessages as OpenAIChatMessage[]);

    const processingTime = Date.now() - startTime;

    const structuredResponse = formatAIResponse(response.content, response.model);
    structuredResponse.metadata.processingTime = processingTime;

    res.json({
      ...structuredResponse,
      rawContent: response.content,
      model: response.model,
    });
  } catch (error: any) {
    console.error("AI structured chat error:", error);
    res.status(500).json({ message: error.message || "AI request failed" });
  }
});

router.post("/chat/stream", async (req: Request, res: Response) => {
  const writer = createSSEWriter(res);
  
  try {
    const { messages, context, model, mode } = req.body as {
      messages: ChatMessage[];
      context?: string;
      model?: ModelId;
      mode?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      writer.error("Messages array required", "VALIDATION_ERROR");
      writer.end();
      return;
    }

    writer.connected();

    const thinkingSteps = [
      "Analyzing your request...",
      "Processing context and files...",
      "Generating response...",
    ];
    
    writer.thinkingStart(thinkingSteps[0]);

    const systemPrompt = mode === "bolt" || mode === "builder"
      ? getSystemPromptForMode("bolt", context)
      : getSystemPromptForMode(mode || "chat", context);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    await simulateThinkingSteps(writer, thinkingSteps);

    const selectedModel: ModelId = model || "gpt-4o";
    let currentSectionId = "main";
    let accumulatedContent = "";

    const response = await streamWithModel(
      allMessages,
      selectedModel,
      (token: string, done: boolean) => {
        if (writer.closed) return;
        
        if (!done && token) {
          accumulatedContent += token;
          writer.streamToken(token, currentSectionId, "text");
          
          if (token.includes("## ") || token.includes("# ")) {
            const sectionMatch = accumulatedContent.match(/##?\s+([^\n]+)/g);
            if (sectionMatch) {
              const lastHeader = sectionMatch[sectionMatch.length - 1];
              currentSectionId = lastHeader.replace(/##?\s+/, "").toLowerCase().replace(/\s+/g, "-");
            }
          }
        }
      }
    );

    writer.streamSection({ 
      id: "response",
      type: "text",
      content: accumulatedContent,
      title: "Response"
    }, true);

    writer.complete(response.model, response.tokensUsed);
    writer.end();

  } catch (error: any) {
    console.error("AI stream error:", error);
    writer.error(error.message || "Stream failed", "STREAM_ERROR");
    writer.end();
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, language, context, model } = req.body;

    if (!prompt || !language) {
      return res.status(400).json({ message: "Prompt and language required" });
    }

    if (model) {
      const systemPrompt = `You are an expert ${language} developer. Generate clean, efficient, and well-documented code.${context ? `\n\nContext:\n${context}` : ""}`;
      const response = await generateWithModel(prompt, systemPrompt, model);
      res.json({ code: response.content, model: response.model });
    } else {
      const code = await generateCode(prompt, language, context);
      res.json({ code });
    }
  } catch (error: any) {
    console.error("AI generate error:", error);
    res.status(500).json({ message: error.message || "Code generation failed" });
  }
});

router.post("/edit", async (req: Request, res: Response) => {
  try {
    const { instruction, code, language, context, model } = req.body;

    if (!instruction || !code || !language) {
      return res.status(400).json({ message: "Instruction, code, and language required" });
    }

    if (model) {
      const result = await generateCodeEdit(instruction, code, language, context, model);
      res.json({ 
        code: result.editedCode, 
        diff: result.diff, 
        explanation: result.explanation,
        model 
      });
    } else {
      const editedCode = await editCode({ instruction, code, language, context });
      res.json({ code: editedCode });
    }
  } catch (error: any) {
    console.error("AI edit error:", error);
    res.status(500).json({ message: error.message || "Code edit failed" });
  }
});

router.post("/explain", async (req: Request, res: Response) => {
  try {
    const { code, language, model } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    if (model) {
      const systemPrompt = `You are an expert ${language} developer. Explain the following code clearly and concisely.`;
      const response = await generateWithModel(`Explain this code:\n\`\`\`${language}\n${code}\n\`\`\``, systemPrompt, model);
      res.json({ explanation: response.content, model: response.model });
    } else {
      const explanation = await explainCode(code, language);
      res.json({ explanation });
    }
  } catch (error: any) {
    console.error("AI explain error:", error);
    res.status(500).json({ message: error.message || "Code explanation failed" });
  }
});

router.post("/builder/plan", async (req: Request, res: Response) => {
  try {
    const { prompt, projectStructure, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
    }

    const plan = await generateBuildPlan(prompt, projectStructure || "", model || "gpt-4o");
    res.json(plan);
  } catch (error: any) {
    console.error("AI builder plan error:", error);
    res.status(500).json({ message: error.message || "Plan generation failed" });
  }
});

router.post("/builder/execute", async (req: Request, res: Response) => {
  try {
    const { step, projectFiles, buildContext, model } = req.body as {
      step: BuildStep;
      projectFiles: ProjectFile[];
      buildContext: string;
      model?: ModelId;
    };

    if (!step) {
      return res.status(400).json({ message: "Step required" });
    }

    const executedStep = await executeBuildStep(
      step,
      projectFiles || [],
      buildContext || "",
      model || "gpt-4o"
    );
    res.json(executedStep);
  } catch (error: any) {
    console.error("AI builder execute error:", error);
    res.status(500).json({ message: error.message || "Step execution failed" });
  }
});

router.post("/builder/execute-all", async (req: Request, res: Response) => {
  try {
    const { plan, projectFiles, model } = req.body;

    if (!plan || !plan.steps) {
      return res.status(400).json({ message: "Plan with steps required" });
    }

    const executedPlan = await executeBuildPlan(
      plan,
      projectFiles || [],
      model || "gpt-4o"
    );
    res.json(executedPlan);
  } catch (error: any) {
    console.error("AI builder execute-all error:", error);
    res.status(500).json({ message: error.message || "Plan execution failed" });
  }
});

router.post("/oneshot", async (req: Request, res: Response) => {
  try {
    const { prompt, projectType, model } = req.body as {
      prompt: string;
      projectType: ProjectType;
      model?: ModelId;
    };

    if (!prompt || !projectType) {
      return res.status(400).json({ message: "Prompt and project type required" });
    }

    const app = await generateFullApp(prompt, projectType, model || "gpt-4o");
    res.json(app);
  } catch (error: any) {
    console.error("AI oneshot error:", error);
    res.status(500).json({ message: error.message || "App generation failed" });
  }
});

router.post("/oneshot/from-image", async (req: Request, res: Response) => {
  try {
    const { image, prompt, projectType, model } = req.body;

    if (!image || !projectType) {
      return res.status(400).json({ message: "Image and project type required" });
    }

    const app = await generateAppFromImage(image, prompt || "", projectType, model || "gpt-4o");
    res.json(app);
  } catch (error: any) {
    console.error("AI oneshot from image error:", error);
    res.status(500).json({ message: error.message || "App generation from image failed" });
  }
});

router.post("/oneshot/enhance", async (req: Request, res: Response) => {
  try {
    const { existingFiles, enhancement, model } = req.body;

    if (!existingFiles || !enhancement) {
      return res.status(400).json({ message: "Existing files and enhancement required" });
    }

    const result = await enhanceExistingApp(existingFiles, enhancement, model || "gpt-4o");
    res.json(result);
  } catch (error: any) {
    console.error("AI oneshot enhance error:", error);
    res.status(500).json({ message: error.message || "Enhancement failed" });
  }
});

router.get("/oneshot/templates", async (req: Request, res: Response) => {
  try {
    res.json({ templates: PROJECT_TEMPLATES });
  } catch (error: any) {
    console.error("Get templates error:", error);
    res.status(500).json({ message: error.message || "Failed to get templates" });
  }
});

router.post("/commit-message", async (req: Request, res: Response) => {
  try {
    const { diff, model } = req.body;

    if (!diff) {
      return res.status(400).json({ message: "Diff required" });
    }

    if (model) {
      const systemPrompt = "You are a git commit message expert. Generate a concise, conventional commit message based on the diff. Format: type(scope): message";
      const response = await generateWithModel(diff, systemPrompt, model);
      res.json({ message: response.content, model: response.model });
    } else {
      const message = await generateCommitMessage(diff);
      res.json({ message });
    }
  } catch (error: any) {
    console.error("AI commit message error:", error);
    res.status(500).json({ message: error.message || "Commit message generation failed" });
  }
});

router.post("/analyze-image", async (req: Request, res: Response) => {
  try {
    const { image, prompt, model } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ message: "Image and prompt required" });
    }

    const analysis = await analyzeImage(image, prompt);
    res.json({ analysis, model: model || "gpt-4o" });
  } catch (error: any) {
    console.error("AI image analysis error:", error);
    res.status(500).json({ message: error.message || "Image analysis failed" });
  }
});

router.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ message: "Audio data required" });
    }

    const buffer = Buffer.from(audio, "base64");
    const text = await transcribeAudio(buffer);
    res.json({ text });
  } catch (error: any) {
    console.error("AI transcribe error:", error);
    res.status(500).json({ message: error.message || "Transcription failed" });
  }
});

router.post("/debug", async (req: Request, res: Response) => {
  try {
    const { code, error, language, model } = req.body;

    if (!code || !error || !language) {
      return res.status(400).json({ message: "Code, error, and language required" });
    }

    if (model) {
      const systemPrompt = `You are an expert ${language} debugger. Analyze the code and error, then provide a fix.
Respond with JSON: { "explanation": "what caused the error", "fix": "the corrected code" }`;
      const response = await generateWithModel(
        `Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nError: ${error}`,
        systemPrompt,
        model
      );
      try {
        const parsed = JSON.parse(response.content);
        res.json({ ...parsed, model: response.model });
      } catch {
        res.json({ explanation: response.content, fix: code, model: response.model });
      }
    } else {
      const result = await debugCode(code, error, language);
      res.json(result);
    }
  } catch (error: any) {
    console.error("AI debug error:", error);
    res.status(500).json({ message: error.message || "Debug analysis failed" });
  }
});

router.post("/generate-tests", async (req: Request, res: Response) => {
  try {
    const { code, language, model } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    if (model) {
      const systemPrompt = `You are an expert ${language} developer. Generate comprehensive unit tests for the provided code.`;
      const response = await generateWithModel(
        `Generate tests for:\n\`\`\`${language}\n${code}\n\`\`\``,
        systemPrompt,
        model
      );
      res.json({ tests: response.content, model: response.model });
    } else {
      const tests = await generateTests(code, language);
      res.json({ tests });
    }
  } catch (error: any) {
    console.error("AI generate tests error:", error);
    res.status(500).json({ message: error.message || "Test generation failed" });
  }
});

router.post("/generate-docs", async (req: Request, res: Response) => {
  try {
    const { code, language, model } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    if (model) {
      const systemPrompt = `You are a technical documentation expert. Generate comprehensive documentation for the provided ${language} code.`;
      const response = await generateWithModel(
        `Document this code:\n\`\`\`${language}\n${code}\n\`\`\``,
        systemPrompt,
        model
      );
      res.json({ docs: response.content, model: response.model });
    } else {
      const docs = await generateDocs(code, language);
      res.json({ docs });
    }
  } catch (error: any) {
    console.error("AI generate docs error:", error);
    res.status(500).json({ message: error.message || "Documentation generation failed" });
  }
});

router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { prompt, size, style } = req.body as {
      prompt: string;
      size?: ImageSize;
      style?: ImageStyle;
    };

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
    }

    const result = await generateImage({ prompt, size, style });
    res.json({
      url: result.url,
      revisedPrompt: result.revisedPrompt,
    });
  } catch (error: any) {
    console.error("AI generate image error:", error);
    res.status(500).json({ message: error.message || "Image generation failed" });
  }
});

router.post("/generate-audio", async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body as {
      text: string;
      voice?: TTSVoice;
    };

    if (!text) {
      return res.status(400).json({ message: "Text required" });
    }

    const result = await generateAudio({ text, voice });
    res.json({
      audio: result.audio,
      format: result.format,
    });
  } catch (error: any) {
    console.error("AI generate audio error:", error);
    res.status(500).json({ message: error.message || "Audio generation failed" });
  }
});

export default router;
