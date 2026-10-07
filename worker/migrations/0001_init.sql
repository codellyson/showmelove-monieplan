-- Initial schema, copied from the live AdonisJS database (tmp/db.sqlite3) after
-- Lucid migrations 1700000000001..06 and Better Auth's migrate. Column names,
-- types and defaults match exactly so a `sqlite3 .dump` of the old database
-- imports into D1 without rewriting (see worker/README.md, "Moving data").
--
-- Lucid's adonis_schema / adonis_schema_versions tables are deliberately left out.

-- App tables (Lucid) ---------------------------------------------------------

CREATE TABLE `creators` (
  `id` integer not null primary key autoincrement,
  `display_name` varchar(255) not null,
  `handle` varchar(255) not null,
  `bio` text null,
  `location` varchar(255) null,
  `currency` varchar(255) not null default 'NGN',
  `currency_symbol` varchar(255) not null default '₦',
  `monthly_goal` integer not null default '0',
  `brand_color` varchar(255) not null default '#FF5A36',
  `payout_mode` varchar(255) not null default 'managed',
  `processor` varchar(255) null,
  `created_at` datetime not null,
  `updated_at` datetime not null,
  `user_id` varchar(255) null,
  `khaime_merchant_id` varchar(255) null,
  `payout_status` varchar(255) null,
  `payout_provider` varchar(255) null,
  `settlement_currency` varchar(255) null,
  `stripe_account_id` varchar(255) null
);
CREATE UNIQUE INDEX `creators_handle_unique` on `creators` (`handle`);
CREATE INDEX `creators_user_id_index` on `creators` (`user_id`);

CREATE TABLE `supports` (
  `id` integer not null primary key autoincrement,
  `creator_id` integer,
  `supporter_name` varchar(255) null,
  `message` text null,
  `amount` integer not null,
  `currency` varchar(255) not null default 'NGN',
  `recurring` boolean not null default '0',
  `status` varchar(255) not null default 'pending',
  `reference` varchar(255) not null,
  `created_at` datetime not null,
  `updated_at` datetime not null,
  `charge_amount` integer null,
  `charge_currency` varchar(255) null,
  `khaime_split` text null,
  foreign key(`creator_id`) references `creators`(`id`) on delete CASCADE
);

-- Better Auth tables (dates stored as ISO-8601 text, as Better Auth writes them)

CREATE TABLE "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" integer not null,
  "image" text,
  "createdAt" date not null,
  "updatedAt" date not null
);

CREATE TABLE "session" (
  "id" text not null primary key,
  "expiresAt" date not null,
  "token" text not null unique,
  "createdAt" date not null,
  "updatedAt" date not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);
CREATE INDEX "session_userId_idx" on "session" ("userId");

CREATE TABLE "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" date,
  "refreshTokenExpiresAt" date,
  "scope" text,
  "password" text,
  "createdAt" date not null,
  "updatedAt" date not null
);
CREATE INDEX "account_userId_idx" on "account" ("userId");

CREATE TABLE "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" date not null,
  "createdAt" date not null,
  "updatedAt" date not null
);
CREATE INDEX "verification_identifier_idx" on "verification" ("identifier");
