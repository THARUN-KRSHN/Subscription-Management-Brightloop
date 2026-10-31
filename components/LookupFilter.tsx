"use client";
import { useState } from "react";
import type { LookupKind } from "@/app/admin/lookups";
import { LookupSelect } from "./LookupSelect";
export function LookupFilter({
  kind,
  name,
  label,
  initialValue = "",
}: {
  kind: LookupKind;
  name: string;
  label: string;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="min-w-48 flex-1 sm:max-w-xs">
      <LookupSelect
        kind={kind}
        name={name}
        label={label}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}
