"use client";

import { createCodePlugin, type HighlightOptions, type HighlightResult } from "@streamdown/code";
import { type CSSProperties, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Match Kylon Markdown's light and dark syntax colors.
export const sharedCodeHighlighter = createCodePlugin({
  themes: ["github-light-default", "github-dark-default"],
});

type HighlightedCodeProps = {
  code: string;
  language: HighlightOptions["language"];
};

type TokenStyle = CSSProperties & Record<`--${string}`, string>;

function tokenStyle(token: HighlightResult["tokens"][number][number]): TokenStyle {
  const style: TokenStyle = {};
  const lightColor = token.color ?? token.htmlStyle?.color;
  const lightBackground = token.bgColor ?? token.htmlStyle?.["background-color"];
  if (lightColor) style["--sdm-c"] = lightColor;
  if (lightBackground) style["--sdm-tbg"] = lightBackground;
  for (const [property, value] of Object.entries(token.htmlStyle ?? {})) {
    if (property !== "color" && property !== "background-color") {
      Object.assign(style, { [property]: value });
    }
  }
  return style;
}

export function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const [result, setResult] = useState<HighlightResult | null>(null);

  useEffect(() => {
    let active = true;
    const accept = (nextResult: HighlightResult) => {
      if (active) setResult(nextResult);
    };
    const immediateResult = sharedCodeHighlighter.highlight(
      { code, language, themes: sharedCodeHighlighter.getThemes() },
      accept,
    );
    setResult(immediateResult);
    return () => {
      active = false;
    };
  }, [code, language]);

  return (
    <pre
      data-highlighted-code
      className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-background p-3 pr-11 font-mono text-xs leading-5 [overflow-wrap:anywhere]"
    >
      <code>
        {result
          ? result.tokens.map((line, lineIndex) => (
              <span className="block" key={`${lineIndex}:${line[0]?.offset ?? 0}`}>
                {line.length === 0
                  ? "\n"
                  : line.map((token, tokenIndex) => {
                      const style = tokenStyle(token);
                      const hasBackground = Boolean(
                        token.bgColor ?? token.htmlStyle?.["background-color"],
                      );
                      return (
                        <span
                          className={cn(
                            "text-[var(--sdm-c,inherit)] dark:text-[var(--shiki-dark,var(--sdm-c,inherit))]",
                            hasBackground &&
                              "bg-[var(--sdm-tbg)] dark:bg-[var(--shiki-dark-bg,var(--sdm-tbg))]",
                          )}
                          style={style}
                          key={`${tokenIndex}:${token.offset}`}
                        >
                          {token.content}
                        </span>
                      );
                    })}
              </span>
            ))
          : code}
      </code>
    </pre>
  );
}
