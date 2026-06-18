import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customers, moves, moveImages, customerReminders } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { formatCustomerNumber } from "../../shared/customerNumber";
import { generatePDF } from "../pdfGenerator";
import { generateOfferHTML } from "../offerTemplate";

function attachCustomerNumber<T extends { id: number }>(customer: T) {
  return {
    ...customer,
    kundenummer: formatCustomerNumber(customer.id),
  };
}

function formatDateForOffer(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function formatMoneyForOffer(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(numeric)) return "0,00";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function parseServicesJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildOfferSummary(servicesJson: Record<string, unknown>, servicesText: string | null | undefined) {
  const lines: string[] = [];
  // Helper: pick the first non-empty value from multiple possible field
  // names. The NewCustomer form and the MoveDetailDialog edit form use
  // DIFFERENT keys for the same selection, so we must check both.
  // e.g. NewCustomer stores `auszugsortEmpfangsservice` while the edit
  // dialog stores `einpackservice` — both mean "Einpackservice = Ja".
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = servicesJson[k];
      if (v !== undefined && v !== null && v !== "" && v !== false && v !== 0) return v;
    }
    return undefined;
  };
  const num = (...keys: string[]): number => {
    for (const k of keys) {
      const v = servicesJson[k];
      if (v !== undefined && v !== null && v !== "") {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  };
  const str = (...keys: string[]): string => {
    for (const k of keys) {
      const v = servicesJson[k];
      if (v !== undefined && v !== null) {
        const s = String(v).trim();
        if (s) return s;
      }
    }
    return "";
  };

  // ── Auszugsort ─────────────────────────────────────────────────
  if (pick("auszugsortEmpfangsservice", "einpackservice")) {
    lines.push(`Einpackservice Auszug (${num("auszugsortEmpfangsserviceKartons", "einpackKartons")} Kartons)`);
  }
  if (pick("auszugsortAbbauMoebel", "abbauMoebeln")) {
    lines.push(`Möbelabbau Auszug (${num("auszugsortAbbauMoebelM3", "abbauMoebelnM3")} m³)`);
  }
  if (pick("auszugsortAbbauKueche", "abbauKueche")) {
    lines.push(`Küchenabbau (${num("auszugsortAbbauKuecheM3", "abbauKuecheM3")} m³)`);
  }
  if (pick("auszugsortParkzone", "parkzoneAuszug")) {
    lines.push("Einrichtung einer Parkzone am Auszugsort");
  }

  // ── Einzugsort ─────────────────────────────────────────────────
  if (pick("einzugsortAuspacksservice", "auspackservice")) {
    lines.push(`Auspackservice Einzug (${num("einzugsortAuspacksserviceKartons", "auspackKartons")} Kartons)`);
  }
  if (pick("einzugsortAufbauMoebel", "aufbauMoebeln")) {
    lines.push(`Möbelaufbau Einzug (${num("einzugsortAufbauMoebelM3", "aufbauMoebelnM3")} m³)`);
  }
  if (pick("einzugsortAufbauKueche", "aufbauKueche")) {
    lines.push(`Küchenaufbau (${num("einzugsortAufbauKuecheM3", "aufbauKuecheM3")} m³)`);
  }
  if (pick("einzugsortParkzone", "parkzoneEinzug")) {
    lines.push("Einrichtung einer Parkzone am Einzugsort");
  }

  // ── Kartons ────────────────────────────────────────────────────
  const umz = num("umzugskartons");
  if (umz > 0) lines.push(`Umzugskartons: ${umz}`);
  const klk = num("kleiderkartons");
  if (klk > 0) lines.push(`Kleiderkartons: ${klk}`);

  // ── Additional services ────────────────────────────────────────
  if (pick("klaviertransport")) {
    lines.push(`Klaviertransport (${str("klavierGross") || "Standard"})`);
  }
  {
    const st = str("schwerTransport");
    if (st && st.toLowerCase() !== "kein") {
      lines.push(`Schwer Transport (${st})`);
    }
  }
  if (pick("lampen")) {
    const ort = str("lampenOrt");
    const stueck = num("lampenStueck");
    const detail = [
      ort && ort.toLowerCase() !== "kein" ? ort : null,
      stueck > 0 ? `${stueck} Stück` : null,
    ].filter(Boolean).join(", ");
    lines.push(detail ? `Lampen (${detail})` : "Lampen");
  }
  if (pick("einlagerungMoebel", "einlagerung")) {
    const price = num("einlagerungPrice");
    lines.push(price > 0 ? `Einlagerung von Möbeln (${price} €)` : "Einlagerung von Möbeln");
  }
  if (pick("endreinigung")) {
    lines.push("Endreinigung");
  }
  if (pick("bohrDuebel", "bohrarbeit")) {
    const punkte = num("bohrPunkt", "bohrarbeitPunkt");
    lines.push(punkte > 0 ? `Bohr- und Dübelarbeit (${punkte} Punkte)` : "Bohr- und Dübelarbeit");
  }
  if (pick("entsorgungMoebel", "entsorgung")) {
    lines.push(`Entsorgung (${str("entsorgungType") || "Standard"}, ${num("entsorgungM3")} m³)`);
  }
  {
    const aussenlift = str("ausmist", "aussenlift");
    if (aussenlift && aussenlift.toLowerCase() !== "nein") {
      const stunden = num("ausmistStunde", "aussenliftStunde");
      lines.push(stunden > 0 ? `Außenlift (${stunden} Stunden)` : "Außenlift");
    }
  }
  if (pick("anschlussWaschmaschine")) {
    lines.push("Anschluss Waschmaschine");
  }
  {
    const text = str("sonstigeLeistung");
    if (text) {
      const price = num("sonstigeLeistungPrice", "sonstigePrice");
      lines.push(price > 0 ? `Sonstige Leistung: ${text} (${price} €)` : `Sonstige Leistung: ${text}`);
    }
  }

  // Note: the move's `services` free-text field is intentionally NOT
  // appended here. Only the structured selections (kartons, möbelaufbau,
  // klaviertransport, …) appear on the PDF as LEISTUNGEN bullets.
  return lines.join("\n");
}

export const customersRouter = router({
  /**
   * Create a new customer and move order
   */
  create: protectedProcedure
    .input(
      z.object({
        // Branch-Daten - kann null sein, wird dann automatisch aus dem Benutzer ermittelt
        branchId: z.number().nullable().optional(),
        // Customer data
       title: z.string().optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        status2: z.string().optional(),
        versuch: z.string().optional(),
        // reminderDate (YYYY-MM-DD) — sales sets a follow-up date here.
        // The customer appears in the Reminders section once this date arrives.
        // null/undefined = no reminder scheduled.
        reminderDate: z.string().nullable().optional(),

        // Move data
        moveCode: z.string().min(1).optional(),
        pickupAddress: z.string().min(1),
        pickupFloor: z.string().optional(),
        pickupElevatorCapacity: z.string().optional(),
        pickupParkingDistance: z.string().optional(),
        deliveryAddress: z.string().min(1),
        deliveryFloor: z.string().optional(),
        deliveryElevatorCapacity: z.string().optional(),
        deliveryParkingDistance: z.string().optional(),
        pickupDate: z.string(),
        deliveryDate: z.string(),
        volume: z.number().optional(),
        grossPrice: z.number().optional(),
        distance: z.number().optional(),
        numTrips: z.number().optional(),
        moveType: z.string().optional(),
        services: z.string().optional(),
        servicesJson: z.string().optional(),

        // Note / text fields
        summary: z.string().optional(),
        anmerkungen: z.string().optional(),
        serviceanmerkungen: z.string().optional(),
        moebelListe: z.string().optional(),
        kundenNote: z.string().optional(),
        kontaktinfo: z.string().optional(),

        // Finanzen fields
        anzahlung: z.number().optional(),
        restbetrag: z.number().optional(),
        zahlungsart: z.string().optional(),
        rechnungNr: z.string().optional(),

        // Audits
        bezahltvon: z.string().optional(),
        betzhalKunde: z.string().optional(),
        istBezahlt: z.boolean().optional(),
        paymentWay: z.string().optional(),
        auditTotalPrice: z.number().optional(),
        bezahltDatum: z.string().optional(),
        bankBetrag: z.number().optional(),
        barBetrag: z.number().optional(),
        rechnungAusgestellt: z.boolean().optional(),
        rechnungBetrag: z.number().optional(),
        rechnungNummer: z.string().optional(),

        // Images (as base64 or URLs)
        images: z
          .array(
            z.object({
              name: z.string(),
              data: z.string(), // base64 encoded
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung zum Erstellen von Kunden",
        });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const effectiveBranchId: number = input.branchId ?? ctx.user.branchId ?? 1;

      try {
      // Defensive: validate the incoming pickup/delivery dates BEFORE the insert.
      // The columns are NOT NULL, so an Invalid Date / empty string would either
      // fail the insert or silently corrupt the row to '0000-00-00 00:00:00'.
      // Fall back to today if the input is missing or unparseable.
      const todayMidnight = (() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      })();
      const safeDate = (raw: unknown): Date => {
        if (typeof raw === "string" && raw.trim()) {
          const parsed = new Date(raw);
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
            return parsed;
          }
        }
        return todayMidnight;
      };
      const pickupDateValue = safeDate(input.pickupDate);
      const deliveryDateValue = safeDate(input.deliveryDate);
      console.log("[customers.create] dates:", {
        rawPickup: input.pickupDate,
        rawDelivery: input.deliveryDate,
        finalPickup: pickupDateValue.toISOString(),
        finalDelivery: deliveryDateValue.toISOString(),
      });

      const customerResult = await db
          .insert(customers)
          .values({
            branchId: effectiveBranchId,
            title: input.title,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            company: input.company,
            notes: input.notes,
            status2: input.status2 || "Angaben vollständig",
            versuch: input.versuch,
          })
          .$returningId();

        const customerId = customerResult[0]?.id;

        if (!customerId) {
          throw new Error("Konnte Kunden-ID nach dem Erstellen nicht ermitteln");
        }

        const kundenummer = formatCustomerNumber(customerId);
        const moveCode = kundenummer;

        const moveResult = await db
          .insert(moves)
          .values({
            branchId: effectiveBranchId,
            customerId,
            moveCode,
            pickupAddress: input.pickupAddress,
            pickupFloor: input.pickupFloor,
            pickupElevatorCapacity: input.pickupElevatorCapacity,
            pickupParkingDistance: input.pickupParkingDistance,
            deliveryAddress: input.deliveryAddress,
            deliveryFloor: input.deliveryFloor,
            deliveryElevatorCapacity: input.deliveryElevatorCapacity,
            deliveryParkingDistance: input.deliveryParkingDistance,
            pickupDate: pickupDateValue,
            deliveryDate: deliveryDateValue,
            volume: input.volume,
            grossPrice: input.grossPrice ? input.grossPrice.toFixed(2) : "0.00",
            distance: input.distance,
            numTrips: input.numTrips || 0,
            moveType: input.moveType,
            services: input.services,
            servicesJson: input.servicesJson,
            // Note fields — saved separately so MoveDetailDialog can load them individually
            summary: input.summary,
            anmerkungen: input.anmerkungen,
            serviceanmerkungen: input.serviceanmerkungen,
            moebelListe: input.moebelListe,
            kundenNote: input.kundenNote,
            kontaktinfo: input.kontaktinfo,
            // Finanzen
            anzahlung: input.anzahlung,
            restbetrag: input.restbetrag,
            zahlungsart: input.zahlungsart,
            rechnungNr: input.rechnungNr,
            paymentStatus: input.istBezahlt ? "paid" : "unpaid",
            bezahltVon: input.bezahltvon,
            betzhalKunde: input.betzhalKunde,
            istBezahlt: input.istBezahlt ? 1 : 0,
            paymentWay: input.paymentWay,
            auditTotalPrice: input.auditTotalPrice ? Math.round(input.auditTotalPrice * 100) : undefined,
            bezahltDatum: input.bezahltDatum ? new Date(input.bezahltDatum) : undefined,
            bankBetrag: input.bankBetrag ? Math.round(input.bankBetrag * 100) : undefined,
            barBetrag: input.barBetrag ? Math.round(input.barBetrag * 100) : undefined,
            rechnungAusgestellt: input.rechnungAusgestellt ? 1 : 0,
            rechnungBetrag: input.rechnungBetrag ? Math.round(input.rechnungBetrag * 100) : undefined,
            rechnungNummer: input.rechnungNummer,
          })
          .$returningId();

        const moveId = moveResult[0]?.id;

        // [DIAGNOSTIC] Read back the row we just inserted to see what the
        // database actually stored. If pickupDate/deliveryDate come back as
        // null here, the column is silently coercing the value to NULL —
        // which usually means a column-type mismatch (e.g., the live DB has
        // the column as DATE NULL even though the schema says timestamp NOT NULL).
        if (moveId) {
          try {
            const [verify] = await db.select().from(moves).where(eq(moves.id, moveId)).limit(1);
            console.log("[customers.create] DB readback:", {
              id: verify?.id,
              pickupDate: verify?.pickupDate,
              deliveryDate: verify?.deliveryDate,
              pickupDateType: typeof verify?.pickupDate,
            });
            // Inspect the actual MySQL column structure so we can see if the
            // production schema has the columns defined as nullable / wrong type.
            try {
              // @ts-ignore – use raw mysql2 query through drizzle's session
              const cols: any = await (db as any).execute(
                `SHOW COLUMNS FROM \`moves\` WHERE Field IN ('pickupDate','deliveryDate')`
              );
              console.log("[customers.create] column info:", JSON.stringify(cols?.[0] ?? cols));
            } catch (colErr) {
              console.error("[customers.create] column inspect failed:", colErr);
            }
          } catch (verifyErr) {
            console.error("[customers.create] readback failed:", verifyErr);
          }
        }


        if (!moveId) {
          throw new Error("Konnte Auftrags-ID nach dem Erstellen nicht ermitteln");
        }

        if (input.images && input.images.length > 0) {
          console.log(`[customers.create] uploading ${input.images.length} image(s) for moveId=${moveId}`);
          for (const image of input.images) {
            try {
              // Save photos directly to the database as LONGBLOB.
              // No external storage required — works on Render's free tier
              // without losing files on every redeploy. Photos are then
              // served via /api/images/:id.
              const commaIndex = image.data.indexOf(",");
              const base64Data = commaIndex >= 0 ? image.data.slice(commaIndex + 1) : image.data;
              const mimeMatch = image.data.match(/^data:([^;]+);/);
              const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
              const buffer = Buffer.from(base64Data, "base64");
              console.log(
                `[customers.create] image "${image.name}": ` +
                  `mime=${mimeType}, base64Len=${base64Data.length}, bufferBytes=${buffer.length}`
              );

              const inserted = await db.insert(moveImages).values({
                moveId,
                // imageUrl is required (NOT NULL) on legacy DB schemas, so
                // we send a placeholder. Right after the insert we update
                // it to the real `/api/images/<id>` URL once we know id.
                imageUrl: "",
                imageKey: image.name || `photo-${Date.now()}`,
                imageType: "customer_photos",
                // uploadedBy is NOT NULL with no default in the DB — always
                // provide a numeric value so the insert never fails.
                uploadedBy: ctx.user?.id ?? 0,
              } as any).$returningId?.() ?? null;

              // Resolve the new row's id and stamp the public URL.
              let imageId: number | null = inserted?.[0]?.id ?? null;
              if (imageId === null) {
                const [latest] = await db.select({ id: moveImages.id })
                  .from(moveImages)
                  .where(eq(moveImages.moveId, moveId))
                  .orderBy(desc(moveImages.id))
                  .limit(1);
                imageId = latest?.id ?? null;
              }
              console.log(`[customers.create] inserted image with id=${imageId}`);
              if (imageId !== null) {
                // The `data` LONGBLOB and `mimeType` columns are added at
                // runtime by the migration and are NOT declared in the Drizzle
                // schema, so Drizzle silently drops them on insert. We write
                // them with a raw SQL UPDATE which Drizzle has to honour.
                const { sql } = await import("drizzle-orm");
                await (db as any).execute(
                  sql`UPDATE \`moveImages\`
                      SET \`data\` = ${buffer},
                          \`mimeType\` = ${mimeType},
                          \`imageUrl\` = ${`/api/images/${imageId}`}
                      WHERE \`id\` = ${imageId}`
                );
                // Verify the data was stored
                try {
                  const verify: any = await (db as any).execute(
                    sql.raw(`SELECT \`id\`, LENGTH(\`data\`) AS dataLen, \`mimeType\`, \`imageUrl\` FROM \`moveImages\` WHERE \`id\` = ${imageId}`)
                  );
                  const rows = Array.isArray(verify?.[0]) ? verify[0] : verify;
                  const r = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                  console.log(`[customers.create] verify image id=${imageId}: ${JSON.stringify(r)}`);
                } catch (vErr) {
                  console.error("[customers.create] verify failed:", vErr);
                }
              }
            } catch (error) {
              console.error("Error uploading image:", error);
            }
          }
        }

        // forget to call/whatsapp this new customer.
        try {
          const fullName = [input.title, input.firstName, input.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
       await db.insert(customerReminders).values({
            customerId,
            branchId: effectiveBranchId,
            customerName: fullName || "Unbekannt",
            kundennummer: kundenummer,
            versuch: input.versuch ?? null,
            // Convert ISO date string → Date object for the DATE column.
            // null is preserved so customers without a reminder are hidden in the list.
            reminderDate: input.reminderDate ? new Date(input.reminderDate) : null,
          });
        } catch (reminderError) {
          // Reminder creation should never block the main customer save.
          console.error("Failed to create reminder:", reminderError);
        }

        return {
          success: true,
          customerId,
          kundenummer,
          moveId,
          moveCode,
          message: "Kunden- und Auftragsdaten erfolgreich gespeichert",
        };
      } catch (error) {
        console.error("Error creating customer:", error);
        throw new Error("Daten konnten nicht gespeichert werden");
      }
    }),

  /**
   * Get all customers
   */
  list: protectedProcedure
    .input(z.object({ branchId: z.number().nullable().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, input?.branchId);
        const result = effectiveBranchId
          ? await db.select().from(customers).where(eq(customers.branchId, effectiveBranchId))
          : await db.select().from(customers);

        return result.map(attachCustomerNumber);
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    }),

  /**
   * Get customer by ID with their moves
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const customer = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);

        if (customer.length === 0) return null;

        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
        if (effectiveBranchId && customer[0].branchId !== effectiveBranchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Keine Berechtigung, diesen Kunden anzuzeigen",
          });
        }

        const customerMoves = await db.select().from(moves).where(eq(moves.customerId, input.id));

        const movesWithImages = await Promise.all(
          customerMoves.map(async (move) => {
            const images = await db.select().from(moveImages).where(eq(moveImages.moveId, move.id));
            return { ...move, images, kundenummer: formatCustomerNumber(move.customerId) };
          }),
        );

        return {
          ...attachCustomerNumber(customer[0]),
          moves: movesWithImages,
        };
      } catch (error) {
        console.error("Error fetching customer:", error);
        return null;
      }
    }),

  generateOfferPdf: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        moveId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung zum Erstellen von Angeboten",
        });
      }

      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const moveRows = await db.select().from(moves).where(eq(moves.id, input.moveId)).limit(1);

      const customer = customerRows[0];
      const move = moveRows[0];

      if (!customer || !move || move.customerId !== customer.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kunde oder Auftrag nicht gefunden",
        });
      }

      const { getEffectiveBranchId } = await import("../_core/context");
      const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
      if (effectiveBranchId && customer.branchId !== effectiveBranchId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung für dieses Angebot",
        });
      }

      const kundenummer = formatCustomerNumber(customer.id);
      const servicesJson = parseServicesJson((move as any).servicesJson);
      const customerName = `${customer.title ? `${customer.title} ` : ""}${customer.firstName} ${customer.lastName}`.trim();
      const moveDate = formatDateForOffer((move as any).pickupDate);
      const grossPriceNumeric = Number((move as any).grossPrice ?? 0);
      const grossPrice = formatMoneyForOffer(grossPriceNumeric);
      const nettoPrice = grossPrice;
      const volumeValue = Number((move as any).volume ?? 0);
      const distanceValue = Number((move as any).distance ?? 0);
      const serviceSummary = buildOfferSummary(servicesJson, (move as any).services ?? undefined);
      const greetingName = customer.lastName?.trim() ? `${customer.title ?? ""} ${customer.lastName}`.trim() : customerName;

      const html = generateOfferHTML({
        kundenummer,
        moveDate,
        customerName,
        customerEmail: customer.email ?? "",
        customerPhone: customer.phone ?? "",
        pickupAddress: (move as any).pickupAddress ?? "-",
        pickupFloor: String((move as any).pickupFloor ?? "-"),
        pickupElevator: String((move as any).pickupElevatorCapacity ?? "-"),
        pickupWalkway: String((move as any).pickupParkingDistance ?? "-"),
        deliveryAddress: (move as any).deliveryAddress ?? "-",
        deliveryFloor: String((move as any).deliveryFloor ?? "-"),
        deliveryElevator: String((move as any).deliveryElevatorCapacity ?? "-"),
        deliveryWalkway: String((move as any).deliveryParkingDistance ?? "-"),
        distanceKm: Number.isFinite(distanceValue) && distanceValue > 0 ? formatMoneyForOffer(distanceValue).replace(/,00$/, "") : "0",
        volumeM3: Number.isFinite(volumeValue) && volumeValue > 0 ? formatMoneyForOffer(volumeValue).replace(/,00$/, "") : "0",
        grossPrice,
        nettoPrice,
        packageName: "Premium",
        serviceSummary,
        greetingLine: `Hallo ${greetingName},`,
      });

      const pdfBuffer = await generatePDF(html, {
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
        preferCSSPageSize: true,
      });

      return {
        filename: `Umzug-Angebot_${kundenummer}.pdf`,
        base64: pdfBuffer.toString("base64"),
        kundenummer,
      };
    }),

  /**
   * Delete customer (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur Administratoren können Kunden löschen",
        });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      try {
        const customer = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
        if (customer.length === 0) throw new Error("Customer not found");

        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
        if (effectiveBranchId && customer[0].branchId !== effectiveBranchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Keine Berechtigung, diesen Kunden zu löschen",
          });
        }

        const customerMoves = await db.select({ id: moves.id }).from(moves).where(eq(moves.customerId, input.customerId));
        const moveIds = customerMoves.map((m) => m.id);
        if (moveIds.length > 0) {
          for (const moveId of moveIds) {
            await db.delete(moveImages).where(eq(moveImages.moveId, moveId)).catch(() => {});
          }
        }
        await db.delete(moves).where(eq(moves.customerId, input.customerId));
        await db.delete(customers).where(eq(customers.id, input.customerId));
        return { success: true };
      } catch (error) {
        console.error("Error deleting customer:", error);
        throw new Error("Löschen des Kunden fehlgeschlagen");
      }
    }),

  /**
   * Update customer
   */
  update: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        data: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          company: z.string().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db.update(customers).set(input.data).where(eq(customers.id, input.customerId));
        return { success: true, kundenummer: formatCustomerNumber(input.customerId) };
      } catch (error) {
        console.error("Error updating customer:", error);
        throw new Error("Aktualisieren der Daten fehlgeschlagen");
      }
    }),
});
