import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';

import { AuthInitializerService } from '@/app/auth/auth-initializer.service';
import { AuthUserProvisionerService } from '@/app/auth/auth-user-provisioner.service';
import { AuthGuard } from '@/app/auth/auth.guard';
import { JwtAuthStrategy } from '@/app/auth/strategies/jwt/jwt-auth.strategy';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { MockAuthStrategy } from '@/app/auth/strategies/mock-auth.strategy';
import { User } from '@/database/entities/user.entity';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([User])],
  providers: [
    OidcDiscoveryService,
    JwtVerificationService,
    JwtAuthStrategy,
    MockAuthStrategy,
    AuthInitializerService,
    AuthUserProvisionerService,
    AuthGuard,
  ],
  exports: [AuthInitializerService, AuthGuard],
})
export class AuthModule {}
