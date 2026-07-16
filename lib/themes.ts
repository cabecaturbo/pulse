/**
 * Comment theme clustering. Managers see THEMES, never raw comments — unless
 * a theme has 5+ similar comments, in which case a few examples may surface.
 *
 * If ANTHROPIC_API_KEY is set, an LLM clusters free-text comments into themes
 * (comments are already anonymous; nothing else is sent). Otherwise a keyword
 * fallback keeps the feature working in every environment.
 */

export interface CommentTheme {
  theme: string;
  count: number;
  /** Example comments — only populated when count >= 5. */
  examples: string[];
}

const KEYWORD_BUCKETS: { theme: string; words: RegExp }[] = [
  { theme: "Staffing & call-outs", words: /staff|call.?out|short|ratio|assignment|coverage|down a nurse/i },
  { theme: "Breaks & meals", words: /break|lunch|meal|eat|bathroom|pee/i },
  { theme: "Floating", words: /float|pulled|another unit|reassign/i },
  { theme: "Patient acuity", words: /acuity|heavy patients|codes?|icu|critical|admit/i },
  { theme: "Equipment & supplies", words: /equipment|supplies|pump|monitor|broken|missing/i },
  { theme: "Leadership & support", words: /charge|manager|support|help|alone|leadership|listen/i },
  { theme: "Scheduling", words: /schedule|shift swap|overtime|mandat|hours/i },
];

export function clusterByKeywords(comments: string[]): CommentTheme[] {
  const buckets = new Map<string, string[]>();
  for (const comment of comments) {
    const bucket =
      KEYWORD_BUCKETS.find((b) => b.words.test(comment))?.theme ?? "Other";
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), comment]);
  }
  return [...buckets.entries()]
    .map(([theme, list]) => ({
      theme,
      count: list.length,
      examples: list.length >= 5 ? list.slice(0, 3) : [],
    }))
    .sort((a, b) => b.count - a.count);
}

async function clusterWithLlm(comments: string[]): Promise<CommentTheme[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Cluster these anonymous nurse shift comments into at most 6 short themes. Reply with ONLY a JSON array of {"theme": string, "indices": number[]} objects, indices referencing the comment list. Comments:\n${comments
              .map((c, i) => `${i}: ${c}`)
              .join("\n")}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content: { text?: string }[] };
    const text = data.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as {
      theme: string;
      indices: number[];
    }[];
    return parsed
      .map((p) => ({
        theme: p.theme,
        count: p.indices.length,
        examples:
          p.indices.length >= 5
            ? p.indices.slice(0, 3).map((i) => comments[i]).filter(Boolean)
            : [],
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

export async function clusterComments(comments: string[]): Promise<CommentTheme[]> {
  if (comments.length === 0) return [];
  return (await clusterWithLlm(comments)) ?? clusterByKeywords(comments);
}
