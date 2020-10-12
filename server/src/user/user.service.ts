import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Put, Patch, Inject, forwardRef, UnauthorizedException, Query } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';
import { QueryBuilder } from 'src/util/database/query-builder';
import { v4 as uuidv4 } from 'uuid';
import { stringify } from 'querystring';
import { FileHandler } from 'src/util/file-handler/file-handler';

const fileConfig = require('../../file-handler-config.json');
const moment = require('moment');
const rating_types: string[] = [
	"lessor",
	"lessee"
];
const default_page_size: number = 10;

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
			profile_picture: result.profile_picture ? fileConfig.user_image_base_url + result.profile_picture.split(".")[0] : ""
		}

		if (isAuthenticated) {
			user.email = result.email;
			user.phone_number = result.phone_number;
			user.street = result.street;
			user.house_number = result.house_number;
			user.date_of_birth = result.date_of_birth;
			user.password_hash = result.password_hash;

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
	 * Updates an user given sufficient auth 
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
	): Promise<{
		user: User;
		session_id: string;
	}> {
		// Authenticate request
		if (!(auth && auth.session.session_id && auth.session.user_id && user)) {
			throw new BadRequestException("Insufficient Arguments");
		}

		const validatedUser = await this.validateUser(auth);

		if (!(validatedUser && validatedUser.user.user_id === auth.session.user_id)) {
			throw new UnauthorizedException("Invalid Session");
		}

		// Check old password
		if(password && (!password.new_password_hash || !password.old_password_hash || password.old_password_hash != validatedUser.user.password_hash)) {
			throw new UnauthorizedException("Incorrect Password");
		}

		// Validate new Email
		if (!EmailValidator.validate(user.email)) {
			throw new BadRequestException("Invalid Email");
		}

		// Check if Email is already registered
		let result = (await Connector.executeQuery(QueryBuilder.getUser({ email: user.email })))[0];
		if (result && result.user_id != user.user_id) {
			throw new BadRequestException("Email address already registered");
		}


		// Check if phone is already registered
		result = (await Connector.executeQuery(QueryBuilder.getUser({ phone: user.phone_number })))[0];
		if (result && result.user_id != user.user_id) {
			throw new BadRequestException("Phone number address already registered");
		}

		// Get new place_id
		const newPlace = (await Connector.executeQuery(QueryBuilder.getPlace({ post_code: user.post_code })))[0];
		if (!newPlace) {
			throw new BadRequestException("Invalid post Code");
		}
		user.city = newPlace.name;
		user.place_id = newPlace.place_id

		// Update User information
		await Connector.executeQuery(QueryBuilder.updateUser(user, password ? password.new_password_hash : null));

		let passwordHash: string;
		if(password && password.new_password_hash) {
			passwordHash = password.new_password_hash;
		} else {
			passwordHash = validatedUser.user.password_hash;
		}
		
		return await this.validateUser({
			login: {
				email: user.email,
				password_hash: passwordHash
			}
		});
	}

	public deleteUser(
		user_id: string,
		auth: {
			session_id: string
		}
	): Promise<{}> {
		// How do we delete users?
		throw new Error("Method not implemented. (And will never be implemented)");
	}

	/**
	 * Returns a complete user object and session_id given proper auth details
	 * @param auth 
	 */
	public async validateUser(
		auth: {
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

		if (!auth) {
			throw new BadRequestException("Invalid auth parameters");
		}

		let user: User;
		let session_id: string;

		// Decide whether to use login or session data
		if (auth.login && auth.login.email && auth.login.password_hash) {
			// Authenticate using login data
			let result = (await Connector.executeQuery(QueryBuilder.getUser({
				login: {
					email: auth.login.email,
					password_hash: auth.login.password_hash
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

		} else if (auth.session && auth.session.session_id && auth.session.user_id && true) {
			// Authenticate using session data 
			let result = (await Connector.executeQuery(QueryBuilder.getSession(auth.session.session_id)))[0];

			if (!(result && result.user_id === auth.session.user_id)) {
				throw new UnauthorizedException("Invalid session.");
			}

			user = await this.getUser(result.user_id, true);

		} else {
			throw new BadRequestException("Invalid auth parameters 2");
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

		// Check if the other fields are filled
		if(!user.first_name || !user.last_name || !user.password_hash) {
			throw new BadRequestException("Missing arguments");
		}
	}

	/**
	 * Returns a list of user ratings
	 * @param user_id
	 * @param query object (optionally) containing a rating_type and a rating 
	 */
	public async getUserRatings(user_id: string, query: any): Promise<any> {
		/* Possible query params:
			type = "lessee" / "lessor"
			rating = 1...5
		*/
		// Check if rating_type parameter is valid (if given)
		if(!(!query.rating_type || (query.rating_type && rating_types.includes(query.rating_type)))) {
			throw new BadRequestException("Invalid rating_type parameter in request");
		}

		// Check if rating parameter is valid (if given)
		if(!(!query.rating || (query.rating <= 5 && query.rating >= 1))) {
			throw new BadRequestException("Invalid rating parameter in request");
		}

		// Check if user exists
		let user: User = await this.getUser(user_id); 
		if(!user) {
			throw new NotFoundException("User not found")
		}

		// Check paging
		let numberOfRatings: number;
		if(query.rating_type) {
			// If rating_type = "lessor"
			if(query.rating_type === rating_types[0]) {
				numberOfRatings = user.number_of_lessor_ratings;
			} else {
				numberOfRatings = user.number_of_lessee_ratings;
			}
		} else {
			numberOfRatings = user.number_of_lessor_ratings + user.number_of_lessee_ratings;
		}

		let page: number;
		if(!query.page) {
			page = 1;
		} else {
			if(query.page > Math.ceil(numberOfRatings / default_page_size)) {
				throw new BadRequestException("Ran our of pages...");
			} else {
				page = query.page;
			}
		}

		return await Connector.executeQuery(QueryBuilder.getUserRatings(user_id, query.rating_type, query.rating, default_page_size, page));
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
			throw new BadRequestException("Insufficient arguments");
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

	/**
	 * Returns the local storage path of a requested user's profile picture
	 * @param user_id 
	 */
	public async getProfilePicture(user_id: string): Promise<string> {
		const user = (await Connector.executeQuery(QueryBuilder.getUser({ user_id: user_id })))[0]
		if(!user) {
			throw new NotFoundException("User not found");
		}

		if(!user.profile_picture) {
			throw new NotFoundException("No Profile picture")
		}

		// response.sendFile(fileConfig.file_storage_path + user.profile_picture);
		return fileConfig.file_storage_path + user.profile_picture;
	}
	
	/**
	 * Uploads a given image to the server and sets its path as the profile_picture attribute of a user
	 * @param user_id 
	 * @param auth 
	 * @param image 
	 */
	public async uploadProfilePicture(
		user_id: string, 
		session_id: string,
		image: {
			fieldname: string,
			originalname: string,
			encoding: string,
			mimetype: string,
			buffer: Buffer,
			size: number
		}
	): Promise<User> {
		// Check auth
		if(!session_id 
			|| !user_id 
			|| !image
			|| !image.fieldname
			|| !image.originalname
			|| !image.encoding
			|| !image.mimetype
			|| !image.buffer
			|| !image.size) {
			throw new BadRequestException("Insufficient arguments");
		}

		const validatedUser = await this.validateUser({
			session: {
				user_id: user_id, 
				session_id: session_id
			}
		});
		
		if(user_id != user_id || validatedUser.user.user_id != user_id) {
			throw new UnauthorizedException("Unauthorized");
		}

		// Upload file
		const fileName = (await FileHandler.saveImage(image, user_id)).split("/").slice(-1)[0];

		// Update User with new path
		await Connector.executeQuery(QueryBuilder.changeProfilePicture(user_id, fileName));

		return await this.getUser(user_id);
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
		await Connector.executeQuery(QueryBuilder.setNewUserRating(lessor_info.rated_user_id, lessor_info.average, lessor_info.rating_count, lessee_info.average , lessee_info.rating_count));
	}
}