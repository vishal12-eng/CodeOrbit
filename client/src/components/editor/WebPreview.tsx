import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function WebPreview({ isOpen, onClose, previewUrl, projectId }: WebPreviewProps) {
  const [url, setUrl] = useState(previewUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container { max-width: 600px; }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        p { font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem; }
        .icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
        }
        .feature {
          background: rgba(255,255,255,0.1);
          padding: 1rem;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }
        .feature-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .feature-text { font-size: 0.875rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🚀</div>
        <h1>NovaCode Preview</h1>
        <p>Your application preview will appear here when you run your project.</p>
        <div class="features">
          <div class="feature">
            <div class="feature-icon">⚡</div>
            <div class="feature-text">Live Reload</div>
          </div>
          <div class="feature">
            <div class="feature-icon">📱</div>
            <div class="feature-text">Responsive</div>
          </div>
          <div class="feature">
            <div class="feature-icon">🔒</div>
            <div class="feature-text">Secure</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "40%", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l bg-background flex flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Preview URL..."
              className="h-7 text-xs flex-1"
            />
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6", deviceMode === "mobile" && "bg-muted")}
                onClick={() => setDeviceMode("mobile")}
              >
                <Smartphone className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6", deviceMode === "tablet" && "bg-muted")}
                onClick={() => setDeviceMode("tablet")}
              >
                <Tablet className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6", deviceMode === "desktop" && "bg-muted")}
                onClick={() => setDeviceMode("desktop")}
              >
                <Monitor className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleOpenExternal}
                disabled={!url}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-zinc-900 flex items-start justify-center p-4 overflow-auto">
            <motion.div
              animate={{
                width: deviceSizes[deviceMode].width,
                height: deviceSizes[deviceMode].height,
              }}
              transition={{ duration: 0.2 }}
              className={cn(
                "bg-white rounded-lg overflow-hidden shadow-2xl",
                deviceMode !== "desktop" && "border-4 border-zinc-700"
              )}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
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
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
