import { Controller, Get, Body, Header } from '@nestjs/common';
import { HelloWorldService } from './hello-world.service';

@Controller('hello-world')
export class HelloWorldController {
    constructor(private readonly helloWorldService: HelloWorldService) {}
    @Get()
    helloWorld(
    ): {hello: string, world: string} {
        return this.helloWorldService.helloWorld();
    }

    
}
