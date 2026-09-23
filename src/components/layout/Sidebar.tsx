import { Link } from "@tanstack/react-router";
import {
  Inbox,
  FileSearch,
  ShieldCheck,
  FileText,
  ShoppingCart,
  Briefcase,
  Truck,
  Bus,
  ClipboardList,
  BookOpen,
  Bug,
  Code2,
  Calculator,
  ShieldAlert,
  Route as RouteIcon,
  Scale,
  GraduationCap,
  Map,
  Library,
  Grid3x3,
  FlaskConical,
  LifeBuoy,
  Gauge,
  Rocket,
  NotebookPen,
} from "lucide-react";

const secoes = [
  {
    titulo: "Módulos fiscais",
    itens: [
      { to: "/", label: "Manifestação", desc: "Notas recebidas", icon: Inbox },
      { to: "/nfe", label: "NF-e 55", desc: "Produtos", icon: FileText },
      { to: "/nfce", label: "NFC-e 65", desc: "Varejo / PDV", icon: ShoppingCart },
      { to: "/nfse", label: "NFS-e", desc: "Serviços", icon: Briefcase },
      { to: "/cte", label: "CT-e 57", desc: "Carga", icon: Truck },
      { to: "/cte-os", label: "CT-e OS 67", desc: "Pessoas e valores", icon: Bus },
      { to: "/mdfe", label: "MDF-e 58", desc: "Manifesto", icon: ClipboardList },
    ],
  },
  {
    titulo: "Conhecimento",
    itens: [
      { to: "/comece-aqui", label: "Comece aqui", desc: "Trilha de 7 dias", icon: Rocket },
      { to: "/matriz", label: "Matriz fiscal", desc: "Cenário → regras", icon: Grid3x3 },
      { to: "/mapa", label: "Mapa fiscal", desc: "Do documento aos eventos", icon: Map },
      { to: "/conhecimento", label: "Base fiscal", desc: "Campos, regras, XML", icon: BookOpen },
      { to: "/cenarios", label: "Cenários", desc: "Operação passo a passo", icon: RouteIcon },
      { to: "/reforma", label: "Reforma", desc: "IBS, CBS e IS", icon: Scale },
      { to: "/fontes", label: "Fontes", desc: "Manuais e legislação", icon: Library },
    ],
  },
  {
    titulo: "Laboratórios",
    itens: [
      { to: "/debugger", label: "Debugger", desc: "Regras e diagnóstico", icon: Bug },
      { to: "/cstat", label: "Rejeições", desc: "Causa e correção", icon: ShieldAlert },
      { to: "/conferir-xml", label: "Conferir XML", desc: "Carregar NF-e com erro", icon: FileSearch },
      { to: "/xml-lab", label: "XML Lab", desc: "Tag → campo → regra", icon: Code2 },
      { to: "/regressao", label: "Regressão", desc: "Casos de teste", icon: FlaskConical },
      { to: "/suporte", label: "Modo suporte", desc: "Roteiro do analista", icon: LifeBuoy },
      { to: "/incidentes", label: "Incidentes", desc: "Caso → conhecimento", icon: NotebookPen },
      { to: "/qualidade", label: "Qualidade", desc: "Lacunas e completude", icon: Gauge },
      { to: "/governanca", label: "Governança", desc: "Revisão e base oficial", icon: ShieldCheck },
      { to: "/math-lab", label: "Cálculos", desc: "Fórmula e resultado", icon: Calculator },
    ],
  },
  {
    titulo: "Aprendizado",
    itens: [
      { to: "/academia", label: "Academia", desc: "Trilhas e desafios", icon: GraduationCap },
    ],
  },
] as const;

export function Sidebar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="flex w-60 shrink-0 flex-col overflow-y-auto bg-nav text-nav-foreground"
    >
      <div className="px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Simulador Fiscal</p>
        <p className="text-xs text-nav-muted">Bíblia fiscal interativa</p>
      </div>

      <div className="flex-1 space-y-4 px-2 pb-6">
        {secoes.map((s) => (
          <div key={s.titulo}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-nav-muted">
              {s.titulo}
            </p>
            <ul className="space-y-0.5">
              {s.itens.map((m) => (
                <li key={m.to}>
                  <Link
                    to={m.to}
                    activeOptions={{ exact: m.to === "/" }}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-nav-muted transition-colors hover:bg-nav-active hover:text-nav-foreground [&.active]:bg-nav-active [&.active]:text-nav-foreground"
                  >
                    <m.icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.label}</span>
                      <span className="block truncate text-xs opacity-70">{m.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
