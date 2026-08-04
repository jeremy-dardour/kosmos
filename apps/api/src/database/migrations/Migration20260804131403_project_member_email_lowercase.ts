import { Migration } from '@mikro-orm/migrations';

export class Migration20260804131403_project_member_email_lowercase extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "project_member" add constraint "project_member_check" check (email = lower(email));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "project_member" drop constraint "project_member_check";`,
    );
  }
}
