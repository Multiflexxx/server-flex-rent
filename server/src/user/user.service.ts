import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
    getUser(id: number) {
        return new Error("Method not implemented");
    }
    
    createUser(reqBody: {}) {
        throw new Error("Method not implemented.");
    }

    updateUser(id: number, reqBody: {}) {
        throw new Error("Method not implemented.");
    }
    
    deleteUser(id: number, reqBody: {}) {
        throw new Error("Method not implemented.");
    }
   
}
