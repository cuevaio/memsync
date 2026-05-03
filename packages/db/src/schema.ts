import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const users = pgTable("users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  polarCustomerId: text("polar_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const subscriptions = pgTable("subscriptions", {
  clerkUserId: text("clerk_user_id").primaryKey().references(() => users.clerkUserId, { onDelete: "cascade" }),
  polarCustomerId: text("polar_customer_id"),
  polarSubscriptionId: text("polar_subscription_id"),
  productId: text("product_id"),
  status: text("status").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: "string" }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull()
});

export const extensionTokens = pgTable(
  "extension_tokens",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().references(() => users.clerkUserId, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" })
  },
  table => ({
    clerkUserIndex: index("idx_extension_tokens_user").on(table.clerkUserId),
    tokenHashIndex: index("idx_extension_tokens_hash").on(table.tokenHash)
  })
);

export type UserRecord = InferSelectModel<typeof users>;
export type SubscriptionRecord = InferSelectModel<typeof subscriptions>;
export type ExtensionTokenRecord = InferSelectModel<typeof extensionTokens>;
