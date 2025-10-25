const { sqliteTable, text, integer, blob, index } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

// Members table - complete structure with Discord user data and encrypted tokens
const members = sqliteTable('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  athlete_id: integer('athlete_id').unique().notNull(),
  discord_id: text('discord_id').unique().notNull(),
  discord_user_id: text('discord_user_id'), // Consistent naming with codebase
  is_active: integer('is_active').default(1),
  athlete: text('athlete'), // JSON string of athlete data
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  registered_at: text('registered_at').default(sql`CURRENT_TIMESTAMP`),
  
  // Discord user information (essential for proper name display)
  discord_username: text('discord_username'),
  discord_display_name: text('discord_display_name'),
  discord_discriminator: text('discord_discriminator').default('0'),
  discord_avatar: text('discord_avatar'),
  
  // Encrypted token storage (stored as complete encrypted JSON object)
  encrypted_tokens: text('encrypted_tokens'), // JSON string containing the full encrypted token structure
});

// Indexes for members table
const memberDiscordIdIdx = index('member_discord_idx').on(members.discord_id);
const memberAthleteIdIdx = index('member_athlete_idx').on(members.athlete_id);
const memberDiscordUsernameIdx = index('member_discord_username_idx').on(members.discord_username);
const memberDiscordDisplayNameIdx = index('member_discord_display_name_idx').on(members.discord_display_name);
const memberRegisteredAtIdx = index('member_registered_at_idx').on(members.registered_at);

// Races table - enhanced with road/trail types
const races = sqliteTable('races', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  member_athlete_id: integer('member_athlete_id').notNull().references(() => members.athlete_id, { 
    onDelete: 'cascade',
    onUpdate: 'cascade' 
  }),
  name: text('name').notNull(),
  race_date: text('race_date').notNull(), // ISO date string
  race_type: text('race_type').notNull().default('road'), // 'road' or 'trail'
  distance: text('distance'), // e.g. "42.2km", "10mi", "5K"
  distance_km: text('distance_km'), // Standardized distance in km for sorting/filtering
  location: text('location'),
  status: text('status').notNull().default('registered'), // registered, completed, cancelled, dns, dnf
  notes: text('notes'),
  goal_time: text('goal_time'), // e.g. "3:30:00"
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Indexes for races table
const raceMemberIdx = index('race_member_idx').on(races.member_athlete_id);
const raceDateIdx = index('race_date_idx').on(races.race_date);
const raceTypeIdx = index('race_type_idx').on(races.race_type);

// Migration log table - track migration status
const migrationLog = sqliteTable('migration_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  migration_name: text('migration_name').notNull().unique(),
  executed_at: text('executed_at').default(sql`CURRENT_TIMESTAMP`),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error_message: text('error_message'),
  data_backup: text('data_backup'), // JSON backup of migrated data
});

// Settings table - store bot configuration that can be changed via commands
const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

module.exports = {
  members,
  races, 
  migrationLog,
  settings,
};