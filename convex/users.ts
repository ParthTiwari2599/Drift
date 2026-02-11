import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    return user ? { id: user._id, ...user } : null;
  },
});

export const getUsersByIds = query({
  args: { userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.userIds.map(async (uid) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", uid))
          .first();
        return user ? { id: user._id, ...user } : null;
      })
    );
    return results.filter(Boolean);
  },
});

export const upsertUser = mutation({
  args: {
    userId: v.string(),
    customDisplayName: v.optional(v.string()),
    customAvatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    const updatedAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customDisplayName: args.customDisplayName,
        customAvatar: args.customAvatar,
        updatedAt,
      });
      return true;
    }

    await ctx.db.insert("users", {
      userId: args.userId,
      customDisplayName: args.customDisplayName,
      customAvatar: args.customAvatar,
      updatedAt,
    });
    return true;
  },
});
