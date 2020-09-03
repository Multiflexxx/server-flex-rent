import { Injectable } from '@nestjs/common';
import { HelloWorld } from './hello-world.model';
import { Connector } from './../util/database/connector'

@Injectable()
export class HelloWorldService {
    helloWorld(): HelloWorld {
        const message = Connector.executeQuery({
            query: "Select * From Test", 
            args: []
        });
        console.log(message);
        return new HelloWorld ("Hello World", "World Hello");
    }

}
