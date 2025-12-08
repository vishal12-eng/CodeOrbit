import { useState, useRef } from "react";
import {
  Image,
  Volume2,
  Loader2,
  Download,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type ImageSize = "1024x1024" | "1792x1024" | "1024x1792";
type ImageStyle = "vivid" | "natural";
type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

interface GeneratedAudio {
  audio: string;
  format: string;
}

export default function ImageAudioGenerator() {
  const [activeTab, setActiveTab] = useState<"image" | "audio">("image");
  
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024");
  const [imageStyle, setImageStyle] = useState<ImageStyle>("vivid");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [audioText, setAudioText] = useState("");
  const [audioVoice, setAudioVoice] = useState<TTSVoice>("alloy");
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    
    setIsGeneratingImage(true);
    setImageError(null);
    setGeneratedImage(null);

    try {
      const response = await apiRequest("POST", "/api/ai/generate-image", {
        prompt: imagePrompt,
        size: imageSize,
        style: imageStyle,
      });
      const data = await response.json();
      setGeneratedImage(data);
    } catch (error: any) {
      setImageError(error.message || "Failed to generate image");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!audioText.trim()) return;
    
    setIsGeneratingAudio(true);
    setAudioError(null);
    setGeneratedAudio(null);

    try {
      const response = await apiRequest("POST", "/api/ai/generate-audio", {
        text: audioText,
        voice: audioVoice,
      });
      const data = await response.json();
      setGeneratedAudio(data);
    } catch (error: any) {
      setAudioError(error.message || "Failed to generate audio");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage?.url) return;
    
    try {
      const response = await fetch(generatedImage.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  const handleDownloadAudio = () => {
    if (!generatedAudio?.audio) return;
    
    const byteCharacters = atob(generatedAudio.audio);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-audio-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyImageUrl = async () => {
    if (!generatedImage?.url) return;
    
    await navigator.clipboard.writeText(generatedImage.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAudioDataUrl = () => {
    if (!generatedAudio?.audio) return "";
    return `data:audio/mp3;base64,${generatedAudio.audio}`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {activeTab === "image" ? (
            <Image className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          AI Media Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "image" | "audio")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="image" className="gap-2" data-testid="tab-image">
              <Image className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2" data-testid="tab-audio">
              <Volume2 className="h-4 w-4" />
              Audio (TTS)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4 mt-0">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="image-prompt">Prompt</Label>
                <Textarea
                  id="image-prompt"
                  placeholder="Describe the image you want to generate..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="input-image-prompt"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="image-size">Size</Label>
                  <Select value={imageSize} onValueChange={(v) => setImageSize(v as ImageSize)}>
                    <SelectTrigger id="image-size" data-testid="select-image-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">Square (1024x1024)</SelectItem>
                      <SelectItem value="1792x1024">Landscape (1792x1024)</SelectItem>
                      <SelectItem value="1024x1792">Portrait (1024x1792)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image-style">Style</Label>
                  <Select value={imageStyle} onValueChange={(v) => setImageStyle(v as ImageStyle)}>
                    <SelectTrigger id="image-style" data-testid="select-image-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vivid">Vivid</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleGenerateImage}
                disabled={!imagePrompt.trim() || isGeneratingImage}
                className="w-full"
                data-testid="button-generate-image"
              >
                {isGeneratingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Image className="h-4 w-4 mr-2" />
                )}
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </Button>

              {imageError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-image-error">
                  {imageError}
                </div>
              )}

              {generatedImage && (
                <div className="space-y-3">
                  <div className="relative rounded-md overflow-hidden border">
                    <img
                      src={generatedImage.url}
                      alt="Generated"
                      className="w-full h-auto"
                      data-testid="img-generated"
                    />
                  </div>
                  
                  {generatedImage.revisedPrompt && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Revised Prompt</Label>
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md" data-testid="text-revised-prompt">
                        {generatedImage.revisedPrompt}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadImage}
                      className="flex-1"
                      data-testid="button-download-image"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyImageUrl}
                      className="flex-1"
                      data-testid="button-copy-url"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied ? "Copied" : "Copy URL"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      data-testid="button-regenerate-image"
                    >
                      <RefreshCw className={cn("h-4 w-4", isGeneratingImage && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4 mt-0">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="audio-text">Text to Convert</Label>
                <Textarea
                  id="audio-text"
                  placeholder="Enter text to convert to speech..."
                  value={audioText}
                  onChange={(e) => setAudioText(e.target.value)}
                  className="min-h-[80px] resize-none"
                  data-testid="input-audio-text"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio-voice">Voice</Label>
                <Select value={audioVoice} onValueChange={(v) => setAudioVoice(v as TTSVoice)}>
                  <SelectTrigger id="audio-voice" data-testid="select-audio-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                    <SelectItem value="echo">Echo (Male)</SelectItem>
                    <SelectItem value="fable">Fable (British)</SelectItem>
                    <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                    <SelectItem value="nova">Nova (Female)</SelectItem>
                    <SelectItem value="shimmer">Shimmer (Soft Female)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerateAudio}
                disabled={!audioText.trim() || isGeneratingAudio}
                className="w-full"
                data-testid="button-generate-audio"
              >
                {isGeneratingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-2" />
                )}
                {isGeneratingAudio ? "Generating..." : "Generate Audio"}
              </Button>

              {audioError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-audio-error">
                  {audioError}
                </div>
              )}

              {generatedAudio && (
                <div className="space-y-3">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Generated Audio</span>
                      <Badge variant="secondary">
                        {generatedAudio.format.toUpperCase()}
                      </Badge>
                    </div>
                    <audio
                      ref={audioRef}
                      controls
                      className="w-full"
                      src={getAudioDataUrl()}
                      data-testid="audio-player"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAudio}
                      className="flex-1"
                      data-testid="button-download-audio"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download MP3
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateAudio}
                      disabled={isGeneratingAudio}
                      data-testid="button-regenerate-audio"
                    >
                      <RefreshCw className={cn("h-4 w-4", isGeneratingAudio && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
