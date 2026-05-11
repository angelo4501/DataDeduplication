"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDedupeStore } from "@/store/use-dedupe-store";

function formatFields(fields: ReturnType<typeof useDedupeStore.getState>["settings"]["fields"]): string {
  return fields
    .map((field) => `${field.field},${field.label},${field.weight},${field.kind},${field.aliases?.join("|") ?? ""}`)
    .join("\n");
}

export function SettingsPanel() {
  const { settings, updateSettings } = useDedupeStore();
  const [exact, setExact] = useState(settings.thresholds.exact);
  const [high, setHigh] = useState(settings.thresholds.high);
  const [possible, setPossible] = useState(settings.thresholds.possible);
  const [maxBlockSize, setMaxBlockSize] = useState(settings.maxBlockSize);
  const [fieldsText, setFieldsText] = useState(formatFields(settings.fields));

  function handleSave() {
    const fields = fieldsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [field, label, weight, kind, aliases] = line.split(",");
        return {
          field,
          label,
          weight: Number(weight),
          kind: kind as typeof settings.fields[number]["kind"],
          aliases: aliases?.split("|").filter(Boolean) ?? [],
        };
      });

    if (fields.some((field) => !field.field || !field.label || Number.isNaN(field.weight))) {
      toast.error("Field configuration contains invalid rows.");
      return;
    }

    updateSettings({
      fields,
      thresholds: { exact, high, possible },
      maxBlockSize,
    });
    toast.success("Matching settings saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matching settings</CardTitle>
        <CardDescription>
          Tune thresholds and weights for CRM exports, voter lists, employee records, and customer databases.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <label htmlFor="exact" className="text-sm font-medium">Exact threshold</label>
            <Input id="exact" type="number" value={exact} onChange={(event) => setExact(Number(event.target.value))} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="high" className="text-sm font-medium">High threshold</label>
            <Input id="high" type="number" value={high} onChange={(event) => setHigh(Number(event.target.value))} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="possible" className="text-sm font-medium">Possible threshold</label>
            <Input
              id="possible"
              type="number"
              value={possible}
              onChange={(event) => setPossible(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="max-block" className="text-sm font-medium">Max block size</label>
            <Input
              id="max-block"
              type="number"
              value={maxBlockSize}
              onChange={(event) => setMaxBlockSize(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label htmlFor="fields" className="text-sm font-medium">Weighted fields</label>
          <Textarea
            id="fields"
            value={fieldsText}
            onChange={(event) => setFieldsText(event.target.value)}
            className="min-h-52 font-mono text-sm"
          />
          <p className="text-sm text-muted-foreground">
            Format: field,label,weight,kind,alias|alias. Kinds: name, string, phone, date, address, exact.
          </p>
        </div>

        <Button className="w-fit" onClick={handleSave}>
          Save settings
        </Button>
      </CardContent>
    </Card>
  );
}
