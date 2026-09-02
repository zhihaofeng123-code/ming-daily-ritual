"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildUrlStateHref, readUrlState } from "@/lib/url-state";

const detailViews = ["summary", "full"] as const;

/**
 * Replace this sample with a real reusable detail component. Keeping one
 * component shared by the normal and `/present/` routes prevents capture-only
 * UI from drifting from the page users actually open.
 */
export function ExampleDetail({ itemId, isolated = false }: { itemId: string; isolated?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");
  const view = readUrlState(searchParams, "view", detailViews, "summary");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const viewHref = (nextView: (typeof detailViews)[number]) =>
    buildUrlStateHref(
      {
        pathname,
        search: searchParams,
        hash,
      },
      { view: nextView === "summary" ? null : nextView },
    );

  return (
    <Card className={isolated ? "min-h-full rounded-none border-0 shadow-none" : undefined}>
      <CardHeader className="gap-3 border-b">
        <div className="space-y-2">
          <Badge variant="secondary">Example detail</Badge>
          <CardTitle className="text-xl leading-tight">Item {itemId}</CardTitle>
        </div>
        <nav aria-label="Example detail view" className="flex gap-2">
          {detailViews.map((nextView) => (
            <Button
              key={nextView}
              asChild
              size="sm"
              variant={view === nextView ? "default" : "secondary"}
            >
              <Link href={viewHref(nextView) as Route} replace>
                {nextView === "summary" ? "Summary" : "Full detail"}
              </Link>
            </Button>
          ))}
        </nav>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">
        <p>
          This pathname makes one item directly reachable. Replace the sample identifier and copy
          with the site&apos;s real content lookup.
        </p>
        {view === "full" ? (
          <p className="text-muted-foreground">
            Query-backed component state is reachable too. This paragraph is present at
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5">?view=full</code>
            and remains stable across refresh, sharing, and App-page presentation.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
