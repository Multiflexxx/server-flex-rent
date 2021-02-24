import { Controller, Get, Param, Put, Body, Patch, Delete, Req, Post, Res, Query, UseInterceptors, UploadedFile, Response } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.model';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRating } from './user-rating.model';
import { RATING_MAX_FOR_OFFERS } from 'src/util/static-consts';
import { UserSession } from './user-session.model';
import { TrustedDevice } from './trusted-device.model';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
    ) {}




    /**
     * Deletes user given a ID and sufficient authorization (Don't recommend using it tho)
     * @param id 
     * @param reqBody 
     */
    @Patch('delete/:id')
    async deleteUser(
        @Param('id') id: string,
        @Body('auth') auth: {
			session: UserSession
		},
        @Res() response
    ) {
        await this.userService.softDeleteUser(id, auth);
        response.sendStatus(200);
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
    @Post('google')
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
    @Post('apple')
    async authenticateUserWithApple(): Promise<{
        user: User,
        session_id: string
    }> {
        return this.userService.handleAppleSignIn();
    }

    /**
     * Authenticate user with facebook credentials
     */
    @Post('facebook')
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
			session: UserSession
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

    
    @Patch('/rating-delete/:id')
    async deleteUserRating(
        @Body('auth') auth: {
			session: UserSession
		},
        @Param('id') rating_id?: string
    ): Promise<UserRating> {
        return await this.userService.deleteUserRating(auth, rating_id);
    }

    /**
     * Updates a user rating
     * @param auth auth object (session)
     * @param rating parameters for the rating object
     * @param rating_id rating to be updated
     */
    @Patch('/rating/:id')
    async updateUserRating(
        @Body('auth') auth: {
			session: UserSession
		},
        @Body('rating') rating: {
            user_id: string,
            rating_type: string,
            rating: number,
            headline: string,
            text: string
        },
        @Param('id') rating_id: string 
    ): Promise<UserRating> {
        return await this.userService.updateUserRatingById(auth, rating, rating_id);
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


    /**
     * Entry point to register 2FA for a users account. Returns an URL that can be scanned by Google Authenticator.
     * @param user_id User initiating the request
     * @param auth authentication object (session)
     * @param trusted_device Option to add a trusted device
     */
    @Post('tfa/register/:id')
    async register2FA(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            session: UserSession
        },
        @Body('trusted_device') trusted_device?: {
			device_name: string
		}
    ) {
        return await this.userService.register2Fa(user_id, auth, trusted_device);
    }

    /**
     * Takes in a login attempt and a 2FA token. Validates the token, if token is valid, returns a user and session
     * @param user_id 
     * @param auth authentication object (login)
     * @param token 2FA token (6 digits)
     */
    @Post('tfa/validate-token/:id')
    async check2FaToken(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            login: {
				email: string,
				password_hash: string
			}
        },
        @Body('token') token: string
    ): Promise<{
        user: User,
		session_id: string
    }> {
        return await this.userService.check2FaToken(user_id, auth, token);
    }


    /**
     * Registers a trusted device for a user, so 2FA won't be required for every login
     * @param user_id id of the user
     * @param device_name Device name, if none is passed is set to "2FA Device #12AB"
     * @param auth authentication object (session)
     */
    @Post('tfa/trusted-device/register/:id')
    async registerTrustedDevice(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            session: UserSession
        },
        @Body('device_name') device_name?: string,
    ): Promise<TrustedDevice> {
        return await this.userService.registerTrustedDevice(user_id, auth, device_name)
    }

    /**
     * Removes a trusted device from the user's trusted device list
     * @param user_id id of the user
     * @param auth authentication object (session)
     * @param device_id id of the device to be removed
     */
    @Post('tfa/trusted-device/remove/:id')
    async removeTrustedDevice(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            session: UserSession
        },
        @Body('device_id') device_id: string
    ): Promise<TrustedDevice> {
        return await this.userService.removeTrustedDevice(user_id, auth, device_id);
    }


    /**
     * Returns all registered trusted devices for a user
     * @param user_id Id of the user
     * @param auth authentication object (session)
     */
    @Post('tfa/trusted-device/all/:id')
    async getAllTrustedDevices(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            session: UserSession
        }
    ): Promise<TrustedDevice[]> {
        return await this.userService.getAllTrustedDevicesForUser(user_id, auth);
    }


    /**
     * Returns a registered trusted device by id
     * @param user_id Id of the user
     * @param auth authentication object (session)
     * @param device_id Id of the registered device
     */
    @Post('tfa/trusted-device/:id')
    async getTrustedDeviceByDeviceId(
        @Param('id') user_id: string,
        @Body('auth') auth: {
            session: UserSession
        },
        @Body('device_id') device_id: string
    ): Promise<TrustedDevice> {
        return await this.userService.getTrustedDevice(user_id, auth, device_id);
    }


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
			session: UserSession
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
            session?: UserSession
        }
    ): Promise<{
        user: User,
        session_id: string
    }> {
        return await this.userService.validateUser(auth);
    }


    // @Post('test2/:id')
    // async test2Function(
    //     @Param('id') user_id: string,
    //     @Body('token') token: string
    // ) {
    //     // return await this.userService.check2faToken(user_id, token);
    // }

    // @Post('test/:id')
    // async testFunction(
    //     @Param('id') user_id,
    //     @Body('auth') auth: {
	// 		session: UserSession
	// 	},
    //     @Body('trusted_device') trusted_device?: {
    //         device_name: string
    //     }
    // ) {
    //     return await this.userService.register2Fa(user_id, auth, trusted_device);
    // }
}
