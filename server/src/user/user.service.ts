import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, UnauthorizedException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';
import { QueryBuilder } from 'src/util/database/query-builder';
import { v4 as uuidv4 } from 'uuid';
import { FileHandler } from 'src/util/file-handler/file-handler';
import * as StaticConsts from 'src/util/static-consts';
import { OfferService } from 'src/offer/offer.service';
import { Request } from 'src/offer/request.model';

const axios = require('axios');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = require("../../database.json").google_client_id;
const google_oauth_client = new OAuth2Client(GOOGLE_CLIENT_ID);
const fileConfig = require('../../file-handler-config.json');
const moment = require('moment');

@Injectable()
export class UserService {
	constructor(
		@Inject(forwardRef(() => OfferService))
		private readonly offerService: OfferService
	) {}

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

		if (result.status_id != StaticConsts.userStates.SOFT_DELETED && result.status_id != StaticConsts.userStates.HARD_DELETED) {
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
				profile_picture: result.profile_picture ? fileConfig.user_image_base_url + result.profile_picture.split(".")[0] + `?refresh=${uuidv4()}` : "",
				status_id: result.status_id
			}

			// Add private parameters of user is authenticated
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
		} else {
			user = {
				user_id: result.user_id,
				first_name: "Deleted",
				last_name: "User",
				verified: false,
				place_id: 0,
				lessee_rating: 0,
				number_of_lessee_ratings: 0,
				lessor_rating: 0,
				number_of_lessor_ratings: 0,
				profile_picture: result.profile_picture ? fileConfig.user_image_base_url + result.profile_picture.split(".")[0] + `?refresh=${uuidv4()}` : "",
				status_id: result.status_id
			}
		}

		return user;
	}

	/**
	 * Creates a user
	 * @param user 
	 * @param method 
	 */
	public async createUser(user: User, method: string): Promise<{ user: User, session_id: string }> {
		if (!user) {
			throw new BadRequestException("No user information supplied");
		}
		// Validate User input:
		await this.validateRegistrationInput(user);

		if (!method || !StaticConsts.SIGN_IN_METHODS.includes(method)) {
			throw new BadRequestException("Invalid Sign Up Method");
		}

		// Assign user a new user ID
		user.user_id = uuidv4();

		// Hash password again
		const plainTextPwd: string = user.password_hash;
		user.password_hash = bcrypt.hashSync(user.password_hash, StaticConsts.HASH_SALT_ROUNDS);

		// Create User
		await Connector.executeQuery(QueryBuilder.createUser(user, method));

		// Create Session for User and return user + new session
		return await this.validateUser({
			login: {
				email: user.email,
				password_hash: plainTextPwd
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
		if (password && (!password.new_password_hash || !password.old_password_hash || !bcrypt.compareSync(password.old_password_hash, validatedUser.user.password_hash))) {
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

		// Hash password if new password given
		let plainTextPwd: string
		if (password && password.new_password_hash) {
			plainTextPwd = password.new_password_hash;
			password.new_password_hash = bcrypt.hashSync(password.new_password_hash, StaticConsts.HASH_SALT_ROUNDS);
		}

		// Update User information
		await Connector.executeQuery(QueryBuilder.updateUser(user, password && password.new_password_hash ? password.new_password_hash : null));


		return await this.validateUser({
			session: auth.session
		});
	}

	/**
	 * Sets the deleted flag for a user and deletes active sessions as well as active requests (not yet), wouldn't recommend using this tho
	 * @param user_id user_id of user to be deleted
	 * @param auth session_id and user_id of user to be deleted
	 */
	public async softDeleteUser(
		user_id: string,
		auth: {
			session: {
				user_id: string,
				session_id: string
			}
		}
	): Promise<void> {
		// Check parameter
		if (!user_id || !auth || !auth.session.user_id || !auth.session.session_id) {
			throw new BadRequestException("Insufficient Parameter");
		}

		// Validate user wow
		const validatedUser = await this.validateUser(auth);
		if (validatedUser.user.user_id != user_id) {
			throw new UnauthorizedException("Not authorized")
		}

		// Check if user can even be deleted (cant be deleted when user has open requests etc...)
		let openLessorRequests: Request[] = await this.offerService.getRequests({
			session: auth.session,
			lessor: true
		}) as Request[];

		let openLesseeRequests: Request[] = await this.offerService.getRequests({
			session: auth.session,
			lessor: false
		}) as Request[];
		
		let allRequests: Request[] = [...openLessorRequests, ...openLesseeRequests];

		// Cancel deletion process, if user has open requests
		allRequests.forEach(a => {
			if(a.status_id == StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR || a.status_id == StaticConsts.REQUEST_STATUS_ITEM_LEND_TO_LESSEE)
				throw new ConflictException("Open Requests must be closed before deleting user");
		});

		// Delete user's offer
		let offer = await this.offerService.getOffersByUserId(auth.session.user_id);
		offer.forEach(async o => {
			await this.offerService.deleteOffer(o.offer_id, { session: auth.session });
		});

		// Delete user's profile Picture
		FileHandler.deleteImage(validatedUser.user.profile_picture);

		// Set user Status to "soft_deleted" and set users deletion_date (today + 1 week)
		await Connector.executeQuery(QueryBuilder.setUserDeletionDate(auth.session.user_id));
		await Connector.executeQuery(QueryBuilder.transferUserInfo(auth.session.user_id));
		await Connector.executeQuery(QueryBuilder.softDeleteUser(auth.session.user_id));
	}

	// /**
	//  * Function used for hard deleting a user, after the one week period after soft deleting expired
	//  */
	// public async hardDeleteUser() { 
	// 	await Connector.executeQuery(QueryBuilder.cron_hardDeleteUser());
	// }

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
			},
			oauth?: {
				email: string,
				method: string
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

			let result = (await Connector.executeQuery(QueryBuilder.getUser({ email: auth.login.email })))[0];

			if (result && result.user_id) {
				user = await this.getUser(result.user_id, true);
			} else {
				throw new UnauthorizedException("Email and Password don't match");
			}

			if (!bcrypt.compareSync(auth.login.password_hash, result.password_hash)) {
				throw new UnauthorizedException("Email and Password don't match");
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

		} else if (auth.oauth && auth.oauth.email && auth.oauth.method) {
			// Authenticate using oauth flow (Email and method)
			let result = (await Connector.executeQuery(QueryBuilder.getUser({ oauth: auth.oauth })))[0];

			if (!result || !result.user_id) {
				throw new NotFoundException("No user with that sign in info and oauth method");
			} else {
				user = await this.getUser(result.user_id, true);
			}

			// ,, any old sessions
			await Connector.executeQuery(QueryBuilder.deleteOldSessions(user.user_id));

			// Set Session
			session_id = uuidv4();
			await Connector.executeQuery(QueryBuilder.createSession(session_id, user.user_id));

		} else {
			throw new BadRequestException("Invalid auth parameters 2");
		}

		if(user.status_id == StaticConsts.userStates.SOFT_DELETED || user.status_id == StaticConsts.userStates.HARD_DELETED) {
			throw new NotFoundException("User deleted")
		}

		return {
			user: user,
			session_id: session_id
		}
	}

	// private async getOauthUser(email: string, method: string): Promise<{
	// 	user: User,
	// 	session_id: string
	// }> {
	// 	return null;
	// }

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

		user.lessee_rating = 0
		user.number_of_lessee_ratings = 0
		user.lessor_rating = 0
		user.number_of_lessor_ratings = 0

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
		if (!user.first_name || !user.last_name || !user.password_hash) {
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
		if (!(!query.rating_type || (query.rating_type && StaticConsts.RATING_TYPES.includes(query.rating_type)))) {
			throw new BadRequestException("Invalid rating_type parameter in request");
		}

		// Check if rating parameter is valid (if given)
		if (!(!query.rating || isNaN(query.rating) || (query.rating <= 5 && query.rating >= 1))) {
			throw new BadRequestException("Invalid rating parameter in request");
		}

		// Check if user exists
		let user: User = await this.getUser(user_id);
		if (!user) {
			throw new NotFoundException("User not found")
		}

		// Check paging
		let numberOfRatings: number;
		if (query.rating_type) {
			// If rating_type = "lessor"
			if (query.rating_type === StaticConsts.RATING_TYPES[0]) {
				numberOfRatings = user.number_of_lessor_ratings;
			} else {
				numberOfRatings = user.number_of_lessee_ratings;
			}
		} else {
			numberOfRatings = user.number_of_lessor_ratings + user.number_of_lessee_ratings;
		}

		let page: number;
		if (!query.page || isNaN(query.page)) {
			page = 1;
		} else {
			if (query.page > Math.ceil(numberOfRatings / StaticConsts.DEFAULT_PAGE_SIZE)) {
				throw new BadRequestException("Ran our of pages...");
			} else {
				page = query.page;
			}
		}

		return await Connector.executeQuery(QueryBuilder.getUserRatings(user_id, query.rating_type, query.rating, StaticConsts.DEFAULT_PAGE_SIZE, page));
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
		if (!rating
			|| !rating.user_id
			|| !rating.rating_type
			|| !rating.rating
			|| rating.rating > 5
			|| rating.rating < 1
			|| !StaticConsts.RATING_TYPES.includes(rating.rating_type)) {
			throw new BadRequestException("Invalid rating arguments");
		}
		
		// Headline and text logic
		if((rating.headline == null || rating.headline == undefined)
			|| (rating.text == null || rating.text == undefined)
			|| (rating.text.length > 0 && rating.headline.length < 1)) {
				throw new BadRequestException("Invalid rating arguments");
		}

			
		// Check if user to be rated exists
		const ratedUser = (await Connector.executeQuery(QueryBuilder.getUser({ user_id: rating.user_id })))[0];
		if (!ratedUser) {
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
		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (!user.profile_picture) {
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
		if (!session_id
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

		if (user_id != user_id || validatedUser.user.user_id != user_id) {
			throw new UnauthorizedException("Unauthorized");
		}

		// Upload file
		const fileName = (await FileHandler.saveImage(image, user_id)).split("/").slice(-1)[0];

		// Update User with new path
		await Connector.executeQuery(QueryBuilder.changeProfilePicture(user_id, fileName));

		return await this.getUser(user_id, true);
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
		await Connector.executeQuery(QueryBuilder.setNewUserRating(lessor_info.rated_user_id, lessor_info.average, lessor_info.rating_count, lessee_info.average, lessee_info.rating_count));
	}


	// Handle third party sign ins

	/**
	 * Sign in with google
	 * @param auth object containing JWT token
	 */
	public async handleGoogleSignIn(
		auth: {
			token: string
		}
	): Promise<{
		user: User,
		session_id: string
	}> {
		const token_obj = {
			idToken: auth.token,
			audience: GOOGLE_CLIENT_ID
		}
		try {
			const ticket = (await google_oauth_client.verifyIdToken(token_obj)).getPayload();
			return await this.validateUser({
				oauth: {
					email: ticket.email,
					method: "google"
				}
			})
		} catch (e) {
			throw new InternalServerErrorException("Google Sign In failed");
		}
	}

	/**
	 * Handle Sign in for oauth Apple user
	 */
	public async handleAppleSignIn(): Promise<{
		user: User,
		session_id: string
	}> {
		throw new Error("Apple Sign In not implemented");
	}


	/**
	 * Handle Sign in for oauth Facebook user
	 */
	public async handleFacebookSignIn(
		auth: {
			token: string
		}
	): Promise<{
		user: User,
		session_id: string
	}> {
		if (!auth || !auth.token) {
			throw new BadRequestException("Invalid auth details (token)");
		}

		// User token to get Information from facebook API
		let fb_response: any;
		try {
			fb_response = await axios.get(StaticConsts.FB_API_URL + auth.token);
		} catch (e) {
			if (e.request.res.statusCode === 400) {
				throw new BadRequestException("Invalid Facebook access token");
			} else {
				throw new InternalServerErrorException("Something went wrong...")
			}
		}

		if (!fb_response.data.email) {
			throw new BadRequestException("Service can't handle facebook logins without an email");
		}

		// Return user
		return await this.validateUser({
			oauth: {
				email: fb_response.data.email,
				method: "facebook"
			}
		});
	}
}