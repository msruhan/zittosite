import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Info,
  Key,
  ListBullets,
  Package,
  Pulse,
  ShieldWarning,
  WarningCircle,
  WebhooksLogo,
} from "@phosphor-icons/react/dist/ssr";
import { CodePanel, CopyValue, type CodeSample } from "@/components/domain/api-docs/code-panel";
import { DocsToc, type TocGroup } from "@/components/domain/api-docs/docs-toc";
import { cn } from "@/lib/utils";

const KEY_PLACEHOLDER = "al_live_xxxxxxxxxxxxxxxx";

const TOC: TocGroup[] = [
  {
    label: "Mulai",
    items: [
      { id: "overview", label: "Overview" },
      { id: "autentikasi", label: "Autentikasi" },
      { id: "format-request", label: "Format request" },
      { id: "format-respons", label: "Format respons" },
    ],
  },
  {
    label: "Endpoint",
    items: [
      { id: "accountinfo", label: "accountinfo", mono: true },
      { id: "imeiservicelist", label: "imeiservicelist", mono: true },
      { id: "placeimeiorder", label: "placeimeiorder", mono: true },
      { id: "placeimeiorderbulk", label: "placeimeiorderbulk", mono: true },
      { id: "orderstatus", label: "orderstatus", mono: true },
      { id: "orderstatusbulk", label: "orderstatusbulk", mono: true },
    ],
  },
  {
    label: "Webhook",
    items: [
      { id: "webhook-event", label: "Event & payload" },
      { id: "webhook-signature", label: "Verifikasi signature" },
      { id: "webhook-retry", label: "Retry & jeda otomatis" },
    ],
  },
  {
    label: "Referensi",
    items: [
      { id: "kode-status", label: "Kode status order" },
      { id: "error", label: "Daftar error" },
      { id: "rate-limit", label: "Rate limit" },
      { id: "setup-panel", label: "Setup panel reseller" },
    ],
  },
];

/* ---------- sample builders ---------- */

type Field = [name: string, value: string];

function samplesFor(endpoint: string, username: string, action: string, extra: Field[] = []): CodeSample[] {
  const fields: Field[] = [["username", username], ["apiaccesskey", KEY_PLACEHOLDER], ["action", action], ...extra];
  const needsEncode = (value: string) => /[<>{}"\[\] ,]/.test(value);

  const curl = [
    `curl -X POST ${endpoint}`,
    ...fields.map(([k, v]) => (needsEncode(v) ? `  --data-urlencode '${k}=${v}'` : `  -d ${k}=${v}`)),
  ].join(" \\\n");

  const php = `<?php
$ch = curl_init('${endpoint}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_POSTFIELDS => http_build_query([
${fields.map(([k, v]) => `    '${k}' => ${k === "apiaccesskey" ? "getenv('AL_API_KEY')" : `'${v.replace(/'/g, "\\'")}'`},`).join("\n")}
  ]),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if (isset($response['ERROR'])) {
  throw new Exception($response['ERROR'][0]['MESSAGE']);
}
print_r($response['SUCCESS']);`;

  const node = `const body = new URLSearchParams({
${fields.map(([k, v]) => `  ${k}: ${k === "apiaccesskey" ? "process.env.AL_API_KEY" : JSON.stringify(v)},`).join("\n")}
});

const res = await fetch("${endpoint}", { method: "POST", body });
const data = await res.json();

if (data.ERROR) throw new Error(data.ERROR[0].MESSAGE);
console.log(data.SUCCESS);`;

  return [
    { label: "cURL", code: curl },
    { label: "PHP", code: php },
    { label: "Node.js", code: node },
  ];
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

/* ---------- layout primitives ---------- */

function Section({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-32 border-t border-hairline pt-10 xl:scroll-mt-20", className)}>
      {children}
    </section>
  );
}

function GroupHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="pt-14">
      <p className="text-label font-bold uppercase tracking-wide text-action">{eyebrow}</p>
      <h2 className="mt-1 text-display text-ink">{title}</h2>
      {children ? <p className="mt-2 max-w-[68ch] text-body text-ink-soft">{children}</p> : null}
    </div>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-headline text-ink">{children}</h3>;
}

function H4({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 mt-6 text-title text-ink">{children}</h4>;
}

function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-2 max-w-[72ch] text-body text-ink-soft", className)}>{children}</p>;
}

function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm border border-hairline bg-mist px-1 py-px font-mono text-label text-ink">
      {children}
    </code>
  );
}

function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children: ReactNode;
}) {
  const Icon = tone === "warn" ? ShieldWarning : Info;
  return (
    <div
      className={cn(
        "mt-5 flex gap-3 rounded-lg border px-4 py-3",
        tone === "warn" ? "border-hold-edge/60 bg-hold-wash/60" : "border-action/25 bg-action-wash/70",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", tone === "warn" ? "text-hold-ink" : "text-action")}
        aria-hidden="true"
      />
      <div>
        <p className={cn("text-body font-bold", tone === "warn" ? "text-hold-ink" : "text-action-deep")}>{title}</p>
        <div className="mt-0.5 text-body text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

function MethodBadge() {
  return (
    <span className="inline-flex h-6 items-center rounded-md bg-cleared-wash px-2 font-mono text-label font-bold text-cleared-ink">
      POST
    </span>
  );
}

function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-cleared-edge/15 px-2 font-mono text-label text-cleared-edge">
      {children}
    </span>
  );
}

type Param = { name: string; type: string; required?: boolean; desc: ReactNode };

function ParamTable({ params, caption }: { params: Param[]; caption?: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface">
      {caption ? (
        <p className="border-b border-hairline bg-mist/60 px-4 py-2 text-label font-bold uppercase tracking-wide text-ink-soft">
          {caption}
        </p>
      ) : null}
      <dl className="divide-y divide-hairline">
        {params.map((param) => (
          <div key={param.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-label font-bold text-ink">{param.name}</span>
              <span className="text-label text-ink-faint">{param.type}</span>
              {param.required ? (
                <span className="text-label font-bold text-refused-ink">wajib</span>
              ) : (
                <span className="text-label text-ink-faint">opsional</span>
              )}
            </dt>
            <dd className="text-body text-ink-soft">{param.desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RefTable({ head, rows }: { head: [string, string]; rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="grid grid-cols-[minmax(0,14rem)_1fr] gap-4 border-b border-hairline bg-mist/60 px-4 py-2 text-label font-bold uppercase tracking-wide text-ink-soft">
        <span>{head[0]}</span>
        <span>{head[1]}</span>
      </div>
      <dl className="divide-y divide-hairline">
        {rows.map(([term, desc], index) => (
          <div key={index} className="grid grid-cols-[minmax(0,14rem)_1fr] gap-4 px-4 py-2.5">
            <dt className="min-w-0 break-words font-mono text-label font-bold text-ink">{term}</dt>
            <dd className="text-body text-ink-soft">{desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Endpoint({
  id,
  action,
  aliases,
  summary,
  children,
  samples,
  response,
}: {
  id: string;
  action: string;
  aliases?: string[];
  summary: ReactNode;
  children?: ReactNode;
  samples: CodeSample[];
  response: string;
}) {
  return (
    <Section id={id}>
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge />
        <span className="font-mono text-label text-ink-soft">/api/index.php</span>
        <span className="font-mono text-label text-ink-faint">·</span>
        <span className="font-mono text-label text-ink">action={action}</span>
      </div>
      <h3 className="mt-2 font-mono text-headline text-ink">{action}</h3>
      <P>{summary}</P>
      {aliases?.length ? (
        <p className="mt-2 text-label text-ink-faint">
          Alias:{" "}
          {aliases.map((alias, index) => (
            <span key={alias}>
              {index ? ", " : null}
              <C>{alias}</C>
            </span>
          ))}
        </p>
      ) : null}
      {children}
      <div className="mt-5 grid gap-3 2xl:grid-cols-2">
        <CodePanel samples={samples} title="Request" />
        <CodePanel samples={[{ label: "Respons", code: response }]} title="Respons" badge={<StatusBadge>200</StatusBadge>} />
      </div>
    </Section>
  );
}

const AUTH_PARAMS: Param[] = [
  { name: "username", type: "string", required: true, desc: "Username akun Anda." },
  { name: "apiaccesskey", type: "string", required: true, desc: <>API key dari menu API Access, diawali <C>al_live_</C>.</> },
];

/* ---------- page ---------- */

export function ApiDocs({ endpoint, username, apiEnabled }: { endpoint: string; username: string; apiEnabled: boolean }) {
  const quickLinks = [
    { href: "#autentikasi", icon: Key, title: "Autentikasi", text: "Username dan API key di setiap request." },
    { href: "#imeiservicelist", icon: ListBullets, title: "Layanan", text: "Daftar layanan dan harga khusus akun Anda." },
    { href: "#placeimeiorder", icon: Package, title: "Order", text: "Kirim order tunggal atau bulk, dibayar dari saldo." },
    { href: "#orderstatus", icon: Pulse, title: "Status order", text: "Cek hasil order lewat REFERENCEID." },
    { href: "#webhook-event", icon: WebhooksLogo, title: "Webhook", text: "Terima callback bertanda tangan saat order selesai." },
    { href: "#error", icon: WarningCircle, title: "Error & limit", text: "Kode error, kode status, dan batas request." },
  ];

  return (
    <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0">
        <DocsToc groups={TOC} variant="chips" />

        {/* Overview */}
        <section id="overview" className="scroll-mt-32 xl:scroll-mt-20">
          <p className="text-label font-bold uppercase tracking-wide text-action">API Reference</p>
          <h1 className="mt-1 text-display text-ink">Dokumentasi API</h1>
          <P className="max-w-[64ch]">
            Hubungkan website atau panel reseller Anda untuk mengambil daftar layanan, mengirim order IMEI, dan
            menerima hasilnya secara otomatis. Semua order lewat API dibayar dari saldo akun.
          </P>

          {!apiEnabled ? (
            <Callout tone="warn" title="Akses API belum aktif untuk akun Anda">
              Dokumentasi tetap bisa dibaca, tetapi request akan ditolak sampai admin mengaktifkan akses API.
            </Callout>
          ) : null}

          <H4>Base URL</H4>
          <CopyValue value={endpoint} label="base URL" />
          <p className="mt-2 text-label text-ink-faint">
            Satu endpoint untuk semua action. Path <C>/api/dhru</C> juga diterima.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {quickLinks.map(({ href, icon: Icon, title, text }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  "group card-shell flex items-start gap-3 p-4",
                  "transition-[border-color,box-shadow,transform] duration-150 ease-out-strong",
                  "hover:border-action/40 hover:shadow-lifted active:scale-[0.99]",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-action-wash text-action">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-title text-ink">
                    {title}
                    <ArrowRight
                      className="size-3.5 text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-action"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-0.5 block text-body text-ink-soft">{text}</span>
                </span>
              </a>
            ))}
          </div>

          <H4>Mulai dalam 3 langkah</H4>
          <ol className="space-y-3">
            {[
              <>
                Buat API key di menu{" "}
                <Link href="/app/api" className="font-bold text-action hover:underline">
                  API Access
                </Link>
                . Key hanya ditampilkan sekali, jadi simpan di server Anda.
              </>,
              <>
                Panggil <C>imeiservicelist</C> untuk mengambil <C>SERVICEID</C>, lalu kirim order dengan{" "}
                <C>placeimeiorder</C>.
              </>,
              <>
                Pasang URL webhook agar hasil order dikirim otomatis, atau cek berkala lewat <C>orderstatus</C>.
              </>,
            ].map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface font-data text-label font-bold text-ink">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-body text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <GroupHeading eyebrow="Mulai" title="Dasar-dasar" />

        <Section id="autentikasi" className="mt-6">
          <H3>Autentikasi</H3>
          <P>
            Setiap request membawa <C>username</C> dan <C>apiaccesskey</C> sebagai field form. Key yang dicabut langsung
            ditolak. Anda bisa memiliki maksimal 5 key aktif; gunakan satu key per website agar mudah dicabut.
          </P>
          <ParamTable params={AUTH_PARAMS} caption="Field autentikasi" />
          <P>
            Untuk kompatibilitas dengan panel reseller lain, alias <C>api_username</C>, <C>user</C>, <C>key</C>,{" "}
            <C>api_key</C>, <C>apikey</C>, dan <C>accesskey</C> juga diterima, termasuk format gabungan{" "}
            <C>username.apikey</C> di field key.
          </P>
          <Callout tone="warn" title="Jaga kerahasiaan API key">
            Jangan menaruh API key di kode frontend, aplikasi mobile, URL, screenshot, atau log. Simpan di environment
            variable atau secret manager di server, lalu panggil API dari backend Anda.
          </Callout>
        </Section>

        <Section id="format-request" className="mt-10">
          <H3>Format request</H3>
          <P>
            Kirim <C>POST</C> dengan body <C>application/x-www-form-urlencoded</C> atau <C>multipart/form-data</C>{" "}
            (default PHP cURL). Request <C>GET</C> selalu ditolak.
          </P>
          <ParamTable
            caption="Field umum"
            params={[
              ...AUTH_PARAMS,
              { name: "action", type: "string", required: true, desc: <>Nama action, tidak peka huruf besar/kecil. Lihat bagian Endpoint.</> },
              {
                name: "parameters",
                type: "XML | JSON",
                desc: (
                  <>
                    Data order. Format XML <C>{"<PARAMETERS><ID>…</ID><IMEI>…</IMEI></PARAMETERS>"}</C> atau JSON{" "}
                    <C>{'{"ID":"…","IMEI":"…"}'}</C>. Field <C>ID</C>, <C>IMEI</C>, dan <C>orderid</C> juga boleh
                    dikirim langsung sebagai field form.
                  </>
                ),
              },
              { name: "requestformat", type: "string", desc: <>Diterima demi kompatibilitas (mis. <C>JSON</C>). Respons selalu JSON.</> },
            ]}
          />
        </Section>

        <Section id="format-respons" className="mt-10">
          <H3>Format respons</H3>
          <P>
            Semua respons memakai HTTP <C>200</C>, termasuk saat gagal. Periksa key <C>SUCCESS</C> atau <C>ERROR</C> di
            body, keduanya berupa array.
          </P>
          <div className="mt-4 grid gap-3 2xl:grid-cols-2">
            <CodePanel
              title="Berhasil"
              samples={[{ label: "Berhasil", code: json({ SUCCESS: [{ MESSAGE: "…" }], apiversion: "8.2" }) }]}
            />
            <CodePanel
              title="Gagal"
              samples={[
                {
                  label: "Gagal",
                  code: json({
                    ERROR: [{ MESSAGE: "Authentication failed", FULL_DESCRIPTION: "invalid_username_or_apiaccesskey" }],
                    apiversion: "8.2",
                  }),
                },
              ]}
            />
          </div>
        </Section>

        <GroupHeading eyebrow="Endpoint" title="Action">
          Semua action dikirim ke base URL yang sama dan dibedakan lewat field <C>action</C>.
        </GroupHeading>

        <div className="mt-6 space-y-10">
          <Endpoint
            id="accountinfo"
            action="accountinfo"
            summary="Mengambil saldo akun. creditraw berisi angka mentah dalam Rupiah, credit berisi versi terformat."
            samples={samplesFor(endpoint, username, "accountinfo")}
            response={json({
              SUCCESS: [
                {
                  message: "Your Account Info",
                  AccoutInfo: {
                    credit: "1.250.000",
                    creditraw: "1250000",
                    mail: username,
                    currency: "IDR",
                    username,
                  },
                },
              ],
              apiversion: "8.2",
            })}
          >
            <Callout title="Nama key mengikuti standar">
              Key <C>AccoutInfo</C> memang ditulis tanpa huruf &quot;n&quot; agar kompatibel dengan panel reseller.
            </Callout>
          </Endpoint>

          <Endpoint
            id="imeiservicelist"
            action="imeiservicelist"
            aliases={["servicelist", "getservices"]}
            summary={
              <>
                Daftar layanan aktif beserta harga sesuai grup akun Anda. Gunakan <C>SERVICEID</C> sebagai <C>ID</C>{" "}
                saat order. <C>CREDIT</C> adalah harga per IMEI dalam Rupiah.
              </>
            }
            samples={samplesFor(endpoint, username, "imeiservicelist")}
            response={json({
              SUCCESS: [
                {
                  MESSAGE: "IMEI Service List",
                  LIST: {
                    "IMEI Services": {
                      GROUPNAME: "IMEI Services",
                      GROUPTYPE: "IMEI",
                      SERVICES: {
                        kode_layanan: {
                          SERVICEID: "kode_layanan",
                          SERVICETYPE: "IMEI",
                          SERVICENAME: "Nama layanan",
                          CREDIT: "150000",
                          TIME: "1-3 jam",
                          INFO: "Deskripsi layanan",
                          "Requires.Network": "None",
                        },
                      },
                    },
                  },
                },
              ],
              apiversion: "8.2",
            })}
          />

          <Endpoint
            id="placeimeiorder"
            action="placeimeiorder"
            aliases={["placeorder"]}
            summary="Membuat satu order untuk satu IMEI. Harga layanan langsung dipotong dari saldo; simpan REFERENCEID untuk cek status."
            samples={samplesFor(endpoint, username, "placeimeiorder", [
              ["parameters", "<PARAMETERS><ID>kode_layanan</ID><IMEI>356938035643809</IMEI></PARAMETERS>"],
            ])}
            response={json({
              SUCCESS: [{ MESSAGE: "Order Placed Successfully", REFERENCEID: "ZT2610010001" }],
              apiversion: "8.2",
            })}
          >
            <ParamTable
              caption="Isi parameters"
              params={[
                { name: "ID", type: "string", required: true, desc: <>Kode layanan (<C>SERVICEID</C>), tidak peka huruf besar/kecil. Alias: <C>SERVICEID</C>.</> },
                { name: "IMEI", type: "string", required: true, desc: "IMEI 15 digit yang valid." },
                { name: "CUSTOMFIELD", type: "base64 JSON", desc: <>Opsional, dikirim otomatis oleh sebagian panel reseller. Isinya digabung ke parameters.</> },
              ]}
            />
          </Endpoint>

          <Endpoint
            id="placeimeiorderbulk"
            action="placeimeiorderbulk"
            aliases={["placeorderbulk"]}
            summary={
              <>
                Membuat hingga 50 order dalam satu request. Total harga dicek di awal: jika saldo tidak cukup untuk semua
                baris, seluruh request ditolak. Setiap baris mengembalikan <C>REFERENCEID</C> atau <C>ERROR</C>{" "}
                masing-masing.
              </>
            }
            samples={samplesFor(endpoint, username, "placeimeiorderbulk", [
              [
                "parameters",
                '[{"ID":"kode_layanan","IMEI":"356938035643809"},{"ID":"kode_layanan","IMEI":"353918058381694"}]',
              ],
            ])}
            response={json({
              SUCCESS: [
                { IMEI: "356938035643809", ID: "kode_layanan", MESSAGE: "Order Placed Successfully", REFERENCEID: "ZT2610010002" },
                { IMEI: "353918058381694", ID: "kode_layanan", ERROR: "Invalid IMEI" },
              ],
              apiversion: "8.2",
            })}
          >
            <ParamTable
              caption="Isi parameters"
              params={[
                {
                  name: "parameters",
                  type: "JSON array",
                  required: true,
                  desc: <>Maksimal 50 item <C>{'{"ID":"…","IMEI":"…"}'}</C>. Objek berkunci (<C>{'{"1":{…},"2":{…}}'}</C>) juga diterima.</>,
                },
              ]}
            />
          </Endpoint>

          <Endpoint
            id="orderstatus"
            action="orderstatus"
            aliases={["getimeiorder", "getserverorder"]}
            summary={
              <>
                Status satu order. Untuk order selesai, hasilnya ada di <C>CODE</C>. Untuk order ditolak, alasannya ada
                di <C>CODE</C> dan <C>COMMENTS</C>.
              </>
            }
            samples={samplesFor(endpoint, username, "orderstatus", [["orderid", "ZT2610010001"]])}
            response={json({
              SUCCESS: [
                {
                  STATUS: "4",
                  CODE: "Hasil order",
                  COMMENTS: "",
                  REFERENCEID: "ZT2610010001",
                  IMEI: "356938035643809",
                  MESSAGE: "Order completed",
                },
              ],
              apiversion: "8.2",
            })}
          >
            <ParamTable
              params={[
                { name: "orderid", type: "string", required: true, desc: <>REFERENCEID dari respons order. Alias: <C>REFERENCEID</C>, <C>ID</C>.</> },
              ]}
            />
          </Endpoint>

          <Endpoint
            id="orderstatusbulk"
            action="orderstatusbulk"
            aliases={["getimeiorderbulk", "getserverorderbulk"]}
            summary="Status hingga 100 order sekaligus. ID duplikat digabung; ID yang tidak ditemukan dikembalikan dengan ERROR."
            samples={samplesFor(endpoint, username, "orderstatusbulk", [
              ["orderid", "ZT2610010001,ZT2610010002"],
            ])}
            response={json({
              SUCCESS: [
                { STATUS: "1", CODE: "", COMMENTS: "", REFERENCEID: "ZT2610010001", IMEI: "356938035643809", MESSAGE: "Order in process" },
                { REFERENCEID: "ZT2610010009", ERROR: "Order not found" },
              ],
              apiversion: "8.2",
            })}
          >
            <ParamTable
              params={[
                {
                  name: "orderid",
                  type: "string",
                  required: true,
                  desc: <>Daftar REFERENCEID dipisah koma. Bisa juga lewat <C>parameters</C> berupa JSON array.</>,
                },
              ]}
            />
          </Endpoint>
        </div>

        <GroupHeading eyebrow="Webhook" title="Callback order">
          Daripada polling, pasang URL webhook di menu API Access. Kami mengirim POST bertanda tangan saat order API
          selesai, ditolak, atau dibatalkan.
        </GroupHeading>

        <Section id="webhook-event" className="mt-6">
          <H3>Event & payload</H3>
          <RefTable
            head={["Event", "Kapan dikirim"]}
            rows={[
              ["order.completed", "Order selesai dan hasil tersedia di code."],
              ["order.rejected", "Order ditolak atau hasilnya gagal. Saldo sudah dikembalikan."],
              ["order.cancelled", "Order dibatalkan. Saldo sudah dikembalikan."],
              ["ping", <>Dikirim saat Anda menekan &quot;Kirim test&quot;. Tidak tercatat di riwayat.</>],
            ]}
          />
          <H4>Header</H4>
          <RefTable
            head={["Header", "Isi"]}
            rows={[
              ["X-Webhook-Event", "Nama event, sama dengan field event di body."],
              ["X-Webhook-Id", "ID unik pengiriman. Tetap sama saat retry, gunakan untuk deduplikasi."],
              ["X-Timestamp", "Unix timestamp (detik) saat pengiriman."],
              ["X-Signature", <><C>sha256=</C> + HMAC-SHA256 dari <C>{"<X-Timestamp>.<raw body>"}</C>.</>],
              ["User-Agent", <C key="ua">ZittoSite-Webhook/1.0</C>],
            ]}
          />
          <div className="mt-5">
            <CodePanel
              title="POST https://website-anda.com/webhook/order"
              samples={[
                {
                  label: "Body",
                  code: json({
                    event: "order.completed",
                    referenceId: "ZT2610010001",
                    imei: "356938035643809",
                    service: { id: "kode_layanan", name: "Nama layanan" },
                    status: 4,
                    code: "Hasil order",
                    comments: "",
                    message: "Order completed",
                    completedAt: "2026-10-01T08:15:00.000Z",
                  }),
                },
              ]}
            />
          </div>
        </Section>

        <Section id="webhook-signature" className="mt-10">
          <H3>Verifikasi signature</H3>
          <P>
            Hitung ulang HMAC dengan secret webhook Anda (diawali <C>whsec_</C>) atas raw body, sebelum di-parse.
            Bandingkan dengan perbandingan constant-time, dan tolak timestamp yang lebih tua dari 5 menit.
          </P>
          <div className="mt-4">
            <CodePanel
              samples={[
                {
                  label: "PHP",
                  code: `<?php
$secret    = getenv('AL_WEBHOOK_SECRET');
$rawBody   = file_get_contents('php://input');
$timestamp = $_SERVER['HTTP_X_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

$expected = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);

if (!hash_equals($expected, $signature) || abs(time() - (int) $timestamp) > 300) {
  http_response_code(401);
  exit;
}

$event = json_decode($rawBody, true);
// Proses $event['referenceId'] ... lalu balas cepat
http_response_code(200);`,
                },
                {
                  label: "Node.js",
                  code: `import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/webhook/order", express.raw({ type: "application/json" }), (req, res) => {
  const timestamp = req.header("X-Timestamp") ?? "";
  const signature = req.header("X-Signature") ?? "";
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.AL_WEBHOOK_SECRET)
      .update(\`\${timestamp}.\${req.body}\`)
      .digest("hex");

  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300;
  if (!valid || !fresh) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));
  // Proses event.referenceId ... lalu balas cepat
  res.sendStatus(200);
});`,
                },
              ]}
            />
          </div>
        </Section>

        <Section id="webhook-retry" className="mt-10">
          <H3>Retry & jeda otomatis</H3>
          <P>
            Balas dengan HTTP <C>2xx</C> dalam 10 detik. Redirect tidak diikuti dan dianggap gagal. URL wajib{" "}
            <C>https://</C> dan harus mengarah ke alamat publik.
          </P>
          <ol className="mt-4 flex flex-wrap items-center gap-2">
            {["Langsung", "+1 menit", "+5 menit", "+15 menit", "+1 jam", "+6 jam"].map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                {index ? <ArrowRight className="size-3.5 text-ink-faint" aria-hidden="true" /> : null}
                <span className="rounded-full border border-hairline bg-surface px-3 py-1 font-data text-label text-ink">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <P>
            Setelah 6 percobaan gagal, pengiriman ditandai gagal. Jika endpoint gagal 10 kali berturut-turut, webhook
            dijeda otomatis; perbaiki URL lalu aktifkan lagi di menu API Access. Event bisa terkirim lebih dari sekali,
            jadi proses secara idempoten berdasarkan <C>X-Webhook-Id</C> atau <C>referenceId</C> + <C>event</C>.
          </P>
        </Section>

        <GroupHeading eyebrow="Referensi" title="Kode & batasan" />

        <Section id="kode-status" className="mt-6">
          <H3>Kode status order</H3>
          <P>
            Nilai <C>STATUS</C> di <C>orderstatus</C> dan <C>status</C> di webhook mengikuti standar API reseller.
          </P>
          <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface">
            {[
              ["0", "Order pending", "Menunggu diproses.", "border-queued-edge bg-queued-wash text-queued-ink"],
              ["1", "Order in process", "Sedang dikerjakan.", "border-working-edge bg-working-wash text-working-ink"],
              ["3", "Order rejected", "Ditolak, dibatalkan, atau gagal. Saldo dikembalikan.", "border-refused-edge bg-refused-wash text-refused-ink"],
              ["4", "Order completed", "Selesai, hasil ada di CODE.", "border-cleared-edge bg-cleared-wash text-cleared-ink"],
            ].map(([code, message, desc, tone]) => (
              <div key={code} className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border font-data text-title", tone)}>
                  {code}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-label font-bold text-ink">{message}</p>
                  <p className="text-body text-ink-soft">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="error" className="mt-10">
          <H3>Daftar error</H3>
          <P>
            <C>MESSAGE</C> berisi pesan singkat; <C>FULL_DESCRIPTION</C> berisi kode yang stabil untuk dicocokkan di
            program Anda.
          </P>
          <RefTable
            head={["MESSAGE / FULL_DESCRIPTION", "Arti"]}
            rows={[
              [<>Authentication failed<br /><span className="font-normal text-ink-faint">invalid_username_or_apiaccesskey</span></>, "Username atau key salah, key dicabut, atau akses API dinonaktifkan."],
              [<>Too many requests<br /><span className="font-normal text-ink-faint">too_many_failed_logins</span></>, "Terlalu banyak autentikasi gagal dari IP Anda. Tunggu hingga 10 menit."],
              [<>Too many requests<br /><span className="font-normal text-ink-faint">rate_limited · order_rate_limited</span></>, "Melewati batas request atau batas order per menit."],
              [<>Unsupported action<br /><span className="font-normal text-ink-faint">unsupported_action</span></>, "Nilai action tidak dikenali."],
              [<>Invalid request<br /><span className="font-normal text-ink-faint">parameters_required · orderid_required · use_post</span></>, "Field wajib kosong, atau request bukan POST."],
              ["Service not found", "ID layanan tidak ada atau tidak aktif untuk akun Anda."],
              ["Invalid IMEI", "IMEI bukan 15 digit yang valid."],
              ["Insufficient balance", "Saldo tidak cukup. Untuk bulk, dicek terhadap total semua baris."],
              [<>Maximum 50 orders per request<br /><span className="font-normal text-ink-faint">too_many_orders</span></>, "Melewati 50 order (bulk) atau 100 ID (status bulk)."],
              ["Order not found", "REFERENCEID tidak ditemukan di akun Anda."],
              [<>Internal error<br /><span className="font-normal text-ink-faint">internal_error</span></>, "Gangguan di sisi kami. Aman untuk dicoba lagi."],
            ]}
          />
        </Section>

        <Section id="rate-limit" className="mt-10">
          <H3>Rate limit</H3>
          <P>Batas dihitung per API key, kecuali autentikasi gagal yang dihitung per IP.</P>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["120", "request / menit", "Semua action, per API key."],
              ["20", "order / menit", "Per API key. Setiap baris bulk dihitung satu order."],
              ["20", "gagal / 10 menit", "Autentikasi gagal per IP sebelum diblokir sementara."],
            ].map(([value, unit, desc]) => (
              <div key={unit} className="card-shell p-4">
                <p className="font-data text-metric text-ink">
                  {value} <span className="text-body font-normal text-ink-soft">{unit}</span>
                </p>
                <p className="mt-1 text-body text-ink-soft">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="setup-panel" className="mt-10 pb-10">
          <H3>Setup di panel reseller</H3>
          <P>Tambahkan kami sebagai API supplier di panel reseller Anda dengan data berikut:</P>
          <RefTable
            head={["Field di panel", "Isi"]}
            rows={[
              ["URL", <C key="url">{endpoint}</C>],
              ["Username", <C key="username">{username}</C>],
              ["API Access Key", <>API key dari menu <Link href="/app/api" className="font-bold text-action hover:underline">API Access</Link></>],
            ]}
          />
          <P>
            Setelah tersambung, sinkronkan daftar layanan lalu petakan layanan Anda ke <C>SERVICEID</C> kami. Status dan
            hasil order akan ditarik otomatis oleh panel Anda.
          </P>
        </Section>
      </div>

      <aside className="hidden xl:block">
        <DocsToc groups={TOC} variant="rail" />
      </aside>
    </div>
  );
}
