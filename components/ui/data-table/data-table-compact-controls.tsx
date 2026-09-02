import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, X } from 'lucide-react';
import type { DataColumn, DataColumnFilter, DataSortState } from '@/components/ui/data-types';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OptionBadge, selectOption } from '@/components/ui/field-values/shared';
import { cn } from '@/lib/utils';
import { columnFilterOptions, isColumnFilterable, isColumnSortable } from './data-table-utils';

const COMPACT_FILTER_BADGE_LIMIT = 2;

const compactTriggerClassName =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring-subtle data-[state=open]:text-foreground [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5';

interface DataTableCompactControlsProps<TRow> {
  className?: string;
  columns: DataColumn<TRow>[];
  columnFilters: DataColumnFilter[];
  sort: DataSortState | null;
  onSortApply: (column: DataColumn<TRow>, direction: 'asc' | 'desc' | null) => void;
  onFilterToggle: (column: DataColumn<TRow>, optionId: string) => void;
  onFiltersClearAll: () => void;
}

/**
 * Sort/filter entry points for the compact (card list) presentation, driven by
 * the same state and callbacks as the desktop header menus.
 */
export function DataTableCompactControls<TRow>({
  className,
  columns,
  columnFilters,
  sort,
  onSortApply,
  onFilterToggle,
  onFiltersClearAll,
}: DataTableCompactControlsProps<TRow>) {
  const sortableColumns = columns.filter((column) => isColumnSortable(column));
  const filterableColumns = columns.filter((column) => isColumnFilterable(column));
  if (sortableColumns.length === 0 && filterableColumns.length === 0) return null;

  const sortColumn = sort ? columns.find((column) => column.key === sort.column) : undefined;
  const activeFilterBadges = columnFilters.flatMap((filter) => {
    const column = filterableColumns.find((candidate) => candidate.key === filter.column);
    if (!column) return [];
    return filter.values.map((value) => ({ key: `${filter.column}:${value}`, column, value }));
  });
  const visibleFilterBadges = activeFilterBadges.slice(0, COMPACT_FILTER_BADGE_LIMIT);
  const hiddenFilterCount = activeFilterBadges.length - visibleFilterBadges.length;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {sortableColumns.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={compactTriggerClassName} aria-label="Sort rows">
            {sortColumn && sort ? (
              <>
                {sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />}
                <span className="truncate">{sortColumn.label}</span>
              </>
            ) : (
              <>
                <ArrowUpDown />
                Sort
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {sortableColumns.map((column) => {
              const active = sort?.column === column.key;
              return (
                <DropdownMenuItem
                  key={column.key}
                  onSelect={() =>
                    onSortApply(column, active && sort?.direction === 'asc' ? 'desc' : 'asc')
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{column.label}</span>
                  {active ? (sort?.direction === 'asc' ? <ArrowUp /> : <ArrowDown />) : null}
                </DropdownMenuItem>
              );
            })}
            {sortColumn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onSortApply(sortColumn, null)}>
                  <X />
                  Clear sort
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {filterableColumns.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={compactTriggerClassName} aria-label="Filter rows">
            <ListFilter />
            {visibleFilterBadges.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {visibleFilterBadges.map(({ key, column, value }) => (
                  <OptionBadge key={key} option={selectOption(column, value)} />
                ))}
                {hiddenFilterCount > 0 ? (
                  <span className="shrink-0 text-[11px] leading-4 font-semibold text-tertiary-foreground">
                    +{hiddenFilterCount}
                  </span>
                ) : null}
              </span>
            ) : (
              'Filter'
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {filterableColumns.map((column) => {
              const filterValues =
                columnFilters.find((filter) => filter.column === column.key)?.values ?? [];
              return (
                <DropdownMenuSub key={column.key}>
                  <DropdownMenuSubTrigger>
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    {filterValues.length > 0 ? (
                      <span className="ml-2 flex min-w-0 items-center gap-1 overflow-hidden">
                        {filterValues.slice(0, COMPACT_FILTER_BADGE_LIMIT).map((value) => (
                          <OptionBadge key={value} option={selectOption(column, value)} />
                        ))}
                        {filterValues.length > COMPACT_FILTER_BADGE_LIMIT ? (
                          <span className="shrink-0 text-[11px] leading-4 font-semibold text-tertiary-foreground">
                            +{filterValues.length - COMPACT_FILTER_BADGE_LIMIT}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-40">
                    {columnFilterOptions(column).map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={filterValues.includes(option.id)}
                        onCheckedChange={() => onFilterToggle(column, option.id)}
                      >
                        <OptionBadge option={selectOption(column, option.id)} />
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
            {activeFilterBadges.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onFiltersClearAll}>
                  <X />
                  Clear filters
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
