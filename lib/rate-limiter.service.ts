import {
    IRateLimiterStoreOptions,
    RateLimiterAbstract,
    RateLimiterMemcache,
    RateLimiterMemory,
    RateLimiterMySQL,
    RateLimiterPostgres,
    RateLimiterRedis,
    RateLimiterRes,
} from 'rate-limiter-flexible';

import { Injectable, Inject, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RATE_LIMITER_OPTIONS, RATE_LIMITER_TOKEN, REFLECTOR } from './rate-limiter.constants';
import { RateLimiterModuleOptions } from './rate-limiter.interface';

@Injectable()
export class RateLimiterService {
    private rateLimiters: Map<string, RateLimiterAbstract> = new Map();

    constructor(
        @Inject(RATE_LIMITER_OPTIONS) private readonly options: RateLimiterModuleOptions,
        @Inject(REFLECTOR) private readonly reflector: Reflector,
    ) {}

    async getRateLimiter(keyPrefix: string, options?: RateLimiterModuleOptions): Promise<RateLimiterMemory> {
        let rateLimiter: RateLimiterMemory = this.rateLimiters.get(keyPrefix);

        const limiterOptions: RateLimiterModuleOptions = {
            ...this.options,
            ...options,
            keyPrefix,
        };

        const { type, pointsConsumed, ...libraryArguments } = limiterOptions;

        if (!rateLimiter) {
            if (limiterOptions.type === 'Redis') {
                rateLimiter = new RateLimiterRedis(libraryArguments as IRateLimiterStoreOptions);
            } else if (limiterOptions.type === 'Memcache') {
                rateLimiter = new RateLimiterMemcache(libraryArguments as IRateLimiterStoreOptions);
            } else if (limiterOptions.type === 'Postgres') {
                rateLimiter = await new Promise((resolve, reject) => {
                    const limiter = new RateLimiterPostgres(libraryArguments as IRateLimiterStoreOptions, err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(limiter);
                        }
                    });
                });
            } else if (limiterOptions.type === 'MySQL') {
                rateLimiter = await new Promise((resolve, reject) => {
                    const limiter = new RateLimiterMySQL(libraryArguments as IRateLimiterStoreOptions, err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(limiter);
                        }
                    });
                });
            } else {
                rateLimiter = new RateLimiterMemory(libraryArguments);
            }

            this.rateLimiters.set(keyPrefix, rateLimiter);
        }

        return rateLimiter;
    }

    async executeRateLimiter(context: ExecutionContext): Promise<void> {
        let points: number = this.options.points;
        let pointsConsumed: number = this.options.pointsConsumed;
        let keyPrefix: string = this.options.keyPrefix;

        const reflectedOptions: RateLimiterModuleOptions = this.reflector.get<RateLimiterModuleOptions>(
            RATE_LIMITER_TOKEN,
            context.getHandler(),
        );

        if (reflectedOptions) {
            if (reflectedOptions.points) {
                points = reflectedOptions.points;
            }

            if (reflectedOptions.pointsConsumed) {
                pointsConsumed = reflectedOptions.pointsConsumed;
            }

            if (reflectedOptions.keyPrefix) {
                keyPrefix = reflectedOptions.keyPrefix;
            } else {
                keyPrefix = context.getClass().name;

                if (context.getHandler()) {
                    keyPrefix += `-${context.getHandler().name}`;
                }
            }
        }

        const rateLimiter: RateLimiterMemory = await this.getRateLimiter(keyPrefix, reflectedOptions);

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        if (!response.set && response.header) response.set = response.header;
        else if (!response.set) return;

        const key = request.user ? request.user.id : request.ip;

        try {
            const rateLimiterResponse: RateLimiterRes = await rateLimiter.consume(key, pointsConsumed);

            response.set('Retry-After', Math.ceil(rateLimiterResponse.msBeforeNext / 1000));
            response.set('X-RateLimit-Limit', points);
            response.set('X-Retry-Remaining', rateLimiterResponse.remainingPoints);
            response.set('X-Retry-Reset', new Date(Date.now() + rateLimiterResponse.msBeforeNext).toUTCString());
        } catch (rateLimiterResponse) {
            if (rateLimiterResponse instanceof Error) {
                throw rateLimiterResponse;
            }

            response.set('Retry-After', Math.ceil(rateLimiterResponse.msBeforeNext / 1000));
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
