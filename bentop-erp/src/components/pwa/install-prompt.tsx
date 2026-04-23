"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="md:hidden fixed bottom-16 left-2 right-2 z-50 bg-primary text-primary-foreground rounded-lg p-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-bottom duration-300">
      <Download className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Install Bentop ERP</div>
        <div className="text-xs opacity-80">Access offline from your home screen</div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleInstall}
        className="flex-shrink-0"
      >
        Install
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
