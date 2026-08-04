import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthInitializerService } from '@/app/auth/auth-initializer.service';
import { AuthUserProvisionerService } from '@/app/auth/auth-user-provisioner.service';
import { AuthGuard } from '@/app/auth/auth.guard';
import { CurrentUserResolutionService } from '@/app/auth/current-user-resolution.service';
import { CurrentUserInterceptor } from '@/app/auth/current-user.interceptor';
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
    CurrentUserResolutionService,
    { provide: APP_INTERCEPTOR, useClass: CurrentUserInterceptor },
    AuthGuard,
  ],
  exports: [
    AuthInitializerService,
    AuthUserProvisionerService,
    CurrentUserResolutionService,
    AuthGuard,
  ],
})
export class AuthModule {}
