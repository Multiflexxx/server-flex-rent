import { Controller, Get, Body, Header } from '@nestjs/common';
import { HelloWorldService } from './hello-world.service';
import { HelloWorld } from './hello-world.model';

@Controller('hello-world')
export class HelloWorldController {
    constructor(private readonly helloWorldService: HelloWorldService) {}
    @Get()
    helloWorld(): HelloWorld {
        return this.helloWorldService.helloWorld();
    }

    
}
