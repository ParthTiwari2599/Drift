import { action } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const hashPassword = action({
  args: { password: v.string() },
  handler: async (_ctx, args) => {
    const hash = await bcrypt.hash(args.password, 10);
    return hash;
  },
});

export const comparePassword = action({
  args: { password: v.string(), hash: v.string() },
  handler: async (_ctx, args) => {
    const ok = await bcrypt.compare(args.password, args.hash);
    return ok;
  },
});
