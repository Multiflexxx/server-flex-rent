import { Injectable } from '@nestjs/common';

@Injectable()
export class Offer {

    constructor(
        public hello: string, 
        public world: string
    ) {}
}