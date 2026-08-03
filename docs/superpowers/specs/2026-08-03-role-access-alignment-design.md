# Role access alignment — Super Admin, Admin, User

Date: 2026-08-03  
Status: approved (brainstorming)  
Scope: align website + Telegram access with agreed role rules; hide customer identity from Admin; restrict Admin website menus.

## Context

The product already has three actors (User, Admin/operator, Super Admin). A role brief asked whether current behavior matches policy. Gap analysis showed:

- Super Admin and User flows are largely in place.
- Admin can process orders on website **and** Telegram (accepted).
- Admin currently sees customer identity (must stop).
- Admin currently has near–full website access except Admins CRUD (must narrow to Orders + Reports + Security).
- CEIR is not integrated; product decision is a **form warning only** (link to infoceir.com), already shipped on the create-order form.

## Decisions (locked)

1. **Admin channels:** process orders on **website and Telegram**.
2. **Customer identity:** Admin must **not** see who ordered (no name, username, or Telegram handle). Super Admin retains full identity.
3. **Admin website menus:** **Orders + Reports + Security** only. Users, Services, and Admins are Super Admin only.
4. **CEIR:** no external API in this scope. User is warned on the order form that IMEI must be UNKNOWN and should check [infoceir.com](https://infoceir.com).
5. **Payment / Telegram auto-link:** out of scope (mark-paid remains; Telegram linking stays manual).

## Access matrix

| Surface | Super Admin | Admin |
| --- | --- | --- |
| Dashboard | Yes | Optional summary or redirect to Orders (implementation may keep a light dashboard of queue metrics without PII) |
| Orders | Yes, with user identity | Yes, **without** user identity |
| Reports | Yes | Yes (aggregates only; no PII columns) |
| Users | Yes | No (403) |
| Services | Yes | No (403) |
| Admins | Yes | No (403) |
| Security / Telegram link | Yes | Yes |
| Telegram order ops | Yes if linked | Yes (Terima / Tolak / Done) |

User remains: website + Telegram bot for own orders; accounts created by Super Admin.

## Identity redaction

### Telegram notifications

Admin order cards must include:

- Order ID  
- Masked IMEI  
- Service name  
- Price / status as needed  
- Action buttons (Terima / Tolak / Done flow unchanged)

Must **not** include: user full name, username, or Telegram handle.

### Website (role `admin`)

- Order list and detail omit “Pihak terkait” / customer identity blocks.
- Search for Admin: Order ID and IMEI only (no search-by-user for Admin).
- Super Admin UI unchanged: full user identity and search-by-user.

### API

- Order serializers (and any list/detail endpoints Admin can call) must redact `user` PII for role `admin`.
- Enforcement is server-side (guards + serialization). UI hiding alone is insufficient.
- Endpoints for Users / Services / Admins require `SuperAdminGuard` (or equivalent). Admin calling them receives 403.
- Status override / emergency status change: **Super Admin only** (tighten if currently open to any admin).

## Order processing (unchanged semantics)

- Paid / mark-paid → `waiting_action` → Admin Terima → `in_process` → Done + `OrderResult`, or Tolak → `rejected`.
- First-accept-wins on Terima remains.
- Same transitions available from Telegram callbacks and website Admin Order UI (without revealing customer identity on Admin surfaces).

## Out of scope

- Real payment gateway / QRIS  
- Automatic Telegram account linking  
- CEIR API integration or automated UNKNOWN verification  
- New DB role beyond existing `super_admin` | `admin`  
- Granular permission matrix beyond the menu/API split above  

## Testing checklist

- Login as `operator` (admin): sidebar shows Orders, Reports, Security only; Users/Services/Admins return 403 or redirect.
- Admin order list/detail/Telegram card: no customer name/username/handle.
- Login as `superadmin`: full menus; order detail shows user; Admins CRUD works.
- Create order form still shows IMEI UNKNOWN + infoceir.com warning.
- Terima / Tolak / Done still work from Telegram and from Admin website orders.

## Implementation approach

Preferred: **API SuperAdminGuard expansion + role-aware order serialization + nav/hideHrefs + Telegram message copy** (approach 1 from brainstorming). Do not rely on menu hiding alone.
