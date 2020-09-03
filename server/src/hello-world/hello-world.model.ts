import { Injectable } from '@nestjs/common';

@Injectable()
export class HelloWorld {

    constructor(
        public hello: string, 
        public world: string
    ) {}
}