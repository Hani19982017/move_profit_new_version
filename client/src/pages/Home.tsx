import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

// ── Karten-Definitionen pro Rolle ──────────────────────────────────────────
// admin: alles
const ADMIN_CARDS = [
  { href: "/new-customer",  emoji: "👥", title: "Kunden & Verwaltung",          desc: "Kundendaten hinzufügen" },
  { href: "/orders",        emoji: "📦", title: "Kundenbetreuung & Verwaltung",    desc: "Kundengewinnung" },
  { href: "/reminders",     emoji: "⏰", title: "Erinnerungen & Kontaktstatus", desc: "Kunden, die nachverfolgt werden müssen" },
  { href: "/rechnungen",    emoji: "🧾", title: "Rechnungen",                    desc: "Rechnungen Zahlungen anzeigen verwalten" },
  { href: "/admin",         emoji: "📊", title: "Dashboard",                 desc: "Verwaltung von Kunden, Aufträgen Zahlungen" },
  { href: "/worker",        emoji: "👷", title: "Tägliche Mitarbeiteraufgaben",          desc: "Aufgaben, Adressen Fotos anzeigen" },
  { href: "/admin-reports", emoji: "📈", title: "Finanz- Verwaltungsberichte",    desc: "Schäden, Beschwerden & Umsatz" },
  { href: "/branches",      emoji: "🏢", title: "Filialverwaltung",                desc: "Filialen hinzufügen, deaktivieren reaktivieren" },
  { href: "/users",         emoji: "🔐", title: "Benutzerverwaltung",            desc: "Berechtigungen, Rollen Löschungen", adminOnly: true },
];

// sales: sieht weder Startseite (admin) noch Benutzerverwaltung noch Verwaltungsberichte
const SALES_CARDS = [
  { href: "/new-customer", emoji: "👥", title: "Kunden & Verwaltung",          desc: "Kundendaten hinzufügen" },
  { href: "/orders",       emoji: "📦", title: "Kundenbetreuung & Verwaltung",             desc: "Kundengewinnung" },
  { href: "/reminders",    emoji: "⏰", title: "Erinnerungen & Kontaktstatus", desc: "Kunden, die nachverfolgt werden müssen" },
  { href: "/rechnungen",   emoji: "🧾", title: "Rechnungen",            desc: "Rechnungen Zahlungen anzeigen verwalten" },
  { href: "/worker",       emoji: "👷", title: "Tägliche Mitarbeiteraufgaben",         desc: "Aufgaben Adressen anzeigen" },
];

// worker / supervisor: nur das Mitarbeiter-Dashboard
const WORKER_CARDS = [
  { href: "/worker",       emoji: "👷", title: "Meine Aufgaben heute",         desc: "Aufgaben, Adressen Fotos anzeigen" },
];

// branch_manager: read-only view of orders, invoices, worker tasks, and reports.
// Cannot add customers, cannot manage branch users.
const BRANCH_MANAGER_CARDS = [
  { href: "/orders",       emoji: "📦", title: "Kundenbetreuung & Verwaltung",             desc: "Kundengewinnung" },
  { href: "/rechnungen",   emoji: "🧾", title: "Rechnungen",            desc: "Filialrechnungen anzeigen" },
  { href: "/worker",       emoji: "👷", title: "Tägliche Mitarbeiteraufgaben",         desc: "Aufgaben Adressen anzeigen" },
  { href: "/admin-reports",emoji: "📈", title: "Finanz- Verwaltungsberichte",             desc: "Schäden, Beschwerden & Umsatz" },
];

function getCardsForRole(role: string) {
  switch (role) {
    case "admin":          return ADMIN_CARDS;
    case "sales":          return SALES_CARDS;
    case "worker":
    case "supervisor":     return WORKER_CARDS;
    case "branch_manager": return BRANCH_MANAGER_CARDS;
    default:               return SALES_CARDS; // normaler user = wie sales
  }
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin:          "Geschäftsführer / Inhaber",
    sales:          "Vertriebsteam",
    worker:         "Mitarbeiter",
    supervisor:     "Aufsicht",
    branch_manager: "Filialleiter",
  };
  return map[role] ?? role;
}

function getRoleBadgeColor(role: string) {
  const map: Record<string, string> = {
    admin:          "border-[#d97e3a]/30 bg-[#fff2e8] text-[#bd682b]",
    sales:          "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    worker:         "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    supervisor:     "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    branch_manager: "border-[#d97e3a]/30 bg-[#fff2e8] text-[#bd682b]",
  };
  return map[role] ?? "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]";
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const role = user?.role ?? "sales";
  const cards = getCardsForRole(role);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(26,77,109,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(217,126,58,0.18),transparent_24%),linear-gradient(135deg,#0f2f44_0%,#1a4d6d_52%,#14394f_100%)] text-white">
        <div className="container flex min-h-screen items-center justify-center py-12">
          <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6 text-right arabic">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm text-white/90 backdrop-blur-sm">
                MOVE PROFIS · Management System
              </span>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Kundenverwaltung, Aufträge, Mitarbeiter Rechnungen</h1>
                <p className="max-w-2xl text-lg leading-8 text-white/80">
                  Wählen Sie den richtigen Zugangstyp: Der Administrator meldet sich über die feste E-Mail mit Passwort an, Mitarbeiter und andere Benutzer
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-md">
              <div className="mb-6 flex flex-col items-center text-center">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/98724221/dRc3boRSBaEdddsbQmhM9N/move-profis-logo_c64616b7.webp"
                  alt="Move Profis"
                  className="mb-4 h-24 w-auto rounded-2xl border border-[#d97e3a]/40 bg-white px-6 py-4 shadow-lg"
                />
                <h2 className="text-2xl font-semibold">Willkommen bei MOVE PROFIS</h2>
                <p className="mt-2 text-sm leading-7 text-white/75">Wählen Sie den passenden Bereich: Der Administrator meldet sich separat über die feste E-Mail an </p>
              </div>
              <div className="space-y-3">
                <Button asChild size="lg" className="w-full bg-[#d97e3a] text-white hover:bg-[#bd682b]">
                  <a href="/login#manager">Administrator-Anmeldung via E-Mail & Passwort</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href="/login#staff">Mitarbeiter & andere Benutzer Anmeldung</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container py-8">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-[#1a4d6d]/12 bg-white/90 shadow-[0_18px_55px_rgba(26,77,109,0.12)] backdrop-blur-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-8">
            <div className="space-y-5 arabic">
              <span className="inline-flex items-center rounded-full border border-[#d97e3a]/30 bg-[#fff2e8] px-4 py-1 text-sm font-medium text-[#bd682b]">
                MOVE PROFIS DASHBOARD
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-[#1a4d6d] sm:text-4xl">Hallo {user?.name}, alle Betriebsvorgänge an einem Ort</h1>
                <p className="max-w-3xl text-base leading-8 text-slate-600">
                  Nutzen Sie die Karten unten für schnellen Zugriff auf Kundenverwaltung, Auftragsverfolgung, Mitarbeiteraufgaben, Berichte, Rechnungen Filialen 
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex text-xs px-3 py-1 rounded-full border font-medium ${getRoleBadgeColor(role)}`}>
                  {getRoleLabel(role)}
                </span>
                <span className="inline-flex rounded-full border border-[#1a4d6d]/15 bg-[#eaf2f7] px-3 py-1 text-xs font-medium text-[#1a4d6d]">
                  Benutzername: {user?.username || "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4 lg:items-end">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/98724221/dRc3boRSBaEdddsbQmhM9N/move-profis-logo_c64616b7.webp"
                alt="Move Profis"
                className="h-auto w-full max-w-[260px] rounded-[1.75rem] border border-[#d97e3a]/35 bg-white px-5 py-4 shadow-lg"
              />
              <p className="text-right text-sm text-slate-500">System zur Verwaltung von Transport Spedition</p>
              <Button
                onClick={() => logout()}
                className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
              >
                Abmelden
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, idx) => (
            <a
              key={card.href}
              href={card.href}
              className={`relative overflow-hidden rounded-[1.6rem] border bg-white/95 p-6 shadow-[0_14px_40px_rgba(26,77,109,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(26,77,109,0.16)] animate-fade-in ${
                (card as any).adminOnly ? "border-orange-200" : "border-[#1a4d6d]/10"
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1a4d6d] via-[#245f86] to-[#d97e3a]" />
              {(card as any).adminOnly && (
                <span className="absolute left-4 top-4 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  Nur für Administrator
                </span>
              )}
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf2f7] text-3xl shadow-inner">
                {card.emoji}
              </div>
              <h2 className="mb-2 text-xl font-semibold text-[#1a4d6d]">{card.title}</h2>
              <p className="leading-7 text-slate-600">{card.desc}</p>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-[#d97e3a]">
                Bereich öffnen
              </div>
            </a>
          ))}
        </div>

        {(role === "worker" || role === "supervisor") && (
          <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center shadow-sm">
            <p className="text-sm text-orange-800">
              Hallo {user?.name}! Sie können über das Mitarbeiter-Dashboard oben auf Ihre täglichen Aufgaben zugreifen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
