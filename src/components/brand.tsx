import {
  siGithub,
  siFigma,
  siNotion,
  siClaude,
  siCursor,
  siVercel,
  siLinear,
  siSpotify,
  siNetflix,
  siGoogle,
} from "simple-icons";
import { serviceById } from "@/domain/catalog";

const icons: Record<string, { path: string; hex: string }> = {
  github: siGithub,
  figma: siFigma,
  notion: siNotion,
  anthropic: siClaude,
  cursor: siCursor,
  vercel: siVercel,
  linear: siLinear,
  spotify: siSpotify,
  netflix: siNetflix,
  google: siGoogle,
};
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="m5 10 11-6 11 6-11 6L5 10Z" fill="currentColor" />
        <path
          d="m5 16 11 6 11-6M5 22l11 6 11-6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
export function ServiceLogo({
  service,
  name,
  size = 40,
}: {
  service: string;
  name: string;
  size?: number;
}) {
  const s = serviceById(service),
    icon = icons[service];
  const dark = ["github", "vercel", "netflix"].includes(service);
  return (
    <span
      className={`service-logo service-${service || "custom"}`}
      style={{
        width: size,
        height: size,
        background: s?.color ?? "#EDF0F8",
        color: dark
          ? "#fff"
          : service === "spotify"
            ? "#138846"
            : service === "linear"
              ? "#5B50C7"
              : service === "anthropic"
                ? "#B26042"
                : "#202834",
      }}
      aria-hidden="true"
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.5}
          height={size * 0.5}
          fill="currentColor"
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <span className="service-monogram" style={{ fontSize: size * 0.26 }}>
          {service === "openai"
            ? "GPT"
            : service === "aws"
              ? "aws"
              : name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}
