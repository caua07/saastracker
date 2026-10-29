export type Service = {
  id: string;
  name: string;
  domain: string;
  category: string;
  color: string;
  icon?: string;
};
export const services: Service[] = [
  {
    id: "github",
    name: "GitHub",
    domain: "github.com",
    category: "Desenvolvimento",
    color: "#191B1F",
    icon: "github",
  },
  {
    id: "figma",
    name: "Figma",
    domain: "figma.com",
    category: "Desenvolvimento",
    color: "#F2E8FF",
    icon: "figma",
  },
  {
    id: "notion",
    name: "Notion",
    domain: "notion.so",
    category: "Produtividade",
    color: "#F4F4F3",
    icon: "notion",
  },
  {
    id: "openai",
    name: "ChatGPT",
    domain: "chatgpt.com",
    category: "Inteligência artificial",
    color: "#E0F3EC",
    icon: "openai",
  },
  {
    id: "anthropic",
    name: "Claude",
    domain: "claude.ai",
    category: "Inteligência artificial",
    color: "#F6E5D9",
    icon: "anthropic",
  },
  {
    id: "cursor",
    name: "Cursor",
    domain: "cursor.com",
    category: "Desenvolvimento",
    color: "#EDEEF1",
    icon: "cursor",
  },
  {
    id: "vercel",
    name: "Vercel",
    domain: "vercel.com",
    category: "Infraestrutura",
    color: "#16181C",
    icon: "vercel",
  },
  {
    id: "linear",
    name: "Linear",
    domain: "linear.app",
    category: "Produtividade",
    color: "#EDEBFF",
    icon: "linear",
  },
  {
    id: "spotify",
    name: "Spotify",
    domain: "spotify.com",
    category: "Entretenimento",
    color: "#DCF6E6",
    icon: "spotify",
  },
  {
    id: "netflix",
    name: "Netflix",
    domain: "netflix.com",
    category: "Entretenimento",
    color: "#231518",
    icon: "netflix",
  },
  {
    id: "google",
    name: "Google One",
    domain: "one.google.com",
    category: "Produtividade",
    color: "#EEF2FF",
    icon: "google",
  },
  {
    id: "aws",
    name: "AWS",
    domain: "aws.amazon.com",
    category: "Infraestrutura",
    color: "#FFF1DD",
    icon: "aws",
  },
];
export function serviceById(id: string) {
  return services.find((s) => s.id === id);
}
