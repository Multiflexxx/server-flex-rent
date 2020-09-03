import { Injectable } from '@nestjs/common';
import { HelloWorld } from './hello-world.model';

@Injectable()
export class HelloWorldService {
    helloWorld(): {hello: string, world: string} {
        return {
            hello: "Hello World",
            world: "World Hello"
        };
    }

}
