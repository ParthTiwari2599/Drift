import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    topic: v.string(),
    slug: v.string(),
    isLocked: v.boolean(),
    passwordHash: v.optional(v.string()),
    createdBy: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_createdAt", ["active", "createdAt"]),

  messages: defineTable({
    roomId: v.string(),
    userId: v.string(),
    userName: v.string(),
    text: v.string(),
    type: v.string(),
    timestamp: v.number(),
    expireAt: v.optional(v.number()),
    deleteMode: v.optional(v.string()),
    replyTo: v.optional(v.any()),
    reactions: v.optional(v.any()),
  })
    .index("by_roomId_timestamp", ["roomId", "timestamp"])
    .index("by_expireAt", ["expireAt"]),

  presence: defineTable({
    roomId: v.string(),
    userId: v.string(),
    lastSeen: v.number(),
    username: v.string(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_userId", ["roomId", "userId"])
    .index("by_userId", ["userId"]),

  users: defineTable({
    userId: v.string(),
    customDisplayName: v.optional(v.string()),
    customAvatar: v.optional(v.string()),
    friends: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
