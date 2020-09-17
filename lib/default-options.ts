import { RateLimiterModuleOptions } from './rate-limiter.interface';

export const defaultRateLimiterOptions: RateLimiterModuleOptions = {
    type: 'Memory',
    points: 4,
    duration: 1,
    pointsConsumed: 1,
};
