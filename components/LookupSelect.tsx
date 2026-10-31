"use client";
import { useEffect, useId, useState } from "react";
import {
  lookupOptions,
  type LookupKind,
  type LookupOption,
} from "@/app/admin/lookups";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function LookupSelect({
  kind,
  label,
  name,
  value,
  onChange,
  selectedLabel,
  parentId,
  required,
  disabled,
  availableOnly,
}: {
  kind: LookupKind;
  label: string;
  name: string;
  value: string;
  onChange: (value: string, label: string) => void;
  selectedLabel?: string;
  parentId?: number | null;
  required?: boolean;
  disabled?: boolean;
  availableOnly?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(
      () => {
        lookupOptions({ kind, q, page, parentId, availableOnly })
          .then((result) => {
            if (!cancelled) {
              setOptions(result.options);
              setTotal(result.total);
              setError(result.error ?? "");
              setLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setError("Could not load options. Change the search to retry.");
              setLoading(false);
            }
          });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, q, page, parentId, availableOnly]);
  const visible =
    value && !options.some((option) => option.value === value)
      ? [{ value, label: selectedLabel || `Selected #${value}` }, ...options]
      : options;
  return (
    <div>
      <label className="field" htmlFor={id}>
        {label}
        <select
          id={id}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
              visible.find((option) => option.value === event.target.value)
                ?.label ?? "",
            )
          }
          required={required}
          disabled={disabled}
          aria-busy={loading}
        >
          <option value="">
            {kind === "variants" ? "No variant" : "Choose…"}
          </option>
          {visible.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name={name} value={value} />
      {!disabled && (
        <details className="mt-2">
          <summary className="w-fit text-xs text-primary">
            Search {label.toLowerCase()}
          </summary>
          <label className="mt-2 block text-xs" htmlFor={`${id}-search`}>
            Find by name
            <Input
              id={`${id}-search`}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              maxLength={100}
              className="mt-1"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page === 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>{loading ? "Loading…" : `${total} results · ${page}`}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page * 20 >= total || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
