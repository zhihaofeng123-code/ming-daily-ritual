"use client";

import { Braces, Brackets, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HighlightedCode } from "@/components/ui/code-highlighting";
import type { FieldValueViewProps } from "@/components/ui/field-values/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function formatJsonValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function JsonFieldView({ value, className }: FieldValueViewProps) {
  const isArray = Array.isArray(value);
  const summary =
    value == null
      ? null
      : isArray
        ? `Array · ${value.length} item${value.length === 1 ? "" : "s"}`
        : typeof value === "object"
          ? `Object · ${Object.keys(value).length} key${Object.keys(value).length === 1 ? "" : "s"}`
          : formatJsonValue(value);
  const Icon = isArray ? Brackets : Braces;

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <Icon
        data-json-value-kind={isArray ? "array" : "object"}
        className="size-3 shrink-0 text-muted-foreground"
      />
      {summary != null ? <span className="truncate text-sm">{summary}</span> : null}
    </span>
  );
}

export function JsonFieldExpandedView({ value }: Pick<FieldValueViewProps, "value">) {
  const [copied, setCopied] = useState(false);
  const formatted = formatJsonValue(value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be unavailable in restricted browser contexts.
    }
  };

  return (
    <div data-json-code-block className="relative min-w-0 overflow-hidden bg-background">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "absolute top-2 right-2 z-10 text-muted-foreground hover:bg-accent/72 hover:text-foreground",
              copied && "bg-accent/80 text-foreground",
            )}
            aria-label={copied ? "Copied" : "Copy JSON"}
            onClick={() => void copy()}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy JSON"}</TooltipContent>
      </Tooltip>
      <HighlightedCode code={formatted} language="json" />
    </div>
  );
}
