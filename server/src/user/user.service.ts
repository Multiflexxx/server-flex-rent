import { Injectable } from '@nestjs/common';

export type User = any;
@Injectable()
export class UserService {

    /** 
     * For testing only
     */
    private readonly users: User[];

    constructor() {
      this.users = [
        {
          userId: 1,
          username: 'john',
          password: 'changeme',
        },
        {
          userId: 2,
          username: 'chris',
          password: 'secret',
        },
        {
          userId: 3,
          username: 'maria',
          password: 'guess',
        },
      ];
    }

    async getUser(id: number) {
        return this.users.find(user => user.userId === id);
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
