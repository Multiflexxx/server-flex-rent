import { Controller, Get, Param, Put, Body, Patch, Delete, Req, Post, Res, Query, UseInterceptors, UploadedFile, Response } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.model';
import { response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRating } from './user-rating.model';

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
        @Body('sign_in_method') method: string
    ) {
        return await this.userService.createUser(user, method);
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
     * Deletes user given a ID and sufficient authorization (Don't recommend using it tho)
     * @param id 
     * @param reqBody 
     */
    @Patch('delete/:id')
    async deleteUser(
        @Param('id') id: string,
        @Body('auth') auth: {
            session: {
                session_id: string,
                user_id: string
            }
        },
        @Res() response
    ) {
        await this.userService.softDeleteUser(id, auth);
        response.sendStatus(200);
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


    /**
     * Authenticate user with google credentials
     * @param auth 
     */
    @Post('/google')
    async authenticateUserWithGoogle(
        @Body('auth') auth: {
            token: string
        }
    ): Promise<{
        user: User,
        session_id: string
    }> {
        return this.userService.handleGoogleSignIn(auth);
    }

    /**
     * Authenticate user with apple credentials
     */
    @Post('/apple')
    async authenticateUserWithApple(): Promise<{
        user: User,
        session_id: string
    }> {
        return this.userService.handleAppleSignIn();
    }

    /**
     * Authenticate user with facebook credentials
     */
    @Post('/facebook')
    async authenticateUserWithFacebook(
        @Body('auth') auth: {
            token: string
        }
    ): Promise<{
        user: User,
        session_id: string
    }> {
        return this.userService.handleFacebookSignIn(auth);
    }


    /**
     * Used for creating new user ratings
     * @param auth Auth details of the user rating someone
     * @param rating Ratings details
     * @param res 
     */
    @Post('rating')
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
        }
    ): Promise<UserRating> {
        return await this.userService.rateUser(auth, rating);
    }


    /**
     * Used for retrieving user ratings for a single user
     * @param user_id User_id of user
     * @param query Additional query params (rating_type (string), rating (numeric), page (numeric))
     */
    @Get('rating/:id')
    async getUserRatings(
        @Param('id') user_id,
        @Query() query,
    ): Promise<any> {
        return await this.userService.getUserRatings(user_id, query);
    }


    /**
     * Send the profile picture of a user as a response
     * @param user_id 
     * @param response 
     */
    @Get('images/:id')
    async getProfilePicture(
        @Param('id') user_id,
        @Res() response
    ): Promise<any> {
        response.sendFile(await this.userService.getProfilePicture(user_id));
    }


    /**
     * Used for uploading new profile pictures for a user
     * @param image 
     * @param user_id 
     * @param session_id 
     */
    @Post('images')
    @UseInterceptors(FileInterceptor('image'))
    async uploadProfilePicture(
        @UploadedFile() image: {
			fieldname: string,
			originalname: string,
			encoding: string,
			mimetype: string,
			buffer: Buffer,
			size: number
		},
        @Body('user_id') user_id: string,
        @Body('session_id') session_id: string
    ): Promise<any> {
        return await this.userService.uploadProfilePicture(user_id, session_id, image);
    }
}
