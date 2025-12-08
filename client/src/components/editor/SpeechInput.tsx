import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor;
    webkitSpeechRecognition: ISpeechRecognitionConstructor;
  }
}

interface SpeechInputProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onListeningChange?: (isListening: boolean) => void;
  onAudioRecorded?: (audioBase64: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  showStatus?: boolean;
  disabled?: boolean;
}

export default function SpeechInput({
  onTranscript,
  onListeningChange,
  onAudioRecorded,
  onError,
  language = "en-US",
  continuous = true,
  interimResults = true,
  className,
  size = "icon",
  variant = "ghost",
  showStatus = false,
  disabled = false,
}: SpeechInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setUseFallback(true);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      onListeningChange?.(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      onListeningChange?.(false);
      
      if (!isManuallyStoppedRef.current && continuous) {
        try {
          recognition.start();
        } catch {
        }
      }
      isManuallyStoppedRef.current = false;
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        return;
      }
      if (event.error === "aborted") {
        return;
      }
      
      const errorMessage = getErrorMessage(event.error);
      setError(errorMessage);
      onError?.(errorMessage);
      setIsListening(false);
      onListeningChange?.(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript.trim(), true);
        setInterimTranscript("");
      } else if (interimText) {
        setInterimTranscript(interimText);
        onTranscript(interimText.trim(), false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        recognitionRef.current.abort();
      }
    };
  }, [language, continuous, interimResults, onTranscript, onListeningChange, onError]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case "not-allowed":
        return "Microphone access denied. Please allow microphone access.";
      case "network":
        return "Network error. Please check your connection.";
      case "audio-capture":
        return "No microphone found. Please connect a microphone.";
      case "service-not-allowed":
        return "Speech service not allowed.";
      default:
        return `Speech recognition error: ${error}`;
    }
  };

  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessingAudio(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(",")[1];
          if (onAudioRecorded) {
            onAudioRecorded(base64);
          }
          setIsProcessingAudio(false);
        };
        reader.onerror = () => {
          const errorMessage = "Failed to process audio recording";
          setError(errorMessage);
          onError?.(errorMessage);
          setIsProcessingAudio(false);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
      onListeningChange?.(true);
    } catch (err) {
      const errorMessage = "Microphone access denied or unavailable";
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onAudioRecorded, onListeningChange, onError]);

  const stopFallbackRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      onListeningChange?.(false);
    }
  }, [onListeningChange]);

  const toggleListening = useCallback(() => {
    if (useFallback) {
      if (isListening) {
        stopFallbackRecording();
      } else {
        startFallbackRecording();
      }
      return;
    }

    if (!recognitionRef.current) return;

    if (isListening) {
      isManuallyStoppedRef.current = true;
      recognitionRef.current.stop();
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        const errorMessage = "Failed to start speech recognition";
        setError(errorMessage);
        onError?.(errorMessage);
      }
    }
  }, [isListening, useFallback, startFallbackRecording, stopFallbackRecording, onError]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={toggleListening}
            disabled={disabled}
            className={cn(
              "relative",
              isListening && "bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600"
            )}
            data-testid="button-speech-toggle"
          >
            {isListening ? (
              <>
                <Mic className="h-4 w-4 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? "Stop listening" : "Start voice input"}</p>
        </TooltipContent>
      </Tooltip>

      {showStatus && isListening && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Listening...
          </Badge>
          {interimTranscript && (
            <span className="text-xs text-muted-foreground italic max-w-[200px] truncate">
              {interimTranscript}
            </span>
          )}
        </div>
      )}

      {error && showStatus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function useSpeechRecognition(options?: {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);

  const { language = "en-US", continuous = true, interimResults = true } = options || {};

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!isManuallyStoppedRef.current && continuous) {
        try {
          recognition.start();
        } catch {
        }
      }
      isManuallyStoppedRef.current = false;
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error);
      }
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interimText += text;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + (prev ? " " : "") + finalTranscript.trim());
        setInterimTranscript("");
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        recognitionRef.current.abort();
      }
    };
  }, [language, continuous, interimResults]);

  const start = useCallback(() => {
    if (recognitionRef.current && isSupported) {
      setError(null);
      try {
        recognitionRef.current.start();
      } catch {
      }
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      isManuallyStoppedRef.current = true;
      recognitionRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    start,
    stop,
    reset,
  };
}
