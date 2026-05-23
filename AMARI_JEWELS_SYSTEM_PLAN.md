# Amari Jewels Jewelry Management System Plan

## 1. Product Goal

Amari Jewels will be a PWA-based jewelry management system for managing customers, suppliers, stock items, design masters, settings, and sales. The system should work well on desktop and tablet, support authenticated users, store images in S3-compatible object storage, and keep all structured business data in PostgreSQL.

Primary goals:

- Centralize customer, supplier, stock, design, and future sales data.
- Make day-to-day data entry fast and reliable.
- Support image upload for design records.
- Provide searchable, filterable master records.
- Prepare a clean foundation for Sales, billing, inventory movement, and reporting.

## 2. Proposed Tech Stack

Frontend:

- Next.js with React
- TypeScript
- PWA support with service worker and web app manifest
- Responsive UI for desktop, tablet, and mobile
- Form validation with Zod or React Hook Form + Zod

Backend:

- Node.js API layer through Next.js API routes, Next.js Route Handlers, or a separate Express/Fastify service
- TypeScript
- JWT authentication
- PostgreSQL database
- Prisma ORM or Drizzle ORM

Storage:

- iDrive E2 S3-compatible bucket for design images and future document uploads
- Presigned upload URLs for secure client-side uploads
- Object keys stored in PostgreSQL

Deployment:

- Frontend/backend: VPS, Docker, Railway, Render, AWS Lightsail, or similar
- Database: managed PostgreSQL or self-hosted PostgreSQL
- Images: iDrive E2 S3-compatible storage

## 3. Recommended Architecture

Use a modular monolith first. This keeps development fast and simple while still allowing clean module separation.

Recommended app structure:

```text
src/
  app/
    login/
    dashboard/
    customers/
    suppliers/
    stock/
    designs/
    settings/
    profile/
    api/
  components/
    forms/
    tables/
    layout/
    upload/
    ui/
  server/
    auth/
    db/
    services/
      customers/
      suppliers/
      stock/
      designs/
      settings/
      storage/
  lib/
    validation/
    constants/
    utils/
```

Key principles:

- Keep business logic in `server/services`, not directly inside UI components.
- Keep validation schemas shared between frontend and backend when possible.
- Use soft delete for master data where audit/history matters.
- Add created/updated metadata to every important table.
- Use status fields for Active/Inactive instead of deleting business records permanently.

## 4. Core User Roles

Initial roles:

- Admin: full access to all modules, users, settings, and profile.
- Staff: create/edit operational records such as customers, suppliers, stock, and designs.
- Viewer: read-only access for reports and lookups.

Role-based access can be simple at first and expanded later.

## 5. Authentication Plan

Required flow:

- Login with username and password.
- Server verifies credentials.
- Server returns JWT access token.
- Token is stored securely.
- Protected API routes validate JWT before processing requests.

Password security recommendation:

- Do not store raw SHA hashes such as plain SHA-1 or SHA-256. They are not safe for passwords.
- Recommended: Argon2id or bcrypt.
- If SHA-based hashing is mandatory, use PBKDF2-HMAC-SHA256 with a unique salt and high iteration count.

JWT plan:

- Access token expiry: 15 minutes to 1 hour.
- Refresh token expiry: 7 to 30 days.
- Store refresh token in an HTTP-only secure cookie.
- Store access token in memory or HTTP-only cookie depending on final architecture.
- Rotate refresh tokens after use.

Authentication tables:

- `users`
- `user_sessions`
- optional `password_reset_tokens`

## 6. Common Fields and Standards

Most business tables should include:

```text
id
code
status
remarks
created_at
updated_at
created_by
updated_by
deleted_at
```

Recommended status values:

- `ACTIVE`
- `INACTIVE`

Recommended country default:

- `India`

Recommended code generation:

- Customer: `CUST-000001`
- Supplier: `SUP-000001`
- Stock tag: manually entered or auto-generated as `TAG-000001`
- Design: manually entered or auto-generated as `DES-000001`

Codes should be unique and human-readable.

## 7. Modules

## 7.1 Customer Module

Purpose:

Manage customer master records for future sales, invoicing, and communication.

Fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| code | string | yes | Unique customer code |
| name | string | yes | Person/contact name |
| company | string | no | Company or firm name |
| mobile | string | yes | Validate Indian mobile format where possible |
| address | text | no | Full address |
| city | string | no | City |
| state | string | no | Indian state |
| country | string | yes | Default `India` |
| gst | string | no | GSTIN validation |
| pan | string | no | Can be auto-filled from GSTIN |
| remarks | text | no | Internal notes |
| status | enum | yes | Active/Inactive |

GST/PAN rule:

- Indian GSTIN is 15 characters.
- PAN can be derived from characters 3 to 12 of GSTIN.
- Example: GSTIN `27ABCDE1234F1Z5` gives PAN `ABCDE1234F`.
- Auto-fill PAN after GST is entered, but allow manual override.

Screens:

- Customer list
- Add customer
- Edit customer
- View customer
- Delete/deactivate customer

List features:

- Search by code, name, company, mobile, GST, PAN, city
- Filter by status, state, city
- Export CSV later

Actions:

- Add
- Edit
- Delete or soft delete
- Activate/Deactivate

## 7.2 Supplier Module

Purpose:

Manage supplier master records for purchases, stock sourcing, and vendor communication.

Fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| code | string | yes | Unique supplier code |
| name | string | yes | Contact/person name |
| company | string | no | Supplier firm name |
| mobile | string | yes | Validate mobile |
| address | text | no | Full address |
| city | string | no | City |
| state | string | no | State |
| country | string | yes | Default `India` |
| gst | string | no | GSTIN validation |
| pan | string | no | Auto-fill from GST where possible |
| remarks | text | no | Internal notes |
| status | enum | yes | Active/Inactive |

Screens:

- Supplier list
- Add supplier
- Edit supplier
- View supplier
- Delete/deactivate supplier

List features:

- Search by code, name, company, mobile, GST, PAN
- Filter by status, city, state

## 7.3 Stock Module

Purpose:

Track individual jewelry stock items with tag, design, metal, diamond, and weight details.

Initial stock fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| tag_no | string | yes | Unique stock item tag |
| design_no | string | no | Link to Design Master if available |
| metal_quality | string/id | yes | Example: 18K, 22K, 925 silver |
| gross_weight | decimal | yes | g.wt |
| net_weight | decimal | yes | n.wt |
| pure_weight | decimal | no | p.wt |
| diamond_weight | decimal | no | Carat or configured unit |
| diamond_quality | string | no | Example: VVS, VS, SI |
| diamond_color | string | no | Example: D, E, F, G |
| diamond_pieces | integer | no | Number of diamond pieces |
| status | enum | yes | In stock, sold, reserved, inactive |
| remarks | text | no | Notes |

Recommended stock status values:

- `IN_STOCK`
- `RESERVED`
- `SOLD`
- `INACTIVE`

Future stock enhancements:

- Supplier link
- Purchase reference
- Making charges
- Metal rate
- Diamond rate
- Stone details
- Barcode/QR code generation
- Stock movement history
- Repair/alteration tracking

Screens:

- Stock list
- Add stock item
- Edit stock item
- View stock item
- Print tag/barcode later

List features:

- Search by tag number, design number, metal quality
- Filter by status, category, subcategory, supplier, date
- Weight range filters

Important validation:

- Gross weight should be greater than or equal to net weight.
- Weight fields should not be negative.
- Diamond pieces should be a whole number.

## 7.4 Design Master Module

Purpose:

Maintain reusable jewelry design records with images and standard weight/specification details. Stock items can reference a design.

Fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| design_no | string | yes | Unique design number |
| image | file/url | no | Stored in iDrive E2 S3 |
| date | date | yes | Design date |
| category_id | uuid | yes | Link to category setting |
| sub_category_id | uuid | no | Link to subcategory setting |
| metal_quality | string/id | yes | Could later become setting |
| gross_weight | decimal | no | Standard gross weight |
| net_weight | decimal | no | Standard net weight |
| diamond_weight | decimal | no | Standard diamond weight |
| diamond_pieces | integer | no | Diamond piece count |
| stone_weight | decimal | no | Stone weight |
| stone_pieces | integer | no | Stone pieces |
| remarks | text | no | Notes |
| status | enum | yes | Active/Inactive |

Image plan:

- User selects image.
- Frontend requests presigned upload URL.
- File uploads directly to iDrive E2.
- API stores object key, original filename, mime type, and public/private URL strategy.
- Display image through signed read URL or CDN/public bucket depending on privacy requirement.

Screens:

- Design list with image thumbnails
- Add design
- Edit design
- View design
- Delete/deactivate design

List features:

- Search by design number
- Filter by category, subcategory, metal quality, status, date range

## 7.5 Settings Module

Purpose:

Manage application-level master data and users.

Sections:

- Category
- Sub category
- Users
- Profile

### Category

Fields:

- code
- name
- description
- status

Examples:

- Ring
- Necklace
- Earrings
- Bracelet
- Pendant

### Sub Category

Fields:

- category_id
- code
- name
- description
- status

Examples:

- Engagement Ring
- Daily Wear Ring
- Bridal Necklace

### Users

Fields:

- username
- display_name
- mobile
- email
- password_hash
- role
- status

Actions:

- Add user
- Edit user
- Delete/deactivate user
- Reset password
- Change role

### Profile

Profile should include two parts:

Business profile:

- business name
- owner name
- mobile
- email
- GSTIN
- PAN
- address
- city
- state
- country
- logo

Logged-in user profile:

- display name
- mobile
- email
- change password

## 7.6 Sales Module

Sales details are pending and will be designed later. The current system should still prepare for sales by keeping stock, customers, and settings clean.

Expected future capabilities:

- Create sale invoice
- Select customer
- Add one or more stock tags/design items
- Calculate metal amount, diamond amount, stone amount, making charges, discount, GST, and final amount
- Mark sold stock as `SOLD`
- Generate invoice PDF
- Payment tracking
- Return/cancel sale
- Sales reports

Future sales tables may include:

- `sales`
- `sale_items`
- `sale_payments`
- `sale_taxes`
- `sale_status_history`

No final implementation should be locked until sales rules are defined.

## 8. Database Design

Recommended database: PostgreSQL.

Recommended numeric type for weights and money:

- Use `numeric(12,3)` for weights.
- Use `numeric(14,2)` for money.
- Avoid floating point for business calculations.

### Main Tables

```sql
users
user_sessions
customers
suppliers
categories
sub_categories
designs
design_images
stock_items
business_profile
audit_logs
```

### Users

```sql
users (
  id uuid primary key,
  username varchar(50) unique not null,
  display_name varchar(120) not null,
  mobile varchar(20),
  email varchar(180),
  password_hash text not null,
  password_salt text,
  role varchar(30) not null,
  status varchar(20) not null default 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Customers

```sql
customers (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(150) not null,
  company varchar(180),
  mobile varchar(20) not null,
  address text,
  city varchar(100),
  state varchar(100),
  country varchar(100) not null default 'India',
  gst varchar(15),
  pan varchar(10),
  remarks text,
  status varchar(20) not null default 'ACTIVE',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Suppliers

```sql
suppliers (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(150) not null,
  company varchar(180),
  mobile varchar(20) not null,
  address text,
  city varchar(100),
  state varchar(100),
  country varchar(100) not null default 'India',
  gst varchar(15),
  pan varchar(10),
  remarks text,
  status varchar(20) not null default 'ACTIVE',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Categories

```sql
categories (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(120) unique not null,
  description text,
  status varchar(20) not null default 'ACTIVE',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Sub Categories

```sql
sub_categories (
  id uuid primary key,
  category_id uuid not null references categories(id),
  code varchar(30) unique not null,
  name varchar(120) not null,
  description text,
  status varchar(20) not null default 'ACTIVE',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  unique(category_id, name)
)
```

### Designs

```sql
designs (
  id uuid primary key,
  design_no varchar(40) unique not null,
  design_date date not null,
  category_id uuid not null references categories(id),
  sub_category_id uuid references sub_categories(id),
  metal_quality varchar(50) not null,
  gross_weight numeric(12,3),
  net_weight numeric(12,3),
  diamond_weight numeric(12,3),
  diamond_pieces integer,
  stone_weight numeric(12,3),
  stone_pieces integer,
  remarks text,
  status varchar(20) not null default 'ACTIVE',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Design Images

```sql
design_images (
  id uuid primary key,
  design_id uuid not null references designs(id),
  storage_provider varchar(50) not null default 'IDRIVE_E2',
  bucket varchar(120) not null,
  object_key text not null,
  original_filename varchar(255),
  mime_type varchar(120),
  size_bytes bigint,
  is_primary boolean not null default true,
  created_at timestamptz not null
)
```

### Stock Items

```sql
stock_items (
  id uuid primary key,
  tag_no varchar(40) unique not null,
  design_id uuid references designs(id),
  design_no varchar(40),
  metal_quality varchar(50) not null,
  gross_weight numeric(12,3) not null,
  net_weight numeric(12,3) not null,
  pure_weight numeric(12,3),
  diamond_weight numeric(12,3),
  diamond_quality varchar(50),
  diamond_color varchar(50),
  diamond_pieces integer,
  remarks text,
  status varchar(30) not null default 'IN_STOCK',
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

### Business Profile

```sql
business_profile (
  id uuid primary key,
  business_name varchar(180) not null,
  owner_name varchar(150),
  mobile varchar(20),
  email varchar(180),
  gst varchar(15),
  pan varchar(10),
  address text,
  city varchar(100),
  state varchar(100),
  country varchar(100) not null default 'India',
  logo_object_key text,
  updated_at timestamptz not null
)
```

### Audit Logs

```sql
audit_logs (
  id uuid primary key,
  user_id uuid references users(id),
  entity_type varchar(80) not null,
  entity_id uuid,
  action varchar(40) not null,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar(80),
  user_agent text,
  created_at timestamptz not null
)
```

## 9. API Plan

Use REST APIs initially. GraphQL is not necessary for this scope.

Authentication:

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
```

Customers:

```text
GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id
PATCH  /api/customers/:id/status
```

Suppliers:

```text
GET    /api/suppliers
POST   /api/suppliers
GET    /api/suppliers/:id
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
PATCH  /api/suppliers/:id/status
```

Stock:

```text
GET    /api/stock
POST   /api/stock
GET    /api/stock/:id
PUT    /api/stock/:id
DELETE /api/stock/:id
PATCH  /api/stock/:id/status
```

Designs:

```text
GET    /api/designs
POST   /api/designs
GET    /api/designs/:id
PUT    /api/designs/:id
DELETE /api/designs/:id
PATCH  /api/designs/:id/status
POST   /api/designs/:id/images
DELETE /api/designs/:id/images/:imageId
```

Settings:

```text
GET    /api/settings/categories
POST   /api/settings/categories
PUT    /api/settings/categories/:id
DELETE /api/settings/categories/:id

GET    /api/settings/sub-categories
POST   /api/settings/sub-categories
PUT    /api/settings/sub-categories/:id
DELETE /api/settings/sub-categories/:id

GET    /api/settings/users
POST   /api/settings/users
PUT    /api/settings/users/:id
DELETE /api/settings/users/:id
PATCH  /api/settings/users/:id/status
POST   /api/settings/users/:id/reset-password
```

Profile:

```text
GET /api/profile/business
PUT /api/profile/business
GET /api/profile/me
PUT /api/profile/me
```

Storage:

```text
POST /api/storage/presign-upload
POST /api/storage/presign-read
```

## 10. UI/UX Plan

Navigation:

- Dashboard
- Customers
- Suppliers
- Stock
- Design Master
- Sales
- Settings
- Profile

Common page pattern:

- Header with module title and Add button
- Search input
- Filters
- Data table
- Row actions: view, edit, status, delete
- Pagination

Common form behavior:

- Required field validation
- GST validation
- Auto PAN from GST where possible
- Default country as India
- Status defaults to Active
- Save and Cancel buttons
- Toast notification after save/update/delete

Dashboard widgets:

- Total customers
- Total suppliers
- Total stock items
- Total designs
- In-stock count
- Sold count later
- Recent designs
- Recent stock entries

## 11. PWA Requirements

PWA features:

- Installable app
- App icon and splash theme
- Offline fallback screen
- Cache static assets
- Cache selected lookup data such as categories and subcategories
- Background sync can be added later if offline entry is required

Recommended PWA behavior:

- Do not allow full offline writes in phase 1 unless business requires it.
- Show clear offline state.
- Keep authenticated pages protected even in PWA mode.

Manifest:

- App name: Amari Jewels
- Short name: Amari
- Theme color: brand color
- Display mode: standalone

## 12. Image Storage Plan with iDrive E2

Required configuration:

```text
IDRIVE_E2_ENDPOINT
IDRIVE_E2_REGION
IDRIVE_E2_BUCKET
IDRIVE_E2_ACCESS_KEY_ID
IDRIVE_E2_SECRET_ACCESS_KEY
```

Upload flow:

1. User selects design image.
2. Frontend validates file type and size.
3. Frontend requests presigned upload URL.
4. Backend creates object key such as `designs/{designNo}/{uuid}.jpg`.
5. Frontend uploads image directly to S3 storage.
6. Frontend submits design form with uploaded object key.
7. Backend stores image metadata.

Validation:

- Allowed types: JPG, PNG, WebP
- Max file size: recommended 5 MB initially
- Optional image compression before upload

Security:

- Do not expose secret keys to frontend.
- Use presigned URLs.
- Prefer private bucket unless images are meant to be public.

Private image viewing plan:

The iDrive E2 bucket will remain private. The UI should not receive permanent public image URLs, and the backend should avoid streaming image bytes unless there is a special need. To keep server load low, image reads will use a media endpoint that validates the request and redirects the browser to a short-lived presigned iDrive E2 URL.

Accepted flow:

```text
UI image tag requests /media/images/designs/DES-0001/{filename}.jpg
  -> Express API checks auth and validates the object key
  -> Express API creates a short-lived presigned GET URL for private iDrive E2 S3
  -> Express API returns 302 redirect to the presigned URL
  -> Browser downloads image bytes directly from iDrive E2
```

Example UI usage:

```tsx
<img src="/media/images/designs/DES-0001/photo.jpg" alt="Design DES-0001" />
```

Recommended media API:

```text
GET /media/images/*
```

Object key strategy:

- Use the filename/path directly instead of image ID lookup.
- No database call is required for image viewing.
- Treat the requested path as the S3 object key after validation.
- Use controlled prefixes such as `designs/` and `profile/`.
- Use unique filenames during upload to prevent accidental overwrite.

Example object keys:

```text
designs/DES-0001/20260501-uuid.jpg
designs/DES-0001/20260501-uuid.webp
profile/logo-uuid.png
```

Media route security rules:

- Require user authentication before creating a presigned read URL.
- Validate that the key does not contain `..`, encoded path traversal, backslashes, or leading slash.
- Allow only approved prefixes such as `designs/` and `profile/`.
- Keep presigned read URLs short-lived, recommended 1 to 5 minutes.
- Do not expose iDrive E2 access keys to the frontend.
- Use cookies for image route authentication if images are rendered through normal `<img src="">`, because browsers do not attach custom `Authorization` headers to standard image requests.

## 13. Validation Rules

General:

- Trim text input.
- Prevent duplicate codes.
- Validate required fields.
- Keep status values restricted to allowed enum values.

Mobile:

- Store as string.
- Validate Indian 10-digit mobile where applicable.
- Optionally allow country code such as `+91`.

GST:

- Uppercase automatically.
- Validate length as 15.
- Validate basic GSTIN pattern.
- Derive PAN from GSTIN positions 3 to 12.

PAN:

- Uppercase automatically.
- Validate 10-character PAN format.

Weights:

- Use decimal numbers.
- No negative values.
- Gross weight should be greater than or equal to net weight.

Pieces:

- Whole number.
- No negative values.

## 14. Reporting Plan

Phase 1 reports:

- Customer list export
- Supplier list export
- Stock list export
- Design list export

Future reports:

- Stock valuation
- Category-wise stock
- Supplier-wise stock
- Sales report
- Customer purchase history
- GST report
- Profit/loss report
- Inventory movement report

## 15. Audit and Safety

Recommended:

- Soft delete important records using `deleted_at`.
- Store audit logs for create/update/delete/status changes.
- Track user and timestamp for changes.
- Restrict delete for records already used in sales.
- Back up PostgreSQL daily.
- Back up image bucket metadata.

## 16. Environment Variables

```text
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

IDRIVE_E2_ENDPOINT=
IDRIVE_E2_REGION=
IDRIVE_E2_BUCKET=
IDRIVE_E2_ACCESS_KEY_ID=
IDRIVE_E2_SECRET_ACCESS_KEY=

NEXT_PUBLIC_APP_NAME=Amari Jewels
NEXT_PUBLIC_APP_URL=
```

## 17. Development Phases

### Phase 1: Foundation

- Create Next.js project with TypeScript.
- Configure PostgreSQL.
- Add ORM.
- Add authentication.
- Add app layout and protected routes.
- Add user seed for admin.
- Add base UI components.

### Phase 2: Settings

- Category CRUD.
- Sub category CRUD.
- User management.
- Business profile.
- Logged-in user profile.

### Phase 3: Customers and Suppliers

- Customer CRUD.
- Supplier CRUD.
- GST/PAN validation and auto-fill.
- Search, filters, pagination.

### Phase 4: Design Master

- Design CRUD.
- Category and subcategory selection.
- Image upload through iDrive E2 presigned URLs.
- Thumbnail display.

### Phase 5: Stock

- Stock CRUD.
- Link stock to design.
- Weight validation.
- Stock status management.
- Search and filters.

### Phase 6: PWA

- Manifest.
- Icons.
- Service worker.
- Offline fallback.
- Installability testing.

### Phase 7: Sales Planning and Build

- Finalize sales workflow.
- Define invoice fields.
- Define price calculation rules.
- Define payment modes.
- Define tax rules.
- Build sales module.
- Add invoice PDF.
- Connect sales to stock status.

### Phase 8: Reports and Hardening

- Add exports.
- Add audit logs.
- Add backup workflow.
- Add role permissions.
- Improve dashboard.
- Production deployment.

## 18. Testing Plan

Unit tests:

- Validation functions
- GST/PAN helper
- Password hashing
- Calculation helpers later

Integration tests:

- Auth API
- CRUD APIs
- Image upload presign API

UI tests:

- Login
- Add/edit customer
- Add/edit supplier
- Add/edit design with image
- Add/edit stock item

Manual acceptance tests:

- Install PWA.
- Login/logout.
- Create all master records.
- Search and filter records.
- Upload and view design image.
- Check role restrictions.

## 19. Initial Implementation Decisions

Recommended choices:

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma ORM
- Zod validation
- JWT with HTTP-only refresh cookie
- Argon2id or bcrypt for password hashing
- iDrive E2 through AWS SDK S3 client
- Soft delete for customers, suppliers, designs, and stock
- REST API for initial version

## 20. Open Questions Before Development

Sales:

- Should sales be invoice-based or estimate/quotation first?
- Will each sale always use stock tags?
- Are custom orders required?
- What are payment modes?
- How should GST be calculated?
- Is invoice printing required in A4, thermal, or both?

Stock:

- Should stock be linked to supplier from day one?
- Should tag number be manual, auto-generated, or barcode-based?
- Should stock support multiple stones beyond diamond?
- Should metal rate and making charges be stored now?

Design:

- Can one design have multiple images?
- Should design number be manual or auto-generated?

Users:

- How many roles are needed initially?
- Should staff be restricted by module?

Deployment:

- Preferred hosting provider?
- Managed database or self-hosted PostgreSQL?
- Private or public image bucket?

## 21. Minimum Viable Product Scope

MVP should include:

- Login/logout
- Admin user
- Dashboard
- Customer CRUD
- Supplier CRUD
- Category CRUD
- Sub category CRUD
- User CRUD
- Profile
- Design Master CRUD with image upload
- Stock CRUD
- Search, filter, pagination
- PWA install support

Keep Sales as a planned module until business rules are finalized.
