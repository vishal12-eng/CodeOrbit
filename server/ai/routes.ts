import { Router, Request, Response } from "express";
import {
  chatCompletion,
  generateCode,
  editCode,
  explainCode,
  generateBuilderPlan,
  generateCommitMessage,
  analyzeImage,
  transcribeAudio,
  debugCode,
  generateTests,
  generateDocs,
  ChatMessage,
} from "./openai";

const router = Router();

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { messages, systemPrompt } = req.body as {
      messages: ChatMessage[];
      systemPrompt?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: "Messages array required" });
    }

    const response = await chatCompletion(messages, systemPrompt);
    res.json(response);
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({ message: error.message || "AI request failed" });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, language, context } = req.body;

    if (!prompt || !language) {
      return res.status(400).json({ message: "Prompt and language required" });
    }

    const code = await generateCode(prompt, language, context);
    res.json({ code });
  } catch (error: any) {
    console.error("AI generate error:", error);
    res.status(500).json({ message: error.message || "Code generation failed" });
  }
});

router.post("/edit", async (req: Request, res: Response) => {
  try {
    const { instruction, code, language, context } = req.body;

    if (!instruction || !code || !language) {
      return res.status(400).json({ message: "Instruction, code, and language required" });
    }

    const editedCode = await editCode({ instruction, code, language, context });
    res.json({ code: editedCode });
  } catch (error: any) {
    console.error("AI edit error:", error);
    res.status(500).json({ message: error.message || "Code edit failed" });
  }
});

router.post("/explain", async (req: Request, res: Response) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    const explanation = await explainCode(code, language);
    res.json({ explanation });
  } catch (error: any) {
    console.error("AI explain error:", error);
    res.status(500).json({ message: error.message || "Code explanation failed" });
  }
});

router.post("/builder/plan", async (req: Request, res: Response) => {
  try {
    const { prompt, projectStructure } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt required" });
    }

    const plan = await generateBuilderPlan(prompt, projectStructure || "");
    res.json(plan);
  } catch (error: any) {
    console.error("AI builder plan error:", error);
    res.status(500).json({ message: error.message || "Plan generation failed" });
  }
});

router.post("/commit-message", async (req: Request, res: Response) => {
  try {
    const { diff } = req.body;

    if (!diff) {
      return res.status(400).json({ message: "Diff required" });
    }

    const message = await generateCommitMessage(diff);
    res.json({ message });
  } catch (error: any) {
    console.error("AI commit message error:", error);
    res.status(500).json({ message: error.message || "Commit message generation failed" });
  }
});

router.post("/analyze-image", async (req: Request, res: Response) => {
  try {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ message: "Image and prompt required" });
    }

    const analysis = await analyzeImage(image, prompt);
    res.json({ analysis });
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
    const { code, error, language } = req.body;

    if (!code || !error || !language) {
      return res.status(400).json({ message: "Code, error, and language required" });
    }

    const result = await debugCode(code, error, language);
    res.json(result);
  } catch (error: any) {
    console.error("AI debug error:", error);
    res.status(500).json({ message: error.message || "Debug analysis failed" });
  }
});

router.post("/generate-tests", async (req: Request, res: Response) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    const tests = await generateTests(code, language);
    res.json({ tests });
  } catch (error: any) {
    console.error("AI generate tests error:", error);
    res.status(500).json({ message: error.message || "Test generation failed" });
  }
});

router.post("/generate-docs", async (req: Request, res: Response) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "Code and language required" });
    }

    const docs = await generateDocs(code, language);
    res.json({ docs });
  } catch (error: any) {
    console.error("AI generate docs error:", error);
    res.status(500).json({ message: error.message || "Documentation generation failed" });
  }
});

export default router;
