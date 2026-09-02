'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompactOrTouchInput } from '@/components/ui/use-responsive-input';
import { cn } from '@/lib/utils';
import {
  type DataColumn,
  type DataColumnFilter,
  type DataRow,
  type DataSortState,
  type DataValue,
} from '@/components/ui/data-types';
import { DataTableCardList } from './data-table-card-list';
import { DataTableCompactControls } from './data-table-compact-controls';
import { DataTableHeader } from './data-table-header';
import { DataTableRow, type DataTableTitleMode } from './data-table-row';
import {
  comparableValue,
  getTitle,
  rowIdFromValue,
  rowMatchesColumnFilters,
  type DataTableTitleAction,
} from './data-table-utils';
import { useDataTableColumnWidths } from './use-data-table-column-widths';

export type { DataTableTitleAction } from './data-table-utils';
export type { DataColumnFilter } from '@/components/ui/data-types';

export interface DataTableProps<TRow = DataRow> {
  className?: string;
  columns: DataColumn<TRow>[];
  rows: TRow[];
  titleColumnKey?: string;
  getRowId?: (row: TRow) => string;
  getRowTitle?: (row: TRow) => string;
  /**
   * Edit mode toggle. Off (default): cells render static values, and clicking
   * a row triggers the primary title action. On: cells edit in place via
   * `onCellCommit`, and the title cell still triggers the primary title action
   * unless `titleEditsOnClick` opts it into editing.
   */
  editable?: boolean;
  /** When `editable`, clicking the title cell edits the title instead of triggering the title action. */
  titleEditsOnClick?: boolean;
  /** Uncontrolled initial sort; the table sorts loaded rows client-side. */
  defaultSort?: DataSortState;
  /** Controlled sort state (null = unsorted). With `onSortChange`, the parent owns ordering (e.g. server-side). */
  sort?: DataSortState | null;
  onSortChange?: (sort: DataSortState | null) => void;
  /** Uncontrolled initial header filters; the table filters loaded rows client-side. */
  defaultColumnFilters?: DataColumnFilter[];
  /** Controlled header filters. When provided, the parent owns filtering (e.g. server-side). */
  columnFilters?: DataColumnFilter[];
  onColumnFiltersChange?: (filters: DataColumnFilter[]) => void;
  loading?: boolean;
  hasMoreRows?: boolean;
  loadingMore?: boolean;
  onLoadMoreRows?: () => void;
  selectedRowId?: string | null;
  /** Fallback row activation when no title action resolves for a row. */
  onRowActivate?: (row: TRow) => void;
  onCellCommit?: (row: TRow, column: DataColumn<TRow>, value: DataValue) => unknown | Promise<unknown>;
  rowAriaLabel?: (row: TRow) => string;
  titleAction?: DataTableTitleAction<TRow>;
  titleActions?: DataTableTitleAction<TRow>[];
  columnWidthStorageKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const INITIAL_LOADING_ROW_COUNT = 8;
const MORE_LOADING_ROW_COUNT = 3;
const ROW_HEIGHT = 42;
const VIRTUAL_OVERSCAN = 12;

function skeletonWidthClass<TRow>(column: DataColumn<TRow>, index: number) {
  if (column.type === 'checkbox') return 'size-4';
  if (index === 0) return 'w-[68%]';
  if (column.type === 'number' || column.type === 'currency' || column.type === 'percent') return 'w-[46%]';
  if (column.type === 'date') return 'w-[56%]';
  return 'w-[62%]';
}

function DataTableSkeletonRows<TRow>({
  columns,
  gridTemplateColumns,
  rowCount,
}: {
  columns: DataColumn<TRow>[];
  gridTemplateColumns: string;
  rowCount: number;
}) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid h-[42px] w-full border-b border-border/60 last:border-b-0"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column, columnIndex) => (
            <div
              key={column.key}
              className={cn(
                'flex min-w-0 items-center px-3',
                columnIndex === 0 && 'sticky left-0 z-10 bg-background px-4'
              )}
            >
              <Skeleton className={cn('h-4 rounded-sm', skeletonWidthClass(column, columnIndex))} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function DataTableLoadingSkeleton<TRow>({
  className,
  columns,
  gridTemplateColumns,
  tableWidth,
}: {
  className?: string;
  columns: DataColumn<TRow>[];
  gridTemplateColumns: string;
  tableWidth: number;
}) {
  return (
    <div className={cn('min-w-0', className)} aria-busy="true">
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-full" style={{ minWidth: tableWidth }}>
            <div className="grid h-10 border-b border-border/70" style={{ gridTemplateColumns }}>
              {columns.map((column, index) => (
                <div
                  key={column.key}
                  className={cn('flex min-w-0 items-center px-3', index === 0 && 'sticky left-0 z-10 bg-background px-4')}
                >
                  <Skeleton className={cn('h-3 rounded-sm', index === 0 ? 'w-24' : 'w-16')} />
                </div>
              ))}
            </div>
            <DataTableSkeletonRows columns={columns} gridTemplateColumns={gridTemplateColumns} rowCount={INITIAL_LOADING_ROW_COUNT} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataTable<TRow = DataRow>({
  className,
  columns,
  rows,
  titleColumnKey,
  getRowId,
  getRowTitle,
  editable = false,
  titleEditsOnClick = false,
  defaultSort,
  sort: sortProp,
  onSortChange,
  defaultColumnFilters,
  columnFilters: columnFiltersProp,
  onColumnFiltersChange,
  loading,
  hasMoreRows,
  loadingMore,
  onLoadMoreRows,
  selectedRowId,
  onRowActivate,
  onCellCommit,
  rowAriaLabel,
  titleAction,
  titleActions,
  columnWidthStorageKey,
  emptyTitle = 'No rows',
  emptyDescription = 'There is no data yet.',
}: DataTableProps<TRow>) {
  const titleColumn = useMemo(
    () => columns.find((column) => column.key === titleColumnKey) ?? columns[0],
    [columns, titleColumnKey]
  );
  const visibleColumns = useMemo(
    () => (titleColumn ? columns.filter((column) => column.key !== titleColumn.key) : []),
    [columns, titleColumn]
  );
  const orderedColumns = useMemo(
    () => (titleColumn ? [titleColumn, ...visibleColumns] : columns),
    [columns, titleColumn, visibleColumns]
  );
  const fallbackSort = useMemo<DataSortState | null>(() => {
    const column = defaultSort?.column ?? titleColumn?.key ?? orderedColumns[0]?.key;
    return column ? { column, direction: defaultSort?.direction ?? 'asc' } : null;
  }, [defaultSort?.column, defaultSort?.direction, orderedColumns, titleColumn?.key]);

  const sortControlled = sortProp !== undefined;
  const [internalSort, setInternalSort] = useState<DataSortState | null>(fallbackSort);
  const sort = sortControlled ? sortProp : internalSort;

  const filtersControlled = columnFiltersProp !== undefined;
  const [internalColumnFilters, setInternalColumnFilters] = useState<DataColumnFilter[]>(
    () => defaultColumnFilters ?? []
  );
  const columnFilters = filtersControlled ? columnFiltersProp : internalColumnFilters;
  const hasActiveColumnFilters = columnFilters.some((filter) => filter.values.length > 0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [showStickyTitleDivider, setShowStickyTitleDivider] = useState(false);
  const showStickyTitleDividerRef = useRef(false);
  const compactOrTouchInput = useCompactOrTouchInput();
  const titleColumnWidthKey = titleColumn?.key ?? '';
  const {
    columnWidths,
    columnWidthsReady,
    defaultWidths,
    gridTemplateColumns,
    resizingColumn,
    startColumnResize,
    tableWidth,
  } = useDataTableColumnWidths({
    columns: orderedColumns,
    titleColumnWidthKey,
    columnWidthStorageKey,
  });

  useEffect(() => {
    if (sortControlled) return;
    if (!internalSort || !orderedColumns.length) return;
    if (orderedColumns.some((column) => column.key === internalSort.column)) return;
    setInternalSort(fallbackSort);
  }, [fallbackSort, internalSort, orderedColumns, sortControlled]);

  const displayRows = useMemo(() => {
    const filtered =
      !filtersControlled && hasActiveColumnFilters
        ? rows.filter((row) => rowMatchesColumnFilters(row, columnFilters, orderedColumns))
        : rows;
    if (sortControlled || !sort) return filtered;
    const sortColumn = orderedColumns.find((column) => column.key === sort.column);
    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      const av = comparableValue(a, sortColumn);
      const bv = comparableValue(b, sortColumn);
      if (av < bv) return sort.direction === 'asc' ? -1 : 1;
      if (av > bv) return sort.direction === 'asc' ? 1 : -1;
      return getTitle(a, titleColumn, getRowTitle, rowIdFromValue(a, getRowId, 0)).localeCompare(
        getTitle(b, titleColumn, getRowTitle, rowIdFromValue(b, getRowId, 0))
      );
    });
  }, [
    columnFilters,
    filtersControlled,
    getRowId,
    getRowTitle,
    hasActiveColumnFilters,
    orderedColumns,
    rows,
    sort,
    sortControlled,
    titleColumn,
  ]);

  const applyColumnFilters = useCallback(
    (next: DataColumnFilter[]) => {
      if (!filtersControlled) setInternalColumnFilters(next);
      onColumnFiltersChange?.(next);
    },
    [filtersControlled, onColumnFiltersChange]
  );
  const handleSortApply = useCallback(
    (column: DataColumn<TRow>, direction: 'asc' | 'desc' | null) => {
      const next = direction ? { column: column.key, direction } : null;
      if (!sortControlled) setInternalSort(next);
      onSortChange?.(next);
    },
    [onSortChange, sortControlled]
  );
  const handleFilterToggle = useCallback(
    (column: DataColumn<TRow>, optionId: string) => {
      const existing = columnFilters.find((filter) => filter.column === column.key);
      let next: DataColumnFilter[];
      if (!existing) {
        next = [...columnFilters, { column: column.key, values: [optionId] }];
      } else {
        const values = existing.values.includes(optionId)
          ? existing.values.filter((value) => value !== optionId)
          : [...existing.values, optionId];
        next =
          values.length > 0
            ? columnFilters.map((filter) => (filter === existing ? { ...filter, values } : filter))
            : columnFilters.filter((filter) => filter !== existing);
      }
      applyColumnFilters(next);
    },
    [applyColumnFilters, columnFilters]
  );
  const handleFilterClear = useCallback(
    (column: DataColumn<TRow>) => {
      applyColumnFilters(columnFilters.filter((filter) => filter.column !== column.key));
    },
    [applyColumnFilters, columnFilters]
  );
  const clearAllColumnFilters = useCallback(() => applyColumnFilters([]), [applyColumnFilters]);

  const resolvedTitleActions = useMemo(
    () => titleActions ?? (titleAction ? [titleAction] : []),
    [titleAction, titleActions]
  );
  const canActivateRows = resolvedTitleActions.length > 0 || !!onRowActivate;
  const activateRow = useCallback(
    (row: TRow) => {
      const primary = resolvedTitleActions[0];
      if (primary) {
        if (primary.onClick) {
          primary.onClick(row);
          return;
        }
        const href = primary.href?.(row);
        if (href) {
          if (primary.target === '_blank') window.open(href, '_blank', 'noopener,noreferrer');
          else window.location.assign(href);
          return;
        }
      }
      onRowActivate?.(row);
    },
    [onRowActivate, resolvedTitleActions]
  );

  const cellsEditable = editable && !!onCellCommit;
  const titleMode: DataTableTitleMode = editable
    ? titleEditsOnClick && cellsEditable
      ? 'edit'
      : canActivateRows
        ? 'action'
        : cellsEditable
          ? 'edit'
          : 'static'
    : 'static';
  const rowActivatesOnClick = !editable && canActivateRows;

  const updateStickyTitleDivider = useCallback(() => {
    const nextShowStickyTitleDivider = (scrollContainerRef.current?.scrollLeft ?? 0) > 0;
    if (showStickyTitleDividerRef.current === nextShowStickyTitleDivider) return;
    showStickyTitleDividerRef.current = nextShowStickyTitleDivider;
    setShowStickyTitleDivider(nextShowStickyTitleDivider);
  }, []);

  useBrowserLayoutEffect(() => {
    updateStickyTitleDivider();
    const scrollContainer = scrollContainerRef.current;
    let secondFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      updateStickyTitleDivider();
      secondFrame = window.requestAnimationFrame(updateStickyTitleDivider);
    });
    const timeout = window.setTimeout(updateStickyTitleDivider, 0);
    if (!scrollContainer) {
      return () => {
        window.cancelAnimationFrame(frame);
        window.cancelAnimationFrame(secondFrame);
        window.clearTimeout(timeout);
      };
    }
    scrollContainer.addEventListener('scroll', updateStickyTitleDivider, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeout);
      scrollContainer.removeEventListener('scroll', updateStickyTitleDivider);
    };
  }, [columnWidthsReady, displayRows.length, updateStickyTitleDivider]);

  useEffect(() => {
    if (!hasMoreRows || loadingMore || !onLoadMoreRows) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRows();
        }
      },
      { root: scrollContainerRef.current, rootMargin: '240px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRows, loadingMore, onLoadMoreRows]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
    enabled: !compactOrTouchInput && !loading,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  if (loading) {
    if (compactOrTouchInput) {
      return (
        <DataTableCardList
          className={className}
          loading
          scrollContainerRef={scrollContainerRef}
          loadMoreRef={loadMoreRef}
          rows={[]}
          titleColumn={titleColumn}
          visibleColumns={visibleColumns}
        />
      );
    }

    return (
      <DataTableLoadingSkeleton
        className={className}
        columns={orderedColumns}
        gridTemplateColumns={gridTemplateColumns}
        tableWidth={tableWidth}
      />
    );
  }

  const filteredEmpty = displayRows.length === 0 && hasActiveColumnFilters;

  if (displayRows.length === 0 && !filteredEmpty) {
    return (
      <div className={cn('min-w-0', className)}>
        <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-background px-6">
          <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            <p className="text-label-md">{emptyTitle}</p>
            <p className="text-body-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  if (compactOrTouchInput) {
    const compactControls = (
      <DataTableCompactControls
        columns={orderedColumns}
        columnFilters={columnFilters}
        sort={sort}
        onSortApply={handleSortApply}
        onFilterToggle={handleFilterToggle}
        onFiltersClearAll={clearAllColumnFilters}
      />
    );

    if (filteredEmpty) {
      return (
        <div className={cn('flex min-w-0 flex-col', className)}>
          <div className="pb-3">{compactControls}</div>
          <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-background px-6">
            <div className="flex max-w-sm flex-col items-center gap-2 text-center">
              <p className="text-label-md">{emptyTitle}</p>
              <p className="text-body-sm text-muted-foreground">No rows match the current filters.</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-sm px-2 py-1 text-body-sm text-muted-foreground transition-colors hover:bg-hover-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring-subtle"
                onClick={clearAllColumnFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <DataTableCardList
        className={className}
        controls={compactControls}
        loadingMore={loadingMore}
        hasMoreRows={hasMoreRows}
        scrollContainerRef={scrollContainerRef}
        loadMoreRef={loadMoreRef}
        rows={displayRows}
        titleColumn={titleColumn}
        visibleColumns={visibleColumns}
        getRowId={getRowId}
        getRowTitle={getRowTitle}
        selectedRowId={selectedRowId}
        onLoadMoreRows={onLoadMoreRows}
        onRowActivate={canActivateRows ? activateRow : undefined}
        rowAriaLabel={rowAriaLabel}
      />
    );
  }

  return (
    <div className={cn('group/table flex min-w-0 flex-col', className, !columnWidthsReady && 'invisible')}>
      <div
        ref={scrollContainerRef}
        className="min-h-0 overflow-auto rounded-md border border-border bg-background"
      >
        <div className="w-full" style={{ minWidth: tableWidth }}>
          <DataTableHeader
            columns={orderedColumns}
            columnFilters={columnFilters}
            gridTemplateColumns={gridTemplateColumns}
            resizingColumn={resizingColumn}
            showStickyTitleDivider={showStickyTitleDivider}
            sort={sort}
            tableWidth={tableWidth}
            onColumnResizeStart={startColumnResize}
            onSortApply={handleSortApply}
            onFilterToggle={handleFilterToggle}
            onFilterClear={handleFilterClear}
          />

          {!filteredEmpty ? (
            <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
              {virtualRows.map((virtualRow) => {
                const row = displayRows[virtualRow.index];
                const rowId = rowIdFromValue(row, getRowId, virtualRow.index);
                return (
                  <DataTableRow
                    key={rowId}
                    cellsEditable={cellsEditable}
                    columnWidths={columnWidths}
                    columnWidthsReady={columnWidthsReady}
                    defaultWidths={defaultWidths}
                    getRowTitle={getRowTitle}
                    gridTemplateColumns={gridTemplateColumns}
                    isLastRow={virtualRow.index === displayRows.length - 1}
                    onActivate={canActivateRows ? activateRow : undefined}
                    onCellCommit={onCellCommit}
                    row={row}
                    rowActivatesOnClick={rowActivatesOnClick}
                    rowAriaLabel={rowAriaLabel}
                    rowId={rowId}
                    selectedRowId={selectedRowId}
                    showStickyTitleDivider={showStickyTitleDivider}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    titleActions={resolvedTitleActions}
                    titleColumn={titleColumn}
                    titleMode={titleMode}
                    visibleColumns={visibleColumns}
                  />
                );
              })}
            </div>
          ) : null}

          {!filteredEmpty ? (
            loadingMore ? (
              <div
                ref={loadMoreRef}
                className="w-full border-t border-border/60"
                aria-busy="true"
              >
                <DataTableSkeletonRows
                  columns={orderedColumns}
                  gridTemplateColumns={gridTemplateColumns}
                  rowCount={MORE_LOADING_ROW_COUNT}
                />
              </div>
            ) : hasMoreRows ? (
              <div
                ref={loadMoreRef}
                className="flex h-12 w-full items-center justify-center border-t border-border/60 px-4 text-body-sm text-muted-foreground"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-sm px-2 py-1 transition-colors hover:bg-hover-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring-subtle"
                  onClick={() => onLoadMoreRows?.()}
                >
                  Load more rows
                </button>
              </div>
            ) : null
          ) : null}
        </div>

        {filteredEmpty ? (
          <div className="sticky left-0 flex min-h-[220px] w-full items-center justify-center px-6">
            <div className="flex max-w-sm flex-col items-center gap-2 text-center">
              <p className="text-label-md">{emptyTitle}</p>
              <p className="text-body-sm text-muted-foreground">No rows match the current filters.</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-sm px-2 py-1 text-body-sm text-muted-foreground transition-colors hover:bg-hover-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring-subtle"
                onClick={clearAllColumnFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
