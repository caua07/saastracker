"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, ArrowRight, Layers3, Check } from "lucide-react";
import { BrandMark, ServiceLogo } from "./brand";
import { Button } from "./ui";
import { readSignInResponse } from "@/domain/sign-in-response";

export function Login({
  googleReady,
  localReady,
  configured,
  error,
}: {
  googleReady: boolean;
  localReady: boolean;
  configured: boolean;
  error: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      error
        ? "Não foi possível entrar. Este espaço aceita somente a conta do proprietário."
        : "",
    );
  async function login(local = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        local ? "/api/local-login" : "/api/auth/sign-in/social",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            local
              ? {}
              : { provider: "google", callbackURL: "/", disableRedirect: true },
          ),
        },
      );
      const result = await readSignInResponse(response, !local);
      if (result.url) window.location.assign(result.url);
      else {
        router.replace("/");
        router.refresh();
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Falha de conexão. Tente novamente.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-main">
        <Link href="/" className="wordmark">
          <BrandMark />
          saastemics<span className="wordmark-dot">.</span>
        </Link>
        <div className="login-content">
          <h1>
            Seu stack.
            <br />
            <span>Sob controle.</span>
          </h1>
          <p>
            Todas as suas assinaturas, custos e próximas cobranças. Um espaço só
            seu.
          </p>
          <div className="login-actions">
            {googleReady && (
              <Button busy={busy} onClick={() => void login()}>
                <ServiceLogo service="google" name="Google" size={23} />
                Entrar com Google
                <ArrowRight size={17} />
              </Button>
            )}
            {localReady && (
              <Button busy={busy} onClick={() => void login(true)}>
                Entrar no ambiente local
                <ArrowRight size={17} />
              </Button>
            )}
            {!googleReady && !localReady && (
              <div className="login-setup">
                <strong>
                  {configured
                    ? "Configure o login Google"
                    : "Seu espaço está quase pronto"}
                </strong>
                <p>
                  O acesso privado precisa do banco, segredo de autenticação e
                  conta do proprietário. As instruções estão no README do
                  projeto.
                </p>
              </div>
            )}
          </div>
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <div className="login-privacy">
            <ShieldCheck size={17} />
            <span>Privado por princípio. Pessoal por escolha.</span>
          </div>
        </div>
        <footer>Uma visão clara do que faz parte do seu dia.</footer>
      </section>
      <section className="login-preview">
        <div className="preview-orbit">
          <span className="orbit-logo orbit-one">
            <ServiceLogo service="figma" name="Figma" size={64} />
          </span>
          <span className="orbit-logo orbit-two">
            <ServiceLogo service="github" name="GitHub" size={60} />
          </span>
          <span className="orbit-logo orbit-three">
            <ServiceLogo service="notion" name="Notion" size={56} />
          </span>
          <span className="orbit-logo orbit-four">
            <ServiceLogo service="spotify" name="Spotify" size={56} />
          </span>
          <span className="orbit-logo orbit-five">
            <ServiceLogo service="linear" name="Linear" size={52} />
          </span>
          <div className="login-preview-window">
            <div className="preview-window-header">
              <span />
              <span />
              <span />
              <b>Seu universo, organizado.</b>
            </div>
            <div className="preview-window-content">
              <Layers3 size={23} />
              <h2>
                Um lugar para
                <br />
                todos os seus serviços.
              </h2>
              <div className="preview-check">
                <Check size={15} />
                Custos que fazem sentido
              </div>
              <div className="preview-check">
                <Check size={15} />
                Renovações à vista
              </div>
              <div className="preview-check">
                <Check size={15} />
                Mais clareza, menos esforço
              </div>
            </div>
          </div>
        </div>
        <p>Uma prévia do seu espaço. Logos identificam os serviços.</p>
      </section>
    </div>
  );
}
