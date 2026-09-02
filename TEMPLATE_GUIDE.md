# General Website Template — Usage Guide

This file is the usage guide for the agent building on this template. It is
read-only reference material: do not update it for the app, do not treat it as
an app deliverable, and do not delete it. Read it once before writing code —
it replaces exploring the template source file-by-file.

Minimal SPA-style Next.js website scaffold for websites, landing pages, public
pages, portals, documentation-style pages, and lightweight CMS-backed sites.
It intentionally has no prebuilt landing sections.

## Commands

```bash
pnpm install               # once after template pull
pnpm generate:contracts    # after every lib/app-definition/definition.ts change
pnpm validate:push         # required before pushing
pnpm dev                   # local dev server; rarely needed
```

`pnpm build` / `pnpm start` exist for the deployment pipeline — do not run
them locally; the preview deployment builds automatically on push and build
errors are retrievable from the deployment logs.
Generated contracts stay uncommitted; provider postbuild uploads the snapshot.

## Date And Time Boundaries

- `DateOnly` is a canonical `YYYY-MM-DD` calendar date with no time zone; `Instant` is an ISO timestamp with `Z` or an explicit offset.
- Normalize database, API, workspace, form, or file values before they enter the business model. Add source-specific decoding under `lib/time/adapters/`.
- Converting a `Date` or `Instant` to `DateOnly` requires an explicit time zone.
- Extend `lib/time/` with the installed `date-fns` dependency and native `Date`/`Intl`; do not add another date library.
- After changing date behavior or adding an adapter, run `pnpm test:time`.

## Structure

- `app/page.tsx`: the site entry — start building here.
- `app/layout.tsx`: root layout wiring providers; `app/api/**`: optional semantic App API routes.
- `components/providers/`: TanStack Query + Kylon workspace provider; keep.
- `components/ui/`: reusable UI primitives; keep and reuse.
- `lib/app-definition/definition.ts`: App metadata, entities, table mapping, API declarations; source of `pnpm generate:contracts`.
- `lib/kylon/`: Kylon bridge helpers and workspace member profiles; keep.
- `lib/db.ts`: DB connection/query helpers; `lib/query-keys.ts`: query key registry.
- `lib/client-storage.ts`: validated browser-storage access; `lib/client-recovery.ts` + `app/error.tsx` + `app/global-error.tsx`: client failure recovery; keep.
- `lib/url-state.ts`: builds App-local hrefs without dropping unrelated query
  or fragment state; use it for filters, tabs, selections, and component views
  that must survive refresh or be presented by an agent.
- `generated/`: disposable output of `pnpm generate:contracts`; never hand-edit.

## URL Reachability And Presentation Routes

Every page or component an agent may need to present must have a stable
App-local URL. Use path segments for durable identity and query parameters for
view state:

```text
/examples/items/:itemId
/examples/items/:itemId?view=full
/present/items/:itemId?view=full
```

The sample routes share `ExampleDetail`. Replace its sample content and route
nouns with the site's real detail component. The `/present/` route omits
navigation and unrelated page chrome so a 16:9 Kylon capture spends its first
viewport on the addressed content. Keep normal and presentation routes backed
by one component; do not build a second capture-only version that can drift.

Use `buildUrlStateHref` when a control changes query-backed state. It preserves
unrelated query keys and the fragment, removes only nullish values, and rejects
non-App-relative paths. Use `readUrlState` with an allowlist so an old or
hand-edited URL cannot put the component into an unsupported state. Navigate
with a real Next.js `Link` or router push/replace so browser history and the
Kylon bridge observe the change.

Do not keep a presentable selection, item, modal, tab, filter, or fullscreen
mode only in React state. If the requested state cannot be reconstructed from
the pathname, query, and fragment after a reload, Kylon cannot link to or
capture it. Verify each promised URL directly, after reload, and at a 720×405
viewport before handoff.

## Browser-Persisted State (read before touching localStorage)

Anything in `localStorage`/`sessionStorage` is untrusted input. It outlives the
code that wrote it, so a value from an older build or a half-finished write is
still there long after the shape changed.

- Read it with `readStored` / `readStoredArray` from `lib/client-storage.ts` and
  pass a real type guard. Never hand a bare `JSON.parse` result to render.
- The reason is specific, not stylistic: `JSON.parse` succeeds on `null`, `{}`,
  `123`, and a double-encoded string. Any of them reaching `.map`/`.reduce`
  throws **during render**, which replaces the whole page — and because the
  value persists, it throws again on every later visit. Reloading does not
  clear it, so the site is gone for that browser until someone clears site data.
- Write with `writeStored`. It swallows quota and private-mode failures.
- If a stored decision must survive automatic recovery — a cookie-consent
  choice is the usual one — add its key to `RECOVERY_PRESERVED_KEYS` in
  `lib/client-recovery.ts`.

The boundaries in `app/error.tsx` and `app/global-error.tsx` repair the browser
and reload before showing anyone an error, and report to
`/api/client-errors`. Restyle their copy to match the site, but keep the
recovery branch rendering nothing, keep the fallback on inline styles, and do
not put technical instructions in visitor-facing copy.

## Build The Site

Start from `app/page.tsx`. If the site needs persisted CMS/content/form/
subscription data, define entities and PostgreSQL table mapping in
`lib/app-definition/definition.ts`, set `dataViewer.mode` to `required`, add semantic App API routes under
`app/api/**`, run `pnpm generate:contracts`, and put the schema in
`db/migrations/` as numbered SQL files.

## Definition Contracts (read before writing definition.ts)

`lib/app-definition/types.ts` is the single authoritative contract for
`lib/app-definition/definition.ts`. Read that one file before writing or
editing a definition — do not infer shapes from prose or from memory. The
pieces that most often fail typecheck:

- `EntityDefinition` = manifest fields (`id`, `label`, `pluralLabel`,
  `description`, `titleField`, `fields`, `relationships`) plus DB mapping
  (`table`, optional `idColumn`/`createdAtColumn`/`updatedAtColumn`, `api`).
- Every field `type` must come from the `FieldType` union; select options are
  `{ id, label, color? }` objects under `config.options`.
- `relationships` entries are `RelationshipManifest`:
  `{ type: "has_one" | "has_many" | "belongs_to" | "many_to_many", entityId, foreignKey?, label? }`
  — note camelCase `entityId`/`foreignKey`.

Minimal complete entity for reference:

```ts
{
  id: "clients",
  label: "Client",
  pluralLabel: "Clients",
  description: "Companies we sell to.",
  titleField: "name",
  table: "clients",
  fields: [
    { id: "name", label: "Name", type: "text", required: true },
    {
      id: "status",
      label: "Status",
      type: "select",
      config: {
        options: [
          { id: "active", label: "Active", color: "green" },
          { id: "churned", label: "Churned" },
        ],
      },
    },
    { id: "owner", label: "Owner", type: "user" },
  ],
  relationships: [{ type: "has_many", entityId: "deals", foreignKey: "client_id" }],
  api: {
    list: "/api/clients",
    get: "/api/clients/{client_id}",
    update: "/api/clients/{client_id}",
    delete: "/api/clients/{client_id}",
  },
}
```

Table/list UI configs must satisfy the generics in
`components/ui/data-types.ts`: declare columns as
`[...] satisfies DataColumn<YourRecord>[]` so mismatches fail at the
declaration instead of deep inside page typechecking.

## SQL Dialect (PostgreSQL)

The App database speaks PostgreSQL. Write `db/migrations/*.sql` and all query
SQL in PostgreSQL dialect — MySQL habits are the common failure source:

- No enum column types. Inline `status ENUM('todo','done')` is MySQL-only and
  fails the migration with `type "enum" does not exist`; do not reach for
  `CREATE TYPE ... AS ENUM` either. Use `VARCHAR`/`TEXT` plus a `CHECK`
  constraint: `status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done'))`.
- No backtick identifiers and no `AUTO_INCREMENT`. Quote identifiers with
  double quotes only when required; for numeric keys use
  `GENERATED ALWAYS AS IDENTITY` (this template's demo uses app-generated
  string ids instead).
- Timestamps are `TIMESTAMPTZ` with `DEFAULT now()`.
- Keep writing `?` placeholders in server query code — `lib/db.ts` converts
  them to `$1, $2, ...` before execution. Raw SQL in migration files uses no
  placeholders at all.

## UI Component Index

All under `components/ui/`. Before using any component you have not used yet,
read the props interface at the top of its file (one targeted read) — do not
guess props and fix them after typecheck.

- `data-table/` — the table engine: header sort/filter menus, virtualized rows, scroll pagination, card list fallback, column-width persistence (`index.tsx` is the entry; interaction model below).
- `data-types.ts` — canonical field value/type aliases shared by table + field components.
- `field.tsx`, `field-list.tsx`, `field-list-layout.ts` — record detail field grid primitives.
- `field-value.tsx`, `field-value-popover.tsx`, `field-values/` — per-type field renderers/editors (text, number, date, select, checkbox, relation, attachment) with view/edit modes.
- `drilldown-dialog.tsx` — chart→records drilldown dialog (`DrilldownScope` + rows).
- `metrics.tsx` — dashboard summary metric cards (`SummaryMetric[]`).
- `chart.tsx` — Recharts wrapper with themed tooltip/legend.
- `calendar.tsx`, `calendar-view.tsx`, `calendar-utils.ts` — date-picker primitive and month/week event calendar (`CalendarEvent[]`).
- `combobox.tsx` — searchable select for relation/user pickers.
- `overflow-list.tsx` — collapses overflowing chips into a "+N" popover.
- `file-preview.tsx` — attachment preview (image/pdf) with fallback link.
- `alert-dialog.tsx`, `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `hover-card.tsx`, `tooltip.tsx`, `context-menu.tsx`, `dropdown-menu.tsx` — overlay primitives (shadcn-style).
- `button.tsx`, `input.tsx`, `input-group.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `slider.tsx`, `toggle.tsx`, `toggle-group.tsx`, `label.tsx` — form primitives.
- `card.tsx`, `tabs.tsx`, `accordion.tsx`, `separator.tsx`, `scroll-area.tsx`, `skeleton.tsx`, `badge.tsx`, `avatar.tsx`, `alert.tsx`, `item.tsx`, `kbd.tsx`, `sonner.tsx` — layout/display primitives and toasts.
- `use-responsive-input.ts` — hook for mobile-friendly input behavior.

## Data Table Interaction Model

`DataTable` is read-only by default: cells have no click interaction and
clicking a row triggers the primary (first) title action. Key props:

- `editable` — turns on click-to-edit cells (via `onCellCommit`); the title
  cell still triggers the title action unless `titleEditsOnClick` is set. Set
  it only when the app calls for inline editing.
- `titleAction`/`titleActions` — pass exactly one action chosen with
  `useIsKylonShell()` (`lib/kylon/use-is-kylon-shell.ts`): a thread action
  inside the Kylon shell, an open-in-dialog action in a plain browser tab.
- `sort`/`onSortChange` and `columnFilters`/`onColumnFiltersChange` —
  controlled mode for wiring header sort/filter to a server list API so they
  apply to the whole data set. Omit them (optionally with
  `defaultSort`/`defaultColumnFilters`) for uncontrolled client-side
  sorting/filtering of already-loaded rows.
- Every column sorts by default. A header offers Sort ascending/descending
  unless the column is `json` (never sortable, matching the definition
  contract) or sets `sortable: false`. Do not write `sortable: true` per
  column — it is already the default, and spelling it out teaches the next
  reader that omitting it means "off".
- When sort is controlled (server-side), the list API's allowed sort fields
  must cover every column the table still renders sortable. A column the
  header offers but the endpoint rejects turns a click into a failed request,
  so extend the API's allowlist in the same change that adds the column.
- Header filter menus appear only on `select`/`multi_select` columns with
  options (`filterable: false` opts a column out); an active filter replaces
  the header label with the selected option badges.
- The compact (card list) presentation renders Sort/Filter controls above the
  cards from the same state and callbacks, so narrow screens keep full
  sort/filter access.
- Rows render through `@tanstack/react-virtual` and page in via
  `hasMoreRows`/`onLoadMoreRows` — keep both wired when listing large data
  sets.

## Platform Topics (read the build-app skill references, not template source)

- Workspace members and `user`/`multi_user` fields → `references/workspace-data.md`.
- Entity/field/relation registration contracts and Data Viewer behavior → `references/data-definition-contracts.md`.
- Build the confirmed Custom UI pages and workflows. For Apps with registered data, Data Viewer is available from the Kylon App header's More menu. Other UI conventions → `references/ui-guidelines.md`.
- `db/migrations` rules, the App id placeholder and registration gates, and the develop→push→publish loop → the build-app skill body.
- **Do not block iframe embedding.** Never add `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` — Kylon previews run in an iframe.

You have now seen the whole template. Start building — do not read template
source files to "understand the project" beyond the targeted reads above.
