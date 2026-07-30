import { Migration } from '@mikro-orm/migrations';

export class Migration20260728133131 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "step" drop constraint "step_workstream_id_position_unique";`,
    );
    this.addSql(
      `alter table "step" add constraint "step_workstream_id_position_unique" unique ("workstream_id", "position") deferrable initially deferred;`,
    );

    this.addSql(
      `alter table "checklist_item" drop constraint "checklist_item_step_id_position_unique";`,
    );
    this.addSql(
      `alter table "checklist_item" add constraint "checklist_item_step_id_position_unique" unique ("step_id", "position") deferrable initially deferred;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "checklist_item" drop constraint "checklist_item_step_id_position_unique";`,
    );
    this.addSql(
      `alter table "checklist_item" add constraint "checklist_item_step_id_position_unique" unique ("step_id", "position");`,
    );

    this.addSql(
      `alter table "step" drop constraint "step_workstream_id_position_unique";`,
    );
    this.addSql(
      `alter table "step" add constraint "step_workstream_id_position_unique" unique ("workstream_id", "position");`,
    );
  }
}
