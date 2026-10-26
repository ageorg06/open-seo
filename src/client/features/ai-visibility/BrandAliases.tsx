import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { updateProjectContext } from "@/serverFunctions/projectContext";
import type { AiBrand } from "@/shared/ai-visibility";
import { aiVisibilityKey } from "./shared";

/** Other spellings AI answers use for each brand: the app side of `setBrandAliases`. */
export function BrandAliases({
  projectId,
  brands,
}: {
  projectId: string;
  brands: AiBrand[];
}) {
  if (!brands.length) return null;
  return (
    <div className="space-y-3 border-t border-border p-4">
      <h2 className="text-sm font-semibold">Brand aliases</h2>
      <p className="text-xs text-muted-foreground">
        Other spellings AI answers use for a brand, separated by commas, such as
        &ldquo;Arcano and Co&rdquo; or the name in Greek, each 2&ndash;80
        characters, up to 20 per brand. Matching ignores case and accents, so
        list inflected forms too. Applies to new checks.
      </p>
      <div className="space-y-2">
        {brands.map((brand) => (
          <AliasRow key={brand.domain} projectId={projectId} brand={brand} />
        ))}
      </div>
    </div>
  );
}

function AliasRow({ projectId, brand }: { projectId: string; brand: AiBrand }) {
  const queryClient = useQueryClient();
  const saved = brand.aliases.join(", ");
  const [value, setValue] = useState(saved);
  const save = useMutation({
    mutationFn: () =>
      updateProjectContext({
        data: {
          projectId,
          updates: [
            {
              setBrandAliases: {
                domain: brand.domain,
                aliases: value
                  .split(",")
                  .map((alias) => alias.trim())
                  .filter(Boolean),
              },
            },
          ],
        },
      }),
    onSuccess: (context) => {
      // The server trims and drops duplicates; show what it kept.
      setValue(
        (
          context.brandAliases.find((row) => row.domain === brand.domain)
            ?.aliases ?? []
        ).join(", "),
      );
      toast.success(`${brand.name} aliases saved`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: aiVisibilityKey(projectId) }),
        queryClient.invalidateQueries({
          queryKey: ["projectContext", projectId],
        }),
      ]);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <span className="w-40 shrink-0 truncate text-sm" title={brand.domain}>
        {brand.name}
      </span>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="No aliases"
        autoComplete="off"
        spellCheck={false}
        aria-label={`${brand.name} aliases`}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={save.isPending || value.trim() === saved}
      >
        Save
      </Button>
    </form>
  );
}
