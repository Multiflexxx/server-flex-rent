import { Injectable } from '@nestjs/common';
import { User } from './user.model';

@Injectable()
export class UserService {

    async getUser(id: number): Promise<User>{
        throw new Error("Method not implemented.");
    }
    
    createUser(reqBody: {}) {
        throw new Error("Method not implemented.");
    }

    updateUser(id: number, cookie: any, req: any) {
        console.log(id, cookie, req);
        throw new Error("Method not implemented.");
    }
    
    deleteUser(id: number, reqBody: {}) {
        throw new Error("Method not implemented.");
    }
   
}
