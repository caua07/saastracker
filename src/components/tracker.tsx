"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Layers3,
  CalendarDays,
  ScanSearch,
  Plug,
  Settings2,
  ArrowUpRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  List,
  LayoutGrid,
  SlidersHorizontal,
  MoreHorizontal,
  Bell,
  Check,
  CheckCheck,
  X,
  Menu,
  ArrowDownToLine,
  FileUp,
  HelpCircle,
  LogOut,
  ArrowLeft,
  Pause,
  Play,
  Pencil,
  Archive,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Subscription,
  type Workspace,
  CATEGORIES,
  workspaceSchema,
} from "@/domain/model";
import {
  overview,
  money,
  monthly,
  convert,
  nextBilling,
  dateLabel,
  today,
  cycleLabels,
  cycleSuffix,
  dayDiff,
  effectiveStatus,
} from "@/domain/finance";
import { detectRecurrences, type Candidate } from "@/domain/recurrence";
import { BrandMark, ServiceLogo } from "./brand";
import { Button, IconButton, Sheet, EmptyState, Confirm } from "./ui";
import {
  FinancialOverview,
  UpcomingPanel,
  CategoriesPanel,
  ProjectionPanel,
  AgendaView,
} from "./insights";
import { SubscriptionForm } from "./subscription-form";
import { SettingsPanel } from "./settings-panel";
import { ImportPanel } from "./import-panel";
import { ImportDialog } from "./import-dialog";
import { transactionKindLabels } from "@/domain/transactions";

export type View =
  | "overview"
  | "subscriptions"
  | "calendar"
  | "discovery"
  | "connections"
  | "transactions";
type Toast = {
  message: string;
  error?: boolean;
  previous?: Workspace;
  version?: number;
};
const viewNames: Record<View, string> = {
  overview: "Visão geral",
  subscriptions: "Assinaturas",
  calendar: "Agenda",
  discovery: "Descoberta",
  connections: "Conexões",
  transactions: "Movimentos",
};
const navItems = [
  { id: "overview", icon: LayoutDashboard },
  { id: "subscriptions", icon: Layers3 },
  { id: "calendar", icon: CalendarDays },
  { id: "discovery", icon: ScanSearch },
  { id: "connections", icon: Plug },
] as const;
const statusLabels: Record<Subscription["status"], string> = {
  active: "Ativa",
  trial: "Em trial",
  paused: "Pausada",
  canceled: "Cancelada",
  archived: "Arquivada",
};

export function Tracker({
  initialData,
  initialView = "overview",
  ownerName = "Você",
}: {
  initialData: Workspace;
  initialView?: View;
  ownerName?: string;
}) {
  const [data, setData] = useState(initialData),
    [view, setView] = useState<View>(initialView),
    [busy, setBusy] = useState(false);
  const dataRef = useRef(data),
    saving = useRef(false);
  const router = useRouter();
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const [toast, setToast] = useState<Toast | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("current"),
    [sort, setSort] = useState("next"),
    [grid, setGrid] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [info, setInfo] = useState(false),
    [alerts, setAlerts] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<{
      initial?: Subscription;
      candidate?: Candidate;
    } | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const [connectionReady, setConnectionReady] = useState(false),
    [bankItem, setBankItem] = useState(""),
    [bankProgress, setBankProgress] = useState(""),
    [syncing, setSyncing] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const stats = overview(data);
  const candidates = useMemo(() => detectRecurrences(data), [data]);
  const selected = data.subscriptions.find((s) => s.id === detail);
  const displayName =
    data.preferences.displayName || ownerName.split(" ")[0] || "Você";
  const notifications = stats.upcoming.filter(
    (e) => dayDiff(e.date, today()) <= data.preferences.reminderDays,
  );
  const navigate = useCallback((next: View) => {
    setView(next);
    setMobileOpen(false);
    window.history.pushState(
      {},
      "",
      `/${next === "overview" ? "" : `?view=${next}`}`,
    );
  }, []);
  useEffect(() => {
    const back = () => {
      const v = new URLSearchParams(window.location.search).get("view") as View;
      setView(v && v in viewNames ? v : "overview");
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("subscriptions");
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [navigate]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (view !== "connections") return;
    let mounted = true;
    fetch("/api/pluggy")
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (mounted && result) setConnectionReady(result.configured === true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [view]);

  const commit = useCallback(
    async (
      next: Workspace,
      message: string,
      resetConnections = false,
    ): Promise<boolean> => {
      if (saving.current) return false;
      const previous = dataRef.current;
      saving.current = true;
      setBusy(true);
      try {
        if (next.version !== previous.version)
          throw new Error(
            "Os dados mudaram durante a revisão. Recarregue antes de salvar para preservar as alterações.",
          );
        const validated = workspaceSchema.parse({
          ...next,
          version: previous.version,
        });
        const response = await fetch("/api/workspace", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(resetConnections ? { "X-Reset-Connections": "true" } : {}),
          },
          body: JSON.stringify(validated),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Não foi possível salvar.");
        const version = result.version;
        const updated = { ...validated, version };
        dataRef.current = updated;
        setData(updated);
        setToast({ message, previous, version });
        return true;
      } catch (error) {
        setToast({
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível salvar. Tente novamente.",
          error: true,
        });
        return false;
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },
    [],
  );

  async function saveSubscription(subscription: Subscription) {
    const current = dataRef.current;
    let next: Workspace = {
      ...current,
      subscriptions: [
        ...current.subscriptions.filter((s) => s.id !== subscription.id),
        subscription,
      ],
    };
    if (form?.candidate) {
      const c = form.candidate;
      const ids = new Set(c.evidence.map((t) => t.id));
      next = {
        ...next,
        transactions: next.transactions.map((t) =>
          ids.has(t.id) ? { ...t, subscriptionId: subscription.id } : t,
        ),
        decisions: [
          ...next.decisions.filter((d) => d.key !== c.key),
          {
            key: c.key,
            evidenceHash: c.evidenceHash,
            status: "confirmed",
            subscriptionId: subscription.id,
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    }
    const saved = await commit(
      next,
      form?.initial ? "Assinatura atualizada" : "Assinatura adicionada",
    );
    if (saved) setForm(null);
    return saved;
  }
  async function changeStatus(
    s: Subscription,
    nextStatus: Subscription["status"],
  ) {
    await commit(
      {
        ...data,
        subscriptions: data.subscriptions.map((item) =>
          item.id === s.id
            ? {
                ...item,
                status: nextStatus,
                cancelDate:
                  nextStatus === "active" &&
                  item.cancelDate &&
                  item.cancelDate <= today()
                    ? null
                    : item.cancelDate,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      },
      nextStatus === "paused"
        ? "Assinatura pausada"
        : nextStatus === "archived"
          ? "Assinatura arquivada"
          : "Assinatura reativada",
    );
  }
  async function reviewCandidate(
    c: Candidate,
    nextStatus: "rejected" | "snoozed",
    subscriptionId: string | null = null,
  ) {
    const ids = new Set(c.evidence.map((t) => t.id));
    const decisionStatus = subscriptionId ? "confirmed" : nextStatus;
    await commit(
      {
        ...data,
        transactions: subscriptionId
          ? data.transactions.map((t) =>
              ids.has(t.id) ? { ...t, subscriptionId } : t,
            )
          : data.transactions,
        decisions: [
          ...data.decisions.filter((d) => d.key !== c.key),
          {
            key: c.key,
            evidenceHash: c.evidenceHash,
            status: decisionStatus,
            subscriptionId,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      subscriptionId
        ? "Cobranças vinculadas"
        : nextStatus === "rejected"
          ? "Sugestão descartada"
          : "Sugestão adiada até surgirem novas evidências",
    );
  }
  async function syncBank() {
    setSyncing(true);
    setBankProgress("Consultando a fonte...");
    try {
      const response = await fetch("/api/pluggy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: bankItem }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setBankProgress(result.message);
      const current = await fetch("/api/workspace", { cache: "no-store" });
      if (current.ok) {
        const updated = workspaceSchema.parse(await current.json());
        dataRef.current = updated;
        setData(updated);
      }
      setToast({ message: result.message });
    } catch (e) {
      setBankProgress(
        e instanceof Error ? e.message : "Falha de sincronização.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const filtered = data.subscriptions
    .filter((s) => {
      if (
        status === "current" &&
        ["archived", "canceled"].includes(effectiveStatus(s))
      )
        return false;
      if (
        status !== "current" &&
        status !== "all" &&
        effectiveStatus(s) !== status
      )
        return false;
      return (
        (category === "all" || s.category === category) &&
        `${s.name} ${s.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR"))
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "amount"
          ? (convert(
              monthly(b.amount, b.cycle),
              b.currency,
              data.preferences,
            )?.toNumber() ?? 0) -
            (convert(
              monthly(a.amount, a.cycle),
              a.currency,
              data.preferences,
            )?.toNumber() ?? 0)
          : (nextBilling(a) ?? "9999").localeCompare(nextBilling(b) ?? "9999"),
    );

  function subscriptionMenu(s: Subscription) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={`Ações de ${s.name}`} disabled={busy}>
            <MoreHorizontal size={18} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="dropdown-menu"
            align="end"
            sideOffset={5}
          >
            <DropdownMenu.Item onSelect={() => setForm({ initial: s })}>
              <Pencil size={15} />
              Editar assinatura
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() =>
                void changeStatus(
                  s,
                  ["paused", "canceled", "archived"].includes(
                    effectiveStatus(s),
                  )
                    ? "active"
                    : "paused",
                )
              }
            >
              {["paused", "canceled", "archived"].includes(
                effectiveStatus(s),
              ) ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )}{" "}
              {["paused", "canceled", "archived"].includes(effectiveStatus(s))
                ? "Reativar"
                : "Pausar"}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => void changeStatus(s, "archived")}
            >
              <Archive size={15} />
              Arquivar
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              className="destructive"
              onSelect={() => setDeleteId(s.id)}
            >
              <Trash2 size={15} />
              Excluir assinatura
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  const collection = (
    <section
      className={`panel collection-panel ${data.preferences.compact ? "compact" : ""}`}
    >
      <div className="panel-heading collection-heading">
        <div>
          <h2>
            Suas assinaturas{" "}
            <span className="count-badge">{filtered.length}</span>
          </h2>
          <p>Tudo o que faz parte do seu dia a dia.</p>
        </div>
        <div className="view-switch" aria-label="Visualização">
          <IconButton
            label="Visualizar em lista"
            className={!grid ? "is-active" : ""}
            onClick={() => setGrid(false)}
          >
            <List size={17} />
          </IconButton>
          <IconButton
            label="Visualizar em grade"
            className={grid ? "is-active" : ""}
            onClick={() => setGrid(true)}
          >
            <LayoutGrid size={16} />
          </IconButton>
        </div>
      </div>
      <div className="collection-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar assinatura..."
            aria-label="Buscar assinatura"
          />
          <kbd>⌘ K</kbd>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={`filter-button ${category !== "all" || status !== "current" ? "has-filter" : ""}`}
            >
              <SlidersHorizontal size={15} />
              <span>Filtros</span>
              {category !== "all" || status !== "current" ? (
                <span className="filter-dot" />
              ) : (
                <ChevronDown size={13} />
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="dropdown-menu filter-menu"
              align="end"
              sideOffset={6}
            >
              <div className="dropdown-label">Categoria</div>
              <DropdownMenu.RadioGroup
                value={category}
                onValueChange={setCategory}
              >
                {[
                  "all",
                  ...new Set([
                    ...CATEGORIES,
                    ...data.subscriptions.map((s) => s.category),
                  ]),
                ].map((c) => (
                  <DropdownMenu.RadioItem key={c} value={c}>
                    {category === c ? (
                      <Check size={14} />
                    ) : (
                      <span className="icon-spacer" />
                    )}
                    {c === "all" ? "Todas as categorias" : c}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator />
              <div className="dropdown-label">Status</div>
              <DropdownMenu.RadioGroup value={status} onValueChange={setStatus}>
                {[
                  ["current", "Em acompanhamento"],
                  ["all", "Todos os status"],
                  ...Object.entries(statusLabels),
                ].map(([value, label]) => (
                  <DropdownMenu.RadioItem key={value} value={value}>
                    {status === value ? (
                      <Check size={14} />
                    ) : (
                      <span className="icon-spacer" />
                    )}
                    {label}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {category !== "all" && (
        <div className="active-filters">
          <button onClick={() => setCategory("all")}>
            {category}
            <X size={12} />
          </button>
        </div>
      )}
      {!filtered.length ? (
        <EmptyState
          icon={<Layers3 size={27} />}
          heading={
            data.subscriptions.length
              ? "Nenhuma assinatura por aqui"
              : "Seu stack começa aqui"
          }
          action={
            data.subscriptions.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setStatus("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => setForm({})}>
                <Plus size={16} />
                Adicionar primeira assinatura
              </Button>
            )
          }
        >
          {data.subscriptions.length
            ? "Tente outro nome ou ajuste os filtros."
            : "Adicione os serviços que você usa. A gente organiza os custos e as próximas cobranças."}
        </EmptyState>
      ) : grid ? (
        <div className="subscription-grid">
          {filtered.map((s) => (
            <article className="subscription-card" key={s.id}>
              <div>
                <button
                  className="service-card-identity"
                  onClick={() => setDetail(s.id)}
                >
                  <ServiceLogo service={s.service} name={s.name} size={43} />
                  <span>
                    <strong>{s.name}</strong>
                    <span>{s.category}</span>
                  </span>
                </button>
                {subscriptionMenu(s)}
              </div>
              <button
                className="subscription-card-body"
                onClick={() => setDetail(s.id)}
              >
                <span>
                  <strong>{money(s.amount, s.currency)}</strong>
                  <span>/{cycleSuffix[s.cycle]}</span>
                </span>
                <span className="subscription-card-foot">
                  <span className={`status-tag status-${effectiveStatus(s)}`}>
                    <i />
                    {statusLabels[effectiveStatus(s)]}
                  </span>
                  <span>
                    {nextBilling(s)
                      ? dateLabel(nextBilling(s)!, true)
                      : "Sem próxima data"}
                  </span>
                </span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="subscription-table">
          <div className="subscription-table-head">
            <span>Serviço</span>
            <span>Frequência</span>
            <button
              onClick={() => setSort(sort === "amount" ? "next" : "amount")}
            >
              Valor <ChevronDown size={12} />
            </button>
            <button onClick={() => setSort("next")}>Próxima cobrança</button>
            <span />
          </div>
          {filtered.map((s) => {
            const converted = convert(s.amount, s.currency, data.preferences),
              next = nextBilling(s);
            return (
              <div className="subscription-row" key={s.id}>
                <button
                  className="service-identity"
                  onClick={() => setDetail(s.id)}
                >
                  <ServiceLogo service={s.service} name={s.name} />
                  <span>
                    <strong>{s.name}</strong>
                    <span>{s.category}</span>
                  </span>
                </button>
                <span className="cycle-cell">
                  {cycleLabels[s.cycle]}
                  {effectiveStatus(s) !== "active" && (
                    <span className={`status-tag status-${effectiveStatus(s)}`}>
                      <i />
                      {statusLabels[effectiveStatus(s)]}
                    </span>
                  )}
                </span>
                <button className="amount-cell" onClick={() => setDetail(s.id)}>
                  <strong>
                    {money(s.amount, s.currency)}
                    <span>/{cycleSuffix[s.cycle]}</span>
                  </strong>
                  <span>
                    {s.currency !== data.preferences.baseCurrency
                      ? converted
                        ? `≈ ${money(converted, data.preferences.baseCurrency)}`
                        : "Sem conversão"
                      : "Valor original"}
                  </span>
                </button>
                <button className="date-cell" onClick={() => setDetail(s.id)}>
                  {next ? (
                    <>
                      <span className="date-dot" />
                      {dateLabel(next, true)}
                      <span className="date-relative">
                        {dayDiff(next, today()) === 0
                          ? "Hoje"
                          : `em ${dayDiff(next, today())} dias`}
                      </span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </button>
                {subscriptionMenu(s)}
              </div>
            );
          })}
        </div>
      )}
      <div className="collection-footer">
        <span>
          {filtered.length}{" "}
          {filtered.length === 1 ? "assinatura" : "assinaturas"}{" "}
          {category !== "all" ? "nesta categoria" : "em acompanhamento"}
        </span>
        <button onClick={() => setForm({})}>
          <Plus size={14} />
          Adicionar serviço
        </button>
      </div>
    </section>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Fechar navegação"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Navegação principal"
      >
        <Link className="wordmark" href="/">
          <BrandMark />
          saastemics<span className="wordmark-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <span>
            <strong>Meu espaço</strong>
            <small>Pessoal</small>
          </span>
          <span className="private-dot" title="Espaço pessoal" />
        </div>
        <div className="nav-label">SEU ESPAÇO</div>
        <nav>
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => navigate(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{viewNames[id]}</span>
              {id === "discovery" && candidates.length > 0 ? (
                <b>{candidates.length}</b>
              ) : id === "overview" && view === "overview" ? (
                <span className="nav-active-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="personal-note">
            <span className="personal-note-icon">
              <Layers3 size={19} />
            </span>
            <strong>
              Menos abas.
              <br />
              Mais controle.
            </strong>
            <p>
              Seu universo de serviços,
              <br />
              finalmente organizado.
            </p>
          </div>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            Configurações
          </button>
          <button className="nav-item" onClick={() => setInfo(true)}>
            <HelpCircle size={18} />
            Sobre seus números
          </button>
          <div className="profile-row">
            <span className="profile-avatar">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>Espaço pessoal</small>
            </span>
            <IconButton
              label="Sair do aplicativo"
              onClick={async () => {
                await fetch("/api/auth/sign-out", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOut size={16} />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <IconButton
              label="Abrir navegação"
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </IconButton>
            <span>Meu espaço</span>
            <ChevronRight size={13} />
            <strong>{viewNames[view]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="private-label">
              <span />
              Uso pessoal
            </span>
            <button
              className="currency-switch"
              onClick={() => setSettings(true)}
            >
              {data.preferences.baseCurrency === "BRL" ? "R$" : "US$"}
              <span>{data.preferences.baseCurrency}</span>
              <ChevronDown size={13} />
            </button>
            <IconButton
              label={`Avisos${notifications.length ? `, ${notifications.length} renovações próximas` : ""}`}
              onClick={() => setAlerts(true)}
            >
              <Bell size={18} />
              {notifications.length > 0 && <i className="notification-dot" />}
            </IconButton>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <h1>{viewNames[view]}</h1>
              <p>
                {view === "overview"
                  ? "Suas ferramentas, seus números. Tudo em seu lugar."
                  : view === "subscriptions"
                    ? "Um espaço para os serviços que fazem parte da sua vida."
                    : view === "calendar"
                      ? "Saiba o que vem pela frente."
                      : view === "discovery"
                        ? "Encontre recorrências. Confirme o que faz sentido."
                        : view === "transactions"
                          ? "As evidências por trás dos seus números."
                          : "Traga seus dados para perto."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "connections" ? (
                <Button onClick={() => setImportOpen(true)}>
                  <FileUp size={16} />
                  Importar CSV
                </Button>
              ) : (
                <Button onClick={() => setForm({})}>
                  <Plus size={17} />
                  Adicionar assinatura
                </Button>
              )}
            </div>
          </div>
          {view === "overview" && (
            <>
              <FinancialOverview
                workspace={data}
                onSettings={() => setSettings(true)}
                onInfo={() => setInfo(true)}
              />
              <div className="dashboard-grid">
                <div className="dashboard-main">
                  {collection}
                  <ProjectionPanel workspace={data} />
                </div>
                <div className="dashboard-aside">
                  <UpcomingPanel
                    workspace={data}
                    onOpen={(s) => setDetail(s.id)}
                    onCalendar={() => navigate("calendar")}
                  />
                  <CategoriesPanel
                    workspace={data}
                    onCategory={(c) => {
                      setCategory(c);
                      navigate("subscriptions");
                    }}
                  />
                </div>
              </div>
            </>
          )}
          {view === "subscriptions" && (
            <>
              <div className="list-summary">
                <span>
                  <span className="blue-dot" />
                  {stats.active.length} serviços ativos
                </span>
                <strong>
                  {money(stats.total, data.preferences.baseCurrency)}
                  <span> / mês equivalente</span>
                </strong>
                <Button variant="ghost" onClick={() => setSettings(true)}>
                  <ArrowDownToLine size={15} />
                  Exportar
                </Button>
              </div>
              {collection}
            </>
          )}
          {view === "calendar" && (
            <AgendaView workspace={data} onOpen={(s) => setDetail(s.id)} />
          )}
          {view === "discovery" && (
            <>
              <div className="discovery-intro">
                <ScanSearch size={22} />
                <div>
                  <h2>Uma sugestão, com evidências.</h2>
                  <p>
                    O motor procura padrões em movimentos importados. A
                    confirmação final é sempre sua; confiança não é
                    probabilidade.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <FileUp size={16} />
                  Importar extrato
                </Button>
              </div>
              {candidates.length ? (
                <div className="candidate-list">
                  {candidates.map((c) => (
                    <article key={c.key} className="panel candidate">
                      <div className="candidate-head">
                        <ServiceLogo service={c.service} name={c.name} />
                        <div>
                          <h2>{c.name}</h2>
                          <p>
                            {money(c.amount, c.currency)} ·{" "}
                            {cycleLabels[c.cycle]}
                          </p>
                        </div>
                        <span
                          className={`confidence confidence-${c.confidence}`}
                        >
                          {c.confidence === "high"
                            ? "Alta confiança"
                            : c.confidence === "medium"
                              ? "Confiança média"
                              : "Mais evidências"}
                          <span>{c.score}/100</span>
                        </span>
                      </div>
                      <div className="evidence-reasons">
                        {c.reasons.map((reason) => (
                          <span key={reason}>
                            <CheckCircle2 size={14} />
                            {reason}
                          </span>
                        ))}
                      </div>
                      <details className="evidence-details">
                        <summary>
                          Ver {c.evidence.length} cobranças usadas{" "}
                          <ChevronDown size={15} />
                        </summary>
                        <div>
                          {c.evidence.map((t) => (
                            <div key={t.id}>
                              <span>
                                {dateLabel(t.date, true)}
                                <small>{t.account}</small>
                              </span>
                              <span>{t.description}</span>
                              <strong>{money(t.amount, t.currency)}</strong>
                            </div>
                          ))}
                        </div>
                      </details>
                      <div className="candidate-actions">
                        <Button
                          disabled={busy}
                          onClick={() => setForm({ candidate: c })}
                        >
                          <Check size={16} />
                          Confirmar assinatura
                        </Button>
                        {data.subscriptions.length > 0 && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <Button variant="secondary" disabled={busy}>
                                Vincular a existente <ChevronDown size={14} />
                              </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="dropdown-menu"
                                sideOffset={5}
                              >
                                {data.subscriptions.map((s) => (
                                  <DropdownMenu.Item
                                    key={s.id}
                                    onSelect={() =>
                                      void reviewCandidate(c, "rejected", s.id)
                                    }
                                  >
                                    {s.name}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void reviewCandidate(c, "snoozed")}
                        >
                          Adiar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void reviewCandidate(c, "rejected")}
                        >
                          Descartar
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="panel">
                  <EmptyState
                    icon={<ScanSearch size={30} />}
                    heading={
                      data.transactions.length
                        ? "Nenhuma sugestão pendente"
                        : "Vamos encontrar seus padrões"
                    }
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => setImportOpen(true)}
                      >
                        <FileUp size={16} />
                        Importar extrato CSV
                      </Button>
                    }
                  >
                    {data.transactions.length
                      ? "Novas evidências podem gerar novas sugestões. Cobranças já vinculadas, parcelas e pagamentos de fatura ficam fora da fila."
                      : "Importe um extrato com alguns meses de movimentos. As possíveis assinaturas vão aparecer aqui com as evidências para você revisar."}
                  </EmptyState>
                </div>
              )}
              {data.decisions.length > 0 && (
                <div className="review-history">
                  <span>
                    <CheckCheck size={16} />
                    {data.decisions.length} sugestões revisadas
                  </span>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void commit(
                        { ...data, decisions: [] },
                        "Revisões limpas; sugestões elegíveis voltam a aparecer",
                      )
                    }
                  >
                    Reabrir revisões
                  </Button>
                </div>
              )}
            </>
          )}
          {view === "connections" && (
            <div className="connections-content">
              <section className="panel connection-panel">
                <div className="connection-icon">
                  <FileUp size={25} />
                </div>
                <div>
                  <h2>Seu extrato, sem digitar tudo</h2>
                  <p>
                    Importe um CSV do seu banco ou cartão. Confira as colunas e
                    os valores antes de trazer os movimentos.
                  </p>
                  <div className="connection-features">
                    <span>
                      <Check size={14} />
                      Prévia antes de importar
                    </span>
                    <span>
                      <Check size={14} />
                      Controle de duplicatas
                    </span>
                    <span>
                      <Check size={14} />
                      Arquivo original descartado
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setImportOpen(true)}
                  >
                    Importar extrato <ArrowUpRight size={15} />
                  </Button>
                </div>
              </section>
              <section className="panel connection-panel bank-panel">
                <div className="connection-icon">
                  <Plug size={25} />
                </div>
                <div>
                  <div className="connection-title">
                    <h2>Meu Pluggy</h2>
                    <span className="small-tag">
                      {connectionReady
                        ? "Disponível"
                        : "Configuração necessária"}
                    </span>
                  </div>
                  <p>
                    Conecte suas contas pelo programa de uso pessoal do Meu
                    Pluggy. A atualização da fonte é diária e depende do
                    consentimento de cada instituição.
                  </p>
                  {connectionReady ? (
                    <>
                      <label className="field">
                        Item ID do Meu Pluggy
                        <input
                          value={bankItem}
                          onChange={(e) => setBankItem(e.target.value)}
                          placeholder="ID do item autorizado no Dashboard"
                        />
                      </label>
                      <Button
                        busy={syncing}
                        disabled={!bankItem.trim()}
                        onClick={() => void syncBank()}
                      >
                        <RefreshCw size={15} />
                        Consultar movimentos
                      </Button>
                      {bankProgress && (
                        <p role="status" className="notice">
                          {bankProgress}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="field-help">
                        Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no
                        servidor para habilitar. As credenciais nunca são
                        solicitadas neste formulário.
                      </p>
                      <a
                        className="text-link"
                        href="https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver guia oficial de configuração{" "}
                        <ExternalLink size={14} />
                      </a>
                    </>
                  )}
                </div>
              </section>
              <section className="panel import-history">
                <div className="panel-heading">
                  <h2>Histórico de importações</h2>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("transactions")}
                  >
                    Ver movimentos <ArrowUpRight size={14} />
                  </Button>
                </div>
                {data.imports.length ? (
                  data.imports.map((batch) => (
                    <div className="import-history-row" key={batch.id}>
                      <ReceiptText size={20} />
                      <div>
                        <strong>{batch.name}</strong>
                        <span>
                          {batch.count} movimentos ·{" "}
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(batch.createdAt),
                          )}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void commit(
                            {
                              ...data,
                              imports: data.imports.filter(
                                (i) => i.id !== batch.id,
                              ),
                              transactions: data.transactions.filter(
                                (t) => t.importId !== batch.id,
                              ),
                            },
                            batch.source === "pluggy"
                              ? "Lote removido e consultas locais interrompidas"
                              : "Importação desfeita",
                            batch.source === "pluggy",
                          )
                        }
                      >
                        Desfazer lote
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="small-empty">
                    Seus arquivos importados aparecerão aqui.
                  </p>
                )}
              </section>
              <div className="connection-footnote">
                <Settings2 size={16} />
                <span>
                  Gmail e outros provedores de e-mail não são necessários para
                  usar seu espaço. Não há acesso à sua caixa postal.
                </span>
              </div>
            </div>
          )}
          {view === "transactions" && (
            <section className="panel transactions-panel">
              <div className="panel-heading">
                <h2>
                  Movimentos importados{" "}
                  <span className="count-badge">
                    {data.transactions.length}
                  </span>
                </h2>
                <Button variant="ghost" onClick={() => navigate("connections")}>
                  <ArrowLeft size={14} />
                  Importações
                </Button>
              </div>
              {data.transactions.length ? (
                <>
                  <p className="panel-caption">
                    Somente movimentos vinculados entram no gasto registrado das
                    assinaturas. Pagamento de fatura e transferência são
                    excluídos.
                  </p>
                  {[...data.transactions]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 100)
                    .map((t) => (
                      <div className="transaction-row" key={t.id}>
                        <span>{dateLabel(t.date, true)}</span>
                        <div>
                          <strong>{t.description}</strong>
                          <span>
                            {t.account} · {transactionKindLabels[t.kind]}
                            {t.pending ? " · Pendente" : ""}
                          </span>
                        </div>
                        <strong>
                          {t.direction === "credit" ? "+" : "−"}
                          {money(t.amount, t.currency)}
                        </strong>
                        <label className="sr-only" htmlFor={`link-${t.id}`}>
                          Vincular {t.description}
                        </label>
                        <select
                          id={`link-${t.id}`}
                          value={t.subscriptionId ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            void commit(
                              {
                                ...data,
                                transactions: data.transactions.map((x) =>
                                  x.id === t.id
                                    ? {
                                        ...x,
                                        subscriptionId: e.target.value || null,
                                      }
                                    : x,
                                ),
                              },
                              "Vínculo atualizado",
                            )
                          }
                        >
                          <option value="">Não vinculada</option>
                          {data.subscriptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  {data.transactions.length > 100 && (
                    <p className="panel-caption">
                      Exibindo os 100 movimentos mais recentes. O backup contém
                      todos os registros.
                    </p>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={<ReceiptText size={28} />}
                  heading="Seu histórico começa com um extrato"
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => setImportOpen(true)}
                    >
                      Importar CSV
                    </Button>
                  }
                >
                  Não criamos pagamentos a partir de previsões. Importe seus
                  movimentos para ver as cobranças registradas.
                </EmptyState>
              )}
            </section>
          )}
          <footer className="app-footer">
            <span>
              <span className="footer-mark" />
              Feito para o seu dia a dia.
            </span>
            <span>
              {busy ? "Salvando alterações..." : "Seu espaço privado"}
              <span className="footer-separator">·</span>
              <button onClick={() => setInfo(true)}>
                Valores com contexto
              </button>
            </span>
          </footer>
        </main>
      </div>

      <Sheet
        open={!!form}
        onClose={() => {
          if (!busy) setForm(null);
        }}
        title={
          form?.initial
            ? "Editar assinatura"
            : form?.candidate
              ? "Confirmar assinatura"
              : "Adicionar assinatura"
        }
        description="Seu próximo serviço, no lugar certo."
      >
        {form && (
          <SubscriptionForm
            key={form.initial?.id ?? form.candidate?.key ?? "new"}
            initial={form.initial}
            candidate={form.candidate}
            onSave={saveSubscription}
            onCancel={() => setForm(null)}
            busy={busy}
          />
        )}
      </Sheet>
      <Sheet
        open={!!selected}
        onClose={() => setDetail(null)}
        title="Detalhes da assinatura"
      >
        {selected && (
          <div className="subscription-detail">
            <div className="detail-identity">
              <ServiceLogo
                service={selected.service}
                name={selected.name}
                size={58}
              />
              <div>
                <h3>{selected.name}</h3>
                <span>{selected.category}</span>
              </div>
              <span
                className={`status-tag status-${effectiveStatus(selected)}`}
              >
                <i />
                {statusLabels[effectiveStatus(selected)]}
              </span>
            </div>
            <div className="detail-price">
              <strong>{money(selected.amount, selected.currency)}</strong>
              <span>/{cycleSuffix[selected.cycle]}</span>
            </div>
            <p className="muted">
              {money(
                monthly(selected.amount, selected.cycle),
                selected.currency,
              )}{" "}
              por mês equivalente
            </p>
            <div className="detail-actions">
              <Button
                onClick={() => {
                  setForm({ initial: selected });
                  setDetail(null);
                }}
              >
                <Pencil size={15} />
                Editar assinatura
              </Button>
              {selected.website && (
                <a
                  className="button button-secondary"
                  href={selected.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Gerenciar <ExternalLink size={15} />
                </a>
              )}
            </div>
            <dl className="detail-facts">
              <div>
                <dt>Próxima cobrança estimada</dt>
                <dd>
                  {nextBilling(selected)
                    ? dateLabel(nextBilling(selected)!)
                    : "Sem próxima cobrança"}
                </dd>
              </div>
              <div>
                <dt>Frequência</dt>
                <dd>{cycleLabels[selected.cycle]}</dd>
              </div>
              <div>
                <dt>Início informado</dt>
                <dd>
                  {dateLabel(selected.startDate)}{" "}
                  {selected.startDate.slice(0, 4)}
                </dd>
              </div>
              {selected.cancelDate && (
                <div>
                  <dt>Término agendado</dt>
                  <dd>{dateLabel(selected.cancelDate)}</dd>
                </div>
              )}
              <div>
                <dt>Origem</dt>
                <dd>
                  {data.transactions.some(
                    (t) => t.subscriptionId === selected.id,
                  )
                    ? "Confirmada com movimentos"
                    : "Cadastro manual"}
                </dd>
              </div>
            </dl>
            {selected.notes && (
              <div className="detail-notes">
                <h4>Suas notas</h4>
                <p>{selected.notes}</p>
              </div>
            )}
            <h4>Histórico de condições</h4>
            <div className="term-history">
              {[...selected.history]
                .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                .map((term) => (
                  <div key={term.effectiveFrom}>
                    <span className="timeline-point" />
                    <div>
                      <strong>
                        {money(term.amount, term.currency)} /{" "}
                        {cycleSuffix[term.cycle]}
                      </strong>
                      <span>
                        Vigente desde {dateLabel(term.effectiveFrom, true)} de{" "}
                        {term.effectiveFrom.slice(0, 4)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <h4>Cobranças registradas</h4>
            {data.transactions.filter((t) => t.subscriptionId === selected.id)
              .length ? (
              <div className="detail-payments">
                {data.transactions
                  .filter((t) => t.subscriptionId === selected.id)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((t) => (
                    <div key={t.id}>
                      <span>
                        {dateLabel(t.date, true)}
                        <small>
                          {t.pending
                            ? "Pendente"
                            : t.direction === "credit"
                              ? "Crédito / estorno"
                              : "Lançamento registrado"}
                        </small>
                      </span>
                      <strong>
                        {t.direction === "credit" ? "+" : "−"}
                        {money(t.amount, t.currency)}
                      </strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="notice">
                Nenhuma cobrança vinculada. Uma previsão não é um pagamento
                realizado.
              </p>
            )}
            <p className="field-help">
              Pausar ou cancelar aqui organiza seu controle. Para encerrar a
              cobrança real, cancele diretamente com o fornecedor.
            </p>
          </div>
        )}
      </Sheet>
      <Sheet
        open={settings}
        onClose={() => {
          if (!busy) setSettings(false);
        }}
        title="Configurações"
        description="Pessoal, simples e do seu jeito."
      >
        {settings && (
          <SettingsPanel workspace={data} onCommit={commit} busy={busy} />
        )}
      </Sheet>
      <ImportDialog
        open={importOpen}
        onClose={() => {
          if (!busy) setImportOpen(false);
        }}
        busy={busy}
      >
        {importOpen && (
          <ImportPanel
            workspace={data}
            onCommit={commit}
            busy={busy}
            onDiscover={() => {
              setImportOpen(false);
              navigate("discovery");
            }}
            onMovements={() => {
              setImportOpen(false);
              navigate("transactions");
            }}
          />
        )}
      </ImportDialog>
      <Sheet
        open={info}
        onClose={() => setInfo(false)}
        title="Números com contexto"
      >
        <div className="explanation-content">
          <h3>Seu custo, sem misturar conceitos</h3>
          <dl>
            <dt>Custo mensal equivalente</dt>
            <dd>
              Distribui o preço confirmado pelo ciclo: uma assinatura anual de
              US$ 120 equivale a US$ 10 por mês. Semanal usa a convenção 52 ÷
              12.
            </dd>
            <dt>Equivalente anual</dt>
            <dd>
              É o mensal equivalente multiplicado por 12, mantendo condições e
              cotação atuais. Não é o gasto realizado.
            </dd>
            <dt>Próximas cobranças</dt>
            <dd>
              Datas estimadas pelo ciclo e referência que você informou. Os
              meses respeitam o calendário, inclusive o fim de fevereiro.
            </dd>
            <dt>Gasto registrado</dt>
            <dd>
              Movimentos importados e vinculados, sem duplicar o pagamento da
              fatura. Um lançamento do cartão não comprova quitação da fatura.
            </dd>
            <dt>Câmbio</dt>
            <dd>
              A conversão usa sua taxa manual com data. Não inclui IOF ou spread
              estimados e não representa a taxa de liquidação do seu cartão.
            </dd>
            <dt>Confiança na descoberta</dt>
            <dd>
              Score heurístico de 0–100, com explicação. Não é uma
              probabilidade. Uma assinatura só é confirmada depois da sua
              revisão.
            </dd>
          </dl>
          <p className="notice">
            Nenhum serviço é cancelado pelo aplicativo. Logos identificam
            fornecedores; não representam parceria.
          </p>
        </div>
      </Sheet>
      <Sheet
        open={alerts}
        onClose={() => setAlerts(false)}
        title="Seus avisos"
        description={`Renovações nos próximos ${data.preferences.reminderDays} dias.`}
      >
        {notifications.length ? (
          <div className="alerts-list">
            {notifications.map(({ subscription: s, date }) => (
              <button
                key={s.id}
                onClick={() => {
                  setAlerts(false);
                  setDetail(s.id);
                }}
              >
                <ServiceLogo service={s.service} name={s.name} />
                <span>
                  <strong>{s.name}</strong>
                  <span>
                    {dateLabel(date, true)} · {money(s.amount, s.currency)}
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bell size={28} />}
            heading="Tudo tranquilo por aqui"
          >
            Nenhuma renovação prevista dentro da janela configurada. Você pode
            ajustar o prazo nas preferências.
          </EmptyState>
        )}
        <p className="field-help">
          Avisos são calculados ao abrir o aplicativo. Não há envio externo ou
          cobrança automática por este app.
        </p>
      </Sheet>
      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir esta assinatura?"
        description="As condições serão removidas e seus movimentos ficarão sem vínculo. Isso não cancela o contrato com o fornecedor."
        action="Excluir assinatura"
        busy={busy}
        onConfirm={async () => {
          const id = deleteId;
          if (
            await commit(
              {
                ...data,
                subscriptions: data.subscriptions.filter((s) => s.id !== id),
                transactions: data.transactions.map((t) =>
                  t.subscriptionId === id ? { ...t, subscriptionId: null } : t,
                ),
                decisions: data.decisions.map((d) =>
                  d.subscriptionId === id ? { ...d, subscriptionId: null } : d,
                ),
              },
              "Assinatura excluída",
            )
          ) {
            setDeleteId(null);
            setDetail(null);
          }
        }}
      />
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          {toast.previous && !toast.error && toast.version === data.version && (
            <button
              disabled={busy}
              onClick={() =>
                void commit(
                  { ...toast.previous!, version: data.version },
                  "Alteração desfeita",
                )
              }
            >
              Desfazer
            </button>
          )}
          <IconButton label="Fechar aviso" onClick={() => setToast(null)}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
