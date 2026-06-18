import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Users, Shield, Trash2, Edit2, RefreshCw,
  UserCheck, ShoppingBag, HardHat, User, Crown, Mail, UserCog,
  Building2, Info, UserPlus, KeyRound, Eye, EyeOff, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { BranchFormDialog } from "@/components/BranchFormDialog";

// ── Rollen-Definition ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: "admin",          label: "Geschäftsführer / Inhaber", icon: Crown,       color: "bg-red-100 text-red-800 border-red-200",      desc: "Vollzugriff auf alle Bereiche und Verwaltungsfunktionen" },
  { value: "sales",          label: "Vertriebsteam",     icon: ShoppingBag, color: "bg-[#eaf2f7] text-[#1a4d6d] border-[#1a4d6d]/20",   desc: "Kunden hinzufügen, Aufträge einsehen, Mitarbeiter-Dashboard" },
  { value: "worker",         label: "Mitarbeiter",              icon: HardHat,     color: "bg-[#fff2e8] text-[#bd682b] border-[#d97e3a]/20", desc: "Tägliche Aufgaben, Adressen und Fotos einsehen" },
  { value: "supervisor",     label: "Aufsicht",              icon: UserCheck,   color: "bg-[#fff7f1] text-[#a85d28] border-[#d97e3a]/15", desc: "Aufgaben überwachen und Berichte erfassen" },
  { value: "branch_manager", label: "Filialleiter",          icon: Shield,      color: "bg-orange-100 text-orange-800 border-orange-200", desc: "Filialverwaltung, nur Lesezugriff" },
] as const;

type RoleValue = typeof ROLES[number]["value"];

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(x => x.value === role) ?? ROLES[ROLES.length - 1];
  const Icon = r.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${r.color}`}>
      <Icon size={11} />
      {r.label}
    </span>
  );
}

// ── Startseite ───────────────────────────────────────────────────────────
export default function UsersManagement() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  // Status: Neuen Benutzer erstellen
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', username: '', password: '', role: 'worker', branchId: '' });
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [createError, setCreateError] = useState('');

  // Status: Passwort ändern
  const [pwdUser, setPwdUser] = useState<any>(null);
  const [newPwd, setNewPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Status: Vollständiges Bearbeitungsfenster
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<RoleValue>("sales");
  const [editBranchId, setEditBranchId] = useState<string>("");

  // Status: Löschfenster
  const [deleteUser, setDeleteUser] = useState<any>(null);

  // Status: Filialauswahl
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Status: Neue Filiale aus diesem Bereich erstellen
  const [showCreateBranch, setShowCreateBranch] = useState(false);

  // Benutzer Filialen abrufen — für Hauptadmin Filialleiter
  const canManageUsers = user?.role === 'admin' || user?.role === 'branch_manager';
  const usersQuery = trpc.users.list.useQuery(undefined, {
    enabled: !!user && canManageUsers,
  });
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: !!user && canManageUsers,
  });

  // Mutations
  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => usersQuery.refetch(),
    onError: (err) => toast.error(err.message || "Rolle aktualisieren fehlgeschlagen"),
  });

  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Benutzerdaten erfolgreich aktualisiert");
      setEditUser(null);
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Aktualisieren der Daten fehlgeschlagen"),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Benutzer erfolgreich gelöscht");
      setDeleteUser(null);
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Benutzer löschen fehlgeschlagen"),
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success('Benutzer erfolgreich erstellt');
      setShowCreate(false);
      setCreateForm({ name: '', username: '', password: '', role: 'worker', branchId: '' });
      setCreateError('');
      usersQuery.refetch();
    },
    onError: (err) => setCreateError(err.message || 'Benutzer erstellen fehlgeschlagen'),
  });

  const updatePasswordMutation = trpc.users.updatePassword.useMutation({
    onSuccess: () => {
      toast.success('Passwort erfolgreich geändert');
      setPwdUser(null);
      setNewPwd('');
    },
    onError: (err) => toast.error(err.message || 'Passwort ändern fehlgeschlagen'),
  });

  const handleCreate = () => {
    setCreateError('');
    if (!createForm.name || !createForm.username || !createForm.password) {
      setCreateError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    createMutation.mutate({
      name: createForm.name,
      username: createForm.username,
      password: createForm.password,
      role: createForm.role as any,
      branchId: createForm.branchId && createForm.branchId !== 'none' ? parseInt(createForm.branchId) : null,
    });
  };

  // Bearbeitungsfenster öffnen Daten befüllen
  const openEdit = (u: any) => {
    setEditUser(u);
    setEditName(u.name || "");
    setEditUsername(u.username || "");
    setEditRole(u.role as RoleValue);
    setEditBranchId(u.branchId ? String(u.branchId) : "");
  };

  // Änderungen speichern
  const handleSaveEdit = () => {
    if (!editUser) return;
    const promises: Promise<any>[] = [];

    // Rolle aktualisieren, wenn geändert
    if (editRole !== editUser.role) {
      promises.push(
        updateRoleMutation.mutateAsync({ userId: editUser.id, role: editRole })
      );
    }

    // Weitere Daten aktualisieren
    const profileChanged =
      editName !== (editUser.name || "") ||
      editUsername !== (editUser.username || "") ||
      (editBranchId ? parseInt(editBranchId) : null) !== editUser.branchId;

    if (profileChanged) {
      promises.push(
        updateProfileMutation.mutateAsync({
          userId: editUser.id,
          name: editName || undefined,
          username: editUsername || undefined,
          branchId: editBranchId ? parseInt(editBranchId) : null,
        })
      );
    }

    if (promises.length === 0) {
      toast.info("Keine Änderungen zum Speichern");
      setEditUser(null);
      return;
    }

    Promise.all(promises).catch(() => {});
  };

  // Seitenschutz: nur Hauptadmin Filialleiter
  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== 'admin' && user?.role !== 'branch_manager') {
      navigate("/");
    }
  }, [loading, isAuthenticated, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => (window.location.href = getLoginUrl())}>Anmelden</Button>
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'branch_manager') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-gray-600">Sie haben keine Berechtigung für diese Seite</p>
        </div>
      </div>
    );
  }

  const allUsers = usersQuery.data ?? [];
  const branches = (branchesQuery.data as any[]) ?? [];
  const activeBranches = branches.filter((b: any) => b.isActive);

  // Filialleiter sieht nur Benutzer seiner Filiale (ohne Hauptadmins)
  let visibleUsers = user?.role === 'branch_manager'
    ? allUsers.filter((u: any) => u.branchId === user.branchId && u.role !== 'admin')
    : allUsers;

  // Nach gewählter Filiale filtern (nur Hauptadmin)
  if (user?.role === 'admin' && selectedBranchId && selectedBranchId !== 'all') {
    visibleUsers = visibleUsers.filter((u: any) => u.branchId === parseInt(selectedBranchId));
  }

  const roleStats = ROLES.map(r => ({
    ...r,
    count: visibleUsers.filter((u: any) => u.role === r.value).length,
  }));

  const isSaving = updateRoleMutation.isPending || updateProfileMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Titelleiste */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> Dashboard
          </button>
          <h1 className="text-lg font-bold text-gray-900">Benutzerverwaltung</h1>
          {user?.role === 'admin' ? (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-medium">
              Hauptadministrator
            </span>
          ) : (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200 font-medium">
              Filialleiter
            </span>
          )}
        </div>
        {/* Dropdown Filialauswahl — nur Hauptadmin */}
        {user?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-700">Filiale:</Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filiale auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Filialen</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Button
              onClick={() => setShowCreateBranch(true)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 border-[#d97e3a]/30 text-[#bd682b] hover:bg-[#fff7f1]"
            >
              <Building2 size={14} /> Filiale hinzufügen
            </Button>
          )}
          <Button
            onClick={() => { setCreateError(''); setShowCreate(true); }}
            size="sm"
            className="bg-[#1a4d6d] text-white hover:bg-[#14394f] flex items-center gap-1"
          >
            <UserPlus size={14} /> Benutzer hinzufügen
          </Button>
          <Button variant="outline" size="sm" onClick={() => { usersQuery.refetch(); branchesQuery.refetch(); }} className="flex items-center gap-1">
            <RefreshCw size={14} /> Aktualisieren
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Wichtiger Hinweis zum Passwort */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#1a4d6d]/15 bg-[#eaf2f7] p-3">
          <Info size={16} className="mt-0.5 shrink-0 text-[#1a4d6d]" />
          <div className="text-sm text-[#1a4d6d]">
            <strong>Internes Anmeldesystem:</strong> Neue Benutzer melden sich über die Seite <strong>/login</strong> mit <strong>Benutzername</strong> 
            Für lokale Benutzer können Sie das Passwort hier über das Schlüsselsymbol ändern <KeyRound size={12} className="inline" />.
          </div>
        </div>

        {/* Erläuterung des Berechtigungssystems */}
        <Card className="mb-6 border-[#1a4d6d]/15 bg-[#f4f8fb]">
          <CardContent className="pt-4 pb-3">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#1a4d6d]">
              <Shield size={16} /> Berechtigungssystem — Erläuterung der Rollen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ROLES.map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.value} className={`flex items-start gap-2 p-2 rounded-lg border ${r.color}`}>
                    <Icon size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{r.label}</p>
                      <p className="text-xs opacity-80">{r.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rollen-Statistik */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {roleStats.map(r => {
            const Icon = r.icon;
            return (
              <div key={r.value} className="bg-white rounded-lg border p-3 text-center">
                <Icon size={20} className="mx-auto mb-1 text-gray-500" />
                <p className="text-xl font-bold text-gray-900">{r.count}</p>
                <p className="text-xs text-gray-500 leading-tight">{r.label}</p>
              </div>
            );
          })}
        </div>

        {/* Benutzertabelle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={18} />
              Benutzerliste ({visibleUsers.length})
              {user?.role === 'branch_manager' && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">Nur Ihre Filiale</span>
              )}
            </CardTitle>
            <CardDescription>
              Klicken Sie auf das Bearbeitungssymbol, um Vollständiger Name, Benutzername, Rolle oder Filiale zu ändern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <div className="text-center py-12 text-gray-400">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
                Wird geladen...
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Noch keine Benutzer</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">#</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Benutzername</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Rolle</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Filiale</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Beitrittsdatum</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u: any, idx: number) => {
                      const branch = branches.find((b: any) => b.id === u.branchId);
                      return (
                        <tr
                          key={u.id}
                          className={`border-b transition-colors ${
                            u.id === user?.id ? "bg-[#f4f8fb]" : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a4d6d] to-[#245f86] text-xs font-bold text-white">
                                {(u.name || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{u.name || "—"}</p>
                                {u.id === user?.id && (
                                  <span className="text-xs text-[#1a4d6d]/70">(Sie)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            <div className="flex items-center gap-1">
                              <User size={12} className="text-gray-400" />
                              {u.username || "—"}
                              {u.isLocalUser ? <span className="rounded px-1 text-xs bg-[#fff2e8] text-[#bd682b]">Lokal</span> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {branch ? (
                              <div className="flex items-center gap-1">
                                <Building2 size={12} className="text-gray-400" />
                                {branch.name}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString("de-DE")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(u)}
                                title="Bearbeiten Daten Benutzer"
                                className="text-[#1a4d6d] hover:text-[#14394f] hover:border-[#1a4d6d]/30"
                              >
                                <Edit2 size={13} />
                              </Button>
                              {u.isLocalUser && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-[#bd682b] hover:text-[#a85c24] hover:border-[#e7b18a]"
                                  onClick={() => { setPwdUser(u); setNewPwd(''); }}
                                  title="Passwort ändern"
                                >
                                  <KeyRound size={13} />
                                </Button>
                              )}
                              {u.id !== user?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                                  onClick={() => setDeleteUser(u)}
                                  title="Benutzer löschen"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Benutzerdaten vollständig bearbeiten
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog size={18} className="text-[#1a4d6d]" />
              Bearbeiten Daten Benutzer
            </DialogTitle>
          </DialogHeader>

          {editUser && (
            <div className="space-y-4 py-2">
              {/* Benutzer-Identitätskarte */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a4d6d] to-[#245f86] text-lg font-bold text-white">
                  {(editUser.name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{editUser.name || "—"}</p>
                  <p className="text-xs text-gray-500">ID: {editUser.id} · Beigetreten: {editUser.createdAt ? new Date(editUser.createdAt).toLocaleDateString("de-DE") : "—"}</p>
                  <p className="text-xs text-gray-400">Anmeldeart: {editUser.loginMethod || "—"}</p>
                </div>
              </div>

              {/* Namensfeld */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Vollständiger Name
                </Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Vollständiger Name eingeben"
                />
              </div>

              {/* Benutzernamefeld */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Benutzername
                </Label>
                <Input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="username"
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">
                  * Wird für die einheitliche interne Anmeldung aller Benutzer verwendet.
                </p>
              </div>

              {/* Rollenfeld */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Rolle / Berechtigung
                </Label>
                {editUser.id === user?.id ? (
                  <div className="flex items-center gap-2 rounded border border-[#e7b18a] bg-[#fff2e8] p-2 text-sm text-[#8f4f1f]">
                    <Info size={14} />
                    Sie können Ihre eigene Rolle nicht ändern
                  </div>
                ) : (
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as RoleValue)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter(r => user?.role === 'branch_manager' ? r.value !== 'admin' && r.value !== 'branch_manager' : true)
                        .map(r => {
                        const Icon = r.icon;
                        return (
                          <SelectItem key={r.value} value={r.value}>
                            <div className="flex items-center gap-2">
                              <Icon size={14} />
                              <span>{r.label}</span>
                              <span className="text-xs text-gray-400">— {r.desc}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Filialfeld — Filialleiter kann es nicht ändern */}
              {user?.role === 'admin' ? (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    Zugewiesene Filiale
                  </Label>
                  <Select
                    value={editBranchId || "none"}
                    onValueChange={(v) => setEditBranchId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ohne Filiale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ohne Filiale (Hauptadministrator)</SelectItem>
                      {branches.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          <div className="flex items-center gap-2">
                            <Building2 size={13} />
                            {b.name} — {b.city}{!b.isActive ? ' (Inaktiv)' : ''}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                  Filiale: Kann hier nicht geändert werden
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Abbrechen</Button>
            <Button
              className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
              disabled={isSaving}
              onClick={handleSaveEdit}
            >
              {isSaving ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neue Filiale aus der Benutzerverwaltung erstellen */}
      <BranchFormDialog
        open={showCreateBranch}
        onOpenChange={setShowCreateBranch}
        title="Neue Filiale hinzufügen"
        description="Es wird dasselbe Filial-Erstellungsfenster wie im Filialen-Bereich verwendet. Die verknüpften Listen werden direkt danach aktualisiert"
      />

      {/* Neuen Benutzer erstellen */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-[#d97e3a]" />
              Neuen Benutzer hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{createError}</div>
            )}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Vollständiger Name *</Label>
              <Input value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} placeholder="z.B. Max Mustermann" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Benutzername (Username) *</Label>
              <Input value={createForm.username} onChange={e => setCreateForm({...createForm, username: e.target.value})} placeholder="z.B. ahmed.ali" />
              <p className="text-xs text-gray-400 mt-1">Für Anmeldung — ohne E-Mail</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Passwort * (mind. 6 Zeichen)</Label>
              <div className="relative">
                <Input
                  type={showCreatePwd ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={e => setCreateForm({...createForm, password: e.target.value})}
                  placeholder="Passwort eingeben"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowCreatePwd(!showCreatePwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCreatePwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className={user?.role === 'branch_manager' ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Rolle *</Label>
                <Select value={createForm.role} onValueChange={v => setCreateForm({...createForm, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* Filialleiter kann keinen Hauptadmin oder weiteren Filialleiter erstellen */}
                    {ROLES.filter(r => user?.role === 'branch_manager' ? r.value !== 'admin' && r.value !== 'branch_manager' : true)
                      .map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Filialleiter wählt keine Filiale — wird automatisch zugewiesen */}
              {user?.role === 'admin' && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">Filiale</Label>
                  <Select value={createForm.branchId || 'none'} onValueChange={v => setCreateForm({...createForm, branchId: v === 'none' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ohne Filiale</SelectItem>
                      {activeBranches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {user?.role === 'branch_manager' && (
                <div className="mt-2 rounded border border-[#1a4d6d]/15 bg-[#f4f8fb] p-2 text-xs text-[#1a4d6d]">
                  Benutzer wird automatisch Ihrer Filiale zugewiesen
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#d97e3a] text-white hover:bg-[#bd682b]">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passwort ändern */}
      <Dialog open={!!pwdUser} onOpenChange={() => setPwdUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-[#d97e3a]" />
              Passwort ändern
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">Neues Passwort für <strong>{pwdUser?.name}</strong></p>
            <div className="relative">
              <Input
                type={showNewPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Neues Passwort (mind. 6 Zeichen)"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdUser(null)}>Abbrechen</Button>
            <Button
              onClick={() => updatePasswordMutation.mutate({ userId: pwdUser.id, newPassword: newPwd })}
              disabled={!newPwd || newPwd.length < 6 || updatePasswordMutation.isPending}
              className="bg-[#d97e3a] text-white hover:bg-[#bd682b]"
            >
              {updatePasswordMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Ändern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschbestätigung */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestätigen Benutzer löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Benutzer <strong>{deleteUser?.name}</strong>?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteUser) {
                  deleteMutation.mutate({ userId: deleteUser.id });
                }
              }}
            >
              {deleteMutation.isPending ? "Wird gelöscht..." : "Benutzer löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
