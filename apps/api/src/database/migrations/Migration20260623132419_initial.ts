import { Migration } from '@mikro-orm/migrations';

export class Migration20260623132419_initial extends Migration {
  override async up(): Promise<void> {
    this.addSql(/* sql */ `
      CREATE TABLE "item" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "item_pkey" PRIMARY KEY ("id")
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "item" cascade;`);
  }
}
