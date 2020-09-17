import { RATE_LIMITER_TOKEN } from './rate-limiter.constants';
import { RateLimiterModuleOptions } from './rate-limiter.interface';
import { SetMetadata } from '@nestjs/common';

export const RateLimit = (options: RateLimiterModuleOptions): MethodDecorator =>
    SetMetadata(RATE_LIMITER_TOKEN, options);
