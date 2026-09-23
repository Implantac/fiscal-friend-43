import { Link } from "@tanstack/react-router";
import {
  Inbox,
  FileText,
  ShoppingCart,
  Briefcase,
  Truck,
  Bus,
  ClipboardList,
} from "lucide-react";

const modulos = [
  { to: "/", label: "Manifestação", desc: "Notas recebidas", icon: Inbox },
  { to: "/nfe", label: "NF-e 55", desc: "Produtos", icon: FileText },
  { to: "/nfce", label: "NFC-e 65", desc: "Varejo / PDV", icon: ShoppingCart },
  { to: "/nfse", label: "NFS-e", desc: "Serviços", icon: Briefcase },
  { to: "/cte", label: "CT-e 57", desc: "Carga", icon: Truck },
  { to: "/cte-os", label: "CT-e OS 67", desc: "Pessoas e valores", icon: Bus },
  { to: "/mdfe", label: "MDF-e 58", desc: "Manifesto", icon: ClipboardList },
] as const;

export function Sidebar() {
  return (
    <nav
      aria-label="Módulos fiscais"
      className="flex w-60 shrink-0 flex-col bg-nav text-nav-foreground"
    >
      <div className="px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Simulador Fiscal</p>
        <p className="text-xs text-nav-muted">Blueprint de integração ERP</p>
      </div>
      <ul className="flex-1 space-y-0.5 px-2 pb-4">
        {modulos.map((m) => (
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
    </nav>
  );
}
