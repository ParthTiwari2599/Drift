import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ACTIVE_WINDOW = 30_000;

export const joinRoomPresence = mutation({
  args: { roomId: v.string(), userId: v.string(), username: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        username: args.username,
      });
      return;
    }

    await ctx.db.insert("presence", {
      roomId: args.roomId,
      userId: args.userId,
      lastSeen: Date.now(),
      username: args.username,
    });
  },
});

export const heartbeatPresence = mutation({
  args: { roomId: v.string(), userId: v.string(), username: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: Date.now(),
        username: args.username,
      });
      return;
    }
    await ctx.db.insert("presence", {
      roomId: args.roomId,
      userId: args.userId,
      lastSeen: Date.now(),
      username: args.username,
    });
  },
});

export const leaveRoomPresence = mutation({
  args: { roomId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_roomId_userId", (q) =>
        q.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listRoomPresenceUsers = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const users = await ctx.db
      .query("presence")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .collect();

    return users
      .filter((u) => now - u.lastSeen < ACTIVE_WINDOW)
      .map((u) => ({ id: u._id, ...u }));
  },
});

export const getRoomActiveCount = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const users = await ctx.db
      .query("presence")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .collect();
    return users.filter((u) => now - u.lastSeen < ACTIVE_WINDOW).length;
  },
});
