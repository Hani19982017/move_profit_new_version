import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Package, ArrowLeft, RefreshCw, Plus,
  MapPin, Calendar, Euro, Truck, Eye, Edit2, Trash2, Image, Building2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import MoveDetailDialog from "@/components/MoveDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCustomerNumber } from "@shared/customerNumber";

// ── Status-Badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:   { label: "Bestätigt",         cls: "bg-[#eaf2f7] text-[#1a4d6d] border-[#1a4d6d]/20" },
    pending:     { label: "Ausstehend", cls: "bg-[#fff2e8] text-[#bd682b] border-[#d97e3a]/20" },
    in_progress: { label: "In Bearbeitung",  cls: "bg-[#eaf2f7] text-[#1a4d6d] border-[#1a4d6d]/20" },
    completed:   { label: "Abgeschlossen",        cls: "bg-gray-100 text-gray-700 border-gray-200" },
    cancelled:   { label: "Storniert",         cls: "bg-red-100 text-red-800 border-red-200" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:    { label: "Bezahlt",      cls: "bg-green-100 text-green-700 border-green-200" },
    unpaid:  { label: "Unbezahlt", cls: "bg-red-100 text-red-800 border-red-200" },
    partial: { label: "Teilweise",       cls: "bg-[#fff2e8] text-[#bd682b] border-[#d97e3a]/20" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Statistik-Karte ───────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Bearbeitungs-Formular ─────────────────────────────────────────────────────────
function EditMoveDialog({
  move,
  open,
  onClose,
  onSaved,
}: {
  move: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pickupAddress, setPickupAddress]   = useState(move?.pickupAddress ?? "");
  const [pickupFloor, setPickupFloor]       = useState(move?.pickupFloor ?? "");
  const [pickupElev, setPickupElev]         = useState(move?.pickupElevatorCapacity ?? "");
  const [pickupPark, setPickupPark]         = useState(move?.pickupParkingDistance ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(move?.deliveryAddress ?? "");
  const [deliveryFloor, setDeliveryFloor]   = useState(move?.deliveryFloor ?? "");
  const [deliveryElev, setDeliveryElev]     = useState(move?.deliveryElevatorCapacity ?? "");
  const [deliveryPark, setDeliveryPark]     = useState(move?.deliveryParkingDistance ?? "");
  const [pickupDate, setPickupDate]         = useState(
    move?.pickupDate ? new Date(move.pickupDate).toISOString().slice(0, 16) : ""
  );
  const [deliveryDate, setDeliveryDate]     = useState(
    move?.deliveryDate ? new Date(move.deliveryDate).toISOString().slice(0, 16) : ""
  );
  const [grossPrice, setGrossPrice]         = useState(
    move?.grossPrice ? String(Number(move.grossPrice)) : ""
  );
  const [volume, setVolume]                 = useState(move?.volume ? String(move.volume) : "");
  const [distance, setDistance]             = useState(move?.distance ? String(move.distance) : "");
  const [numTrips, setNumTrips]             = useState(move?.numTrips ? String(move.numTrips) : "");
  const [status, setStatus]                 = useState(move?.status ?? "pending");
  const [paymentStatus, setPaymentStatus]   = useState(move?.paymentStatus ?? "unpaid");

  const utils = trpc.useUtils();
  const updateMove = trpc.moves.update.useMutation({
    onSuccess: () => {
      toast.success("Auftrag erfolgreich aktualisiert");
      utils.moves.list.invalidate();
      onSaved();
      onClose();
    },
    onError: (err) => {
      toast.error("Aktualisierung fehlgeschlagen: " + err.message);
    },
  });

  const handleSave = () => {
    updateMove.mutate({
      moveId: move.id,
      pickupAddress,
      pickupFloor,
      pickupElevatorCapacity: pickupElev,
      pickupParkingDistance: pickupPark,
      deliveryAddress,
      deliveryFloor,
      deliveryElevatorCapacity: deliveryElev,
      deliveryParkingDistance: deliveryPark,
      pickupDate: pickupDate ? new Date(pickupDate).toISOString() : undefined,
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
      grossPrice: grossPrice ? parseFloat(grossPrice) : undefined,
      volume: volume ? parseInt(volume) : undefined,
      distance: distance ? parseInt(distance) : undefined,
      numTrips: numTrips ? parseInt(numTrips) : undefined,
      status: status as any,
      paymentStatus: paymentStatus as any,
    });
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Auftrag bearbeiten — <span className="text-[#1a4d6d]">{formatCustomerNumber(move?.customerId) || move?.moveCode}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status Zahlung */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Auftragsstatus">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">Ausstehend</option>
                <option value="confirmed">Bestätigt</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="completed">Abgeschlossen</option>
                <option value="cancelled">Storniert</option>
              </select>
            </Field>
            <Field label="Zahlungsstatus">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="unpaid">Unbezahlt</option>
                <option value="partial">Teilweise bezahlt</option>
                <option value="paid">Vollständig bezahlt</option>
              </select>
            </Field>
          </div>

          {/* Datum Preis */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Abholdatum">
              <Input
                type="datetime-local"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="text-sm"
              />
            </Field>
            <Field label="Lieferdatum">
              <Input
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Preis Gesamt (€)">
              <Input
                type="number"
                value={grossPrice}
                onChange={(e) => setGrossPrice(e.target.value)}
                placeholder="0.00"
                className="text-sm"
              />
            </Field>
            <Field label="Volumen (m³)">
              <Input
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </Field>
            <Field label="Entfernung (km)">
              <Input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </Field>
          </div>

          {/* Auszugsadresse */}
          <div className="rounded-lg border bg-[#f4f8fb] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a4d6d]">
              <MapPin size={14} /> Auszugsadresse
            </p>
            <div className="space-y-3">
              <Field label="Vollständige Adresse">
                <Input
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Straße, Hausnummer, PLZ, Stadt"
                  className="text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Etage">
                  <Input
                    value={pickupFloor}
                    onChange={(e) => setPickupFloor(e.target.value)}
                    placeholder="z.B. 2.Etage"
                    className="text-sm"
                  />
                </Field>
                <Field label="Aufzug">
                  <Input
                    value={pickupElev}
                    onChange={(e) => setPickupElev(e.target.value)}
                    placeholder="Aufzug"
                    className="text-sm"
                  />
                </Field>
                <Field label="Entfernung zum LKW">
                  <Input
                    value={pickupPark}
                    onChange={(e) => setPickupPark(e.target.value)}
                    placeholder="z.B. 20-30m"
                    className="text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Einzugsadresse */}
          <div className="rounded-lg border bg-[#fff7f1] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#bd682b]">
              <MapPin size={14} /> Einzugsadresse
            </p>
            <div className="space-y-3">
              <Field label="Vollständige Adresse">
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Straße, Hausnummer, PLZ, Stadt"
                  className="text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Etage">
                  <Input
                    value={deliveryFloor}
                    onChange={(e) => setDeliveryFloor(e.target.value)}
                    placeholder="z.B. 3.Etage"
                    className="text-sm"
                  />
                </Field>
                <Field label="Aufzug">
                  <Input
                    value={deliveryElev}
                    onChange={(e) => setDeliveryElev(e.target.value)}
                    placeholder="Aufzug"
                    className="text-sm"
                  />
                </Field>
                <Field label="Entfernung zum LKW">
                  <Input
                    value={deliveryPark}
                    onChange={(e) => setDeliveryPark(e.target.value)}
                    placeholder="z.B. 10-20m"
                    className="text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Anzahl der Fahrten */}
          <Field label="Anzahl der Fahrten">
            <Input
              type="number"
              value={numTrips}
              onChange={(e) => setNumTrips(e.target.value)}
              placeholder="0"
              className="text-sm w-32"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={updateMove.isPending}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMove.isPending}
            className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
          >
            {updateMove.isPending ? "Wird gespeichert..." : "Änderungen speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Startseite ───────────────────────────────────────────────────────────
export default function Orders() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // branch_manager is read-only — they can view everything in their branch
  // but cannot edit, delete, or create moves.
  const isReadOnly = user?.role === "branch_manager";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editMove, setEditMove] = useState<any>(null);
  const [viewMoveId, setViewMoveId] = useState<number | null>(null);
  const [editMoveId, setEditMoveId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const deleteMove = trpc.moves.delete.useMutation({
    onSuccess: () => {
      toast.success("✅ Auftrag erfolgreich gelöscht");
      utils.moves.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error("❌ Löschen fehlgeschlagen: " + e.message),
  });

  // Filialen abrufen (nur Admin)
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: !!user && user.role === 'admin',
  });
  const branches = branchesQuery.data ?? [];

  // Daten abrufen
  const movesQuery = trpc.moves?.list?.useQuery
    ? trpc.moves.list.useQuery(
        user?.role === 'admin' ? { branchId: selectedBranchId } : undefined,
        { enabled: !!user }
      )
    : { data: undefined, isLoading: false, refetch: () => {} };

  const moves = (movesQuery as any).data ?? [];

  // Filter
  const filtered = moves.filter((m: any) => {
    const q = searchTerm.toLowerCase();
    const kundenummer = formatCustomerNumber(m.customerId)?.toLowerCase();
    const matchSearch =
      kundenummer?.includes(q) ||
      m.pickupAddress?.toLowerCase().includes(q) ||
      m.deliveryAddress?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Statistiken
  const total = moves.length;
  const active = moves.filter((m: any) =>
    ["pending", "confirmed", "in_progress"].includes(m.status)
  ).length;
  const completed = moves.filter((m: any) => m.status === "completed").length;
  const unpaid = moves.filter((m: any) => m.paymentStatus === "unpaid").length;
  const handleRefreshAll = () => {
    (movesQuery as any).refetch?.();
    toast.success("Daten aktualisiert");
  };

  const statusOptions = [   { value: "all",         label: "Alle" },
    { value: "pending",     label: "Ausstehend" },
    { value: "confirmed",   label: "Bestätigt" },
    { value: "in_progress", label: "In Bearbeitung" },
    { value: "completed",   label: "Abgeschlossen" },
    { value: "cancelled",   label: "Storniert" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Titelleiste */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> Startseite
          </button>
          <h1 className="text-lg font-bold text-gray-900">Auftragsverwaltung</h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && branches.length > 0 && (
            <Select
              value={selectedBranchId === null ? 'all' : String(selectedBranchId)}
              onValueChange={(v) => setSelectedBranchId(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <Building2 size={14} className="mr-1 text-gray-400" />
                <SelectValue placeholder="Alle Filialen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Filialen</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="flex items-center gap-1"
          >
            <RefreshCw size={14} /> Aktualisieren
          </Button>
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => navigate("/new-customer")}
              className="flex items-center gap-1 bg-[#1a4d6d] text-white hover:bg-[#14394f]"
            >
              <Plus size={14} /> Neuer Auftrag
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Statistiken */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Aufträge gesamt" value={total}     sub="Alle Aufträge"     icon={Package}  color="bg-[#1a4d6d]" />
          <StatCard title="aktive Aufträge" value={active}    sub="In Bearbeitung"      icon={Truck}    color="bg-orange-500" />
          <StatCard title="Abgeschlossen"          value={completed} sub="Geliefert"       icon={Package}  color="bg-[#d97e3a]" />
          <StatCard title="Unbezahlt"      value={unpaid}    sub="Erfordern Folgemaßnahmen"     icon={Euro}     color="bg-red-500" />
        </div>

        {/* Such- Filterleiste */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Suche nach Kundennummer oder Adresse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === opt.value
                    ? "border-[#1a4d6d] bg-[#1a4d6d] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#1a4d6d] hover:text-[#1a4d6d]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auftragsliste */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Auftragsliste</CardTitle>
                <CardDescription>
                  {filtered.length} Aufträge{filtered.length !== total ? ` Von ${total}` : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(movesQuery as any).isLoading ? (
              <div className="text-center py-16 text-gray-400">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
                Wird geladen...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "Keine Ergebnisse für Ihre Suche"
                    : "Noch keine Aufträge"}
                </p>
                {!searchTerm && statusFilter === "all" && !isReadOnly && (
                  <Button
                    onClick={() => navigate("/new-customer")}
                    className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                  >
                    <Plus size={14} className="mr-1" /> Ersten Auftrag hinzufügen
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Tabelle für große Bildschirme */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Kundennummer</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><MapPin size={13} /> Von</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><MapPin size={13} /> Nach</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Calendar size={13} /> Datum</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Zahlung</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Euro size={13} /> Preis</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Image size={13} /> Fotos</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((move: any) => (
                        <tr key={move.id} className={`border-b transition-colors ${move.istBezahlt ? 'border-green-200 bg-green-50 hover:bg-green-100/60' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{formatCustomerNumber(move.customerId) || move.moveCode || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                            <span className="block truncate" title={move.pickupAddress}>
                              {move.pickupAddress || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                            <span className="block truncate" title={move.deliveryAddress}>
                              {move.deliveryAddress || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {move.pickupDate
                              ? new Date(move.pickupDate).toLocaleDateString("de-DE")
                              : "—"}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={move.status} /></td>
                          <td className="px-4 py-3"><PayBadge status={move.paymentStatus} /></td>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {move.customerPhotoCount > 0 ? (
                              <span
                                title={`${move.customerPhotoCount} Hochgeladenes Bild`}
                                className="inline-flex items-center gap-1 rounded-full border border-[#1a4d6d]/20 bg-[#eaf2f7] px-2 py-0.5 text-xs font-semibold text-[#1a4d6d]"
                              >
                                <Image size={11} />{move.customerPhotoCount}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewMoveId(move.id)}
                                title="Auftrag vollständig anzeigen"
                                className="hover:bg-gray-100"
                              >
                                <Eye size={13} />
                              </Button>
                              {!isReadOnly && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditMoveId(move.id)}
                                    title="Auftrag bearbeiten vollständig"
                                    className="hover:border-[#1a4d6d] hover:bg-[#1a4d6d]/10 hover:text-[#1a4d6d]"
                                  >
                                    <Edit2 size={13} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteConfirmId(move.id)}
                                    title="Auftrag löschen"
                                    className="hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Karten für Mobilgeräte */}
                <div className="md:hidden space-y-3">
                  {filtered.map((move: any) => (
                    <div key={move.id} className={`rounded-lg border p-4 ${move.istBezahlt ? 'border-green-200 bg-green-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1a4d6d]">{formatCustomerNumber(move.customerId) || move.moveCode || "—"}</span>
                          {move.customerPhotoCount > 0 && (
                            <span
                              title={`${move.customerPhotoCount} Hochgeladenes Bild`}
                              className="inline-flex items-center gap-1 rounded-full border border-[#1a4d6d]/20 bg-[#eaf2f7] px-1.5 py-0.5 text-xs font-semibold text-[#1a4d6d]"
                            >
                              <Image size={10} />{move.customerPhotoCount}
                            </span>
                          )}
                        </div>
                        <StatusBadge status={move.status} />
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-[#1a4d6d]" />
                          <span className="truncate">{move.pickupAddress || "—"}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-[#d97e3a]" />
                          <span className="truncate">{move.deliveryAddress || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-gray-400" />
                            <span className="text-xs">
                              {move.pickupDate
                                ? new Date(move.pickupDate).toLocaleDateString("de-DE")
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <PayBadge status={move.paymentStatus} />
                            <span className="font-semibold text-gray-800">
                              {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setViewMoveId(move.id)}
                        >
                          <Eye size={13} className="mr-1" /> Anzeigen
                        </Button>
                        {!isReadOnly && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 hover:border-[#1a4d6d] hover:bg-[#1a4d6d]/10 hover:text-[#1a4d6d]"
                              onClick={() => setEditMoveId(move.id)}
                            >
                              <Edit2 size={13} className="mr-1" /> Bearbeiten
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                              onClick={() => setDeleteConfirmId(move.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Altes Auftrags-Bearbeitungsfenster — aus Kompatibilitätsgründen */}
      {editMove && (
        <EditMoveDialog
          move={editMove}
          open={!!editMove}
          onClose={() => setEditMove(null)}
          onSaved={() => (movesQuery as any).refetch?.()}
        />
      )}

      {/* Vollständige Ansicht */}
      {viewMoveId !== null && (
        <MoveDetailDialog
          moveId={viewMoveId}
          mode="view"
          onClose={() => setViewMoveId(null)}
        />
      )}

      {/* Vollständige Bearbeitung */}
      {editMoveId !== null && (
        <MoveDetailDialog
          moveId={editMoveId}
          mode="edit"
          onClose={() => setEditMoveId(null)}
          onSaved={() => { (movesQuery as any).refetch?.(); }}
        />
      )}

      {/* Löschbestätigung */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 size={18} /> Bestätigen Auftrag löschen
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Möchten Sie diesen Auftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Abbrechen</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMove.isPending}
              onClick={() => deleteConfirmId && deleteMove.mutate({ moveId: deleteConfirmId })}
            >
              {deleteMove.isPending ? "Wird gelöscht..." : "Auftrag löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
