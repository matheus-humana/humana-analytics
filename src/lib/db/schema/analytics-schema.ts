import { pgSchema, timestamp } from 'drizzle-orm/pg-core';

/**
 * Isolated PostgreSQL schema for Humana Analytics.
 * Must not use the public schema or other product schemas.
 */
export const analyticsSchema = pgSchema('analytics');

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });
