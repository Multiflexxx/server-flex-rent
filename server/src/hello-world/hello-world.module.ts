import { Module } from '@nestjs/common';
import { HelloWorldController } from './hello-world.controller';
import { HelloWorldService } from './hello-world.service';

@Module({
    controllers: [HelloWorldController],
    providers: [HelloWorldService]
})
export class HelloWorldModule {}