import { Controller, Get, Param, Put, Body, Patch, Delete, Req, Post, Res, Query, UseInterceptors, UploadedFile, Response } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.model';
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
     * Request a password reset for a user by email
     * Sends out a 6 characters alphanumeric code to the user's email (if user exists)
     * @param email Email of the user
     */
    @Post('password-reset/request')
    async requestPasswordReset(
        @Body('email') email: string
    ): Promise<void> {
        await this.userService.requestPasswordReset(email);
    }

    /**
     * Checks if the reset code is valid and provides a token that authorized a password reset once
     * @param email Email of the user
     * @param reset_code 6 characters alphanumeric code
     */
    @Post('password-reset/verify-code')
    async verifyPasswordResetToken(
        @Body('email') email: string,
        @Body('reset_code') reset_code: string 
    ) {
        return await this.userService.verifyPasswordResetCode(email, reset_code); 
    }

    /**
     * Resets a user's email given their email, a new password and a valid reset token
     * @param email the user's email
     * @param token reset token (uuid v4)
     * @param new_password new Password
     */
    @Post('password-reset/reset')
    async resetPassword(
        @Body('email') email: string,
        @Body('token') token: string,
        @Body('new_password') new_password: string
    ) {
        return await this.userService.resetPassword(email, token, new_password);
    }

    /**
     * Sets a user's email to validated if provided a valid token / user combination
     * /user/validate-email/<user_id>?token=<token-uuidv4>
     * @param token validation token (uuid v4)
     * @param query 
     */
    @Get('validate-email/:user_id')
    async validateEmail(
        @Param('user_id') user_id: string,
        @Query() query
    ) {
        await this.userService.validateEmail(user_id, query.token);
    }

    @Get('validate-phone/:token')
    async validatePhone(
        @Param('token') token: string,
        @Query() query
    ) {
        await this.userService.validatePhone(query.user_id, token);
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
