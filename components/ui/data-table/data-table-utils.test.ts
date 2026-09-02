import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataColumn } from "@/components/ui/data-types";
import { isColumnFilterable, isColumnSortable } from "@/components/ui/data-table/data-table-utils";

function column(overrides: Partial<DataColumn> & Pick<DataColumn, "type">): DataColumn {
  return { key: "field", label: "Field", ...overrides };
}

// Every ordinary field type sorts without the column config saying anything.
// This is the whole point of the default: an agent that writes a plain column
// gets a sortable header, and forgetting a flag can no longer silently ship a
// table nobody can order.
const ORDERABLE_TYPES: DataColumn["type"][] = [
  "text",
  "number",
  "currency",
  "percent",
  "select",
  "multi_select",
  "date",
  "user",
  "multi_user",
  "checkbox",
  "url",
  "email",
  "attachment",
  "relation",
];

test("every orderable field type is sortable without an explicit flag", () => {
  for (const type of ORDERABLE_TYPES) {
    assert.equal(isColumnSortable(column({ type })), true, `${type} should default to sortable`);
  }
});

test("json is never sortable, even when the column asks for it", () => {
  // contracts.ts throws "JSON fields cannot be sortable" on the definition
  // side. If the table disagreed, a column could render a sort menu whose
  // equivalent manifest field fails `pnpm generate:contracts`.
  assert.equal(isColumnSortable(column({ type: "json" })), false);
  assert.equal(isColumnSortable(column({ type: "json", sortable: true })), false);
});

test("sortable: false opts a column out; sortable: true is a no-op on orderable types", () => {
  assert.equal(isColumnSortable(column({ type: "text", sortable: false })), false);
  assert.equal(isColumnSortable(column({ type: "text", sortable: true })), true);
  // Explicitly undefined must read as "not specified", not as "off" — the demo
  // configs spread optional flags conditionally, so undefined reaches here.
  assert.equal(isColumnSortable(column({ type: "text", sortable: undefined })), true);
});

test("sortability is independent of filterability", () => {
  // A column opting out of the filter menu keeps its sort entry and vice
  // versa; the header shows a combined menu, so conflating them would silently
  // drop one control when the other is disabled.
  const filterOptedOut = column({
    type: "select",
    filterable: false,
    config: { options: [{ id: "a", label: "A" }] },
  });
  assert.equal(isColumnFilterable(filterOptedOut), false);
  assert.equal(isColumnSortable(filterOptedOut), true);

  const sortOptedOut = column({
    type: "select",
    sortable: false,
    config: { options: [{ id: "a", label: "A" }] },
  });
  assert.equal(isColumnSortable(sortOptedOut), false);
  assert.equal(isColumnFilterable(sortOptedOut), true);
});
