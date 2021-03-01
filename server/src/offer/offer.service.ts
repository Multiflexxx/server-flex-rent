import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, UnauthorizedException, MethodNotAllowedException, NotImplementedException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import { FileHandler } from 'src/util/file-handler/file-handler'
import { Offer } from './offer.model';
import { Category } from './category.model';
import { uuid } from 'uuidv4';
import * as Moment from 'moment';
import { extendMoment } from 'moment-range';
const moment = extendMoment(Moment);
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/user.model';
import { Request } from './request.model';
import * as StaticConsts from 'src/util/static-consts';
import { OfferRating } from './offer-rating.model';
import { ChatMessage } from 'src/chat/chat-message.model';

const BASE_OFFER_LINK = require('../../file-handler-config.json').offer_image_base_url;

@Injectable()
export class OfferService {
	constructor(
		@Inject(forwardRef(() => UserService))
		private readonly userService: UserService
	) {}

	/**
	 * Returns five best offers, best lessors, and latest offers
	 * Results are filtered by given postcode (reqired)
	 * @param post_code required postcode of user who sends request
	 * @param distance distance from postcode of requester (default is 30km)
	 */
	public async getHomePageOffers(reqBody: {
		post_code?: string,
		distance?: number
	}): Promise<{
		best_offers: Array<Offer>,
		best_lessors: Array<Offer>,
		latest_offers: Array<Offer>
	}> {

		if (reqBody === undefined || reqBody === null || reqBody === '' || reqBody.post_code === undefined || reqBody.post_code === '') {
			throw new BadRequestException("Post code is required");
		}

		// Default distance is 30km
		let distance = StaticConsts.DEFAULT_SEARCH_DISTANCE_FOR_OFFERS;
		if (reqBody.distance) {
			if (isNaN(reqBody.distance)) {
				distance = parseInt(reqBody.distance.toString());
				if (isNaN(distance)) {
					throw new BadRequestException("Not a valid distance");
				}
			} else {
				distance = reqBody.distance;
			}
		}

		let placeId = 0;
		try {
			placeId = (await Connector.executeQuery(QueryBuilder.getPlace({ post_code: reqBody.post_code })))[0].place_id;
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		// Get a list with locations for distance
		let possibleOfferLocations: Array<{
			place_id_2: number
		}> = [];

		try {
			possibleOfferLocations = await Connector.executeQuery(QueryBuilder.getLocationIdsByDistance({
				place_id_1: placeId,
				distance: distance
			}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong");
		}

		// Build a string that contains all places in distance to searcher
		let possibleOfferLocationsString = "(";

		possibleOfferLocations.forEach(location => {
			possibleOfferLocationsString += `user.place_id = ${location.place_id_2} OR `

		});

		possibleOfferLocationsString += `user.place_id = ${placeId}) `

		let homePageOffers = {
			"best_offers": [],
			"best_lessors": [],
			"latest_offers": []
		};

		let dbOffers: Array<{
			offer_id: string,
			user_id: string,
			title: string,
			description: string,
			rating: number,
			price: number,
			category_id: number,
			category_name: string,
			picture_link: string,
			number_of_ratings: number
		}> = [];

		try {
			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({
				best_offers: true,
				place_ids: possibleOfferLocationsString
			}));
			homePageOffers.best_offers = await this.addDataToOffers(dbOffers);

			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({
				best_lessors: true,
				place_ids: possibleOfferLocationsString
			}));
			homePageOffers.best_lessors = await this.addDataToOffers(dbOffers);

			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({
				latest_offers: true,
				place_ids: possibleOfferLocationsString
			}));
			homePageOffers.latest_offers = await this.addDataToOffers(dbOffers);
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		return homePageOffers;
	}

	/**
	 * Returns an array of offer objects matching the given filter criteria
	 * @param query query wich is send to server
	 * If a parameter called 'limit' with a value greater 0 is provided,
	 * the limit is used for the return
	 * If a parameter called 'category' with a numeric value > 0 is provided,
	 * the result is filtered by category
	 * If a parameter called 'search' is provided with a non empty string,
	 * the result is filtered by the given search keyword
	 * If a parameter called 'lessor_name' is provided with a non empty string,
	 * the result is filtered by lessor's name
	 * If a parameter called 'price_below' with a numeric value > 0 is provided,
	 * the result contains offers below or equal to the given price
	 * If a parameter called 'rating_above' is provided with a numeric value > 0,
	 * the result is filtered by all offers with a rating above the given value
	 * @param post_code required postcode of user who sends request
	 * @param distance distance from postcode of requester (default is 30km)
	 */
	public async getAll(query: {
		post_code?: string,
		limit?: string,
		category?: string,
		search?: string,
		distance?: number,
		lessor_name?: string,
		price_below?: number,
		rating_above?: number
	}): Promise<Array<Offer>> {
		let limit: number = StaticConsts.DEFAULT_SEARCH_LIMIT_FOR_OFFERS; // Default limit
		let category: number = 0;
		let search: string = "";
		// Default distance is 30km
		let distance = StaticConsts.DEFAULT_SEARCH_DISTANCE_FOR_OFFERS;
		let lessorName: string = undefined;
		let priceBelow: number = undefined;
		let ratingAbove: number = undefined;

		if (query.post_code === undefined || query.post_code === null || query.post_code === '') {
			throw new BadRequestException("Post code is required");
		}

		let placeId = 0;
		try {
			placeId = (await Connector.executeQuery(QueryBuilder.getPlace({ post_code: query.post_code })))[0].place_id;
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (query.distance !== undefined && query.distance !== null) {
			if (isNaN(query.distance)) {
				distance = parseInt(query.distance.toString());
				if (isNaN(distance)) {
					throw new BadRequestException("Not a valid distance");
				}
			} else {
				distance = query.distance;
			}
		}

		// Get a list with locations for distance
		let possibleOfferLocations: Array<{
			place_id_2: number
		}> = [];

		try {
			possibleOfferLocations = await Connector.executeQuery(QueryBuilder.getLocationIdsByDistance({
				place_id_1: placeId,
				distance: distance
			}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong");
		}

		// Build a string that contains all places in distance to searcher
		let possibleOfferLocationsString = "(";

		possibleOfferLocations.forEach(location => {
			possibleOfferLocationsString += `user.place_id = ${location.place_id_2} OR `

		});

		possibleOfferLocationsString += `user.place_id = ${placeId}) `

		if (query.limit !== undefined && query.limit !== null) {
			// Update limit, if given
			limit = parseInt(query.limit);
			if (isNaN(limit)) {
				// Not a number
				throw new BadRequestException("Limit is not a valid number");
			}
		}
		if (query.category !== undefined && query.category !== null) {
			category = parseInt(query.category);
			if (isNaN(category)) {
				// Not a number
				throw new BadRequestException("Not a valid category");
			}

			// Check if category is valid
			let validCategory = await this.isValidCategoryId(category);
			if (!validCategory) {
				throw new BadRequestException("Not a valid category");
			}
		}
		if (query.search !== undefined && query.search !== null) {
			if (query.search === "") {
				throw new BadRequestException("Search string is invalid");
			} else {
				search = query.search;
			}
		}

		// Check if lessor is set and has valid data
		if (query.lessor_name !== undefined && query.lessor_name !== null) {
			if (query.lessor_name === "") {
				throw new BadRequestException("Lessor name is invalid");
			} else {
				lessorName = query.lessor_name;
			}
		}

		// Parse price to number
		if (query.price_below !== undefined && query.price_below !== null) {
			if (isNaN(query.price_below)) {
				priceBelow = parseInt(query.price_below.toString());
				if (isNaN(priceBelow)) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				priceBelow = query.price_below;
			}
		}

		if (priceBelow <= StaticConsts.CHECK_ZERO) {
			throw new BadRequestException("Not a valid price");
		}

		// Parse rating to number
		if (query.rating_above !== undefined && query.rating_above !== null) {
			if (isNaN(query.rating_above)) {
				ratingAbove = parseInt(query.rating_above.toString());
				if (isNaN(ratingAbove)) {
					throw new BadRequestException("Not a valid rating");
				}
			} else {
				ratingAbove = query.rating_above;
			}
		}

		if (ratingAbove < StaticConsts.RATING_MIN_FOR_OFFERS || ratingAbove > StaticConsts.RATING_MAX_FOR_OFFERS) {
			throw new BadRequestException("Not a valid rating");
		}

		let dbOffers: Array<{
			offer_id: string,
			user_id: string,
			title: string,
			description: string,
			rating: number,
			price: number,
			category_id: number,
			category_name: string,
			picture_link: string,
			number_of_ratings: number
		}> = [];

		try {
			dbOffers = await Connector.executeQuery(
				QueryBuilder.getOffer({
					query: {
						place_ids: possibleOfferLocationsString,
						distance: distance,
						limit: limit,
						category: category,
						search: search,
						price_below: priceBelow,
						rating_above: ratingAbove,
						lessor_name: lessorName
					}
				}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...")
		}

		return await this.addDataToOffers(dbOffers);
	}

	/**
	 * Returns all offers for a given user id
	 * @param id ID of the user
	 */
	public async getOffersByUserId(id: string): Promise<Array<Offer>> {
		if (id === undefined || id === null || id === "") {
			throw new BadRequestException("Invalid request");
		}
		let dbOffers: Array<{
			offer_id: string,
			user_id: string,
			title: string,
			description: string,
			rating: number,
			price: number,
			category_id: number,
			category_name: string,
			picture_link: string,
			number_of_ratings: number
		}> = [];

		try {
			dbOffers = await Connector.executeQuery(QueryBuilder.getOffer({ user_id: id }));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		// Outsourcing of code
		let offers = await this.addDataToOffers(dbOffers);
		// Method takes an array of offers an adds blocked dates
		// only needed for offerByID and getOffersByUserId
		offers = await this.addBlockedDatesToOffers(offers);

		return offers;
	}

	/**
	 * Returns an offer object containing the offer by ID.
	 * @param id ID of offer to be found
	 */
	public async getOfferById(id: string): Promise<Offer> {
		if (id === undefined || id === null) {
			throw new BadRequestException("No id provided");
		}

		let offers: Array<Offer> = [];

		let dbOffers: Array<{
			offer_id: string,
			user_id: string,
			title: string,
			description: string,
			rating: number,
			price: number,
			category_id: number,
			category_name: string,
			picture_link: string,
			number_of_ratings: number
		}> = [];

		try {
			dbOffers = await Connector.executeQuery(QueryBuilder.getOffer({ offer_id: id }));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (dbOffers.length > StaticConsts.CHECK_ZERO) {
			// Outsourcing of code
			offers = await this.addDataToOffers(dbOffers);

			// Method takes an array of offers an adds blocked dates
			// only needed for offerByID and getOffersByUserId
			offers = await this.addBlockedDatesToOffers(offers);

			return offers[0];
		} else {
			throw new NotFoundException("Offer not found");
		}
	}

	/**
	 * Returns top categories (Categories with most offers)
	 */
	public async getTopCategories(): Promise<Array<Category>> {
		let categoriesResponse: Array<{
			category_id: string,
			name: string,
			picture_link: string,
			offer_count: number
		}> = [];

		try {
			categoriesResponse = await Connector.executeQuery(QueryBuilder.getCategories({ top_categories: true }));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (categoriesResponse.length > StaticConsts.CHECK_ZERO) {
			// Delete temporary column offer_count from response
			categoriesResponse.forEach(category => {
				delete category.offer_count
			});

			return categoriesResponse;
		} else {
			throw new InternalServerErrorException("Could not get categories");
		}
	}

	/**
	 * Returns all categories from database
	 */
	public async getAllCategories(): Promise<Array<Category>> {
		let categories: Array<Category> = [];

		try {
			categories = await Connector.executeQuery(QueryBuilder.getCategories({}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (categories.length > StaticConsts.CHECK_ZERO) {
			return categories;
		} else {
			throw new InternalServerErrorException("Could not get categories");
		}
	}

	/**
	 * Method creates an offer in the system
	 * Returns an offer Object if an offer is created successfully
	 * @param reqBody Data which is needed to create an offer
	 */
	public async createOffer(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		offer?: {
			title?: string,
			description?: string,
			price?: number,
			category: {
				category_id?: number
			},
			blocked_dates?: Array<{
				from_date: Date,
				to_date: Date
			}>
		}
	}): Promise<Offer> {
		if (reqBody !== undefined && reqBody !== null) {
			if (!reqBody.session || !reqBody.offer) {
				throw new BadRequestException("Not a valid request");
			}

			let categoryId = 0;
			let price = 0;

			// Validate session and user
			let user = await this.userService.validateUser({
				session: {
					session_id: reqBody.session.session_id,
					user_id: reqBody.session.user_id
				}
			});

			if (user === undefined || user === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// Convert category_id to number if not a number
			if (isNaN(reqBody.offer.category.category_id)) {
				categoryId = parseInt(reqBody.offer.category.category_id.toString());
				if (isNaN(categoryId)) {
					throw new BadRequestException("Not a valid category");
				}
			} else {
				categoryId = reqBody.offer.category.category_id;
			}

			// Check if category is valid
			let validCategory = await this.isValidCategoryId(categoryId);
			if (!validCategory) {
				throw new BadRequestException("Not a valid category");
			}

			// convert price to number if not a number
			// and check if price is greater 0
			if (isNaN(reqBody.offer.price)) {
				price = parseFloat(reqBody.offer.price.toString());
				if (isNaN(price) || price <= StaticConsts.CHECK_ZERO) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.offer.price <= StaticConsts.CHECK_ZERO) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.offer.price;
				}
			}

			if (price <= StaticConsts.CHECK_ZERO) {
				throw new BadRequestException("Not a valid price");
			}

			// Check if title is empty
			if (reqBody.offer.title === undefined
				|| reqBody.offer.title === null
				|| reqBody.offer.title === "") {
				throw new BadRequestException("Title is required");
			}

			// Check if title is too long
			if (reqBody.offer.title.length > StaticConsts.OFFER_TITLE_MAX_LENGTH) {
				throw new BadRequestException("Title too long");
			}

			// check if description is empty
			if (reqBody.offer.description === undefined
				|| reqBody.offer.description === null
				|| reqBody.offer.description === "") {
				throw new BadRequestException("Description is required");
			}

			let offerId: string;
			let isValid: boolean = true;

			// check if offer_id is already used
			do {
				offerId = uuid();
				isValid = await this.isValidOfferId(offerId);
			} while (isValid === true);

			// Prepare object to write to database
			let offer = {
				offer_id: offerId,
				title: reqBody.offer.title,
				description: reqBody.offer.description,
				number_of_ratings: 0,
				rating: 0,
				category_id: reqBody.offer.category.category_id,
				user_id: reqBody.session.user_id,
				price: price
			};

			try {
				await Connector.executeQuery(QueryBuilder.createOffer(offer));
			} catch (e) {
				throw new InternalServerErrorException("Could not create offer");
			}

			// Check dates are given and data is an array
			if (reqBody.offer.blocked_dates !== undefined
				&& reqBody.offer.blocked_dates !== null) {
				if (!Array.isArray(reqBody.offer.blocked_dates)) {
					throw new BadRequestException("Daterange is not an array");
				}
				reqBody.offer.blocked_dates.forEach(dateRange => {
					// Throw error, if no date is set
					if (dateRange.from_date === undefined
						|| dateRange.from_date === null
						|| dateRange.to_date === undefined
						|| dateRange.to_date == null) {
						throw new BadRequestException("Invaild date for unavailablity of product");
					} else {
						// Throw error, if a start_date, end_date
						// or range from start to end is invalid
						if (!moment(dateRange.from_date.toString()).isValid()
							|| !moment(dateRange.to_date.toString()).isValid()
							|| moment(dateRange.to_date.toString()).diff(dateRange.from_date.toString()) < StaticConsts.CHECK_ZERO) {
							throw new BadRequestException("Invalid date range for unavailablity of product");
						} else if (moment(dateRange.from_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO
							|| moment(dateRange.to_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO) {
							// Throw error, if from_date or to_date is in past
							throw new BadRequestException("Blocked dates cannot be set in past")
						}
					}
				});

				// Insert blocked dates in database
				await reqBody.offer.blocked_dates.forEach(async (blockedDateRange) => {
					// Generate new uuid
					let offerBlockedId = uuid();
					// Insert new blocked dates
					try {
						await Connector.executeQuery(QueryBuilder.insertBlockedDateForOfferId({
							offer_blocked_id: offerBlockedId,
							offer_id: offerId,
							is_lessor: true,
							from_date: new Date(moment(
								blockedDateRange.from_date.toString()
							).format("YYYY-MM-DD")),
							to_date: new Date(moment(
								blockedDateRange.to_date.toString()
							).format("YYYY-MM-DD"))
						}));
					} catch (e) {
						throw new BadRequestException("Could not set new unavailable dates for product");
					}
				});
			}

			let offerResult: Offer;
			try {
				offerResult = await this.getOfferById(offerId);
			} catch (e) {
				throw new InternalServerErrorException("Could not create offer");
			}
			return offerResult;
		} else {
			throw new BadRequestException("Could not create offer");
		}
	}

	/**
	 * Accepts offer images to save on disk and IDs in database
	 * Returns an offer after new images are uploaded
	 * @param reqBody Request Body containing the offer ID, the user ID and the session
	 * @param images Array of multipart image files
	 */
	public async uploadPicture(reqBody: {
		session_id?: string,
		offer_id?: string,
		user_id?: string
	},
		images: Array<{
			fieldname: string,
			originalname: string,
			encoding: string,
			mimetype: string,
			buffer: Buffer,
			size: number
		}>): Promise<Offer> {
		if (reqBody !== undefined
			&& reqBody !== null
			&& images !== undefined
			&& images !== null
			&& images.length > StaticConsts.CHECK_ZERO) {

			// Validate session and user
			let user = await this.userService.validateUser({
				session: {
					session_id: reqBody.session_id,
					user_id: reqBody.user_id
				}
			});

			if (user === undefined || user === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// Check if offer exists
			let validOffer = await this.isValidOfferId(reqBody.offer_id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
			}

			// Check owner of offer
			let offerToValidateUser: Offer;
			try {
				offerToValidateUser = await this.getOfferById(reqBody.offer_id);
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			if (offerToValidateUser.lessor.user_id !== user.user.user_id) {
				throw new UnauthorizedException("User does not match");
			}

			// upload images
			if (images !== undefined && images !== null) {
				if (!Array.isArray(images)) {
					throw new BadRequestException("Images are not an array");
				}

				// Check number of images
				let imagesFromDatabase;
				try {
					imagesFromDatabase = await Connector.executeQuery(QueryBuilder.getOfferPictures(offerToValidateUser.offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				let numberOfimages = imagesFromDatabase.length + images.length;

				if (numberOfimages > StaticConsts.MAX_NUMBER_OF_OFFER_IMAGES) {
					throw new BadRequestException("Too many images");
				} else {
					for (let i = 0; i < images.length; i++) {
						// Generate a new uuid for each picture,
						// save picture on disk and create database insert
						let imageId = uuid();

						// Check if images 
						if (images[i].fieldname === undefined || images[i].fieldname === null || images[i].fieldname !== "images") {
							throw new BadRequestException("Invalid fields");
						}

						if (images[i].size === undefined
							|| images[i].size === null
							|| images[i].size <= StaticConsts.CHECK_ZERO
							|| images[i].size > StaticConsts.MAX_FILE_SIZE_FOR_OFFER_IMAGES) {
							throw new BadRequestException("Invalid image size");
						}

						// Save image
						try {
							await FileHandler.saveImage(images[i], imageId);
						} catch (e) {
							throw new InternalServerErrorException("Something went wrong while processing the images");
						}

						// Write to database
						let fileEnding = ('.' + images[i].originalname.replace(/^.*\./, ''));
						try {
							await Connector.executeQuery(QueryBuilder.insertImageByOfferId(reqBody.offer_id, (imageId + fileEnding)))
						} catch (e) {
							throw new InternalServerErrorException("Something went wrong...");
						}
					}
				}
				// Return offer
				return await this.getOfferById(reqBody.offer_id);
			} else {
				throw new BadRequestException("Could not upload image(s)");
			}
		} else {
			throw new BadRequestException("Could not upload image(s)");
		}
	}

	/**
	 * Checks if an given image is valid and returns the given path if so else it throws an exeption
	 * @param image image name and ending in format <name>.<ending>
	 */
	public checkImagePath(imagePath: string): string {
		if (!FileHandler.imageExists(imagePath)) {
			throw new NotFoundException("Could not find requested image");
		}
		return imagePath;
	}

	/**
	 * Method to update an offer with a given ID
	 * @param id ID of the offer which shall be updated
	 * @param reqBody Data to update the offer
	 */
	public async updateOffer(id: string, reqBody: {
		session?: {
			session_id: string,
			user_id: string
		},
		offer?: {
			title?: string,
			description?: string,
			price?: number,
			category: {
				category_id?: number
			},
			blocked_dates?: Array<{
				from_date: Date,
				to_date: Date
			}>
		},
		delete_images?: Array<string>
	}): Promise<Offer> {

		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
			if (!reqBody.session || !reqBody.offer) {
				throw new BadRequestException("Not a valid request");
			}

			let categoryId: number = 0;
			let price: number = 0;

			// Validate session and user
			let user = await this.userService.validateUser({
				session: {
					session_id: reqBody.session.session_id,
					user_id: reqBody.session.user_id
				}
			});

			if (user === undefined || user === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// Check if offer exists
			let validOffer = await this.isValidOfferId(id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
			}

			// Check owner of offer
			let offerToValidateUser: Offer;
			try {
				offerToValidateUser = await this.getOfferById(id);
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Convert category_id to number if not a number
			if (isNaN(reqBody.offer.category.category_id)) {
				categoryId = parseInt(reqBody.offer.category.category_id.toString());
				if (isNaN(categoryId)) {
					throw new BadRequestException("Not a valid category");
				}
			} else {
				categoryId = reqBody.offer.category.category_id;
			}

			// Check if category is valid
			let validCategory = await this.isValidCategoryId(categoryId);
			if (!validCategory) {
				throw new BadRequestException("Not a valid category");
			}

			// Convert price to number if not a number
			// and check if price is greater 0
			if (isNaN(reqBody.offer.price)) {
				price = parseFloat(reqBody.offer.price.toString());
				if (isNaN(price) || price <= StaticConsts.CHECK_ZERO) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.offer.price <= StaticConsts.CHECK_ZERO) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.offer.price;
				}
			}

			if (price <= StaticConsts.CHECK_ZERO) {
				throw new BadRequestException("Not a valid price");
			}

			// Check if title is empty
			if (reqBody.offer.title === undefined
				|| reqBody.offer.title === null
				|| reqBody.offer.title === "") {
				throw new BadRequestException("Title is required");
			}

			// Check if title is too long
			if (reqBody.offer.title.length > StaticConsts.OFFER_TITLE_MAX_LENGTH) {
				throw new BadRequestException("Title too long");
			}

			// Check if description is empty
			if (reqBody.offer.description === undefined
				|| reqBody.offer.description === null
				|| reqBody.offer.description === "") {
				throw new BadRequestException("Description is required");
			}

			// Delete images
			if (reqBody.delete_images !== undefined && reqBody.delete_images !== null) {
				if (!Array.isArray(reqBody.delete_images)) {
					throw new BadRequestException("Images to delete are not an array");
				}

				reqBody.delete_images.forEach(async imageUrl => {
					try {
						let image = imageUrl.replace(BASE_OFFER_LINK, '');
						await Connector.executeQuery(QueryBuilder.deletePictureById(image));
						FileHandler.deleteImage(imageUrl);
					} catch (e) {
						throw new InternalServerErrorException("Could not delete image (user service)");
					}
				});
			}

			// Update offer
			try {
				await Connector.executeQuery(QueryBuilder.updateOffer({
					offer_id: id,
					title: reqBody.offer.title,
					description: reqBody.offer.description,
					price: price,
					category_id: categoryId
				}));
			} catch (e) {
				throw new BadRequestException("Could not update offer");
			}

			// Check dates if given
			if (reqBody.offer.blocked_dates !== undefined
				&& reqBody.offer.blocked_dates !== null) {
				if (!Array.isArray(reqBody.offer.blocked_dates)) {
					throw new BadRequestException("Daterange is not an array");
				}
				reqBody.offer.blocked_dates.forEach(dateRange => {
					// Throw error, if no date is set
					if (dateRange.from_date === undefined
						|| dateRange.from_date === null
						|| dateRange.to_date === undefined
						|| dateRange.to_date == null) {
						throw new BadRequestException("Invaild date for unavailablity of product");
					} else {
						// Throw error, if a start_date, end_date
						// or range from start to end is invalid
						if (!moment(dateRange.from_date.toString()).isValid()
							|| !moment(dateRange.to_date.toString()).isValid()
							|| moment(dateRange.to_date.toString()).diff(dateRange.from_date.toString()) < StaticConsts.CHECK_ZERO) {
							throw new BadRequestException("Invalid date range for unavailablity of product");
						} else if (moment(dateRange.from_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO
							|| moment(dateRange.to_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO) {
							// Throw error, if from_date or to_date is in past
							throw new BadRequestException("Blocked dates cannot be set in past")
						}
					}
				});

				// Delete all blocked dates
				try {
					// Delete all blocked dates from lessor (second param = true)
					await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id, true));
				} catch (e) {
					throw new BadRequestException("Could not delete old unavailable dates of product");
				}

				// Insert blocked dates in database
				reqBody.offer.blocked_dates.forEach(async (blockedDateRange) => {
					// Generate new uuid
					let offerBlockedId = uuid();
					// Insert new blocked dates
					try {
						await Connector.executeQuery(QueryBuilder.insertBlockedDateForOfferId({
							offer_blocked_id: offerBlockedId,
							offer_id: id,
							is_lessor: true,
							from_date: new Date(moment(
								blockedDateRange.from_date.toString()
							).format("YYYY-MM-DD")),
							to_date: new Date(moment(
								blockedDateRange.to_date.toString()
							).format("YYYY-MM-DD"))
						}));
					} catch (e) {
						throw new BadRequestException("Could not set new unavailable dates for product");
					}
				});
			}

			// Get updated offer from database
			let updatedOffer: Offer;
			try {
				updatedOffer = await this.getOfferById(id);
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}
			return updatedOffer;
		} else {
			throw new BadRequestException("Could not update offer");
		}
	}

	/**
	 * Method is used to book an offer
	 * @param id ID of the offer to be booked
	 * @param reqBody Additional data to book an offer
	 */
	public async bookOffer(id: string, reqBody: {
		session?: {
			session_id: string,
			user_id: string,
		},
		message?: string,
		date_range?: {
			from_date: Date,
			to_date: Date
		}
	}): Promise<Request> {
		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
			if (!reqBody.session || !reqBody.date_range) {
				throw new BadRequestException("Not a valid request");
			}

			// Validate session and user
			let user = await this.userService.validateUser({
				session: {
					session_id: reqBody.session.session_id,
					user_id: reqBody.session.user_id
				}
			});

			if (user === undefined || user === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// Check if offer exists
			let validOffer = await this.isValidOfferId(id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
			}

			// Check if lessee is not lessor
			let offer: Offer;
			try {
				offer = await this.getOfferById(id);
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...")
			}

			// Check owner of offer
			if (offer.lessor.user_id === user.user.user_id) {
				throw new BadRequestException("Lessee cannot be same as lessor");
			}

			// Check date range
			if (reqBody.date_range.from_date === undefined
				|| reqBody.date_range.from_date === null
				|| reqBody.date_range.to_date === undefined
				|| reqBody.date_range.to_date == null) {
				throw new BadRequestException("Invalild date/date range");
			} else {
				// Throw error, if a start_date, end_date
				// or range from start to end is invalid
				if (!moment(reqBody.date_range.from_date.toString()).isValid()
					|| !moment(reqBody.date_range.to_date.toString()).isValid()
					|| moment(reqBody.date_range.to_date.toString()).diff(reqBody.date_range.from_date.toString()) < StaticConsts.CHECK_ZERO) {
					throw new BadRequestException("Invalid date range for request");
				} else if (moment(reqBody.date_range.from_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO
					|| moment(reqBody.date_range.to_date.toString()).diff(moment()) < StaticConsts.CHECK_ZERO) {
					// Throw error, if from_date or to_date is in past
					throw new BadRequestException("Requested dates cannot be set in past")
				}
			}

			let blockedDatesList: Array<{
				offer_blocked_id: string,
				offer_id: string,
				from_date: Date,
				to_date: Date,
				reason?: string
			}> = [];

			try {
				blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Use extension of moment for daterange
			// See https://www.thetopsites.net/article/53065781.shtml
			// and https://github.com/rotaready/moment-range
			let inputRange = moment.range(
				new Date(reqBody.date_range.from_date),
				new Date(reqBody.date_range.to_date)
			);

			blockedDatesList.forEach(blockedDateRange => {
				let dbRange = moment.range(
					new Date(blockedDateRange.from_date),
					new Date(blockedDateRange.to_date));

				// Maybe using overlaps() could shorten the if statement
				// but is '{ adjacent: true }' needed as second parameter?
				if (dbRange.contains(reqBody.date_range.from_date)
					|| dbRange.contains(reqBody.date_range.to_date)
					|| inputRange.contains(blockedDateRange.from_date)
					|| inputRange.contains(blockedDateRange.to_date)) {
					throw new BadRequestException("Cannot book an offer if the offer is already blocked");
				}
			});

			// Generate uuid for request
			//(it should not happen that two request have the same id 
			//also it should be almost impossible to guess the id [security])
			let requestUuid = uuid();

			let responseUser = await this.userService.getUser(user.user.user_id, StaticConsts.userDetailLevel.CONTRACT);

			let request: Request = {
				request_id: requestUuid,
				user: responseUser,
				offer: offer,
				status_id: StaticConsts.REQUEST_STATUS_OPEN,
				date_range: {
					from_date: new Date(moment(
						reqBody.date_range.from_date.toString()
					).format("YYYY-MM-DD")),
					to_date: new Date(moment(
						reqBody.date_range.to_date.toString()
					).format("YYYY-MM-DD"))
				},
				message: (reqBody.message === undefined || reqBody.message === null) ? "" : reqBody.message,
				qr_code_id: "",
				new_update: false,
				lessor_rating: null,
				lessee_rating: null,
				offer_rating: null
			}
	
			// calculate chatid
			const chatId: string = this.calculateChatId(responseUser.user_id, offer.lessor.user_id);
	
			let newIndexDB: Array<{
				message_count: number
			}> = await Connector.executeQuery(QueryBuilder.getMessageIndex());
	
			let newIndex = (!newIndexDB || newIndexDB.length === StaticConsts.CHECK_ZERO || !newIndexDB[0] ? 0 : newIndexDB[0].message_count) + 1;
	
			let systemMessage: ChatMessage = {
				chat_id: chatId,
				from_user_id: responseUser.user_id,
				to_user_id: offer.lessor.user_id,
				message_content: requestUuid,
				message_type: StaticConsts.MESSAGE_TYPES.OFFER_REQUEST,
				status_id: StaticConsts.MESSAGE_STATUS.SENT
			}
			// Write chat message to DB
			const messageId: string = chatId + uuid();
			await Connector.executeQuery(QueryBuilder.writeChatMessageToDb(messageId, systemMessage, newIndex));

			console.log(systemMessage)
			try {
				await Connector.executeQuery(QueryBuilder.createRequest(request));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			return request;

		} else {
			throw new BadRequestException("Could not book offer");
		}
	}


	/**
	 * Used to rate offers
	 */
	public async rateOffer(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		rating?: {
			offer?: Offer,
			rating: number,
			headline?: string,
			rating_text?: string
		}
	}): Promise<OfferRating> {
		if (!reqBody
			|| !reqBody.session
			|| !reqBody.session.session_id
			|| !reqBody.session.user_id
			|| !reqBody.rating
			|| !reqBody.rating.offer
			|| !reqBody.rating.offer.offer_id
			|| reqBody.rating.headline === undefined
			|| reqBody.rating.rating_text == undefined
			|| !reqBody.rating.rating
		) {
			throw new BadRequestException("Not a valid request");
		}

		// Check if rating value is valid
		let userRating = 0;
		if (reqBody.rating.rating !== undefined && reqBody.rating.rating !== null) {
			if (isNaN(reqBody.rating.rating)) {
				userRating = parseInt(reqBody.rating.rating.toString());
				if (isNaN(userRating)) {
					throw new BadRequestException("Not a valid rating");
				}
			} else {
				userRating = reqBody.rating.rating;
			}
		} else {
			throw new BadRequestException("Not a valid rating");
		}

		if (userRating <= StaticConsts.RATING_MIN_FOR_OFFERS || userRating > StaticConsts.RATING_MAX_FOR_OFFERS) {
			throw new BadRequestException("Not a valid rating");
		}

		// Check if headline is given if rating test is given
		if (reqBody.rating.rating_text !== "" && (!reqBody.rating.headline || reqBody.rating.headline === "")) {
			throw new BadRequestException("Headline is required if text is given");
		}

		// Check if headline or ratingtext are too long
		if (reqBody.rating.headline !== "" && reqBody.rating.headline.length > StaticConsts.MAX_RATING_HEADLINE_LENGTH) {
			throw new BadRequestException("Headline too long");
		}
		if (reqBody.rating.rating_text !== "" && reqBody.rating.rating_text.length > StaticConsts.MAX_RATING_HEADLINE_LENGTH) {
			throw new BadRequestException("Rating text too long");
		}

		// Validate session and user
		let user = await this.userService.validateUser({
			session: {
				session_id: reqBody.session.session_id,
				user_id: reqBody.session.user_id
			}
		});

		if (user === undefined || user === null) {
			throw new BadRequestException("Not a valid user/session");
		}

		// Check if offer exists
		let validOffer = await this.isValidOfferId(reqBody.rating.offer.offer_id);
		if (!validOffer) {
			throw new BadRequestException("Not a valid offer");
		}

		// offer from database
		let dbOffer: Offer;
		try {
			dbOffer = await this.getOfferById(reqBody.rating.offer.offer_id);
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...")
		}

		// Check owner of offer
		if (dbOffer.lessor.user_id === user.user.user_id) {
			throw new ForbiddenException("Offer cannot be rated by lessor");
		}

		// Check if user made an offer request
		let requestsForOffer: Array<{
			request_id: string,
			user_id: string,
			offer_id: string,
			status_id: number
		}> = await Connector.executeQuery(
			QueryBuilder.getRequestByOfferAndUserId(
				reqBody.rating.offer.offer_id,
				reqBody.session.user_id
			));

		if (requestsForOffer.length === StaticConsts.CHECK_ZERO) {
			throw new ForbiddenException("Cannot rate offers without a valid offer request");
		}

		let ratings: Array<{
			rating_id: string,
			user_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(
			QueryBuilder.getOfferRatings({
				rated_check: {
					offer_id: reqBody.rating.offer.offer_id,
					user_id: user.user.user_id
				}
			})
		);

		// Check if rating exists for given user and offer
		if (ratings.length !== StaticConsts.CHECK_ZERO) {
			throw new ForbiddenException("Cannot rate offers without a valid offer request");
		}

		let ratingId = uuid();
		await Connector.executeQuery(QueryBuilder.updateOfferRating({
			rating_in_offer_ratings: {
				insert: true,
				rating_id: ratingId,
				offer_id: dbOffer.offer_id,
				user_id: user.user.user_id,
				request_id: requestsForOffer[0].request_id,
				rating: reqBody.rating.rating,
				headline: (reqBody.rating.headline ? reqBody.rating.headline : ""),
				rating_text: (reqBody.rating.rating_text ? reqBody.rating.rating_text : "")
			}
		}));

		let updatedRating: Array<{
			arithmetic_mean: number,
			number_of_ratings: number
		}> = await Connector.executeQuery(QueryBuilder.calculateOfferRatingByOfferId(dbOffer.offer_id));


		// Insert rating into database
		await Connector.executeQuery(QueryBuilder.updateOfferRating({
			rating_in_offer: {
				offer_id: dbOffer.offer_id,
				rating: (updatedRating[0].arithmetic_mean == null ? 0 : updatedRating[0].arithmetic_mean),
				number_of_ratings: updatedRating[0].number_of_ratings
			}
		}));

		let ratingResponse: Array<{
			user_id: string,
			rating_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(
			QueryBuilder.getOfferRatings({
				rated_check: {
					offer_id: dbOffer.offer_id,
					user_id: user.user.user_id
				}
			})
		);

		let responseUser = await this.userService.getUser(user.user.user_id, StaticConsts.userDetailLevel.CONTRACT);

		let response = {
			rating_id: ratingResponse[0].rating_id,
			headline: (ratingResponse[0].headline == null ? "" : ratingResponse[0].headline),
			rating_text: (ratingResponse[0].rating_text == null ? "" : ratingResponse[0].rating_text),
			rating: ratingResponse[0].rating,
			rating_owner: responseUser,
			updated_at: ratingResponse[0].updated_at,
			rating_type: StaticConsts.OFFER_RATING_TYPE
		}

		return response;
	}

	/**
	 * Updates the rating for a given offer
	 * @param reqBody 
	 */
	public async updateOfferRating(reqBody: {
		session?: {
			session_id: string,
			user_id: string
		},
		rating?: {
			offer: Offer,
			rating: number,
			headline?: string,
			rating_text?: string,
		}
	}): Promise<OfferRating> {
		if (!reqBody
			|| !reqBody.session
			|| !reqBody.session.session_id
			|| !reqBody.session.user_id
			|| !reqBody.rating
			|| !reqBody.rating.offer
			|| !reqBody.rating.offer.offer_id
			|| reqBody.rating.headline === undefined
			|| reqBody.rating.rating_text == undefined
			|| !reqBody.rating.rating
		) {
			throw new BadRequestException("Not a valid request");
		}

		// Check if rating value is valid
		let userRating = 0;
		if (reqBody.rating.rating !== undefined && reqBody.rating.rating !== null) {
			if (isNaN(reqBody.rating.rating)) {
				userRating = parseInt(reqBody.rating.rating.toString());
				if (isNaN(userRating)) {
					throw new BadRequestException("Not a valid rating");
				}
			} else {
				userRating = reqBody.rating.rating;
			}
		} else {
			throw new BadRequestException("Not a valid rating");
		}

		if (userRating <= StaticConsts.RATING_MIN_FOR_OFFERS || userRating > StaticConsts.RATING_MAX_FOR_OFFERS) {
			throw new BadRequestException("Not a valid rating");
		}

		// Check if headline is given if rating test is given
		if (reqBody.rating.rating_text !== "" && (!reqBody.rating.headline || reqBody.rating.headline === "")) {
			throw new BadRequestException("Headline is required if text is given");
		}

		// Check if headline or ratingtext are too long
		if (reqBody.rating.headline !== "" && reqBody.rating.headline.length > StaticConsts.MAX_RATING_HEADLINE_LENGTH) {
			throw new BadRequestException("Headline too long");
		}
		if (reqBody.rating.rating_text !== "" && reqBody.rating.rating_text.length > StaticConsts.MAX_RATING_HEADLINE_LENGTH) {
			throw new BadRequestException("Rating text too long");
		}

		// Validate session and user
		let user = await this.userService.validateUser({
			session: {
				session_id: reqBody.session.session_id,
				user_id: reqBody.session.user_id
			}
		});

		if (user === undefined || user === null) {
			throw new BadRequestException("Not a valid user/session");
		}

		// Check if offer exists
		let validOffer = await this.isValidOfferId(reqBody.rating.offer.offer_id);
		if (!validOffer) {
			throw new BadRequestException("Not a valid offer");
		}

		// offer from database
		let dbOffer: Offer;
		try {
			dbOffer = await this.getOfferById(reqBody.rating.offer.offer_id);
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...")
		}

		// Check owner of offer
		if (dbOffer.lessor.user_id === user.user.user_id) {
			throw new ForbiddenException("Offer cannot be rated by lessor");
		}

		// Check if user made an offer request
		let requestsForOffer: Array<{
			request_id: string,
			user_id: string,
			offer_id: string,
			status_id: number
		}> = await Connector.executeQuery(
			QueryBuilder.getRequestByOfferAndUserId(
				reqBody.rating.offer.offer_id,
				reqBody.session.user_id
			));

		if (requestsForOffer.length === StaticConsts.CHECK_ZERO) {
			throw new ForbiddenException("Cannot rate offers without a valid offer request");
		}

		let ratings: Array<{
			rating_id: string,
			user_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(
			QueryBuilder.getOfferRatings({
				rated_check: {
					offer_id: reqBody.rating.offer.offer_id,
					user_id: user.user.user_id
				}
			})
		);

		// Check no if rating exists for given user and offer
		if (ratings.length === StaticConsts.CHECK_ZERO) {
			// Create a rating if update is used to update a non exisiting rating
			return await this.rateOffer(reqBody);
		}
		//Else: rating exists => Can be updated	

		await Connector.executeQuery(QueryBuilder.updateOfferRating({
			rating_in_offer_ratings: {
				insert: false,
				offer_id: dbOffer.offer_id,
				user_id: user.user.user_id,
				request_id: requestsForOffer[0].request_id,
				rating: reqBody.rating.rating,
				headline: (reqBody.rating.headline ? reqBody.rating.headline : ""),
				rating_text: (reqBody.rating.rating_text ? reqBody.rating.rating_text : "")
			}
		}));

		let updatedRating: Array<{
			arithmetic_mean: number,
			number_of_ratings: number
		}> = await Connector.executeQuery(QueryBuilder.calculateOfferRatingByOfferId(dbOffer.offer_id));

		// Insert rating into database
		await Connector.executeQuery(QueryBuilder.updateOfferRating({
			rating_in_offer: {
				offer_id: dbOffer.offer_id,
				rating: (updatedRating[0].arithmetic_mean == null ? 0 : updatedRating[0].arithmetic_mean),
				number_of_ratings: updatedRating[0].number_of_ratings
			}
		}));

		let ratingResponse: Array<{
			user_id: string,
			rating_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(
			QueryBuilder.getOfferRatings({
				rated_check: {
					offer_id: dbOffer.offer_id,
					user_id: user.user.user_id
				}
			})
		);

		let responseUser = await this.userService.getUser(user.user.user_id, StaticConsts.userDetailLevel.CONTRACT);

		let response = {
			rating_id: ratingResponse[0].rating_id,
			headline: (ratingResponse[0].headline == null ? "" : ratingResponse[0].headline),
			rating_text: (ratingResponse[0].rating_text == null ? "" : ratingResponse[0].rating_text),
			rating: ratingResponse[0].rating,
			rating_owner: responseUser,
			updated_at: ratingResponse[0].updated_at,
			rating_type: StaticConsts.OFFER_RATING_TYPE
		}

		return response;
	}

	/**
	 * Get ratings for a given offer id
	 * @param id Offer id
	 * @param query object (optionally) containing a page and / or a rating 
	 */
	public async getRatingForOffer(id: string,
		query?: {
			rating?: number,
			page?: number
		}
	): Promise<{
		offer_ratings: Array<OfferRating>,
		current_page: number,
		max_page: number,
		elements_per_page: number
	}> {
		if (id === undefined || id === null || id === "") {
			throw new BadRequestException("No offer id given");
		}

		// Check if rating value is valid
		let ratingFilterNumber: number = undefined;
		if (query.rating !== undefined && query.rating !== null) {
			if (isNaN(query.rating)) {
				ratingFilterNumber = parseInt(query.rating.toString());
				if (isNaN(ratingFilterNumber)) {
					throw new BadRequestException("Not a valid rating number");
				}
			} else {
				ratingFilterNumber = query.rating;
			}
		}

		if (ratingFilterNumber <= StaticConsts.RATING_MIN_FOR_OFFERS || ratingFilterNumber > StaticConsts.RATING_MAX_FOR_OFFERS) {
			throw new BadRequestException("Not a valid rating number");
		}

		// Check if offer exists
		let validOffer = await this.isValidOfferId(id);
		if (!validOffer) {
			throw new BadRequestException("Not a valid offer");
		}

		// offer from database
		let dbOffer: Offer;
		try {
			dbOffer = await this.getOfferById(id);
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...")
		}

		let numberOfRatings = ((await Connector.executeQuery(QueryBuilder.getNumberOfRatingsForOffer(dbOffer.offer_id)))[0].number_of_offer_ratings);

		// Return if no ratings available
		if (numberOfRatings === StaticConsts.CHECK_ZERO) {
			return {
				offer_ratings: [],
				current_page: 0,
				max_page: 0,
				elements_per_page: StaticConsts.DEFAULT_PAGE_SIZE
			}
		}

		// Paging
		let page: number;
		if (!query.page || isNaN(query.page) || query.page <= StaticConsts.CHECK_ZERO) {
			page = 1;
		} else {
			if (parseInt(query.page.toString()) > Math.ceil(numberOfRatings / StaticConsts.DEFAULT_PAGE_SIZE)) {
				throw new BadRequestException("Ran out of pages...");
			} else {
				page = parseInt(query.page.toString());
			}
		}

		// Get filtered ratings from DB
		let dbRatings: Array<{
			rating_id: string,
			user_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(QueryBuilder.getOfferRatings({
			ratings_with_pages: {
				offer_id: dbOffer.offer_id,
				rating: ratingFilterNumber,
				page: page,
				page_size: StaticConsts.DEFAULT_PAGE_SIZE
			}
		}));

		let responseArray: Array<OfferRating> = [];
		for (let i = 0; i < dbRatings.length; i++) {

			let userOfRating = await this.userService.getUser(dbRatings[0].user_id, StaticConsts.userDetailLevel.CONTRACT);

			let o: OfferRating = {
				rating_id: dbRatings[i].rating_id,
				rating: dbRatings[i].rating,
				headline: (dbRatings[i].headline === null ? "" : dbRatings[i].headline),
				rating_text: (dbRatings[i].rating_text === null ? "" : dbRatings[i].rating_text),
				updated_at: dbRatings[i].updated_at,
				rating_owner: userOfRating,
				rating_type: StaticConsts.OFFER_RATING_TYPE
			}
			responseArray.push(o);
		}

		let response = {
			offer_ratings: responseArray,
			current_page: page,
			max_page: Math.ceil(numberOfRatings / StaticConsts.DEFAULT_PAGE_SIZE),
			elements_per_page: StaticConsts.DEFAULT_PAGE_SIZE
		}

		return response;
	}

	/**
	 * Deletes a rating by a given rating (id is used)
	 * @param reqBody session for authentication and rating object for id
	 */
	public async deleteRating(reqBody: {
		session?: {
			session_id: string,
			user_id: string
		},
		rating?: OfferRating
	}): Promise<OfferRating> {
		if (!reqBody
			|| !reqBody.session
			|| !reqBody.session.session_id
			|| !reqBody.session.user_id
			|| !reqBody.rating
		) {
			throw new BadRequestException("Not a valid request");
		}

		// Validate session and user
		let user = await this.userService.validateUser({
			session: {
				session_id: reqBody.session.session_id,
				user_id: reqBody.session.user_id
			}
		});

		if (user === undefined || user === null) {
			throw new BadRequestException("Not a valid user/session");
		}

		let dbRatings: Array<{
			rating_id: string,
			user_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(QueryBuilder.getOfferRatings({
			rating_id: reqBody.rating.rating_id
		}));

		// Check if rating is valid
		if (dbRatings.length <= StaticConsts.CHECK_ZERO) {
			throw new BadRequestException("Not a valid offer rating");
		}

		// Check owner of rating
		if (dbRatings[0].user_id !== user.user.user_id) {
			throw new ForbiddenException("Only lessor can delete rating");
		}

		let offer = await this.getOfferById(dbRatings[0].offer_id);

		// delete rating from database
		await Connector.executeQuery(QueryBuilder.deleteOfferRating(dbRatings[0].rating_id));

		let updatedRating: Array<{
			arithmetic_mean: number,
			number_of_ratings: number
		}> = await Connector.executeQuery(QueryBuilder.calculateOfferRatingByOfferId(offer.offer_id));

		// Insert rating into database
		await Connector.executeQuery(QueryBuilder.updateOfferRating({
			rating_in_offer: {
				offer_id: offer.offer_id,
				rating: (updatedRating[0].arithmetic_mean == null ? 0 : updatedRating[0].arithmetic_mean),
				number_of_ratings: updatedRating[0].number_of_ratings
			}
		}));

		let responseUser = await this.userService.getUser(dbRatings[0].user_id, StaticConsts.userDetailLevel.CONTRACT);

		let response = {
			rating_id: dbRatings[0].rating_id,
			headline: (dbRatings[0].headline == null ? "" : dbRatings[0].headline),
			rating_text: (dbRatings[0].rating_text == null ? "" : dbRatings[0].rating_text),
			rating: dbRatings[0].rating,
			rating_owner: responseUser,
			updated_at: dbRatings[0].updated_at,
			rating_type: StaticConsts.OFFER_RATING_TYPE
		}

		return response;
	}

	/**
	 * Deletes a given offer after user is authenticated
	 * @param id ID of the offer to be deleted
	 * @param reqBody Additional data to authenticate user and delete offer
	 */
	public async deleteOffer(id: string, reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		}
	}): Promise<Offer> {
		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
			if (!reqBody.session) {
				throw new BadRequestException("Not a valid request");
			}

			// Validate session and user
			let user = await this.userService.validateUser({
				session: {
					session_id: reqBody.session.session_id,
					user_id: reqBody.session.user_id
				}
			});

			if (user === undefined || user === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// Check if offer exists
			let validOffer = await this.isValidOfferId(id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
			}

			// Get old offer from database (for return)
			let offer: Offer;
			try {
				offer = await this.getOfferById(id);
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...")
			}

			// Check owner of offer
			if (offer.lessor.user_id !== user.user.user_id) {
				throw new UnauthorizedException("User does not match");
			}

			// Delete all blocked dates from lessor
			try {
				await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id, true));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Delete all blocked dates from lessee
			try {
				await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id, false));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Delete images from disk
			offer.picture_links.forEach(imageUrl => {
				try {
					FileHandler.deleteImage(imageUrl);
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}
			});

			// Delete images from database
			try {
				await Connector.executeQuery(QueryBuilder.deletePicturesByOfferId(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Soft delete offer from database
			try {
				await Connector.executeQuery(QueryBuilder.softDeleteOfferById(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			// Update offer with new deleted data
			offer = await this.getOfferById(id);

			return offer;
		} else {
			throw new BadRequestException("Could not delete offer");
		}
	}

	/**
	 * Returns a single request for a given request OR all request for a user
	 * @param reqBody Data to authenticate user + statuscode to filter AND/OR request, if needed
	 */
	public async getRequests(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		request?: Request,
		status_code?: number,
		lessor?: boolean
	}): Promise<Request | Array<Request>> {
		if (reqBody !== undefined && reqBody !== null && reqBody.session !== undefined && reqBody.session !== null) {
			// Validate session and user
			let userResponse = await this.userService.validateUser({
				session: {
					session_id: reqBody.session.session_id,
					user_id: reqBody.session.user_id
				}
			});

			if (userResponse === undefined || userResponse === null) {
				throw new BadRequestException("Not a valid user/session");
			}

			// If request is sent, lookup the sent request(id)
			// else return all requests for the user
			if (reqBody.request) {
				let dbRequests: Array<{
					request_id: string,
					user_id: string,
					offer_id: string,
					status_id: number,
					from_date: Date,
					to_date: Date,
					message: string,
					qr_code_id: string
				}>;

				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (dbRequests.length < StaticConsts.DB_RETURN_LENGTH_ONE) {
					throw new BadRequestException("Request does not exist");
				} else if (dbRequests.length === StaticConsts.DB_RETURN_LENGTH_ONE) {
					let offer: Offer;
					let qrCodeValue = "";

					try {
						offer = await this.getOfferById(dbRequests[0].offer_id);
					} catch (error) {
						throw new InternalServerErrorException("Something went wrong...");
					}

					let responseUser: User;
					try {
						responseUser = await this.userService.getUser(dbRequests[0].user_id, StaticConsts.userDetailLevel.CONTRACT);
					} catch (e) {
						throw new InternalServerErrorException("Something went wrong");
					}

					// Check if lessor / lesse did not sent request
					// => Other people who are not lessor / lesse should not see requests!
					if (dbRequests[0].user_id !== userResponse.user.user_id
						&& offer.lessor.user_id !== userResponse.user.user_id) {
						throw new UnauthorizedException("Unauthorized to see this request");
					}

					// Lessee sent request and status code matches OR lessor sent request and status code matches
					if (
						(dbRequests[0].user_id === userResponse.user.user_id &&
							dbRequests[0].status_id === StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR)
						||
						(offer.lessor.user_id === userResponse.user.user_id &&
							dbRequests[0].status_id === StaticConsts.REQUEST_STATUS_ITEM_LEND_TO_LESSEE)) {
						qrCodeValue = (dbRequests[0].qr_code_id === null) ? "" : dbRequests[0].qr_code_id;
					}

					// Get User Ratings
					let lesseeRating = await this.userService.getPairUserRatings(offer.lessor.user_id, dbRequests[0].user_id, StaticConsts.RATING_TYPES[1]);
					let lessorRating = await this.userService.getPairUserRatings(dbRequests[0].user_id, offer.lessor.user_id, StaticConsts.RATING_TYPES[0]);

					// Get offerratings for user + offer id
					let offerRating: OfferRating = await this.getOfferRatingByOfferIdAndUserId(dbRequests[0].offer_id, dbRequests[0].user_id);

					let o: Request = {
						request_id: dbRequests[0].request_id,
						user: responseUser,
						offer: offer,
						status_id: dbRequests[0].status_id,
						date_range: {
							from_date: dbRequests[0].from_date,
							to_date: dbRequests[0].to_date
						},
						message: dbRequests[0].message,
						qr_code_id: qrCodeValue,
						offer_rating: offerRating,
						lessee_rating: lesseeRating,
						lessor_rating: lessorRating,
						new_update: false
					}

					// Check if lessor sent request or lessee
					let isLessor = (offer.lessor.user_id === userResponse.user.user_id) ? true : false;

					await Connector.executeQuery(QueryBuilder.updateReadByUser(reqBody.request.request_id, isLessor));

					return o;
				} else {
					throw new InternalServerErrorException("Something went wrong...");
				}
			} else {
				let dbRequests: Array<{
					request_id: string,
					user_id: string,
					offer_id: string,
					status_id: number,
					from_date: Date,
					to_date: Date,
					message: string,
					qr_code_id: string
				}>;

				let response: Array<Request> = [];

				if (reqBody.status_code !== undefined && reqBody.status_code === StaticConsts.REQUEST_STATUS_ITEM_RETURNED_TO_LESSOR) {
					if (reqBody.lessor !== undefined && reqBody.lessor === true) {
						try {
							dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({
								user_id: reqBody.session.user_id,
								status_code: reqBody.status_code,
								lessor: true
							}));
						} catch (error) {
							throw new InternalServerErrorException("Something went wrong...");
						}
					} else {
						try {
							dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({
								user_id: reqBody.session.user_id,
								status_code: reqBody.status_code
							}));
						} catch (error) {
							throw new InternalServerErrorException("Something went wrong...");
						}
					}
				} else {
					if (reqBody.lessor !== undefined && reqBody.lessor === true) {
						try {
							dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({
								user_id: reqBody.session.user_id,
								lessor: true
							}));
						} catch (error) {
							throw new InternalServerErrorException("Something went wrong...");
						}
					} else {
						try {
							dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ user_id: reqBody.session.user_id }));
						} catch (error) {
							throw new InternalServerErrorException("Something went wrong...");
						}
					}
				}

				for (let i = 0; i < dbRequests.length; i++) {
					let offer: Offer;

					try {
						offer = await this.getOfferById(dbRequests[i].offer_id);
					} catch (error) {
						throw new InternalServerErrorException("Something went wrong...");
					}

					let isLessor = (offer.lessor.user_id === userResponse.user.user_id) ? true : false;

					// Check who has update via user id an offer id
					let newUpdateVal = await Connector.executeQuery(QueryBuilder.hasOfferRequestUpdate(dbRequests[i].request_id, isLessor));

					let newUpdate = false;
					if (newUpdateVal.length <= StaticConsts.CHECK_ZERO) {
						newUpdate = false;
					} else {
						newUpdate = !(newUpdateVal[0].has_read == StaticConsts.CHECK_ZERO ? false : true);
					}

					// Remove QR-Code from list
					let o: Request = {
						request_id: dbRequests[i].request_id,
						user: userResponse.user,
						offer: offer,
						status_id: dbRequests[i].status_id,
						date_range: {
							from_date: dbRequests[i].from_date,
							to_date: dbRequests[i].to_date
						},
						message: dbRequests[i].message,
						qr_code_id: '',
						lessee_rating: null,
						lessor_rating: null,
						offer_rating: null,
						new_update: newUpdate
					}

					response.push(o);
				}
				return response;
			}
		} else {
			throw new BadRequestException("Not a valid request");
		}
	}

	/**
	 * Handles everything which is needed to make the whole lend/borrow process possible
	 * Returns an update request
	 * @param reqBody session of user and a valid request object
	 */
	public async handleRequests(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		request?: Request
	}): Promise<Request> {
		if (!reqBody || !reqBody.session || !reqBody.request) {
			throw new BadRequestException("Not a valid request");
		}

		let userResponse = await this.userService.validateUser({
			session: {
				session_id: reqBody.session.session_id,
				user_id: reqBody.session.user_id
			}
		});

		// check if user exists
		if (userResponse === undefined || userResponse === null) {
			throw new BadRequestException("Not a valid user/session");
		}

		// Check if request exists
		// If an error occurs it crashes in getRequest (I guess/ I hope)
		let requests = await this.getRequests({
			session: reqBody.session,
			request: reqBody.request
		});

		// Check if offer exists
		let validOffer = await this.isValidOfferId(reqBody.request.offer.offer_id);
		if (!validOffer) {
			throw new BadRequestException("Not a valid offer");
		}

		let dbOffers: Array<{
			first_name: string,
			last_name: string,
			user_id: string,
			post_code: string,
			city: string,
			verified: number,
			lessor_rating: number,
			number_of_lessor_ratings: number
		}> = [];

		try {
			dbOffers = await Connector.executeQuery(QueryBuilder.getUserByOfferId(reqBody.request.offer.offer_id));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (dbOffers === undefined || dbOffers === null || dbOffers.length !== StaticConsts.DB_RETURN_LENGTH_ONE) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		// check statuscode
		if (reqBody.request.status_id === undefined ||
			reqBody.request.status_id === null ||
			isNaN(reqBody.request.status_id) ||
			reqBody.request.status_id <= StaticConsts.CHECK_ZERO ||
			reqBody.request.status_id > StaticConsts.REQUEST_STATUS_REQUEST_CANCELED_BY_LESSEE) {
			throw new BadRequestException("Invalid status code");
		}

		let returnResponse = null;
		let dbRequests: Array<{
			request_id: string,
			user_id: string,
			offer_id: string,
			status_id: number,
			from_date: Date,
			to_date: Date,
			message: string,
			qr_code_id: string
		}> = [];

		switch (reqBody.request.status_id) {
			case StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR:
				// Accepted by lessor
				// Check if owner sent request
				if (dbOffers[0].user_id !== userResponse.user.user_id) {
					throw new BadRequestException("You are not the owner of the offer!");
				}

				let a: Request = reqBody.request;

				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Disallow overwriting of existing status codes
				if (dbRequests[0].qr_code_id !== null && dbRequests[0].qr_code_id !== '') {
					throw new BadRequestException("Cannot update already set status");
				}

				if (dbRequests[0].status_id !== StaticConsts.REQUEST_STATUS_OPEN) {
					throw new BadRequestException("Cannot update already set status");
				}

				// Update request
				a.status_id = StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR;
				a.qr_code_id = uuid();
				await Connector.executeQuery(QueryBuilder.updateRequest(a));

				returnResponse = await this.getRequests({
					session: reqBody.session,
					request: reqBody.request
				});

				// Set blocked date to database
				await Connector.executeQuery(QueryBuilder.insertBlockedDateForOfferId({
					offer_blocked_id: uuid(),
					offer_id: reqBody.request.offer.offer_id,
					from_date: (requests as Request).date_range.from_date,
					to_date: (requests as Request).date_range.to_date,
					is_lessor: false
				}
				));

				// Remove QR-Code string from response to avoid that the lessor can scan it
				(returnResponse as Request).qr_code_id = '';
				break;
			case StaticConsts.REQUEST_STATUS_REJECTED_BY_LESSOR:
				// Rejected by lessor
				// Check if owner sent request
				if (dbOffers[0].user_id !== userResponse.user.user_id) {
					throw new BadRequestException("You are not the owner of the offer!");
				}

				let b: Request = reqBody.request;

				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Disallow overwriting of existing status codes
				if (dbRequests[0].qr_code_id !== null && dbRequests[0].qr_code_id !== '') {
					throw new BadRequestException("Cannot update already set status");
				}

				if (dbRequests[0].status_id !== StaticConsts.REQUEST_STATUS_OPEN) {
					throw new BadRequestException("Cannot update already set status");
				}

				// Update object to write reject to database
				b.status_id = StaticConsts.REQUEST_STATUS_REJECTED_BY_LESSOR;
				b.qr_code_id = undefined;

				await Connector.executeQuery(QueryBuilder.updateRequest(b));

				returnResponse = await this.getRequests({
					session: reqBody.session,
					request: reqBody.request
				});

				// Remove QR-Code string from response to avoid that the lessor can scan it
				(returnResponse as Request).qr_code_id = '';
				break;
			case StaticConsts.REQUEST_STATUS_ITEM_LEND_TO_LESSEE:
				// Lend by lessor
				// Check if lessor (owner of offer) sent request
				if (dbOffers[0].user_id !== userResponse.user.user_id) {
					throw new BadRequestException("You are not the owner of the offer!");
				}

				let c: Request = reqBody.request;

				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Disallow overwriting of existing status codes
				if (dbRequests[0].qr_code_id === undefined || dbRequests[0].qr_code_id === null || dbRequests[0].qr_code_id === '') {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (dbRequests[0].status_id !== StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR) {
					throw new BadRequestException("Cannot borrow item");
				}

				if (dbRequests[0].qr_code_id !== reqBody.request.qr_code_id) {
					throw new BadRequestException("Invalid QR-Code");
				}

				// Update request
				c.status_id = StaticConsts.REQUEST_STATUS_ITEM_LEND_TO_LESSEE;
				c.qr_code_id = uuid();
				await Connector.executeQuery(QueryBuilder.updateRequest(c));

				returnResponse = await this.getRequests({
					session: reqBody.session,
					request: reqBody.request
				});

				// Remove QR-Code string from response to avoid that the lessor can scan it
				(returnResponse as Request).qr_code_id = '';
				break;
			case StaticConsts.REQUEST_STATUS_ITEM_RETURNED_TO_LESSOR:
				// Returned to lessor
				let d: Request = reqBody.request;

				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Check if lessee sent request
				if (dbRequests[0].user_id !== userResponse.user.user_id) {
					throw new BadRequestException("You are not the lessee of the offer!");
				}

				if (dbRequests[0].status_id !== StaticConsts.REQUEST_STATUS_ITEM_LEND_TO_LESSEE) {
					throw new BadRequestException("Cannot return item");
				}

				if (dbRequests[0].qr_code_id !== reqBody.request.qr_code_id) {
					throw new BadRequestException("Invalid QR-Code");
				}

				// Update request
				d.status_id = StaticConsts.REQUEST_STATUS_ITEM_RETURNED_TO_LESSOR;
				d.qr_code_id = StaticConsts.REQUEST_QR_CODE_NULL; // TODO: Decide what to do with the QR-Code....
				await Connector.executeQuery(QueryBuilder.updateRequest(d));

				returnResponse = await this.getRequests({
					session: reqBody.session,
					request: reqBody.request
				});

				// Remove QR-Code string from response to avoid that the lessor can scan it
				(returnResponse as Request).qr_code_id = '';
				break;
			case StaticConsts.REQUEST_STATUS_REQUEST_CANCELED_BY_LESSOR:
				// Request canceled by lessor
				// TODO: Clarify if case is needed or not
				// Case does not make any sense for now
				throw new Error("Method not implemented!");
				break;
			case StaticConsts.REQUEST_STATUS_REQUEST_CANCELED_BY_LESSEE:
				// Request canceled by lessee
				let f: Request = reqBody.request;

				// Check if lessee sent request
				try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ request_id: reqBody.request.request_id }));
				} catch (error) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Check if lessee sent request
				if (dbRequests[0].user_id !== userResponse.user.user_id) {
					throw new BadRequestException("You are not the lessee of the offer!");
				}

				// Disallow overwriting of existing status codes
				if (dbRequests[0].qr_code_id !== null && dbRequests[0].qr_code_id !== '') {
					throw new BadRequestException("Cannot update already set status");
				}

				// Cancelation by lessee is possible until lessor accepts or rejects
				// => Check if status is other than 1
				if (dbRequests[0].status_id !== StaticConsts.REQUEST_STATUS_OPEN) {
					throw new BadRequestException("Cannot update already set status");
				}

				// Update object to write canceled by lessee to database
				f.status_id = StaticConsts.REQUEST_STATUS_REQUEST_CANCELED_BY_LESSEE;
				f.qr_code_id = undefined;

				await Connector.executeQuery(QueryBuilder.updateRequest(f));

				returnResponse = await this.getRequests({
					session: reqBody.session,
					request: reqBody.request
				});

				// Remove QR-Code string from response to avoid that the lessor can scan it
				(returnResponse as Request).qr_code_id = '';

				break;
			default: throw new BadRequestException("Not a valid status code");
		}

		// Return updated request object
		if (returnResponse !== null) {
			return returnResponse;
		} else {
			throw new InternalServerErrorException("Something went wrong...");
		}
	}

	/**
	 * Returns the number of new opened offer requests for lessor view
	 * and the number of accepted / rejected updates for lessee view
	 * and the total number of updates (sum of all)
	 * @param reqBody Uses a session object to get all request numbers per user
	 */
	public async getNumberOfNewOfferRequestsPerUser(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		}
	}): Promise<{
		lessors_number_of_new_requests: number,
		lessees_number_of_new_accepted_requests: number,
		lessees_number_of_new_rejected_requests: number,
		lessees_total_number_of_updates: number
	}> {
		if (!reqBody || !reqBody.session) {
			throw new BadRequestException("Not a valid request");
		}

		let userResponse = await this.userService.validateUser({
			session: {
				session_id: reqBody.session.session_id,
				user_id: reqBody.session.user_id
			}
		});

		// check if user exists
		if (userResponse === undefined || userResponse === null) {
			throw new BadRequestException("Not a valid user/session");
		}

		// Get number of requests per state
		// If REQUEST_STATUS_OPEN is set in query the number of open requests
		// is calculated by using the userId from offer of request
		// If request is accepted / rejected the userId from request is used
		let numberOfNewRequests = ((await Connector.executeQuery(
			QueryBuilder.getNumberOfNewOfferRequestsPerUser(
				reqBody.session.user_id,
				StaticConsts.REQUEST_STATUS_OPEN)))[0]).number_of_new_requests;

		let numberOfNewAcceptedRequests = ((await Connector.executeQuery(
			QueryBuilder.getNumberOfNewOfferRequestsPerUser(
				reqBody.session.user_id,
				StaticConsts.REQUEST_STATUS_ACCEPTED_BY_LESSOR)))[0]).number_of_new_requests;

		let numberOfNewRejectedRequests = ((await Connector.executeQuery(
			QueryBuilder.getNumberOfNewOfferRequestsPerUser(
				reqBody.session.user_id,
				StaticConsts.REQUEST_STATUS_REJECTED_BY_LESSOR)))[0]).number_of_new_requests;

		let o = {
			lessors_number_of_new_requests: numberOfNewRequests,
			lessees_number_of_new_accepted_requests: numberOfNewAcceptedRequests,
			lessees_number_of_new_rejected_requests: numberOfNewRejectedRequests,
			lessees_total_number_of_updates: (numberOfNewAcceptedRequests + numberOfNewRejectedRequests)
		}
		return o;
	}

	/**
	 * Returns the rating for a given offer id and user id
	 * @param offerId Id of the offer
	 * @param userId Id of the user
	 */
	private async getOfferRatingByOfferIdAndUserId(offerId: string, userId: string): Promise<OfferRating> {
		// Get filtered ratings from DB
		let dbRatings: Array<{
			rating_id: string,
			user_id: string,
			offer_id: string,
			request_id: string,
			rating: number,
			headline: string,
			rating_text: string,
			created_at: Date,
			updated_at: Date
		}> = await Connector.executeQuery(QueryBuilder.getOfferRatings({
			rated_check: {
				offer_id: offerId,
				user_id: userId
			}
		}));

		// No ratings found
		if (dbRatings.length <= StaticConsts.CHECK_ZERO) {
			return null;
		}
		let userOfRating = await this.userService.getUser(dbRatings[0].user_id, StaticConsts.userDetailLevel.CONTRACT);

		let o: OfferRating = {
			rating_id: dbRatings[0].rating_id,
			rating: dbRatings[0].rating,
			headline: (dbRatings[0].headline === null ? "" : dbRatings[0].headline),
			rating_text: (dbRatings[0].rating_text === null ? "" : dbRatings[0].rating_text),
			updated_at: dbRatings[0].updated_at,
			rating_owner: userOfRating,
			rating_type: StaticConsts.OFFER_RATING_TYPE
		}

		return o;
	}

	/**
	 * returns true if an offer is valid
	 * @param id ID of the offer which shall be validated
	 */
	private async isValidOfferId(id: string): Promise<boolean> {
		let offers: Array<Offer> = [];

		if (id !== undefined && id !== null && id !== "") {
			offers = await Connector.executeQuery(
				QueryBuilder.getOffer({ offer_id: id })
			);
		} else {
			throw new BadRequestException("Not a valid offer id");
		}

		if (offers.length === StaticConsts.DB_RETURN_LENGTH_ONE) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Returns true if a category is valid
	 * @param id ID of the category which shall be validated
	 */
	private async isValidCategoryId(id: number): Promise<boolean> {
		let categories: Array<Category> = [];

		if (id !== undefined && id !== null) {
			categories = await Connector.executeQuery(
				QueryBuilder.getCategories({ category_id: id })
			);
		} else {
			throw new BadRequestException("Not a valid category id");
		}

		if (categories.length === StaticConsts.DB_RETURN_LENGTH_ONE) {
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Returns either an empty array or an array with offer objects after
	 * adding additional information like user data and picture links
	 * 
	 * This method does NOT add the blocked dates to the offer list!
	 * Therefore a similar code is used in getOfferById method
	 * 
	 * @param offerList offer list with data from database
	 */
	private async addDataToOffers(offerList: Array<{
		offer_id: string,
		user_id: string,
		title: string,
		description: string,
		rating: number,
		price: number,
		category_id: number,
		category_name: string,
		picture_link: string,
		number_of_ratings: number
	}>): Promise<Array<Offer>> {
		let offers: Array<Offer> = [];

		if (offerList.length > StaticConsts.CHECK_ZERO) {
			for (let i = 0; i < offerList.length; i++) {
				let pictureUUIDList: Array<{
					uuid: string,
					offer_id: string
				}> = [];

				try {
					pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(offerList[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				// Lessor is now a user!
				let lessor: User;
				try {
					lessor = await this.userService.getUser(offerList[i].user_id, StaticConsts.userDetailLevel.PUBLIC);
				} catch (error) {
					throw error;
				}

				if (pictureUUIDList.length > StaticConsts.CHECK_ZERO) {
					let pictureLinks: Array<string> = [];

					for (let j = 0; j < pictureUUIDList.length; j++) {
						pictureLinks.push(BASE_OFFER_LINK + pictureUUIDList[j].uuid);
					}

					offers.push({
						offer_id: offerList[i].offer_id,
						title: offerList[i].title,
						description: offerList[i].description,
						number_of_ratings: offerList[i].number_of_ratings,
						rating: offerList[i].rating,
						price: offerList[i].price,
						category: {
							name: offerList[i].category_name,
							category_id: offerList[i].category_id,
							picture_link: offerList[i].picture_link
						},
						picture_links: pictureLinks,
						lessor: lessor
					});

				} else {
					offers.push({
						offer_id: offerList[i].offer_id,
						title: offerList[i].title,
						description: offerList[i].description,
						number_of_ratings: offerList[i].number_of_ratings,
						rating: offerList[i].rating,
						price: offerList[i].price,
						category: {
							name: offerList[i].category_name,
							category_id: offerList[i].category_id,
							picture_link: offerList[i].picture_link
						},
						picture_links: [],
						lessor: lessor
					});
				}
			}
			return offers;
		} else {
			return [];
		}
	}

	/**
	 * Returns a list of offers after adding data for blocked dates to it
	 * @param offerList List of offers (after data is added to database offers)
	 */
	private async addBlockedDatesToOffers(offerList: Array<Offer>): Promise<Array<Offer>> {
		let offers: Array<Offer> = []
		if (offerList) {
			for (let i = 0; i < offerList.length; i++) {
				let blockedDatesList: Array<{
					offer_blocked_id: string,
					offer_id: string,
					from_date: Date,
					to_date: Date,
					is_lessor: number,
					reason?: string
				}> = [];

				let o = offerList[i];

				try {
					blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(offerList[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (blockedDatesList.length > StaticConsts.CHECK_ZERO) {
					let blockedDates: Array<{
						from_date: Date,
						to_date: Date,
						blocked_by_lessor: boolean
					}> = [];

					for (let i = 0; i < blockedDatesList.length; i++) {
						blockedDates.push({
							from_date: blockedDatesList[i].from_date,
							to_date: blockedDatesList[i].to_date,
							blocked_by_lessor: blockedDatesList[i].is_lessor === StaticConsts.DB_TRUE ? true : false
						});
					}

					o.blocked_dates = blockedDates;
				} else {
					o.blocked_dates = [];
				}

				offers.push(o)
			}
		}

		return offers;
	}

	/**
     * Takes two userIds as input and calculates the chatId
     * @param userOne 
     * @param userTwo 
     */
    private calculateChatId(userOne: string, userTwo: string): string {
        return [userOne, userTwo].sort().join("");
    }
}