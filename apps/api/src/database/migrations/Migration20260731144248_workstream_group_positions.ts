import { Migration } from '@mikro-orm/migrations';

/**
 * Seeds both position columns from the alphabetical order the overview used
 * before manual ordering, so nothing visibly moves on upgrade. Ungrouped
 * workstreams are one scope per project — `partition by` groups their null
 * group ids together.
 */
export class Migration20260731144248_workstream_group_positions extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "group" add "position" int null;`);
    this.addSql(
      `update "group" set "position" = "seeded"."rank" from (select "id", row_number() over (partition by "project_id" order by "name", "id") - 1 as "rank" from "group") as "seeded" where "group"."id" = "seeded"."id";`,
    );
    this.addSql(`alter table "group" alter column "position" set not null;`);
    this.addSql(
      `alter table "group" add constraint "group_project_id_position_unique" unique ("project_id", "position") deferrable initially deferred;`,
    );

    this.addSql(`alter table "workstream" add "position" int null;`);
    this.addSql(
      `update "workstream" set "position" = "seeded"."rank" from (select "id", row_number() over (partition by "project_id", "group_id" order by "name", "id") - 1 as "rank" from "workstream") as "seeded" where "workstream"."id" = "seeded"."id";`,
    );
    this.addSql(
      `alter table "workstream" alter column "position" set not null;`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_group_id_position_unique" unique ("group_id", "position") deferrable initially deferred;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "group" drop constraint "group_project_id_position_unique";`,
    );
    this.addSql(`alter table "group" drop column "position";`);

    this.addSql(
      `alter table "workstream" drop constraint "workstream_group_id_position_unique";`,
    );
    this.addSql(`alter table "workstream" drop column "position";`);
  }
}
