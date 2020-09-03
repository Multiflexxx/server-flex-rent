import { Injectable } from '@nestjs/common';
import { HelloWorld } from './hello-world.model';

@Injectable()
export class HelloWorldService {
    helloWorld(): HelloWorld {
        return new HelloWorld ("Hello World", "World Hello");
    }

}
