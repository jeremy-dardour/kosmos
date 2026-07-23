import { Migration } from '@mikro-orm/migrations';

export class Migration20260723191701 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`create type "step_outcome" as enum ('done', 'skipped');`);
    this.addSql(
      `create table "project" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "event_date" date null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `create table "group" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "color" varchar(7) not null, "project_id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );

    this.addSql(
      `create table "user" ("id" uuid not null default gen_random_uuid(), "email" varchar(255) not null, "name" varchar(255) not null, "avatar_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "user" add constraint "user_email_unique" unique ("email");`,
    );

    this.addSql(
      `create table "workstream" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "icon" varchar(255) not null, "project_id" uuid not null, "group_id" uuid null, "owner_id" uuid null, "started_at" timestamptz null, "completed_at" timestamptz null, "current_step_id" uuid null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_current_step_id_unique" unique ("current_step_id");`,
    );

    this.addSql(
      `create table "step" ("id" uuid not null default gen_random_uuid(), "workstream_id" uuid not null, "position" int not null, "name" varchar(255) not null, "deadline" date null, "owner_id" uuid null, "outcome" "step_outcome" null, "outcome_at" timestamptz null, "blocked" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "step" add constraint "step_workstream_id_position_unique" unique ("workstream_id", "position") deferrable initially deferred;`,
    );

    this.addSql(
      `create table "note" ("id" uuid not null default gen_random_uuid(), "step_id" uuid not null, "author_id" uuid null, "content" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(`create index "note_step_id_index" on "note" ("step_id");`);

    this.addSql(
      `create table "checklist_item" ("id" uuid not null default gen_random_uuid(), "step_id" uuid not null, "position" int not null, "name" varchar(255) not null, "done" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `create index "checklist_item_step_id_index" on "checklist_item" ("step_id");`,
    );
    this.addSql(
      `alter table "checklist_item" add constraint "checklist_item_step_id_position_unique" unique ("step_id", "position") deferrable initially deferred;`,
    );

    this.addSql(
      `alter table "group" add constraint "group_project_id_foreign" foreign key ("project_id") references "project" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "workstream" add constraint "workstream_project_id_foreign" foreign key ("project_id") references "project" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_group_id_foreign" foreign key ("group_id") references "group" ("id") on delete set null;`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_owner_id_foreign" foreign key ("owner_id") references "user" ("id") on delete set null;`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_current_step_id_foreign" foreign key ("current_step_id") references "step" ("id") on delete restrict;`,
    );

    this.addSql(
      `alter table "step" add constraint "step_workstream_id_foreign" foreign key ("workstream_id") references "workstream" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "step" add constraint "step_owner_id_foreign" foreign key ("owner_id") references "user" ("id") on delete set null;`,
    );

    this.addSql(
      `alter table "note" add constraint "note_step_id_foreign" foreign key ("step_id") references "step" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "note" add constraint "note_author_id_foreign" foreign key ("author_id") references "user" ("id") on delete set null;`,
    );

    this.addSql(
      `alter table "checklist_item" add constraint "checklist_item_step_id_foreign" foreign key ("step_id") references "step" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "checklist_item" cascade;`);
    this.addSql(`drop table if exists "note" cascade;`);
    this.addSql(`drop table if exists "step" cascade;`);
    this.addSql(`drop table if exists "workstream" cascade;`);
    this.addSql(`drop table if exists "group" cascade;`);
    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "project" cascade;`);
    this.addSql(`drop type if exists "step_outcome";`);
  }
}
