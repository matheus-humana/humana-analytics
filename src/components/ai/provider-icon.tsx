import { useId } from "react";

import type { ProviderId } from "@/lib/ai/analytics-bot-contract";

type ProviderIconProps = {
  provider: ProviderId;
  className?: string;
};

export function ProviderIcon({ provider, className = "size-4" }: ProviderIconProps) {
  if (provider === "gemini") return <GeminiIcon className={className} />;
  if (provider === "groq") return <GroqIcon className={className} />;
  return <OpenAiIcon className={className} />;
}

function GeminiIcon({ className }: { className: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.55" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 24a14.3 14.3 0 0 0-12-12A14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12Z"
      />
    </svg>
  );
}

function GroqIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#F55036" />
      <circle cx="12" cy="10.5" r="3.6" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path
        d="M15.6 10.5v3.9a3.6 3.6 0 0 1-3.6 3.6h-1.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OpenAiIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#111" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
