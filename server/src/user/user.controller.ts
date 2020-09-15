import { Controller, Get, Param, Put, Body, Patch, Delete, Req, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.model';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
        ) {}

    /**
     * Returns a single user specified by the ID passed in the URL
     * @param id ID of user
     */
    @Get(':id')
    async getUser(
        @Param('id') id: string
    ) {
        return await this.userService.getUser(id);
    }

    /**
     * Creates a user with the Specified parameters in the request's body
     * @param reqBody Parameters of user to be created
     */
    @Put()
    async createUser(
        @Body('user') user: any,
    ) {
        return await this.userService.createUser(user);
    }

    /**
     * Updates a specified user with the data passed in the request's body.
     * @param id ID of user to be updated
     * @param reqBody Parameters-Value pairs to be updated, also contains authorization
     */
    @Patch()
    async updateUser(
        @Body('auth') auth: {
            session_id: string,
            user_id: string
        },
        @Body('user') user: User
    ) {
        return await this.userService.updateUser(auth, user);
    }

    /**
     * Deletes user given a ID and sufficient authorization
     * @param id 
     * @param reqBody 
     */
    @Delete(':id')
    async deleteUser(
        @Param('id') id: string,
        @Body('auth') auth: {
            session_id: string
        }
    ) {
        return await this.userService.deleteUser(id, auth);
    }

    @Post()
    async authenticateUser(
        @Body('auth') auth: {
            login?: {
                email: string,
                password_hash: string
            },
            session?: {
                session_id: string,
                user_id: string
            }
        }
    ): Promise<{
        user: User,
        session_id: string
    }> {
        return await this.userService.validateUser(auth);
    }
}
