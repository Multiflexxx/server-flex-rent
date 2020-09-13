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
    createUser(
        @Body('user') user: any,
    ) {
        return this.userService.createUser(user);
    }

    /**
     * Updates a specified user with the data passed in the request's body.
     * @param id ID of user to be updated
     * @param reqBody Parameters-Value pairs to be updated, also contains authorization
     */
    @Patch(':id')
    updateUser(
        @Param('id') id: number,
        @Body() reqBody: {},
        @Req() req: any
    ) {
        return this.userService.updateUser(id, req.cookies['session_id'], reqBody);
    }

    /**
     * Deletes user given a ID and sufficient authorization
     * @param id 
     * @param reqBody 
     */
    @Delete(':id')
    deleteUser(
        @Param('id') id: number,
        @Body() reqBody: {}
    ) {
        return this.userService.deleteUser(id, reqBody);
    }

    @Post(':id')
    async authenticateUser(
        @Body('authorization') auth: {
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
