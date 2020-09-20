import { Controller, Get, Param, Put, Body, Patch, Delete, Req, Post, Res } from '@nestjs/common';
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
            session: {
                session_id: string,
                user_id: string
            }
        },
        @Body('user') user: User,
        @Body('password') password?: {
            old_password_hash: string,
            new_password_hash: string,
        }
    ) {
        return await this.userService.updateUser(auth, user, password);
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

    /**
     * Used for logging in a user, either with a session or email + password
     * @param auth authentication details containing a user_id and session_id in the session object OR an email and password_hash as part of the login object
     */
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

    @Post('rate')
    async rateUser(
        @Body('auth') auth: {
            session: {
                session_id: string,
                user_id: string
            }
        },
        @Body('rating') rating: {
            user_id: string,
            rating_type: string,
            rating: number,
            headline: string,
            text: string
        },
        @Res() res: any
    ) {
        await this.userService.rateUser(auth, rating);
        res.status(201).send("Hello World")
    }
}
