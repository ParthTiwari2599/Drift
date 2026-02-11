import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

const slugify = (topic: string) =>
  topic.trim().replace(/\s+/g, "-").toLowerCase();

export const createOrJoinRoom = mutation({
  args: {
    topic: v.string(),
    password: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.topic);
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      if (existing.isLocked) {
        if (!args.password) throw new Error("PASSWORD_REQUIRED");
        const ok = await bcrypt.compare(args.password, existing.passwordHash || "");
        if (!ok) throw new Error("INVALID_PASSWORD");
      }
      return { id: existing._id, ...existing };
    }

    let passwordHash: string | undefined = undefined;
    if (args.password) {
      passwordHash = await bcrypt.hash(args.password, 10);
    }

    const roomData = {
      topic: args.topic,
      slug,
      active: true,
      isLocked: !!args.password,
      passwordHash,
      createdBy: args.userId || "",
      createdAt: Date.now(),
    };

    const id = await ctx.db.insert("rooms", roomData);
    return { id, ...roomData };
  },
});

export const findPrivateRoom = query({
  args: { roomName: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const slug = slugify(args.roomName);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (!room || !room.isLocked) throw new Error("ROOM_NOT_FOUND");
    const ok = await bcrypt.compare(args.password, room.passwordHash || "");
    if (!ok) throw new Error("INVALID_PASSWORD");
    return { id: room._id, ...room };
  },
});

export const getRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("rooms", args.roomId);
    if (!roomId) throw new Error("Room not found");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    return { id: room._id, ...room };
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const roomId = ctx.db.normalizeId("rooms", args.roomId);
    if (!roomId) throw new Error("Room not found");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.createdBy !== args.userId) {
      throw new Error("Only room creator can delete this room");
    }
    await ctx.db.delete(roomId);
    return true;
  },
});

export const listActiveRooms = query({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_active_createdAt", (q) => q.eq("active", true))
      .order("desc")
      .collect();
    return rooms.map((r) => ({ id: r._id, ...r }));
  },
});

export const listActiveRoomsWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_active_createdAt", (q) => q.eq("active", true))
      .order("desc")
      .collect();

    const now = Date.now();
    const ACTIVE_WINDOW = 30_000;
    const results = [];
    for (const room of rooms) {
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id as any))
        .collect();
      const activeCount = presence.filter((p) => now - p.lastSeen < ACTIVE_WINDOW)
        .length;
      results.push({ id: room._id, ...room, activeCount });
    }
    return results;
  },
});
