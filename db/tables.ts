import { column, defineTable, NOW } from "astro:db";

/**
 * Category or topic for facts.
 * Example: "Space", "History", "Biology", "Programming"
 */
export const FactTopics = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // Optional owner if we allow user-defined topics
    ownerId: column.text({ optional: true }),

    name: column.text(),
    description: column.text({ optional: true }),

    // Simple slug for URLs or filters
    slug: column.text({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Individual facts, generated or manually curated.
 */
export const Facts = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    topicId: column.number({
      references: () => FactTopics.columns.id,
      optional: true,
    }),

    // Fact text (short and punchy)
    content: column.text(),

    // Optional: 1–5 difficulty or depth
    difficulty: column.text({
      enum: ["basic", "intermediate", "advanced"],
      default: "basic",
    }),

    // Optional source info: URL, book, etc.
    source: column.text({ optional: true }),
    sourceMeta: column.json({ optional: true }),

    // Whether this fact came from AI, user, or curated source
    origin: column.text({
      enum: ["ai", "user", "curated"],
      default: "ai",
    }),

    // Owner if user-created
    ownerId: column.text({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Log of "generate facts" requests.
 * Each row = one generation job (e.g., "give me 5 facts about Space").
 */
export const FactRequests = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    userId: column.text({ optional: true }),

    // What the user asked for
    topicId: column.number({
      references: () => FactTopics.columns.id,
      optional: true,
    }),
    prompt: column.text({ optional: true }),

    // AI input/output payloads for transparency
    input: column.json({ optional: true }),
    output: column.json({ optional: true }),

    status: column.text({
      enum: ["pending", "completed", "failed"],
      default: "completed",
    }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * Per-user state about a fact:
 * - Seen/not seen
 * - Favorited
 * - Reaction / rating (like, meh, etc.)
 */
export const UserFactState = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    userId: column.text(),
    factId: column.number({ references: () => Facts.columns.id }),

    // Whether the user has seen this fact in the UI
    seen: column.boolean({ default: false }),
    seenAt: column.date({ optional: true }),

    // Starred / saved
    isFavorite: column.boolean({ default: false }),

    // Optional simple reaction
    reaction: column.text({
      enum: ["none", "like", "love", "mind_blown", "meh"],
      default: "none",
    }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const factGeneratorTables = {
  FactTopics,
  Facts,
  FactRequests,
  UserFactState,
} as const;
