import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const sendMessageToRoom = mutation({
  args: {
    roomId: v.string(),
    text: v.string(),
    userId: v.string(),
    userName: v.string(),
    type: v.string(),
    deleteMode: v.optional(v.string()),
    replyTo: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expireAt =
      args.deleteMode === "2h" || !args.deleteMode ? now + TWO_HOURS_MS : undefined;

    const messageData: any = {
      roomId: args.roomId,
      text: args.text,
      userId: args.userId,
      userName: args.userName,
      type: args.type,
      deleteMode: args.deleteMode || "2h",
      expireAt,
      timestamp: now,
    };
    if (args.replyTo) messageData.replyTo = args.replyTo;

    await ctx.db.insert("messages", messageData);
  },
});

export const listRoomMessages = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_roomId_timestamp", (q) => q.eq("roomId", args.roomId))
      .order("asc")
      .collect();

    return msgs
      .filter((m) => !m.expireAt || m.expireAt > now)
      .map((m) => ({ id: m._id, ...m }));
  },
});

export const addReactionToMessage = mutation({
  args: { messageId: v.string(), emoji: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const messageId = ctx.db.normalizeId("messages", args.messageId);
    if (!messageId) return;
    const msg = await ctx.db.get(messageId);
    if (!msg) return;
    const reactions = (msg.reactions || {}) as Record<string, string[]>;
    const users = new Set(reactions[args.emoji] || []);
    users.add(args.userId);
    reactions[args.emoji] = Array.from(users);
    await ctx.db.patch(messageId, { reactions });
  },
});

export const removeReactionFromMessage = mutation({
  args: { messageId: v.string(), emoji: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const messageId = ctx.db.normalizeId("messages", args.messageId);
    if (!messageId) return;
    const msg = await ctx.db.get(messageId);
    if (!msg) return;
    const reactions = (msg.reactions || {}) as Record<string, string[]>;
    const users = new Set(reactions[args.emoji] || []);
    users.delete(args.userId);
    reactions[args.emoji] = Array.from(users);
    await ctx.db.patch(messageId, { reactions });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    const messageId = ctx.db.normalizeId("messages", args.messageId);
    if (!messageId) return;
    await ctx.db.delete(messageId);
  },
});

export const cleanupExpiredMessages = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("messages")
      .withIndex("by_expireAt", (q) => q.lte("expireAt", now))
      .collect();
    for (const msg of expired) {
      await ctx.db.delete(msg._id);
    }
  },
});
