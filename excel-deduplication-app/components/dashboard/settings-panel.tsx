"use client";

import { useState } from "react";
import { BrainCircuit, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDedupeStore } from "@/store/use-dedupe-store";
import type { DedupeAlgorithmPreset, DedupeAlgorithmSettings, MatchFieldKind } from "@/types";
import { DEDUPE_ALGORITHM_PRESETS } from "@/types";

function formatFields(fields: ReturnType<typeof useDedupeStore.getState>["settings"]["fields"]): string {
  return fields
    .map(
      (field) =>
        `${field.field},${field.label},${field.weight},${field.kind},${field.required ? "required" : "optional"},${field.aliases?.join("|") ?? ""}`,
    )
    .join("\n");
}

const FIELD_KINDS: MatchFieldKind[] = ["name", "string", "phone", "date", "address", "exact"];

const PRESET_LABELS: Record<Exclude<DedupeAlgorithmPreset, "custom">, string> = {
  enterprise_conservative: " Conservative",
  balanced: "Balanced Precision",
  high_recall: "High Recall Investigation",
};

export function SettingsPanel() {
  const { settings, updateSettings } = useDedupeStore();
  const [exact, setExact] = useState(settings.thresholds.exact);
  const [high, setHigh] = useState(settings.thresholds.high);
  const [possible, setPossible] = useState(settings.thresholds.possible);
  const [maxBlockSize, setMaxBlockSize] = useState(settings.maxBlockSize);
  const [chunkSize, setChunkSize] = useState(settings.chunkSize);
  const [blockFieldsText, setBlockFieldsText] = useState(settings.blockFields.join(", "));
  const [fieldsText, setFieldsText] = useState(formatFields(settings.fields));
  const [algorithm, setAlgorithm] = useState<DedupeAlgorithmSettings>(settings.algorithm);

  function setAlgorithmValue<Key extends keyof DedupeAlgorithmSettings>(
    key: Key,
    value: DedupeAlgorithmSettings[Key],
  ) {
    setAlgorithm((current) => ({
      ...current,
      preset: "custom",
      [key]: value,
    }));
  }

  function applyPreset(preset: string | null) {
    if (!preset || preset === "custom") {
      setAlgorithm((current) => ({ ...current, preset: "custom" }));
      return;
    }

    const typedPreset = preset as Exclude<DedupeAlgorithmPreset, "custom">;
    setAlgorithm(DEDUPE_ALGORITHM_PRESETS[typedPreset]);
  }

  function handleSave() {
    const fields = fieldsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [field, label, weight, kind, requirement = "optional", aliases] = line.split(",");
        return {
          field,
          label,
          weight: Number(weight),
          kind: kind as typeof settings.fields[number]["kind"],
          required: requirement.trim().toLowerCase() === "required",
          aliases: aliases?.split("|").filter(Boolean) ?? [],
        };
      });

    const weightsAreValid = fields.every(
      (field) =>
        field.field &&
        field.label &&
        Number.isFinite(field.weight) &&
        field.weight > 0 &&
        FIELD_KINDS.includes(field.kind),
    );

    if (!weightsAreValid) {
      toast.error("Field configuration contains invalid rows.");
      return;
    }

    if (!(possible < high && high < exact)) {
      toast.error("Thresholds must follow Possible < High < Exact.");
      return;
    }

    const blockFields = blockFieldsText
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    if (blockFields.length === 0) {
      toast.error("Add at least one blocking field.");
      return;
    }

    updateSettings({
      fields,
      thresholds: { exact, high, possible },
      maxBlockSize,
      chunkSize,
      blockFields,
      algorithm,
    });
    toast.success("algorithm settings saved");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="size-5" />
                Drmd deduplication algorithm
              </CardTitle>
              <CardDescription>
                Tune the high-accuracy matching pipeline used for CRM exports, voter lists, employee
                records, and Benefiaciary databases.
              </CardDescription>
            </div>
            <Badge variant="secondary">Drmd rules engine</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="grid gap-2">
              <label htmlFor="preset" className="text-sm font-medium">
                Algorithm preset
              </label>
              <Select value={algorithm.preset} onValueChange={applyPreset}>
                <SelectTrigger id="preset" className="w-full">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESET_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom tuned profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <div>
                <p className="font-medium text-foreground">Conservative</p>
                <p>Best for production merges with strict required-field caps.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Balanced</p>
                <p>Good default for mixed data quality and manual review workflows.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">High recall</p>
                <p>Surfaces more candidates for investigative cleanup queues.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <NumberField id="exact" label="Exact threshold" value={exact} onChange={setExact} />
            <NumberField id="high" label="High threshold" value={high} onChange={setHigh} />
            <NumberField id="possible" label="Possible threshold" value={possible} onChange={setPossible} />
            <NumberField id="max-block" label="Max block size" value={maxBlockSize} onChange={setMaxBlockSize} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <NumberField id="chunk-size" label="Worker chunk size" value={chunkSize} onChange={setChunkSize} />
            <NumberField
              id="max-pairs"
              label="Max pairs per record"
              value={algorithm.maxCandidatePairsPerRecord}
              onChange={(value) => setAlgorithmValue("maxCandidatePairsPerRecord", value)}
            />
            <NumberField
              id="fallback-modulo"
              label="Fallback partitions"
              value={algorithm.fallbackModulo}
              onChange={(value) => setAlgorithmValue("fallbackModulo", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Precision safeguards
          </CardTitle>
          <CardDescription>
            These controls reduce false positives by capping records with required-field conflicts and
            penalizing weak or missing evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <NumberField
              id="required-min"
              label="Required-field min score"
              value={algorithm.requiredFieldMinScore}
              onChange={(value) => setAlgorithmValue("requiredFieldMinScore", value)}
            />
            <NumberField
              id="mismatch-cap"
              label="Mandatory mismatch cap"
              value={algorithm.mandatoryFieldMismatchCap}
              onChange={(value) => setAlgorithmValue("mandatoryFieldMismatchCap", value)}
            />
            <NumberField
              id="minimum-exact"
              label="Min exact fields"
              value={algorithm.minimumExactFields}
              onChange={(value) => setAlgorithmValue("minimumExactFields", value)}
            />
            <NumberField
              id="minimum-high"
              label="Min high-confidence fields"
              value={algorithm.minimumHighConfidenceFields}
              onChange={(value) => setAlgorithmValue("minimumHighConfidenceFields", value)}
            />
            <NumberField
              id="minimum-reasons"
              label="Min candidate reasons"
              value={algorithm.minimumCandidateReasons}
              onChange={(value) => setAlgorithmValue("minimumCandidateReasons", value)}
            />
            <NumberField
              id="strong-threshold"
              label="Strong match threshold"
              value={algorithm.strongMatchThreshold}
              onChange={(value) => setAlgorithmValue("strongMatchThreshold", value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <NumberField
              id="missing-penalty"
              label="Missing-value penalty"
              value={algorithm.missingValuePenalty}
              onChange={(value) => setAlgorithmValue("missingValuePenalty", value)}
            />
            <NumberField
              id="disagreement-penalty"
              label="Disagreement penalty"
              value={algorithm.disagreementPenalty}
              onChange={(value) => setAlgorithmValue("disagreementPenalty", value)}
            />
            <NumberField
              id="strong-boost"
              label="Strong-match boost"
              value={algorithm.strongMatchBoost}
              onChange={(value) => setAlgorithmValue("strongMatchBoost", value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleField
              id="require-exact"
              label="Require mandatory fields for exact duplicates"
              checked={algorithm.requireMandatoryFieldsForExact}
              onChange={(value) => setAlgorithmValue("requireMandatoryFieldsForExact", value)}
            />
            <ToggleField
              id="transitive"
              label="Enable transitive cluster grouping"
              checked={algorithm.enableTransitiveClustering}
              onChange={(value) => setAlgorithmValue("enableTransitiveClustering", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-5" />
            Blocking and weighted fields
          </CardTitle>
          <CardDescription>
            Blocking limits candidate comparisons for 100,000+ rows while field weights define business
            confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <NumberField
              id="name-prefix"
              label="Name prefix length"
              value={algorithm.namePrefixLength}
              onChange={(value) => setAlgorithmValue("namePrefixLength", value)}
            />
            <NumberField
              id="exact-prefix"
              label="Exact prefix length"
              value={algorithm.exactPrefixLength}
              onChange={(value) => setAlgorithmValue("exactPrefixLength", value)}
            />
            <div className="grid gap-2 lg:col-span-2">
              <label htmlFor="block-fields" className="text-sm font-medium">
                Blocking fields
              </label>
              <Input
                id="block-fields"
                value={blockFieldsText}
                onChange={(event) => setBlockFieldsText(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <ToggleField
              id="phonetic"
              label="Phonetic name blocking"
              checked={algorithm.enablePhoneticBlocking}
              onChange={(value) => setAlgorithmValue("enablePhoneticBlocking", value)}
            />
            <ToggleField
              id="address-token"
              label="Address token blocking"
              checked={algorithm.enableAddressTokenBlocking}
              onChange={(value) => setAlgorithmValue("enableAddressTokenBlocking", value)}
            />
            <ToggleField
              id="fallback-blocks"
              label="Cross-block fallback partitions"
              checked={algorithm.enableCrossBlockFallback}
              onChange={(value) => setAlgorithmValue("enableCrossBlockFallback", value)}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="fields" className="text-sm font-medium">
              Weighted fields
            </label>
            <Textarea
              id="fields"
              value={fieldsText}
              onChange={(event) => setFieldsText(event.target.value)}
              className="min-h-56 font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Format: field,label,weight,kind,required|optional,alias|alias. Kinds: name, string,
              phone, date, address, exact.
            </p>
          </div>

          <Button className="w-fit" onClick={handleSave}>
            Save enterprise algorithm settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 p-4 text-sm font-medium"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
    </label>
  );
}
