import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

@Command({ name: 'example', description: 'An example CLI command' })
export class ExampleCommand extends CommandRunner {
  private readonly logger = new Logger(ExampleCommand.name);

  async run(): Promise<void> {
    await Promise.resolve();
    this.logger.log('Hello from the example CLI command!');
  }
}
