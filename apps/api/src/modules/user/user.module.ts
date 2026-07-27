import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';
import { UserController } from '@/modules/user/user.controller';

@Module({
  imports: [MikroOrmModule.forFeature([User])],
  controllers: [UserController],
})
export class UserModule {}
