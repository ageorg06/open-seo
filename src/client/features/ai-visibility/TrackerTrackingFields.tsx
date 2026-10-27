import { cn } from "cn";
import { Info, TriangleAlert } from "lucide-react";
import { EngineLabel } from "./EngineLabel";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import { ProjectMarketFields } from "@/client/features/projects/ProjectMarketFields";
import {
  AI_MAX_ANSWERS_PER_PROMPT,
  AI_UNSUPPORTED_LOCATIONS,
  aiCountryLabel,
  type AiCapability,
  type AiEngine,
  type AiTrackerState,
} from "@/shared/ai-visibility";

export type TrackerDraft = {
  locationCode: number;
  languageCode: string;
  engines: AiEngine[];
  answersPerPrompt: number;
  topic: { name: string; prompts: string[] };
};

export const MAX_PROMPTS_PER_ADDITION = 5;

const ANSWER_COUNT_ITEMS = Array.from(
  { length: AI_MAX_ANSWERS_PER_PROMPT },
  (_, index) => ({ value: String(index + 1), label: String(index + 1) }),
);

export function TrackerTrackingFields({
  state,
  value,
  onChange,
  disabled,
}: {
  state: AiTrackerState;
  value: TrackerDraft;
  onChange: (value: TrackerDraft) => void;
  // Base UI checkboxes aren't native inputs, so a disabled <fieldset> misses them.
  disabled: boolean;
}) {
  const country = aiCountryLabel(value.locationCode);
  const engineGroup = (
    title: string,
    help: string,
    capabilities: AiCapability[],
  ) => (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`About ${title.toLowerCase()}`}
                className="text-muted-foreground"
              />
            }
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{help}</TooltipContent>
        </Tooltip>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {capabilities.map((capability) => {
          const unavailable = AI_UNSUPPORTED_LOCATIONS[
            capability.engine
          ].includes(value.locationCode);
          return (
            <Tooltip key={capability.engine} disabled={!unavailable}>
              <TooltipTrigger
                render={
                  <label
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 border-border",
                      unavailable
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer",
                    )}
                  />
                }
              >
                <Checkbox
                  checked={value.engines.includes(capability.engine)}
                  disabled={disabled || unavailable}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      engines: checked
                        ? [...value.engines, capability.engine]
                        : value.engines.filter(
                            (engine) => engine !== capability.engine,
                          ),
                    })
                  }
                />
                <span className="text-sm font-medium">
                  <EngineLabel
                    engine={capability.engine}
                    label={capability.label}
                  />
                </span>
                {unavailable && (
                  <TriangleAlert className="ml-auto size-4 text-muted-foreground" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {capability.label} can't collect answers in {country}.
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
  return (
    <section className="space-y-5">
      {engineGroup(
        "Scraped responses",
        "Answers as users see them in each AI app.",
        state.capabilities.filter((capability) => !capability.modelApi),
      )}
      {engineGroup(
        "API responses",
        "Answers from each model's API, with web search.",
        state.capabilities.filter((capability) => capability.modelApi),
      )}
      <Field>
        <FieldLabel htmlFor="answers-per-prompt">Answers per prompt</FieldLabel>
        <Select
          items={ANSWER_COUNT_ITEMS}
          value={String(value.answersPerPrompt)}
          onValueChange={(next) => {
            if (next) onChange({ ...value, answersPerPrompt: Number(next) });
          }}
          disabled={disabled}
        >
          <SelectTrigger id="answers-per-prompt" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWER_COUNT_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          AI answers vary, so rates are steadier over several. Each API response
          engine asks every prompt this many times per run, and cost grows to
          match. Google AI Overviews always collects one answer.
        </FieldDescription>
      </Field>
      <ProjectMarketFields
        value={value}
        onChange={(market) =>
          onChange({
            ...value,
            ...market,
            // Drop engines that cannot collect in the new country.
            engines: value.engines.filter(
              (engine) =>
                !AI_UNSUPPORTED_LOCATIONS[engine].includes(market.locationCode),
            ),
          })
        }
      />
    </section>
  );
}
