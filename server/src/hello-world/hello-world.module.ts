import { Module } from '@nestjs/common';
import { HelloWorldController } from './hello-world.controller';
import { HelloWorldService } from './hello-world.service';
import { HelloWorld } from './hello-world.model';

@Module({
    imports: [HelloWorld],
    controllers: [HelloWorldController],
    providers: [HelloWorldService]
})
export class HelloWorldModule {}