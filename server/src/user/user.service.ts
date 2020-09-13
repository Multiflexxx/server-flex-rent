import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Put, Patch, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';
import { QueryBuilder } from 'src/util/database/query-builder';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {

	/**
	 * Returns a User Object containing publicly visible user information
	 * @param id ID of user
	 */
	public async getUser(id: string, isAuthenticated?: boolean): Promise<User> {
		
		let user: User;

		let result = (await Connector.executeQuery(QueryBuilder.getUser({ user_id: id })))[0];
		if (!result) {
			throw new NotFoundException("User not found");
		}

		user = {
			user_id: result.user_id,
			first_name: result.first_name,
			last_name: result.last_name,
			verified: result.verified,
			place_id: result.place_id,
			lessee_rating: result.lessee_rating,
			number_of_lessee_ratings: result.number_of_lessee_ratings,
			lessor_rating: result.lessor_rating,
			number_of_lessor_ratings: result.number_of_lessor_ratings
		}

		if (isAuthenticated) {
			user.email = result.email;
			user.phone_number = result.phone_number;
			user.street = result.street;
			user.house_number = result.house_number;
			user.date_of_birth = result.date_of_birth;

			// Get post code and city name by place_id
			result = (await Connector.executeQuery(QueryBuilder.getPlace({ place_id: user.place_id })))[0];

			if(!result) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			user.post_code = result.post_code;
			user.city = result.name;
		}

		return user;
	}

	public async createUser(user: User): Promise<{user: User, session_id: string}> {
		if(!user) {
			throw new BadRequestException("No user information supplied")
		}
		// Validate User input:
		await this.validateRegistrationInput(user);

		// Assign user a new user ID
		user.user_id = uuidv4();

		// Create User
		await Connector.executeQuery(QueryBuilder.createUser(user));

		// Create Session for User and return user + new session
		return await this.validateUser({
			login: {
				email: user.email,
				password_hash: user.password_hash
			}
		});
	}

	public async updateUser(
		auth: {
			session_id: string,
			user_id: string
		}, 
		user: User
	): Promise<User> {
		// // Authenticate request
		// const validatedUser = await this.validateUser({
		// 	session: {
		// 		session_id: auth.session_id
		// 	}
		// }, id);

		// if(.user)
		// throw new Error("Method not implemented.");
		return null;
	}

	public deleteUser(
		user_id: string, 
		auth: { 
			session_id: string 
		}
	): Promise<{}> {
		// How do we delete users?
		throw new Error("Method not implemented.");
	}

	/**
     * Returns a complete user object and session_id given proper authorization details
     * @param authorization 
     */
    public async validateUser(
        authorization: {
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

		if(!authorization) {
			throw new BadRequestException("Invalid authorization parameters");
		}

        let user: User;
        let session_id: string;

        // Decide whether to use login or session data
        if(authorization.login) {
            // Authenticate using login data
            let result = (await Connector.executeQuery(QueryBuilder.getUser({
                login: {
                    email: authorization.login.email,
                    password_hash: authorization.login.password_hash
                }
            })))[0];

            if(result && result.user_id) {
				user = await this.getUser(result.user_id, true);
            } else {
                throw new UnauthorizedException("Email and Password don't match.");
			}
			
			// Delete any old sessions
			await Connector.executeQuery(QueryBuilder.deleteOldSessions(user.user_id));

            // Set Session
            session_id = uuidv4();
            await Connector.executeQuery(QueryBuilder.createSession(session_id, user.user_id));
            
        } else if(authorization.session) {
            // Authenticate using session data 
            let result = (await Connector.executeQuery(QueryBuilder.getSession(authorization.session.session_id)))[0];

            if(!(result && result.user_id === authorization.session.user_id)) {
                throw new UnauthorizedException("Invalid session.");
            }

            user = await this.getUser(result.user_id, true);

        } else {
            throw new BadRequestException("Invalid authorization parameters");
        }

        return {
            user: user,
            session_id: session_id
        }
    }

	/**
	 * Checks whether user input is valid for registration. Returns true if input is valid, otherwise false
	 * @param user Input to be checked, format should follow the {User} schema
	 */
	private async validateRegistrationInput(user: User): Promise<void> {
		// Validate Email format
		if (!user.email || !EmailValidator.validate(user.email)) {
			throw new BadRequestException("Invalid Email address");
		}

		// Check if Email is already registered
		try {
			let result = (await Connector.executeQuery(QueryBuilder.getUser({ email: user.email })))[0];
			if (result) {
				throw new BadRequestException("Email address already registered");
			}
		} catch (e) {
			if (e instanceof BadRequestException) {
				throw e;
			}
			throw new InternalServerErrorException("Something went wrong...")
		}

		// Check if phone is already registered
		try {
			let result = (await Connector.executeQuery(QueryBuilder.getUser({ phone: user.phone_number })))[0];
			if (result) {
				throw new BadRequestException("Phone number address already registered");
			}
		} catch (e) {
			if (e instanceof BadRequestException) {
				throw e;
			}
			throw new InternalServerErrorException("Something went wrong...")
		}

		// Validate date of birth
		// Check if Birthdate is valid and in acceptable time range
		const presentDate: Date = new Date(); // Format:2020-03-24T14:30:42.836Z
		const date_of_birth: Date = new Date(user.date_of_birth); // Format: 2000-06-05T22:00:00.000Z
		// it is a date
		if (isNaN(date_of_birth.getTime())) {
			// date is not valid
			throw new BadRequestException("Invalid date of birth");
		} else {
			// date is valid
			if (date_of_birth > presentDate) {
				throw new BadRequestException("Invalid date of birth");
			}
		}


		// Check region/place
		// TODO
		let result = (await Connector.executeQuery(QueryBuilder.getPlace({post_code: user.post_code})))[0];
		if(result) {
			user.city = result.name;
			user.place_id = result.place_id;
		} else {
			throw new BadRequestException("Invalid post code");
		}

	}
}
