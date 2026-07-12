import { CommandFactory } from 'nest-commander';

import { CliModule } from './cli.module';

async function bootstrap() {
  await CommandFactory.run(CliModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    errorHandler: (err) => {
      console.error(err);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    },
  });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void bootstrap();
