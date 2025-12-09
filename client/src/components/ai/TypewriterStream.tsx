import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TypewriterStreamProps {
  tokens: string[];
  speed?: number;
  showCursor?: boolean;
  onComplete?: () => void;
  className?: string;
}

export function TypewriterStream({
  tokens,
  speed = 20,
  showCursor = true,
  onComplete,
  className,
}: TypewriterStreamProps) {
  const [displayedTokens, setDisplayedTokens] = useState<string[]>([]);
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTokenIndex < tokens.length) {
      const timeout = setTimeout(() => {
        setDisplayedTokens((prev) => [...prev, tokens[currentTokenIndex]]);
        setCurrentTokenIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (currentTokenIndex === tokens.length && tokens.length > 0) {
      onComplete?.();
    }
  }, [currentTokenIndex, tokens, speed, onComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedTokens]);

  const isComplete = currentTokenIndex >= tokens.length;

  return (
    <div
      ref={containerRef}
      className={cn("whitespace-pre-wrap break-words", className)}
      data-testid="typewriter-stream"
    >
      {displayedTokens.join("")}
      {showCursor && !isComplete && (
        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  className?: string;
}

export function StreamingText({
  text,
  isStreaming = false,
  speed = 5,
  className,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text.length > prevTextRef.current.length) {
      const newChars = text.slice(prevTextRef.current.length);
      
      if (isStreaming) {
        let charIndex = 0;
        const interval = setInterval(() => {
          if (charIndex < newChars.length) {
            setDisplayedText((prev) => prev + newChars[charIndex]);
            charIndex++;
          } else {
            clearInterval(interval);
          }
        }, speed);

        return () => clearInterval(interval);
      } else {
        setDisplayedText(text);
      }
    }
    prevTextRef.current = text;
  }, [text, isStreaming, speed]);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      prevTextRef.current = text;
    }
  }, [isStreaming, text]);

  return (
    <span className={className}>
      {displayedText}
      {isStreaming && displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
      )}
    </span>
  );
}

export function useStreamingText() {
  const [content, setContent] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(() => {
    setContent("");
    setTokens([]);
    setIsStreaming(true);
  }, []);

  const addToken = useCallback((token: string) => {
    setTokens((prev) => [...prev, token]);
    setContent((prev) => prev + token);
  }, []);

  const endStream = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setContent("");
    setTokens([]);
    setIsStreaming(false);
  }, []);

  return {
    content,
    tokens,
    isStreaming,
    startStream,
    addToken,
    endStream,
    reset,
  };
}

export default TypewriterStream;
