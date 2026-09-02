import type { CSSProperties } from 'react';
import type { DataColumn, DataValue } from '@/components/ui/data-types';
import { dataValueFromRow } from '@/components/ui/data-types';
import { FieldValuePopover } from '@/components/ui/field-value-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  DEFAULT_COLUMN_WIDTH,
  getTitle,
  shouldIgnoreRowActivation,
  resolveActionIcon,
  resolveActionText,
  rowHoverOverlayClass,
  rowSelectedOverlayClass,
  stickyCellHoverSurfaceClass,
  stickyCellSurfaceClass,
  stickySelectedHoverOverlayClass,
  stickySelectedOverlayClass,
  stickyTitleCellHoverSurfaceClass,
  stickyTitleDividerClass,
  titleActionButtonClassName,
  titleActionContainerClassName,
  titleActionIconClassName,
  type DataTableTitleAction,
} from './data-table-utils';

export type DataTableTitleMode = 'static' | 'edit' | 'action';

interface DataTableRowProps<TRow> {
  cellsEditable: boolean;
  columnWidths: Record<string, number>;
  columnWidthsReady: boolean;
  defaultWidths: Record<string, number>;
  getRowTitle?: (row: TRow) => string;
  gridTemplateColumns: string;
  isLastRow: boolean;
  onActivate?: (row: TRow) => void;
  onCellCommit?: (row: TRow, column: DataColumn<TRow>, value: DataValue) => unknown | Promise<unknown>;
  row: TRow;
  rowActivatesOnClick: boolean;
  rowAriaLabel?: (row: TRow) => string;
  rowId: string;
  selectedRowId?: string | null;
  showStickyTitleDivider: boolean;
  style?: CSSProperties;
  titleActions?: DataTableTitleAction<TRow>[];
  titleColumn?: DataColumn<TRow>;
  titleMode: DataTableTitleMode;
  visibleColumns: DataColumn<TRow>[];
}

export function DataTableRow<TRow>({
  cellsEditable,
  columnWidths,
  columnWidthsReady,
  defaultWidths,
  getRowTitle,
  gridTemplateColumns,
  isLastRow,
  onActivate,
  onCellCommit,
  row,
  rowActivatesOnClick,
  rowAriaLabel,
  rowId,
  selectedRowId,
  showStickyTitleDivider,
  style,
  titleActions = [],
  titleColumn,
  titleMode,
  visibleColumns,
}: DataTableRowProps<TRow>) {
  const selected = rowId === selectedRowId;
  const title = getTitle(row, titleColumn, getRowTitle, rowId);
  const titleValue = titleColumn ? dataValueFromRow(row, titleColumn) : title;
  const titleActivatesOnClick = titleMode === 'action' && !!onActivate;
  const activateAriaLabel = rowAriaLabel?.(row) ?? `Open ${title}`;
  const resolvedTitleActions = titleActions
    .map((action, index) => {
      const href = action.href?.(row);
      const label = resolveActionText(action.label, row);
      const tooltip = resolveActionText(action.tooltip ?? action.label, row);
      const ariaLabel = resolveActionText(action.ariaLabel ?? action.label ?? action.tooltip, row);
      const icon = resolveActionIcon(action.icon, row);
      return {
        action,
        ariaLabel,
        href,
        icon,
        index,
        label,
        tooltip,
      };
    })
    .filter(({ action, ariaLabel, href, icon }) => Boolean(icon && ariaLabel && (href || action.onClick)));
  const hasTitleActions = resolvedTitleActions.length > 0;

  return (
    <div
      data-selected={selected ? '' : undefined}
      className={cn(
        'group/row group grid h-[42px] w-full text-left',
        rowActivatesOnClick && 'cursor-pointer',
        rowActivatesOnClick && rowHoverOverlayClass,
        !isLastRow && 'border-b border-border/60',
        selected && rowSelectedOverlayClass
      )}
      style={{ ...style, gridTemplateColumns }}
      aria-label={rowActivatesOnClick ? activateAriaLabel : undefined}
      role={rowActivatesOnClick ? 'button' : undefined}
      tabIndex={rowActivatesOnClick ? 0 : undefined}
      onClick={
        rowActivatesOnClick
          ? (event) => {
              if (shouldIgnoreRowActivation(event.target, event.currentTarget)) return;
              onActivate?.(row);
            }
          : undefined
      }
      onKeyDown={
        rowActivatesOnClick
          ? (event) => {
              if (shouldIgnoreRowActivation(event.target, event.currentTarget)) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate?.(row);
              }
            }
          : undefined
      }
    >
      <div
        className={cn(
          'group/title-cell sticky left-0 z-10 flex min-w-0 items-stretch',
          hasTitleActions && 'pr-2',
          showStickyTitleDivider && stickyTitleDividerClass,
          stickyCellSurfaceClass,
          stickyTitleCellHoverSurfaceClass,
          rowActivatesOnClick && stickyCellHoverSurfaceClass,
          titleActivatesOnClick && 'cursor-pointer',
          selected && stickySelectedOverlayClass,
          selected && (rowActivatesOnClick || titleActivatesOnClick) && stickySelectedHoverOverlayClass
        )}
      >
        <div
          className="relative z-10 flex min-w-0 flex-1 items-stretch"
          role={titleActivatesOnClick ? 'button' : undefined}
          tabIndex={titleActivatesOnClick ? 0 : undefined}
          aria-label={titleActivatesOnClick ? activateAriaLabel : undefined}
          onClick={
            titleActivatesOnClick
              ? (event) => {
                  if (shouldIgnoreRowActivation(event.target, event.currentTarget)) return;
                  onActivate?.(row);
                }
              : undefined
          }
          onKeyDown={
            titleActivatesOnClick
              ? (event) => {
                  if (shouldIgnoreRowActivation(event.target, event.currentTarget)) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onActivate?.(row);
                  }
                }
              : undefined
          }
        >
          {titleColumn ? (
            <FieldValuePopover
              field={titleColumn}
              value={titleValue}
              interactive={titleMode === 'edit'}
              onCommit={
                titleMode === 'edit' && onCellCommit
                  ? (nextValue) => onCellCommit(row, titleColumn, nextValue)
                  : undefined
              }
              variant="table-cell"
              className="px-4 py-2.5 text-label-md tracking-normal hover:bg-transparent"
            />
          ) : (
            <p className="flex min-w-0 flex-1 items-center truncate px-4 py-2.5 text-label-md tracking-normal">
              {title}
            </p>
          )}
        </div>
        {hasTitleActions ? (
          <div className={titleActionContainerClassName}>
            {resolvedTitleActions.map(({ action, ariaLabel, href, icon, index, label, tooltip }) => {
              const resolvedTitleActionClassName = action.showLabel
                ? titleActionButtonClassName
                : titleActionIconClassName;

              return (
                <Tooltip key={action.key ?? index}>
                  <TooltipTrigger asChild>
                    {href ? (
                      <a
                        data-row-action="title-action"
                        href={href}
                        target={action.target}
                        rel={action.target === '_blank' ? 'noreferrer' : undefined}
                        aria-label={ariaLabel}
                        className={resolvedTitleActionClassName}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {icon}
                        {action.showLabel && label ? <span>{label}</span> : null}
                      </a>
                    ) : (
                      <button
                        type="button"
                        data-row-action="title-action"
                        aria-label={ariaLabel}
                        className={resolvedTitleActionClassName}
                        onClick={(event) => {
                          event.stopPropagation();
                          action.onClick?.(row);
                        }}
                      >
                        {icon}
                        {action.showLabel && label ? <span>{label}</span> : null}
                      </button>
                    )}
                  </TooltipTrigger>
                  {tooltip ? <TooltipContent side="bottom">{tooltip}</TooltipContent> : null}
                </Tooltip>
              );
            })}
          </div>
        ) : null}
      </div>
      {visibleColumns.map((column) => (
        <div
          key={column.key}
          className={cn(
            'relative flex min-w-0 items-stretch overflow-hidden text-body-md text-muted-foreground',
            rowActivatesOnClick && 'group-hover:text-foreground/90'
          )}
        >
          <FieldValuePopover
            value={dataValueFromRow(row, column)}
            field={column}
            cellWidth={
              columnWidthsReady ? (columnWidths[column.key] ?? defaultWidths[column.key] ?? DEFAULT_COLUMN_WIDTH) : undefined
            }
            interactive={cellsEditable}
            onCommit={
              cellsEditable && onCellCommit ? (nextValue) => onCellCommit(row, column, nextValue) : undefined
            }
            variant="table-cell"
          />
        </div>
      ))}
    </div>
  );
}
