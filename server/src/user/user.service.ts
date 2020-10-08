import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Put, Patch, Inject, forwardRef, UnauthorizedException, Query } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';
import { QueryBuilder } from 'src/util/database/query-builder';
import { v4 as uuidv4 } from 'uuid';
import { stringify } from 'querystring';
const moment = require('moment');
const rating_types: string[] = [
	"lessor",
	"lessee"
];

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
			verified: (result.verified === 1 ? true : false),
			place_id: result.place_id,
			lessee_rating: result.lessee_rating,
			number_of_lessee_ratings: result.number_of_lessee_ratings,
			lessor_rating: result.lessor_rating,
			number_of_lessor_ratings: result.number_of_lessor_ratings,
			profile_picture: result.profile_picture
		}

		if (isAuthenticated) {
			user.email = result.email;
			user.phone_number = result.phone_number;
			user.street = result.street;
			user.house_number = result.house_number;
			user.date_of_birth = result.date_of_birth;

			// Get post code and city name by place_id
			result = (await Connector.executeQuery(QueryBuilder.getPlace({ place_id: user.place_id })))[0];

			if (!result) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			user.post_code = result.post_code;
			user.city = result.name;
		}

		return user;
	}

	public async createUser(user: User): Promise<{ user: User, session_id: string }> {
		if (!user) {
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

	/**
	 * Updates an user given sufficient authorization 
	 * @param auth 
	 * @param user 
	 */
	public async updateUser(
		auth: {
			session: {
				session_id: string,
				user_id: string
			}
		},
		user: User,
		password?: {
			old_password_hash: string,
			new_password_hash: string
		}
	): Promise<User> {
		// Authenticate request
		if (!(auth && auth.session.session_id && auth.session.user_id && user)) {
			throw new BadRequestException("Insufficient Arguments");
		}

		const validatedUser = await this.validateUser(auth);

		if (!(validatedUser && validatedUser.user.user_id === auth.session.user_id)) {
			throw new UnauthorizedException("Invalid Session");
		}

		// Check old password
		if (validatedUser.user.password_hash != password.old_password_hash) {
			throw new UnauthorizedException("Incorrect Password");
		}

		// Validate new Email
		if (!EmailValidator.validate(user.email)) {
			throw new BadRequestException("Invalid Email");
		}

		// Check if Email is already registered
		let result = (await Connector.executeQuery(QueryBuilder.getUser({ email: user.email })))[0];
		if (result) {
			throw new BadRequestException("Email address already registered");
		}


		// Check if phone is already registered
		result = (await Connector.executeQuery(QueryBuilder.getUser({ phone: user.phone_number })))[0];
		if (result) {
			throw new BadRequestException("Phone number address already registered");
		}

		// Get new place_id
		const newPlace = (await Connector.executeQuery(QueryBuilder.getPlace({ post_code: user.post_code })))[0];
		if (!newPlace) {
			throw new BadRequestException("Invalid post Code");
		}
		user.city = newPlace.name;

		// Update User information
		await Connector.executeQuery(QueryBuilder.updateUser(user));

		return await Connector.executeQuery(QueryBuilder.getUser({ user_id: user.user_id }));
	}

	public async rateUser(
		auth: {
			session: {
				session_id: string,
				user_id: string
			}
		},
		rating: {
			user_id: string,
			rating_type: string,
			rating: number,
			headline: string,
			text: string
		}
	) {
		// Check auth input
		if (!auth || !auth.session || !auth.session.session_id || !auth.session.user_id) {
			throw new UnauthorizedException("Unauthorized");
		}


		// Check rating input
		if (!rating || !rating.user_id || !rating.rating_type || !rating.rating || !rating.headline || !rating.text || rating.rating > 5 || rating.rating < 1 || !rating_types.includes(rating.rating_type)) {
			throw new BadRequestException("Invalid rating arguments");
		}

		// Check if user to be rated exists
		const ratedUser = (await Connector.executeQuery(QueryBuilder.getUser({ user_id: rating.user_id })))[0];
		if(!ratedUser) {
			throw new BadRequestException("User does not exist.");
		}

		// Validate auth
		const validatedUser = await this.validateUser(auth);
		if (!validatedUser || validatedUser.user.user_id !== auth.session.user_id) {
			throw new UnauthorizedException("Invalid Session");
		}

		// Make sure user doesn't rate themselves
		if (auth.session.user_id === rating.user_id) {
			throw new BadRequestException("Users can't rate themselves");
		}

		// user#1 = user who rates
		// user#2 = user who is rated
		// Check if user#1 already rated user#2
		const userPairRating = (await Connector.executeQuery(QueryBuilder.getRating({
			user_pair: {
				rating_user_id: auth.session.user_id,
				rated_user_id: rating.user_id,
				rating_typ: rating.rating_type
			}
		})))[0];

		if (userPairRating) {
			throw new BadRequestException("Already rated user");
		}

		// User can be rated
		// Create new rating 
		await Connector.executeQuery(QueryBuilder.createUserRating(auth.session.user_id, rating));

		// and calculate new user rating
		this.updateUserRating(rating.user_id);

	}

	public deleteUser(
		user_id: string,
		auth: {
			session_id: string
		}
	): Promise<{}> {
		// How do we delete users?
		throw new Error("Method not implemented. (And will never be implemented");
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

		if (!authorization) {
			throw new BadRequestException("Invalid authorization parameters");
		}

		let user: User;
		let session_id: string;

		// Decide whether to use login or session data
		if (authorization.login && authorization.login.email && authorization.login.password_hash) {
			// Authenticate using login data
			let result = (await Connector.executeQuery(QueryBuilder.getUser({
				login: {
					email: authorization.login.email,
					password_hash: authorization.login.password_hash
				}
			})))[0];

			if (result && result.user_id) {
				user = await this.getUser(result.user_id, true);
			} else {
				throw new UnauthorizedException("Email and Password don't match.");
			}

			// Delete any old sessions
			await Connector.executeQuery(QueryBuilder.deleteOldSessions(user.user_id));

			// Set Session
			session_id = uuidv4();
			await Connector.executeQuery(QueryBuilder.createSession(session_id, user.user_id));

		} else if (authorization.session && authorization.session.session_id && authorization.session.user_id) {
			// Authenticate using session data 
			let result = (await Connector.executeQuery(QueryBuilder.getSession(authorization.session.session_id)))[0];

			if (!(result && result.user_id === authorization.session.user_id)) {
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
		let result = (await Connector.executeQuery(QueryBuilder.getUser({ email: user.email })))[0];
		if (result) {
			throw new BadRequestException("Email address already registered");
		}


		// Check if phone is already registered
		result = (await Connector.executeQuery(QueryBuilder.getUser({ phone: user.phone_number })))[0];
		if (result) {
			throw new BadRequestException("Phone number address already registered");
		}


		// Validate date of birth
		// Check if Birthdate is valid and in acceptable time range
		const presentDate = moment(); // Format:2020-03-24T14:30:42.836Z
		const date_of_birth = moment(user.date_of_birth); // Format: 2000-06-05T22:00:00.000Z
		// it is a date
		if (!(date_of_birth.isValid() && !date_of_birth.isAfter(presentDate))) {
			// date is not valid
			throw new BadRequestException("Invalid date of birth");
		}
		user.date_of_birth = new Date(date_of_birth.format("YYYY-MM-DD"));

		// Check region/place
		result = (await Connector.executeQuery(QueryBuilder.getPlace({ post_code: user.post_code })))[0];
		if (result) {
			user.city = result.name;
			user.place_id = result.place_id;
		} else {
			throw new BadRequestException("Invalid post code");
		}

	}

	/**
	 * async getUserRatings
	 */
	public async getUserRatings(user_id: string, query: any): Promise<any> {
		/* Possible query params:
			type = "lessee" / "lessor"
			rating = 1...5
		*/
		return await Connector.executeQuery(QueryBuilder.getUserRatings(user_id, query.rating_type, query.rating));
	}

	public async getProfilePicture(user_id: string, response: any) {
		const user = (await Connector.executeQuery(QueryBuilder.getUser({ user_id: user_id })))[0]
		if(!user) {
			throw new NotFoundException("User not found");
		}


    }

	/**
	 * Updates a user's rating and rating counts using ratings created for a user
	 * @param user_id ID of user to be updated
	 */
	private async updateUserRating(user_id: string): Promise<void> {
		// Calculate new user ratings
		const newUserRating = (await Connector.executeQuery(QueryBuilder.calculateUserRating(user_id)));
		const lessor_info = newUserRating.filter(x => x.rating_type == "lessor")[0];
		const lessee_info = newUserRating.filter(x => x.rating_type == "lessee")[0];

		// Update Rating for user
		await Connector.executeQuery(QueryBuilder.setNewUserRating(lessor_info.user_id, lessor_info.average, lessor_info.rating_count, lessee_info.average , lessee_info.rating_count));
	}
}

