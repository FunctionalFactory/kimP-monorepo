import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  imports: [ConfigModule, EventEmitterModule.forRoot()],
  providers: [RedisSubscriberService],
  exports: [RedisSubscriberService],
})
export class RedisModule {}
