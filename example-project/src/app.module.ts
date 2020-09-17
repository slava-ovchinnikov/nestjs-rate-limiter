import {
  RateLimiterInterceptor,
  RateLimiterModule,
} from 'nestjs-rate-limit';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    RateLimiterModule.forRoot({
      points: 100,
      duration: 60,
      keyPrefix: 'global',
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimiterInterceptor,
    },
  ],
})
export class AppModule {}
