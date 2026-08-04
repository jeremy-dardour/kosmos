import { Migration } from '@mikro-orm/migrations';

/**
 * Widens the workstream ordering constraint to the scope the domain actually
 * uses — the project's workstreams sharing one group. `nulls not distinct` is
 * hand-written because MikroORM cannot express it: without it Postgres treats
 * every null group id as unique and the ungrouped scope goes unenforced.
 */
export class Migration20260804074628_workstream_position_nulls_not_distinct extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "workstream" drop constraint "workstream_group_id_position_unique";`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_project_id_group_id_position_unique" unique nulls not distinct ("project_id", "group_id", "position") deferrable initially deferred;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "workstream" drop constraint "workstream_project_id_group_id_position_unique";`,
    );
    this.addSql(
      `alter table "workstream" add constraint "workstream_group_id_position_unique" unique ("group_id", "position") deferrable initially deferred;`,
    );
  }
}
