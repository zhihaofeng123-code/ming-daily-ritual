import { ArrowDown, ArrowUp, Check, ChevronsUpDown, ListFilter, X } from 'lucide-react';
import type { MouseEvent } from 'react';
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
import {
  columnFilterOptions,
  isColumnFilterable,
  isColumnSortable,
  stickyTitleDividerClass,
} from './data-table-utils';

const HEADER_FILTER_BADGE_LIMIT = 2;

interface SortIconProps {
  active: boolean;
  direction: 'asc' | 'desc';
}

function SortIcon({ active, direction }: SortIconProps) {
  if (!active) return <ChevronsUpDown className="icon-14 opacity-45" />;
  return direction === 'asc' ? <ArrowUp className="icon-14" /> : <ArrowDown className="icon-14" />;
}

function HeaderFilterPreview<TRow>({
  column,
  filterValues,
}: {
  column: DataColumn<TRow>;
  filterValues: string[];
}) {
  const visibleValues = filterValues.slice(0, HEADER_FILTER_BADGE_LIMIT);
  const hiddenCount = filterValues.length - visibleValues.length;
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      <ListFilter className="icon-14 shrink-0 text-tertiary-foreground" />
      {visibleValues.map((value) => (
        <OptionBadge key={value} option={selectOption(column, value)} />
      ))}
      {hiddenCount > 0 ? (
        <span className="shrink-0 text-[11px] leading-4 font-semibold text-tertiary-foreground">
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  );
}

function HeaderCellContent<TRow>({
  column,
  filterValues,
  sort,
  sortable,
}: {
  column: DataColumn<TRow>;
  filterValues: string[];
  sort: DataSortState | null;
  sortable: boolean;
}) {
  const sortActive = sort?.column === column.key;
  return (
    <>
      {filterValues.length > 0 ? (
        <HeaderFilterPreview column={column} filterValues={filterValues} />
      ) : (
        <span className="truncate text-[12px] leading-4 font-semibold tracking-normal text-tertiary-foreground uppercase group-hover/header-cell:text-foreground">
          {column.label}
        </span>
      )}
      {sortable && <SortIcon active={sortActive} direction={sort?.direction ?? 'asc'} />}
    </>
  );
}

interface DataTableHeaderProps<TRow> {
  columns: DataColumn<TRow>[];
  columnFilters: DataColumnFilter[];
  gridTemplateColumns: string;
  resizingColumn: string | null;
  showStickyTitleDivider: boolean;
  sort: DataSortState | null;
  tableWidth: number;
  onColumnResizeStart: (event: MouseEvent<HTMLElement>, column: DataColumn<TRow>) => void;
  onSortApply: (column: DataColumn<TRow>, direction: 'asc' | 'desc' | null) => void;
  onFilterToggle: (column: DataColumn<TRow>, optionId: string) => void;
  onFilterClear: (column: DataColumn<TRow>) => void;
}

export function DataTableHeader<TRow>({
  columns,
  columnFilters,
  gridTemplateColumns,
  resizingColumn,
  showStickyTitleDivider,
  sort,
  tableWidth,
  onColumnResizeStart,
  onSortApply,
  onFilterToggle,
  onFilterClear,
}: DataTableHeaderProps<TRow>) {
  return (
    <div className="sticky top-0 z-40 bg-background">
      <div
        className="group/header grid w-full border-b border-border/70 bg-background"
        style={{ gridTemplateColumns, minWidth: tableWidth }}
      >
        {columns.map((column, index) => {
          const sortable = isColumnSortable(column);
          const filterable = isColumnFilterable(column);
          const hasMenu = sortable || filterable;
          const sortActive = sort?.column === column.key;
          const filterValues = columnFilters.find((filter) => filter.column === column.key)?.values ?? [];
          const filterActive = filterValues.length > 0;
          const triggerClassName = cn(
            'flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring-subtle',
            index === 0 && 'pl-0',
            !hasMenu && 'cursor-default'
          );

          return (
            <div
              key={column.key}
              className={cn(
                'group/header-cell relative flex h-10 min-w-0 items-center overflow-hidden font-sans transition-colors',
                index === 0 && 'sticky left-0 z-50 bg-background pl-4',
                index === 0 && showStickyTitleDivider && stickyTitleDividerClass,
                hasMenu && index === 0 && 'hover:bg-surface-soft hover:text-foreground',
                hasMenu && index !== 0 && 'hover:bg-hover-overlay hover:text-foreground'
              )}
            >
              {hasMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(triggerClassName, 'data-[state=open]:text-foreground')}
                    aria-label={`Sort or filter by ${column.label}`}
                  >
                    <HeaderCellContent column={column} filterValues={filterValues} sort={sort} sortable={sortable} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-44">
                    {sortable ? (
                      <>
                        <DropdownMenuItem onSelect={() => onSortApply(column, 'asc')}>
                          <ArrowUp />
                          Sort ascending
                          {sortActive && sort?.direction === 'asc' ? <Check className="ml-auto" /> : null}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onSortApply(column, 'desc')}>
                          <ArrowDown />
                          Sort descending
                          {sortActive && sort?.direction === 'desc' ? <Check className="ml-auto" /> : null}
                        </DropdownMenuItem>
                        {sortActive ? (
                          <DropdownMenuItem onSelect={() => onSortApply(column, null)}>
                            <X />
                            Clear sort
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    ) : null}
                    {sortable && filterable ? <DropdownMenuSeparator /> : null}
                    {filterable ? (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <ListFilter />
                            Filter
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
                        {filterActive ? (
                          <DropdownMenuItem onSelect={() => onFilterClear(column)}>
                            <X />
                            Clear filter
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className={triggerClassName}>
                  <HeaderCellContent column={column} filterValues={filterValues} sort={sort} sortable={sortable} />
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1 right-0 bottom-1 w-1 cursor-col-resize rounded-full transition-colors',
                  resizingColumn === column.key
                    ? 'bg-primary/40'
                    : 'opacity-0 group-hover/header:opacity-100 group-hover/header:bg-border'
                )}
                onMouseDown={(event) => onColumnResizeStart(event, column)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
