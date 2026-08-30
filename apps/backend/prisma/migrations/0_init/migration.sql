-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" VARCHAR(255),
    "verification_token_expires_at" TIMESTAMPTZ,
    "telegram_id" VARCHAR(100),
    "telegram_username" VARCHAR(100),
    "telegram_chat_id" VARCHAR(100),
    "trial_ends_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscription_expires_at" TIMESTAMPTZ,
    "is_subscription_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "height_cm" SMALLINT NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "goal" "Goal" NOT NULL,
    "daily_calorie_goal" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meal_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "food_name" VARCHAR(255) NOT NULL,
    "portion_size" VARCHAR(100) NOT NULL,
    "calories" DECIMAL(7,2) NOT NULL,
    "protein" DECIMAL(6,2) NOT NULL,
    "fat" DECIMAL(6,2) NOT NULL,
    "carbs" DECIMAL(6,2) NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "ingredients" TEXT[],
    "health_advice" TEXT,
    "portion_breakdown" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meal_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "analysis_id" TEXT,
    "meal_type" "MealType" NOT NULL,
    "food_name" VARCHAR(255) NOT NULL,
    "portion_size" VARCHAR(100) NOT NULL,
    "calories" DECIMAL(7,2) NOT NULL,
    "protein" DECIMAL(6,2) NOT NULL,
    "fat" DECIMAL(6,2) NOT NULL,
    "carbs" DECIMAL(6,2) NOT NULL,
    "image_url" TEXT,
    "ingredients" TEXT[],
    "health_advice" TEXT,
    "portion_breakdown" TEXT,
    "logged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" VARCHAR(255),
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "telegram_subscribers" (
    "id" TEXT NOT NULL,
    "chat_id" VARCHAR(100) NOT NULL,
    "telegram_id" VARCHAR(100),
    "username" VARCHAR(100),
    "first_name" VARCHAR(100),
    "lang" VARCHAR(10) NOT NULL DEFAULT 'ru',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "telegram_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_verification_token_idx" ON "users"("verification_token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_telegram_id_idx" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meal_analyses_user_id_idx" ON "meal_analyses"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meal_analyses_user_id_is_confirmed_idx" ON "meal_analyses"("user_id", "is_confirmed");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "meal_logs_analysis_id_key" ON "meal_logs"("analysis_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meal_logs_user_id_logged_at_idx" ON "meal_logs"("user_id", "logged_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meal_logs_user_id_meal_type_idx" ON "meal_logs"("user_id", "meal_type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_subscribers_chat_id_key" ON "telegram_subscribers"("chat_id");
