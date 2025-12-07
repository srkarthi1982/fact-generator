import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { db, eq, and, FactTopics, Facts, FactRequests, UserFactState } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createTopic: defineAction({
    input: z.object({
      name: z.string().min(1, "Name is required"),
      description: z.string().optional(),
      slug: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [topic] = await db
        .insert(FactTopics)
        .values({
          ownerId: user.id,
          name: input.name,
          description: input.description,
          slug: input.slug,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { topic };
    },
  }),

  updateTopic: defineAction({
    input: z.object({
      id: z.number().int(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      slug: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(FactTopics)
        .where(and(eq(FactTopics.id, id), eq(FactTopics.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Topic not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { topic: existing };
      }

      const [topic] = await db
        .update(FactTopics)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(FactTopics.id, id), eq(FactTopics.ownerId, user.id)))
        .returning();

      return { topic };
    },
  }),

  listTopics: defineAction({
    input: z
      .object({
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const includeInactive = input?.includeInactive ?? false;

      const topics = await db.select().from(FactTopics);

      const filtered = topics.filter((topic) => {
        const isMine = !topic.ownerId || topic.ownerId === user.id;
        const isActive = includeInactive ? true : topic.isActive;
        return isMine && isActive;
      });

      return { topics: filtered };
    },
  }),

  createFact: defineAction({
    input: z.object({
      topicId: z.number().int().optional(),
      content: z.string().min(1, "Content is required"),
      difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),
      source: z.string().optional(),
      sourceMeta: z.any().optional(),
      origin: z.enum(["ai", "user", "curated"]).optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.topicId) {
        const [topic] = await db
          .select()
          .from(FactTopics)
          .where(eq(FactTopics.id, input.topicId))
          .limit(1);

        if (!topic) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Topic not found.",
          });
        }
      }

      const [fact] = await db
        .insert(Facts)
        .values({
          topicId: input.topicId,
          content: input.content,
          difficulty: input.difficulty ?? "basic",
          source: input.source,
          sourceMeta: input.sourceMeta,
          origin: input.origin ?? "ai",
          ownerId: user.id,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { fact };
    },
  }),

  updateFact: defineAction({
    input: z.object({
      id: z.number().int(),
      topicId: z.number().int().optional(),
      content: z.string().min(1).optional(),
      difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),
      source: z.string().optional(),
      sourceMeta: z.any().optional(),
      origin: z.enum(["ai", "user", "curated"]).optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(Facts)
        .where(and(eq(Facts.id, id), eq(Facts.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Fact not found.",
        });
      }

      if (typeof rest.topicId !== "undefined") {
        const [topic] = await db
          .select()
          .from(FactTopics)
          .where(eq(FactTopics.id, rest.topicId))
          .limit(1);

        if (!topic) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Topic not found.",
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { fact: existing };
      }

      const [fact] = await db
        .update(Facts)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(Facts.id, id), eq(Facts.ownerId, user.id)))
        .returning();

      return { fact };
    },
  }),

  listFacts: defineAction({
    input: z
      .object({
        topicId: z.number().int().optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const includeInactive = input?.includeInactive ?? false;

      const facts = await db.select().from(Facts);

      const filtered = facts.filter((fact) => {
        const matchesTopic = input?.topicId ? fact.topicId === input.topicId : true;
        const matchesOwner = !fact.ownerId || fact.ownerId === user.id;
        const matchesActive = includeInactive ? true : fact.isActive;
        return matchesTopic && matchesOwner && matchesActive;
      });

      return { facts: filtered };
    },
  }),

  createRequest: defineAction({
    input: z.object({
      topicId: z.number().int().optional(),
      prompt: z.string().optional(),
      input: z.any().optional(),
      output: z.any().optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.topicId) {
        const [topic] = await db
          .select()
          .from(FactTopics)
          .where(eq(FactTopics.id, input.topicId))
          .limit(1);

        if (!topic) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Topic not found.",
          });
        }
      }

      const [request] = await db
        .insert(FactRequests)
        .values({
          userId: user.id,
          topicId: input.topicId,
          prompt: input.prompt,
          input: input.input,
          output: input.output,
          status: input.status ?? "pending",
          createdAt: new Date(),
        })
        .returning();

      return { request };
    },
  }),

  updateUserFactState: defineAction({
    input: z.object({
      factId: z.number().int(),
      seen: z.boolean().optional(),
      seenAt: z.coerce.date().optional(),
      isFavorite: z.boolean().optional(),
      reaction: z.enum(["none", "like", "love", "mind_blown", "meh"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [fact] = await db
        .select()
        .from(Facts)
        .where(eq(Facts.id, input.factId))
        .limit(1);

      if (!fact) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Fact not found.",
        });
      }

      const [existing] = await db
        .select()
        .from(UserFactState)
        .where(and(eq(UserFactState.factId, input.factId), eq(UserFactState.userId, user.id)))
        .limit(1);

      const baseValues = {
        factId: input.factId,
        userId: user.id,
        seen: input.seen ?? existing?.seen ?? false,
        seenAt: input.seenAt ?? existing?.seenAt,
        isFavorite: input.isFavorite ?? existing?.isFavorite ?? false,
        reaction: input.reaction ?? existing?.reaction ?? "none",
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        const [state] = await db
          .update(UserFactState)
          .set(baseValues)
          .where(eq(UserFactState.id, existing.id))
          .returning();

        return { state };
      }

      const [state] = await db.insert(UserFactState).values(baseValues).returning();
      return { state };
    },
  }),

  listUserFactState: defineAction({
    input: z
      .object({
        onlyFavorites: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const states = await db
        .select()
        .from(UserFactState)
        .where(eq(UserFactState.userId, user.id));

      const filtered = input?.onlyFavorites
        ? states.filter((s) => s.isFavorite)
        : states;

      return { states: filtered };
    },
  }),
};
