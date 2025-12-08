import { useState, useRef, useEffect } from "react";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WebPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl?: string;
  projectId: string;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const deviceSizes = {
  desktop: { width: "100%", height: "100%" },
  tablet: { width: "768px", height: "100%" },
  mobile: { width: "375px", height: "100%" },
};

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
type ZoomLevel = typeof ZOOM_LEVELS[number];

export default function WebPreview({ isOpen, onClose, previewUrl, projectId }: WebPreviewProps) {
  const [url, setUrl] = useState(previewUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(100);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  useEffect(() => {
    if (previewUrl) {
      setUrl(previewUrl);
    }
  }, [previewUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  const previewContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preview</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container { max-width: 500px; }
        h1 { font-size: 1.75rem; margin-bottom: 0.75rem; font-weight: 600; }
        p { font-size: 0.9rem; opacity: 0.7; margin-bottom: 1.5rem; line-height: 1.5; }
        .icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.5rem;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        }
        .icon svg { width: 32px; height: 32px; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-top: 1.5rem;
        }
        .feature {
          background: rgba(255,255,255,0.05);
          padding: 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .feature-icon { font-size: 1.25rem; margin-bottom: 0.25rem; }
        .feature-text { font-size: 0.7rem; opacity: 0.7; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <h1>Web Preview</h1>
        <p>Your application preview will appear here when you run your project.</p>
        <div class="features">
          <div class="feature">
            <div class="feature-icon">&#9889;</div>
            <div class="feature-text">Live Reload</div>
          </div>
          <div class="feature">
            <div class="feature-icon">&#128241;</div>
            <div class="feature-text">Responsive</div>
          </div>
          <div class="feature">
            <div class="feature-icon">&#128274;</div>
            <div class="feature-text">Secure</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Preview URL..."
          className="h-7 text-xs flex-1 min-w-0"
          data-testid="input-preview-url"
        />
        <div className="flex items-center gap-0.5 border-l border-border/50 pl-1.5 ml-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", deviceMode === "mobile" && "bg-muted")}
            onClick={() => setDeviceMode("mobile")}
            data-testid="button-device-mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", deviceMode === "tablet" && "bg-muted")}
            onClick={() => setDeviceMode("tablet")}
            data-testid="button-device-tablet"
          >
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", deviceMode === "desktop" && "bg-muted")}
            onClick={() => setDeviceMode("desktop")}
            data-testid="button-device-desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5 border-l border-border/50 pl-1.5 ml-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleZoomOut}
            disabled={zoomLevel === ZOOM_LEVELS[0]}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs min-w-[45px]"
                data-testid="button-zoom-level"
              >
                {zoomLevel}%
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {ZOOM_LEVELS.map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  className={cn(level === zoomLevel && "bg-muted")}
                  data-testid={`zoom-level-${level}`}
                >
                  {level}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleZoomIn}
            disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          {zoomLevel !== 100 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleResetZoom}
              data-testid="button-zoom-reset"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-0.5 border-l border-border/50 pl-1.5 ml-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="button-refresh-preview"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenExternal}
            disabled={!url}
            data-testid="button-external-preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            data-testid="button-close-preview"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 flex items-start justify-center p-3 overflow-auto">
        <div
          className={cn(
            "bg-white rounded-lg overflow-hidden shadow-xl transition-all duration-200",
            deviceMode !== "desktop" && "border-4 border-zinc-700"
          )}
          style={{
            width: deviceSizes[deviceMode].width,
            height: deviceSizes[deviceMode].height,
            maxWidth: "100%",
            maxHeight: "100%",
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
          }}
        >
          <iframe
            ref={iframeRef}
            key={refreshKey}
            srcDoc={url ? undefined : previewContent}
            src={url || undefined}
            onLoad={handleLoad}
            className="w-full h-full border-0"
            title="Web Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
