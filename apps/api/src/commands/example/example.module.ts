import { Module } from '@nestjs/common';

import { ExampleCommand } from '@/commands/example/example.command';

@Module({
  providers: [ExampleCommand],
})
export class ExampleModule {}
