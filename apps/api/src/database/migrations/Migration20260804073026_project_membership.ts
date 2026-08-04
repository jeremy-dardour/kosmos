import { Migration } from '@mikro-orm/migrations';

export class Migration20260804073026_project_membership extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "project_member" ("id" uuid not null default gen_random_uuid(), "project_id" uuid not null, "email" varchar(255) not null, "user_id" uuid null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `create index "project_member_user_id_index" on "project_member" ("user_id");`,
    );
    this.addSql(
      `create index "project_member_email_index" on "project_member" ("email");`,
    );
    this.addSql(
      `alter table "project_member" add constraint "project_member_project_id_email_unique" unique ("project_id", "email");`,
    );

    this.addSql(
      `alter table "project_member" add constraint "project_member_project_id_foreign" foreign key ("project_id") references "project" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "project_member" add constraint "project_member_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete set null;`,
    );

    this.addSql(
      `alter table "project" add "owner_id" uuid not null, add "deleted_at" timestamptz null;`,
    );
    this.addSql(
      `alter table "project" add constraint "project_owner_id_foreign" foreign key ("owner_id") references "user" ("id") on delete restrict;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "project_member" cascade;`);

    this.addSql(
      `alter table "project" drop constraint "project_owner_id_foreign";`,
    );

    this.addSql(
      `alter table "project" drop column "owner_id", drop column "deleted_at";`,
    );
  }
}
