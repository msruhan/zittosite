/**
 * Local Dhru Fusion stand-in for testing supplier-routed services.
 *
 *   npm run mock:supplier          (listens on MOCK_SUPPLIER_PORT, default 4100)
 *
 * Behaviour, keyed on the last digit/char of the IMEI/SN/ECID:
 *   ends with 0  → placeimeiorder is refused immediately ("Invalid IMEI")
 *   ends with 9  → accepted, then rejected after the processing delay
 *   anything else → accepted, then success after the processing delay
 * Services without a device value (QNT/USERNAME/EMAIL only) always succeed.
 * Orders live in memory and are lost on restart.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export const MOCK_SUPPLIER_USERNAME = "dummy";
export const MOCK_SUPPLIER_API_KEY = "DUMMY-SUPPLIER-KEY-123456";

const PORT = Number(process.env.MOCK_SUPPLIER_PORT ?? 4100);
const PROCESS_MS = Number(process.env.MOCK_SUPPLIER_DELAY_MS ?? 15_000);

type Kind = "ceir" | "fmi" | "server";
type MockService = { id: string; name: string; credit: string; time: string; info: string; kind: Kind };

export const MOCK_SUPPLIER_GROUPS: Array<{ name: string; services: MockService[] }> = [
  {
    name: "CEIR Indonesia",
    services: [
      { id: "101", name: "CEIR Status Check", credit: "0.50", time: "Instant", info: "Cek status IMEI di CEIR.", kind: "ceir" },
      { id: "102", name: "CEIR Full History", credit: "1.20", time: "1-5 Minutes", info: "Status + riwayat IMSI.", kind: "ceir" },
    ],
  },
  {
    name: "FMI OFF iPad WiFi",
    services: [
      { id: "201", name: "FMI OFF iPad By SN Instant - iPad 8th Gen 10.2\" (Wi-Fi Only)", credit: "111.00", time: "Instant", info: "Kirim SN perangkat.", kind: "fmi" },
      { id: "202", name: "FMI OFF iPad By SN Instant - iPad 9th Gen", credit: "126.00", time: "Instant", info: "Kirim SN perangkat.", kind: "fmi" },
      { id: "203", name: "FMI OFF iPad By SN Instant - iPad Air 4", credit: "146.00", time: "1-2 Hari Kerja", info: "Kirim SN perangkat.", kind: "fmi" },
      { id: "204", name: "FMI OFF iPad By ECID - iPad Pro 11\" M4", credit: "231.00", time: "Instant", info: "Kirim ECID perangkat.", kind: "fmi" },
    ],
  },
  {
    name: "Server Services",
    services: [
      { id: "301", name: "Tool Credit Top Up (Username + Email + Qnt)", credit: "2.00", time: "5-30 Minutes", info: "Kredit tool ke akun user.", kind: "server" },
      { id: "302", name: "Account Activation (Email)", credit: "5.00", time: "1-6 Hours", info: "Aktivasi akun berdasarkan email.", kind: "server" },
      { id: "303", name: "IMEI Repair Report + Email", credit: "3.50", time: "1-2 Hours", info: "Laporan dikirim ke email.", kind: "server" },
    ],
  },
];

const SERVICES = new Map(
  MOCK_SUPPLIER_GROUPS.flatMap((group) => group.services.map((s) => [s.id, s] as const)),
);

type MockOrder = {
  ref: string;
  service: MockService;
  value: string;
  fields: Record<string, string>;
  createdAt: number;
};

const orders = new Map<string, MockOrder>();
let nextRef = 1000;

function parseParameters(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of xml.matchAll(/<([A-Z0-9_]+)>([^<]*)<\/\1>/gi)) {
    out[match[1]!.toUpperCase()] = match[2]!
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return out;
}

function customFields(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k.toUpperCase(), String(v)]));
  } catch {
    return {};
  }
}

function ceirResult(value: string, full: boolean): string {
  const lines = ["Result: REGISTERED", "Valid until: 2027-10-01"];
  if (full) {
    lines.push(
      `2026-09-12 10:22 · IMSI 51010${value.slice(-10).padStart(10, "0")} · registered · Registrasi via operator`,
      "2026-06-03 08:15 · IMSI 510011234567890 · imsi_changed · Ganti kartu SIM",
      "2025-12-20 14:40 · first_seen · Pertama kali terdeteksi jaringan",
    );
  }
  return lines.join("\n");
}

function successCode(order: MockOrder): string {
  const { service, fields, value } = order;
  if (service.kind === "ceir") return ceirResult(value, service.id === "102");
  if (service.kind === "fmi") return `FMI OFF sukses untuk ${value}. Silakan restart perangkat.`;
  const parts = [
    fields.QNT ? `Qnt ${fields.QNT}` : null,
    fields.USERNAME ? `username ${fields.USERNAME}` : null,
    fields.EMAIL ? `email ${fields.EMAIL}` : null,
  ].filter(Boolean);
  return `Selesai: ${service.name}${parts.length ? ` (${parts.join(", ")})` : ""}.`;
}

function ok(data: Record<string, unknown>) {
  return { SUCCESS: [data], apiversion: "6.1" };
}

function fail(message: string) {
  return { ERROR: [{ MESSAGE: message }], apiversion: "6.1" };
}

function handle(form: URLSearchParams): unknown {
  if (form.get("username") !== MOCK_SUPPLIER_USERNAME || form.get("apiaccesskey") !== MOCK_SUPPLIER_API_KEY) {
    return fail("Authentication Failed");
  }
  const params = parseParameters(form.get("parameters") ?? "");

  switch (form.get("action")) {
    case "accountinfo":
      return ok({
        message: "Your Accout Info",
        AccoutInfo: { credit: "1250.00", creditraw: "1250", mail: "dummy@supplier.test", currency: "USD" },
      });

    case "imeiservicelist":
      return ok({
        MESSAGE: "IMEI Service List",
        LIST: Object.fromEntries(
          MOCK_SUPPLIER_GROUPS.map((group) => [
            group.name,
            {
              GROUPNAME: group.name,
              GROUPTYPE: "IMEI",
              SERVICES: Object.fromEntries(
                group.services.map((s) => [
                  s.id,
                  { SERVICEID: s.id, SERVICETYPE: "IMEI", SERVICENAME: s.name, CREDIT: s.credit, TIME: s.time, INFO: s.info },
                ]),
              ),
            },
          ]),
        ),
      });

    case "placeimeiorder": {
      const service = SERVICES.get(params.ID ?? "");
      if (!service) return fail("Invalid Service ID");
      const fields = { ...customFields(params.CUSTOMFIELD), ...(params.QNT ? { QNT: params.QNT } : {}) };
      const value = params.IMEI || fields.SN || fields.ECID || "";
      if (value.endsWith("0")) return fail("Invalid IMEI");
      const ref = `DMY-${nextRef++}`;
      orders.set(ref, { ref, service, value, fields, createdAt: Date.now() });
      console.log(`[mock-supplier] order ${ref} · ${service.name} · ${value || "-"} · ${JSON.stringify(fields)}`);
      return ok({ MESSAGE: "Order Received", REFERENCEID: ref });
    }

    case "getimeiorder": {
      const order = orders.get(params.ID ?? "");
      if (!order) return fail("Invalid Order ID");
      if (Date.now() - order.createdAt < PROCESS_MS) {
        return ok({ STATUS: "1", CODE: "", COMMENTS: "In process" });
      }
      if (order.value.endsWith("9")) {
        return ok({ STATUS: "3", CODE: "", COMMENTS: "IMEI blacklisted di database supplier (dummy)." });
      }
      return ok({ STATUS: "4", CODE: successCode(order), COMMENTS: "" });
    }

    default:
      return fail("Invalid Action");
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

if (require.main === module) {
  createServer(async (req, res) => {
    if (req.method !== "POST") return send(res, 405, fail("POST only"));
    try {
      const form = new URLSearchParams(await readBody(req));
      const reply = handle(form);
      console.log(`[mock-supplier] ${form.get("action")} → ${"ERROR" in (reply as object) ? "ERROR" : "SUCCESS"}`);
      send(res, 200, reply);
    } catch (err) {
      send(res, 500, fail(err instanceof Error ? err.message : String(err)));
    }
  }).listen(PORT, "127.0.0.1", () => {
    console.log(`[mock-supplier] Dhru mock on http://localhost:${PORT}/api/index.php`);
    console.log(`[mock-supplier] username=${MOCK_SUPPLIER_USERNAME} apikey=${MOCK_SUPPLIER_API_KEY}`);
    console.log(`[mock-supplier] processing delay ${PROCESS_MS} ms`);
  });
}
