import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CheckCircle2, MapPin, Phone, Mail, Navigation, ExternalLink,
  AlertTriangle, MessageSquareWarning, X, Upload, Package, Truck,
  Euro, Image, Wrench, ChevronDown, ChevronUp
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// Google Maps-Link erstellen
function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Klickbare Adresskomponente
function AddressLink({ address, label, colorClass, iconColorClass }: {
  address: string; label: string; colorClass: string; iconColorClass: string;
}) {
  if (!address) return null;
  return (
    <div>
      <p className="text-sm text-gray-600 flex items-center gap-2 mb-2">
        <MapPin className={`w-4 h-4 ${iconColorClass}`} />
        {label}
      </p>
      <a
        href={buildGoogleMapsUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-between gap-3 ${colorClass} p-3 rounded-lg group hover:opacity-90 transition-opacity cursor-pointer`}
      >
        <span className="text-base font-semibold leading-snug">{address}</span>
        <span className="flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100 whitespace-nowrap shrink-0">
          <Navigation size={14} /><ExternalLink size={12} />
        </span>
      </a>
    </div>
  );
}

// Einklappbarer Bereich
function CollapsibleSection({ title, icon, children, defaultOpen = true, accentColor = "blue" }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  defaultOpen?: boolean; accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap: Record<string, string> = {
    blue: "border-[#1a4d6d]/20 bg-[#eaf2f7]",
    green: "border-[#d97e3a]/25 bg-[#fff2e8]",
    purple: "border-[#1a4d6d]/16 bg-[#f4f8fb]",
    orange: "border-[#d97e3a]/25 bg-[#fff2e8]",
    teal: "border-[#1a4d6d]/20 bg-[#eaf2f7]",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <Card className="overflow-hidden">
      <button
        className={`w-full flex items-center justify-between px-4 py-3 border-b ${colorMap[accentColor] || colorMap.blue} transition-colors`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800">{icon}{title}</div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <CardContent className="pt-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

// Kleines Info-Feld
function InfoField({ label, value, className = "" }: { label: string; value: string | number | null | undefined; className?: string }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={`bg-white border border-gray-100 rounded-lg p-3 ${className}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-800 text-sm">{value}</p>
    </div>
  );
}

// Foto komprimieren
async function compressImage(file: File): Promise<{ name: string; data: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve({ name: file.name, data: canvas.toDataURL("image/jpeg", 0.75) });
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Ausstehend", className: "bg-[#fff2e8] text-[#bd682b]" },
    confirmed: { label: "Bestätigt", className: "bg-[#eaf2f7] text-[#1a4d6d]" },
    in_progress: { label: "In Bearbeitung", className: "bg-[#fff2e8] text-[#bd682b]" },
    completed: { label: "Abgeschlossen", className: "bg-[#eaf2f7] text-[#1a4d6d]" },
    cancelled: { label: "Storniert", className: "bg-red-100 text-red-800" },
  };
  const s = map[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  return <Badge className={`${s.className} border-0 text-xs`}>{s.label}</Badge>;
}

function formatCents(cents: number | null | undefined): string {
  if (!cents && cents !== 0) return "—";
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

type ReportType = "schaden" | "beschwerde" | null;

// ===== Interaktive Finanzen-Komponente für Mitarbeiter =====
function WorkerFinanzenSection({ task, onRefetch }: { task: any; onRefetch: () => void }) {
  const [bankBetrag, setBankBetrag] = useState<string>(task?.bankBetrag ? String(task.bankBetrag / 100) : "");
  const [barBetrag, setBarBetrag] = useState<string>(task?.barBetrag ? String(task.barBetrag / 100) : "");
  const [paymentWay, setPaymentWay] = useState<string>(task?.paymentWay || "Bank");
  const [istBezahlt, setIstBezahlt] = useState<number>(task?.istBezahlt || 0);
  const [saving, setSaving] = useState(false);
  const updatePaymentMutation = trpc.workerMoves.updatePayment.useMutation({
    onSuccess: () => {
      toast.success("Gespeichert Zahlungsdaten erfolgreich");
      setSaving(false);
      onRefetch();
    },
    onError: (e) => {
      toast.error("Fehler: " + e.message);
      setSaving(false);
    },
  });
  const handleSave = () => {
    if (!task) return;
    setSaving(true);
    updatePaymentMutation.mutate({
      moveId: task.id,
      bankBetrag: bankBetrag ? parseFloat(bankBetrag) : undefined,
      barBetrag: barBetrag ? parseFloat(barBetrag) : undefined,
      paymentWay,
      istBezahlt,
    });
  };
  if (!task) return null;
  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between border-b border-[#d97e3a]/20 bg-[#fff2e8] px-4 py-3 transition-colors"
        onClick={() => {}}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Euro className="w-4 h-4 text-[#d97e3a]" />
          Finanzen
          {istBezahlt === 1 && (
            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 animate-pulse">✓ Bezahlt</span>
          )}
        </div>
      </button>
      <CardContent className="pt-4 pb-4 space-y-4">
        {/* Nur-Lese-Informationen */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {task.grossPrice && (
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Gesamtpreis</p>
              <p className="font-semibold text-gray-800 text-sm">{parseFloat(String(task.grossPrice)).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
            </div>
          )}
          {task.zahlungsart && (
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Zahlungsart</p>
              <p className="font-semibold text-gray-800 text-sm">{task.zahlungsart}</p>
            </div>
          )}
          {task.anzahlung ? (
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Anzahlung</p>
              <p className="font-semibold text-gray-800 text-sm">{(task.anzahlung / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
            </div>
          ) : null}
          {task.restbetrag ? (
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Restbetrag</p>
              <p className="font-bold text-orange-700 text-sm">{(task.restbetrag / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
            </div>
          ) : null}
          {task.rechnungNummer && (
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Rechnung Nr.</p>
              <p className="font-semibold text-gray-800 text-sm">{task.rechnungNummer}</p>
            </div>
          )}
        </div>
        {/* Interaktive Eingabefelder */}
        <div className="border-t border-orange-100 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#bd682b]">Zahlung erfassen</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bank Betrag (€)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={bankBetrag}
                onChange={(e) => setBankBetrag(e.target.value)}
                className="border-[#1a4d6d]/20 focus:border-[#1a4d6d]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bar Betrag / Kasse (€)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={barBetrag}
                onChange={(e) => setBarBetrag(e.target.value)}
                className="border-[#d97e3a]/25 focus:border-[#d97e3a]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Zahlungsweg</label>
              <Select value={paymentWay} onValueChange={setPaymentWay}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank">Bank (Überweisung)</SelectItem>
                  <SelectItem value="Bar">Bar (Kasse)</SelectItem>
                  <SelectItem value="Bank and Bar">Bank + Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ist bezahlt?</label>
              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => setIstBezahlt(1)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    istBezahlt === 1
                      ? 'border-green-400 bg-green-50 text-green-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-green-300'
                  }`}
                >
                  ✓ Ja
                </button>
                <button
                  onClick={() => setIstBezahlt(0)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    istBezahlt === 0
                      ? 'border-red-400 bg-red-50 text-red-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-red-300'
                  }`}
                >
                  ✗ Nein
                </button>
              </div>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            {saving ? 'Wird gespeichert...' : 'Zahlung speichern'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(user?.branchId ?? null);
  const [showBranchSelector, setShowBranchSelector] = useState(!user?.branchId);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showNoteSection, setShowNoteSection] = useState(false);
  const [reportType, setReportType] = useState<ReportType>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportImages, setReportImages] = useState<{ name: string; data: string; preview: string }[]>([]);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const branchesQuery = trpc.branches.list.useQuery();

  const { data: allMoves = [], refetch } = trpc.workerMoves.list.useQuery(
    selectedBranchId ? { branchId: selectedBranchId } : undefined,
    {
      refetchInterval: 30000,
      enabled: !showBranchSelector, // Keine Aufgaben laden solange Mitarbeiter Filiale wählt
    }
  );

  // Alle Mutations nach oben verschieben vor bedingten Anweisungen
  const reportSchadenMutation = trpc.workerMoves.reportSchaden.useMutation({
    onSuccess: () => {
      toast.success("Schadensbericht gespeichert");
      setReportType(null); setReportDescription(""); setReportImages([]); refetch();
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const reportBeschwerdeM = trpc.workerMoves.reportBeschwerde.useMutation({
    onSuccess: () => {
      toast.success("Beschwerde gespeichert");
      setReportType(null); setReportDescription(""); setReportImages([]); refetch();
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const completeMutation = trpc.workerMoves.complete.useMutation({
    onSuccess: () => {
      toast.success("Erledigt Schließen Aufgabe erfolgreich");
      setShowCompleteConfirm(false); setSelectedTaskId(null); refetch();
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const updateTaskNotes = trpc.workerMoves.updateNotes.useMutation({
    onSuccess: () => {
      toast.success("Notizen gespeichert");
      refetch();
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const activeTasks = allMoves.filter(m => m.status !== 'completed' && m.status !== 'cancelled');
  const selectedTask = activeTasks.find(t => t.id === selectedTaskId) || null;

  // Wenn Mitarbeiter ohne zugewiesene Filiale: muss Filiale zuerst wählen
  if (showBranchSelector) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Auswählen Filiale</CardTitle>
            <CardDescription>Sie müssen zuerst eine Filiale auswählen, um Aufgaben anzuzeigen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {branchesQuery.isLoading ? (
              <p className="text-center text-gray-500">Wird geladen...</p>
            ) : branchesQuery.data && branchesQuery.data.length > 0 ? (
              <>
                <Select value={selectedBranchId?.toString() || ""} onValueChange={(val) => setSelectedBranchId(parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen Filiale" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchesQuery.data.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (selectedBranchId) {
                      setShowBranchSelector(false);
                    }
                  }}
                  disabled={!selectedBranchId}
                  className="w-full"
                >
                  Fortfahren
                </Button>
              </>
            ) : (
              <p className="text-center text-red-500">Keine verfügbaren Filialen</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const compressed = await Promise.all(files.map(compressImage));
    setReportImages(prev => [...prev, ...compressed.map(c => ({ name: c.name, data: c.data, preview: c.data }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmitReport = () => {
    if (!selectedTask || !reportDescription.trim()) return;
    const images = reportImages.map(img => ({ name: img.name, data: img.data }));
    if (reportType === "schaden") {
      reportSchadenMutation.mutate({ moveId: selectedTask.id, description: reportDescription, images });
    } else if (reportType === "beschwerde") {
      reportBeschwerdeM.mutate({ moveId: selectedTask.id, description: reportDescription, images });
    }
  };

  const isSubmitting = reportSchadenMutation.isPending || reportBeschwerdeM.isPending;

  // Dienstleistungen analysieren
  const parseServices = (task: typeof selectedTask): any[] => {
    if (!task) return [];
    try {
      const raw = (task as any).servicesJson || task.services;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  // Schadensfotos analysieren
  const parseSchadenImages = (task: typeof selectedTask): string[] => {
    if (!task) return [];
    try {
      const raw = (task as any).schadenImages;
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch { return []; }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mitarbeiter-Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">{activeTasks.length} aktive Aufgabe(n)</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Aktualisieren</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aufgabenliste */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0">
              <CardHeader className="border-b border-[#1a4d6d]/15 bg-gradient-to-r from-[#f4f8fb] to-[#eaf2f7] pb-3">
                <CardTitle className="text-base text-[#1a4d6d]">Aktive Aufgaben</CardTitle>
                <CardDescription className="text-[#1a4d6d]/80">{activeTasks.length} Aufgaben</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {activeTasks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Keine aktiven Aufgaben</p>
                ) : (
                  activeTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => { setSelectedTaskId(task.id); setReportType(null); }}
                      className={`w-full text-right p-3 rounded-lg border-2 transition-all duration-200 ${
                        selectedTaskId === task.id
                          ? "border-[#1a4d6d] bg-gradient-to-br from-[#f4f8fb] to-[#eaf2f7] shadow-lg scale-[1.02]"
                          : "border-gray-200 hover:border-[#1a4d6d]/35 hover:bg-gray-50 hover:shadow-md"
                      }`}
                    >
                      {/* Kartenkopf: Code Status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[#1a4d6d]">{(task as any).kundenummer || task.moveCode}</span>
                        <div className="flex gap-1">
                          {getStatusBadge(task.status)}
                          <Badge className={`border-0 text-xs ${
                            task.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-[#eef4f8] text-[#1a4d6d]'
                          }`}>
                            {task.paymentStatus === 'paid' ? '✓' : '○'}
                          </Badge>
                        </div>
                      </div>

                      {/* Name Kunde */}
                      <div className="text-sm font-semibold text-gray-800 mb-2 truncate">
                        {(task as any).customerName || "—"}
                      </div>

                      {/* Kurzadressen */}
                      <div className="space-y-1 mb-2">
                        <div className="text-xs text-gray-600 truncate flex items-center gap-1">
                          <span className="font-bold text-[#1a4d6d]">📤</span>
                          <span className="truncate">{task.pickupAddress ? task.pickupAddress.substring(0, 30) : "—"}</span>
                        </div>
                        <div className="text-xs text-gray-600 truncate flex items-center gap-1">
                          <span className="font-bold text-[#d97e3a]">📥</span>
                          <span className="truncate">{task.deliveryAddress ? task.deliveryAddress.substring(0, 30) : "—"}</span>
                        </div>
                      </div>

                      {/* Weitere Informationen */}
                      <div className="grid grid-cols-2 gap-1 mb-2 text-xs">
                        <div className="bg-gray-100 px-2 py-1 rounded">
                          <span className="text-gray-600">📅</span>
                          <span className="text-gray-700 font-medium ml-1">
                            {task.pickupDate ? new Date(task.pickupDate).toLocaleDateString("de-DE") : "—"}
                          </span>
                        </div>
                        <div className="bg-gray-100 px-2 py-1 rounded">
                          <span className="text-gray-600">📍</span>
                          <span className="text-gray-700 font-medium ml-1">
                            {(task as any).customerSitz || "—"}
                          </span>
                        </div>
                        {task.volume && (
                          <div className="rounded border border-[#1a4d6d]/15 bg-[#eaf2f7] px-2 py-1">
                            <span className="text-[#1a4d6d]">📦</span>
                            <span className="ml-1 font-medium text-[#1a4d6d]">{task.volume} m³</span>
                          </div>
                        )}
                        {task.distance && (
                          <div className="rounded border border-[#d97e3a]/20 bg-[#fff2e8] px-2 py-1">
                            <span className="text-[#d97e3a]">🛣️</span>
                            <span className="ml-1 font-medium text-[#bd682b]">{task.distance} km</span>
                          </div>
                        )}
                      </div>

                      {/* Notizen Aufgabe */}
                      {(task as any).taskNotes && (
                        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded">
                          <p className="text-xs text-amber-700 font-medium mb-1">🗒 Notizen:</p>
                          <p className="text-xs text-amber-800 line-clamp-2">{(task as any).taskNotes}</p>
                        </div>
                      )}

                      {/* Schadens- Beschwerdeindikatoren */}
                      <div className="flex gap-1 flex-wrap">
                        {(task as any).schadenDescription && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">⚠ Schaden</span>
                        )}
                        {(task as any).beschwerdeDescription && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">📋 Beschwerde</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Aufgabendetails */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <div className="space-y-4">

                {/* ===== Grundlegende Kundendaten ===== */}
                <CollapsibleSection
                  title={`Daten Aufgabe — ${(selectedTask as any).kundenummer || selectedTask.moveCode}`}
                  icon={<Package className="w-4 h-4 text-[#1a4d6d]" />}
                  accentColor="blue"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoField label="Name Kunde" value={(selectedTask as any).customerName} />
                    <InfoField label="Telefon" value={(selectedTask as any).customerPhone} />
                    <InfoField label="E-Mail" value={(selectedTask as any).customerEmail} />
                    <InfoField label="Filiale" value={(selectedTask as any).customerSitz} />
                    <InfoField label="Type" value={selectedTask.moveType} />
                    <InfoField label="Distanz (km)" value={selectedTask.distance ? `${selectedTask.distance} km` : null} />
                    <InfoField label="m³ (Volumen)" value={selectedTask.volume ? `${selectedTask.volume} m³` : null} />
                    <InfoField label="Umzugsdatum" value={selectedTask.pickupDate ? new Date(selectedTask.pickupDate).toLocaleDateString("de-DE") : null} />
                    <InfoField label="Lieferdatum" value={selectedTask.deliveryDate ? new Date(selectedTask.deliveryDate).toLocaleDateString("de-DE") : null} />
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {getStatusBadge(selectedTask.status)}
                    <Badge className={`border-0 text-xs ${selectedTask.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-[#eef4f8] text-[#1a4d6d]'}`}>
                      {selectedTask.paymentStatus === 'paid' ? '✓ Bezahlt' : '✗ Nicht bezahlt'}
                    </Badge>
                  </div>
                </CollapsibleSection>

                {/* ===== Auszugsort & Einzugsort ===== */}
                <CollapsibleSection
                  title="Auszugsort & Einzugsort"
                  icon={<MapPin className="w-4 h-4 text-[#d97e3a]" />}
                  accentColor="green"
                >
                  <div className="space-y-4">
                    {/* Auszugsort */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1a4d6d]">📦 Auszugsort</p>
                      <AddressLink
                        address={selectedTask.pickupAddress || ""}
                        label="Adresse"
                        colorClass="bg-[#eaf2f7] border border-[#1a4d6d]/15 text-[#1a4d6d]"
                        iconColorClass="text-[#1a4d6d]"
                      />
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <InfoField label="Etage" value={selectedTask.pickupFloor} />
                        <InfoField label="Fahrstuhl" value={selectedTask.pickupElevatorCapacity} />
                        <InfoField label="Laufweg" value={selectedTask.pickupParkingDistance} />
                      </div>
                    </div>
                    <div className="border-t border-dashed border-gray-200" />
                    {/* Einzugsort */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#bd682b]">🏠 Einzugsort</p>
                      <AddressLink
                        address={selectedTask.deliveryAddress || ""}
                        label="Adresse"
                        colorClass="bg-[#fff2e8] border border-[#d97e3a]/20 text-[#7a461f]"
                        iconColorClass="text-[#d97e3a]"
                      />
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <InfoField label="Etage" value={selectedTask.deliveryFloor} />
                        <InfoField label="Fahrstuhl" value={selectedTask.deliveryElevatorCapacity} />
                        <InfoField label="Laufweg" value={selectedTask.deliveryParkingDistance} />
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ===== Services ===== */}
                <CollapsibleSection
                  title="Services"
                  icon={<Wrench className="w-4 h-4 text-[#d97e3a]" />}
                  accentColor="purple"
                  defaultOpen={true}
                >
                  {(() => {
                    const sj = (() => {
                      try { return JSON.parse((selectedTask as any).servicesJson || '{}'); } catch { return {}; }
                    })();
                    const yesNo = (v: any) => v === 'Ja' || v === true || v === 1 || v === 'ja';
                    // Helpers — read a value under any of multiple field
                    // names. NewCustomer and the MoveDetailDialog edit form
                    // unfortunately use DIFFERENT keys for the same
                    // selection (e.g. `auszugsortEmpfangsservice` vs
                    // `einpackservice`), so we have to check both.
                    const pickYesNo = (...keys: string[]) =>
                      keys.some(k => yesNo(sj[k]));
                    const pickValue = (...keys: string[]) => {
                      for (const k of keys) {
                        const v = sj[k];
                        if (v !== undefined && v !== null && v !== '' && v !== false && v !== 0) return v;
                      }
                      return undefined;
                    };
                    const SRow = ({ label, value }: { label: string; value: string }) => (
                      <div className="flex items-center justify-between rounded-lg border border-[#d97e3a]/15 bg-[#fff2e8] px-3 py-2">
                        <span className="text-sm font-medium text-[#7a461f]">{label}</span>
                        <span className="text-xs font-semibold text-[#bd682b]">{value}</span>
                      </div>
                    );
                    const rows: React.ReactNode[] = [];
                    // Auszugsort
                    if (pickYesNo('auszugsortEmpfangsservice', 'einpackservice')) {
                      const k = pickValue('auszugsortEmpfangsserviceKartons', 'einpackKartons', 'auszugsortKartons');
                      rows.push(<SRow key="ae" label="Empfangsservice (Auszug)" value={k ? `Ja — ${k} Kartons` : 'Ja'} />);
                    }
                    if (pickYesNo('auszugsortAbbauMoebel', 'abbauMoebeln')) {
                      const m = pickValue('auszugsortAbbauMoebelM3', 'abbauMoebelnM3');
                      rows.push(<SRow key="am" label="Abbau von Möbeln" value={m ? `Ja — ${m} m³` : 'Ja'} />);
                    }
                    if (pickYesNo('auszugsortAbbauKueche', 'abbauKueche')) {
                      const m = pickValue('auszugsortAbbauKuecheM3', 'abbauKuecheM3');
                      rows.push(<SRow key="aku" label="Abbau von Küche" value={m ? `Ja — ${m} m³` : 'Ja'} />);
                    }
                    if (pickYesNo('auszugsortParkzone', 'parkzoneAuszug')) {
                      rows.push(<SRow key="ap" label="Parkzone am Auszugsort" value="Ja" />);
                    }
                    // Einzugsort
                    if (pickYesNo('einzugsortAuspacksservice', 'auspackservice')) {
                      const k = pickValue('einzugsortAuspacksserviceKartons', 'auspackKartons', 'einzugsortKartons');
                      rows.push(<SRow key="ee" label="Auspacksservice (Einzug)" value={k ? `Ja — ${k} Kartons` : 'Ja'} />);
                    }
                    if (pickYesNo('einzugsortAufbauMoebel', 'aufbauMoebeln')) {
                      const m = pickValue('einzugsortAufbauMoebelM3', 'aufbauMoebelnM3');
                      rows.push(<SRow key="em" label="Aufbau von Möbeln" value={m ? `Ja — ${m} m³` : 'Ja'} />);
                    }
                    if (pickYesNo('einzugsortAufbauKueche', 'aufbauKueche')) {
                      const m = pickValue('einzugsortAufbauKuecheM3', 'aufbauKuecheM3');
                      rows.push(<SRow key="eku" label="Aufbau von Küche" value={m ? `Ja — ${m} m³` : 'Ja'} />);
                    }
                    if (pickYesNo('einzugsortParkzone', 'parkzoneEinzug')) {
                      rows.push(<SRow key="ep" label="Parkzone am Einzugsort" value="Ja" />);
                    }
                    // Kartons
                    if (sj.umzugskartons) rows.push(<SRow key="uk" label="Umzugskartons" value={String(sj.umzugskartons)} />);
                    if (sj.kleiderkartons) rows.push(<SRow key="kk" label="Kleiderkartons" value={String(sj.kleiderkartons)} />);
                    if (sj.deliveryDate) rows.push(<SRow key="dd" label="Delivery Date" value={String(sj.deliveryDate)} />);
                    if (sj.kartonGeliefert) rows.push(<SRow key="kg" label="Karton geliefert?" value={String(sj.kartonGeliefert)} />);
                    if (sj.datumParkzone) rows.push(<SRow key="dp" label="Datum Parkzone" value={String(sj.datumParkzone)} />);
                    if (sj.parkzoneGeliefert) rows.push(<SRow key="pg" label="Parkzone geliefert?" value={String(sj.parkzoneGeliefert)} />);
                    // Additional Services
                    if (yesNo(sj.klaviertransport)) rows.push(<SRow key="kl" label="Klaviertransport" value={sj.klavierGross || 'Ja'} />);
                    if (sj.schwerTransport && sj.schwerTransport !== 'Kein') rows.push(<SRow key="st" label="Schwerer Transport" value={String(sj.schwerTransport)} />);
                    if (yesNo(sj.lampen)) rows.push(<SRow key="la" label="Lampen" value={[sj.lampenOrt, sj.lampenStueck ? sj.lampenStueck + ' Stück' : ''].filter(Boolean).join(' — ') || 'Ja'} />);
                    if (pickYesNo('einlagerungMoebel', 'einlagerung')) {
                      rows.push(<SRow key="el" label="Einlagerung von Möbeln" value={sj.einlagerungPrice ? sj.einlagerungPrice + ' €' : 'Ja'} />);
                    }
                    if (yesNo(sj.endreinigung)) rows.push(<SRow key="er" label="Endreinigung" value="Ja" />);
                    if (pickYesNo('bohrDuebel', 'bohrarbeit')) {
                      const p = pickValue('bohrPunkt', 'bohrarbeitPunkt');
                      rows.push(<SRow key="bd" label="Bohr- Dübelarbeit" value={p ? String(p) : 'Ja'} />);
                    }
                    if (pickYesNo('entsorgungMoebel', 'entsorgung')) {
                      rows.push(<SRow key="en" label="Entsorgung von Möbeln" value={[sj.entsorgungType, sj.entsorgungM3 ? sj.entsorgungM3 + ' m³' : ''].filter(Boolean).join(' — ') || 'Ja'} />);
                    }
                    {
                      const a = pickValue('ausmist', 'aussenlift');
                      const aStr = a ? String(a) : '';
                      if (aStr && aStr !== 'Nein') {
                        const stunden = pickValue('ausmistStunde', 'aussenliftStunde');
                        rows.push(<SRow key="au" label="Ausmist / Außenlift" value={stunden ? `${aStr} — ${stunden} Std.` : aStr} />);
                      }
                    }
                    if (yesNo(sj.anschlussWaschmaschine)) rows.push(<SRow key="aw" label="Anschluss der Waschmaschine" value="Ja" />);
                    if (sj.sonstigeLeistung) {
                      const price = pickValue('sonstigeLeistungPrice', 'sonstigePrice');
                      rows.push(<SRow key="sl" label="Sonstige Leistung" value={price ? `${sj.sonstigeLeistung} — ${price} €` : String(sj.sonstigeLeistung)} />);
                    }
                    return (
                      <div className="space-y-2">
                        {rows.length > 0 ? rows : <p className="text-sm text-gray-400 text-center py-2">Keine zusätzlichen Dienstleistungen erfasst</p>}
                        {(selectedTask as any).anmerkungen && (
                          <div className="bg-gray-50 rounded-lg p-3 mt-1">
                            <p className="text-xs text-gray-500 mb-1 font-semibold">Anmerkungen</p>
                            <p className="text-sm text-gray-700">{(selectedTask as any).anmerkungen}</p>
                          </div>
                        )}
                        {(selectedTask as any).moebelListe && (
                          <div className="bg-gray-50 rounded-lg p-3 mt-1">
                            <p className="text-xs text-gray-500 mb-1 font-semibold">Möbelliste</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{(selectedTask as any).moebelListe}</p>
                          </div>
                        )}
                        {(selectedTask as any).kundenNote && (
                          <div className="mt-1 rounded-lg border border-[#e7b18a] bg-[#fff2e8] p-3">
                            <p className="mb-1 text-xs font-semibold text-[#8f4f1f]">Kundennotiz</p>
                            <p className="text-sm text-[#6f4a2f]">{(selectedTask as any).kundenNote}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CollapsibleSection>

                {/* ===== Finanzen (interaktiv) ===== */}
                <WorkerFinanzenSection task={selectedTask} onRefetch={refetch} />

                                {/* ===== Photos and Docs ===== */}
                <CollapsibleSection
                  title="Kundenfotos (Inventar)"
                  icon={<Image className="w-4 h-4 text-[#1a4d6d]" />}
                  accentColor="teal"
                  defaultOpen={true}
                >
                  <div className="mb-3 rounded-lg border border-[#1a4d6d]/15 bg-[#eaf2f7] p-3">
                    <p className="text-xs font-medium text-[#1a4d6d]">
                      ℹ️ Diese Fotos wurden vom Vertriebsteam hochgeladen zeigen das vereinbarte Inventar des Kunden.
                    </p>
                  </div>
                  {(selectedTask as any).customerPhotos && (selectedTask as any).customerPhotos.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-3 font-medium">
                        {(selectedTask as any).customerPhotos.length} Foto(s) vorhanden
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(selectedTask as any).customerPhotos.map((photo: { id: number; imageUrl: string }, i: number) => (
                          <a key={i} href={photo.imageUrl} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={photo.imageUrl}
                              alt={`Kundenfoto ${i + 1}`}
                              className="aspect-square w-full rounded-lg border-2 border-[#1a4d6d]/15 object-cover shadow-sm transition-all hover:border-[#1a4d6d] hover:opacity-90"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Keine Kundenfotos vorhanden</p>
                      <p className="text-xs text-gray-300 mt-1">Das Vertriebsteam hat noch keine Fotos hochgeladen</p>
                    </div>
                  )}
                </CollapsibleSection>

                {/* ===== Status-Berichte ===== */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Status-Berichte
                    </CardTitle>
                    <CardDescription>Bei Schäden oder Beschwerden während der Arbeit</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(selectedTask as any).schadenDescription && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Schadensbericht vorhanden
                        </p>
                        <p className="text-sm text-red-600 mt-1">{(selectedTask as any).schadenDescription}</p>
                        {parseSchadenImages(selectedTask).length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {parseSchadenImages(selectedTask).map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {(selectedTask as any).beschwerdeDescription && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                          <MessageSquareWarning className="w-4 h-4" /> Beschwerde vorhanden
                        </p>
                        <p className="text-sm text-orange-600 mt-1">{(selectedTask as any).beschwerdeDescription}</p>
                      </div>
                    )}

                    {!reportType && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline" size="sm"
                          className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => setReportType("schaden")}
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" /> Schadensbericht
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                          onClick={() => setReportType("beschwerde")}
                        >
                          <MessageSquareWarning className="w-4 h-4 mr-1" /> Beschwerde
                        </Button>
                      </div>
                    )}

                    {reportType && (
                      <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm">
                            {reportType === "schaden" ? "🔴 Schadensbericht" : "🟠 Beschwerde"}
                          </h4>
                          <button onClick={() => { setReportType(null); setReportDescription(""); setReportImages([]); }}>
                            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                        <Textarea
                          placeholder="Beschreiben Sie den Schaden oder die Beschwerde detailliert..."
                          value={reportDescription}
                          onChange={e => setReportDescription(e.target.value)}
                          rows={3}
                        />
                        <div>
                          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-4 h-4 mr-2" /> Fotos anhängen
                          </Button>
                          {reportImages.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {reportImages.map((img, i) => (
                                <div key={i} className="relative">
                                  <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded border" />
                                  <button
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                    onClick={() => setReportImages(prev => prev.filter((_, j) => j !== i))}
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button className="w-full" disabled={!reportDescription.trim() || isSubmitting} onClick={handleSubmitReport}>
                          {isSubmitting ? "Wird gespeichert..." : "Bericht speichern"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ===== NOTE ===== */}
                <div className="border border-gray-200 rounded">
                  <button
                    type="button"
                    onClick={() => setShowNoteSection(!showNoteSection)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-sm bg-gray-50 text-gray-800 hover:bg-gray-100"
                  >
                    {showNoteSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    + NOTE
                  </button>
                  {showNoteSection && (
                    <div className="p-4 bg-white">
                      <Textarea
                        placeholder="Notiz oder wichtigen Kommentar eingeben..."
                        value={selectedTask?.taskNotes || ""}
                        onChange={(_e) => {
                          // notes are saved via updateTaskNotes mutation directly
                        }}
                        rows={3}
                        className="resize-none"
                      />
                      <Button
                        className="mt-3 w-full bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                        onClick={() => {
                          if (selectedTask && selectedTask.id) {
                            updateTaskNotes.mutate({
                              taskId: (selectedTask as any).taskId ?? selectedTask.id,
                              notes: (selectedTask as any).taskNotes || "",
                            });
                          }
                        }}
                        disabled={updateTaskNotes.isPending}
                      >
                        {updateTaskNotes.isPending ? "Wird gespeichert..." : "Speichern"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ===== Aufgabe abschließen ===== */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Aufgabe abschließen</CardTitle>
                    <CardDescription>Wenn der Umzug vollständig abgeschlossen ist, drücken Sie die Abschluss-Taste</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-[#d97e3a] py-6 text-lg text-white hover:bg-[#bd682b]"
                      onClick={() => setShowCompleteConfirm(true)}
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      ✅ Aufgabe abschließen
                    </Button>
                  </CardContent>
                </Card>

              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Aufgabe aus dem Menü auswählen, um Details anzuzeigen</p>
                  <p className="text-gray-400 text-sm mt-1">Hier werden alle Kundendaten, Adressen Dienstleistungen angezeigt</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Complete Dialog */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestätigen Aufgabe abschließen</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            ? Möchten Sie die Aufgabe <strong>{(selectedTask as any)?.kundenummer || selectedTask?.moveCode}</strong>?
            Sie wird archiviert im Administrator-Dashboard als abgeschlossen angezeigt.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteConfirm(false)}>Abbrechen</Button>
            <Button
              className="bg-[#d97e3a] text-white hover:bg-[#bd682b]"
              disabled={completeMutation.isPending}
              onClick={() => selectedTask && completeMutation.mutate({ moveId: selectedTask.id })}
            >
              {completeMutation.isPending ? "Wird gespeichert..." : "Ja, Aufgabe abschließen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
