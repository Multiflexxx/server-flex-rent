import { Injectable } from '@nestjs/common';

export class HelloWorld {

    constructor(
        public hello: string, 
        public world: string
    ) {}
}