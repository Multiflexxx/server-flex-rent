import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, UnauthorizedException } from '@nestjs/common';
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
import { off } from 'process';

const BASE_OFFER_LINK = require('../../file-handler-config.json').image_base_link;

@Injectable()
export class OfferService {
	constructor(private readonly userService: UserService) { }

	/**
	 * Returns five best offers, best lessors, and latest offers
	 * If the code would run faster more offers would be great
	 */
	public async getHomePageOffers(): Promise<{
		best_offers: Array<Offer>,
		best_lessors: Array<Offer>,
		latest_offers: Array<Offer>
	}> {
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
			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({ best_offers: true }));
			homePageOffers.best_offers = await this.addDataToOffers(dbOffers);

			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({ best_lessors: true }));
			homePageOffers.best_lessors = await this.addDataToOffers(dbOffers);

			dbOffers = await Connector.executeQuery(QueryBuilder.getHomepageOffers({ latest_offers: true }));
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
	 */
	public async getAll(query: {
		limit?: string,
		category?: string,
		search?: string
	}): Promise<Array<Offer>> {
		let limit: number = 25; // Default limit
		let category: number = 0;
		let search: string = "";

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
						limit: limit,
						category: category,
						search: search
					}
				}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...")
		}

		return await this.addDataToOffers(dbOffers);
	}

	/**
	 * Returns all offers for a given user id
	 * @param reqBody User data to validate the user
	 */
	public async getOffersByUserId(reqBody: {
		session_id?: string,
		user_id?: string
	}): Promise<Array<Offer>> {

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
			dbOffers = await Connector.executeQuery(QueryBuilder.getOffer({ user_id: reqBody.user_id }));
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

		if (dbOffers.length > 0) {
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
	 * Returns all categories from database
	 */
	public async getAllCategories(): Promise<Array<Category>> {
		let categories: Array<Category> = [];

		try {
			categories = await Connector.executeQuery(QueryBuilder.getCategories({}));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (categories.length > 0) {
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
		session_id?: string,
		user_id?: string,
		title?: string,
		description?: string,
		price?: number,
		category_id?: number,
		blocked_dates?: Array<{
			from_date: Date,
			to_date: Date
		}>
	}): Promise<Offer> {
		if (reqBody !== undefined && reqBody !== null) {
			let categoryId = 0;
			let price = 0;

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

			// Convert category_id to number if not a number
			if (isNaN(reqBody.category_id)) {
				categoryId = parseInt(reqBody.category_id.toString());
				if (isNaN(categoryId)) {
					throw new BadRequestException("Not a valid category");
				}
			} else {
				categoryId = reqBody.category_id;
			}

			// Check if category is valid
			let validCategory = await this.isValidCategoryId(categoryId);
			if (!validCategory) {
				throw new BadRequestException("Not a valid category");
			}

			// convert price to number if not a number
			// and check if price is greater 0
			if (isNaN(reqBody.price)) {
				price = parseFloat(reqBody.price.toString());
				if (isNaN(price) || price <= 0) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.price <= 0) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.price;
				}
			}

			// Check if title is empty
			if (reqBody.title === undefined
				|| reqBody.title === null
				|| reqBody.title === "") {
				throw new BadRequestException("Title is required");
			}

			// check if description is empty
			if (reqBody.description === undefined
				|| reqBody.description === null
				|| reqBody.description === "") {
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
				title: reqBody.title,
				description: reqBody.description,
				number_of_ratings: 0,
				rating: 0,
				category_id: reqBody.category_id,
				user_id: reqBody.user_id,
				price: reqBody.price
			};

			try {
				await Connector.executeQuery(QueryBuilder.createOffer(offer));
			} catch (e) {
				throw new InternalServerErrorException("Could not create offer");
			}

			// Check dates if given
			if (reqBody.blocked_dates !== undefined
				&& reqBody.blocked_dates !== null) {
				reqBody.blocked_dates.forEach(dateRange => {
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
							|| moment(dateRange.to_date.toString()).diff(dateRange.from_date.toString()) < 0) {
							throw new BadRequestException("Invalid date range for unavailablity of product");
						} else if (moment(dateRange.from_date.toString()).diff(moment()) < 0
							|| moment(dateRange.to_date.toString()).diff(moment()) < 0) {
							// Throw error, if from_date or to_date is in past
							throw new BadRequestException("Blocked dates cannot be set in past")
						}
					}
				});

				// Insert blocked dates in database
				await reqBody.blocked_dates.forEach(async (blockedDateRange) => {
					// Generate new uuid
					let offerBlockedId = uuid();
					// Insert new blocked dates
					try {
						await Connector.executeQuery(QueryBuilder.insertBlockedDateForOfferId({
							offer_blocked_id: offerBlockedId,
							offer_id: offerId,
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
			&& images.length > 0) {

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

			images.forEach(async image => {
				// Generate a new uuid for each picture,
				// save picture on disk and create database insert
				let imageId = uuid();

				// Check if images 
				if (image.fieldname === undefined || image.fieldname === null || image.fieldname !== "images") {
					throw new BadRequestException("Invalid fields");
				}

				if (image.size === undefined
					|| image.size === null
					|| image.size <= 0
					|| image.size > 5242880) {
					throw new BadRequestException("Invalid image size");
				}

				// Save image
				try {
					await FileHandler.saveImage(image, imageId);
				} catch (e) {
					throw e;
				}

				// Write to database
				let fileEnding = ('.' + image.originalname.replace(/^.*\./, ''));
				try {
					await Connector.executeQuery(QueryBuilder.insertImageByOfferId(reqBody.offer_id, (imageId + fileEnding)))
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}
			});

			// Return offer
			return await this.getOfferById(reqBody.offer_id);
		} else {
			throw new BadRequestException("Could not upload image(s)");
		}
	}

	/**
	 * Checks if an given image is valid and returns the given path if so else it throws an exeption
	 * @param image image name and ending in format <name>.<ending>
	 */
	public checkImagePath(imagePath: string): string {
		if (!FileHandler.isValidImagePath(imagePath)) {
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
		session_id?: string,
		user_id?: string,
		title?: string,
		description?: string,
		price?: number,
		category_id?: number,
		delete_images?: Array<string>,
		blocked_dates?: Array<{
			from_date: Date,
			to_date: Date
		}>
	}, images?: Array<{
		fieldname: string,
		originalname: string,
		encoding: string,
		mimetype: string,
		buffer: Buffer,
		size: number
	}>): Promise<Offer> {

		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
			let categoryId: number = 0;
			let price: number = 0;

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
			if (isNaN(reqBody.category_id)) {
				categoryId = parseInt(reqBody.category_id.toString());
				if (isNaN(categoryId)) {
					throw new BadRequestException("Not a valid category");
				}
			} else {
				categoryId = reqBody.category_id;
			}

			// Check if category is valid
			let validCategory = await this.isValidCategoryId(categoryId);
			if (!validCategory) {
				throw new BadRequestException("Not a valid category");
			}

			// Convert price to number if not a number
			// and check if price is greater 0
			if (isNaN(reqBody.price)) {
				price = parseFloat(reqBody.price.toString());
				if (isNaN(price) || price <= 0) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.price <= 0) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.price;
				}
			}

			// Check if title is empty
			if (reqBody.title === undefined
				|| reqBody.title === null
				|| reqBody.title === "") {
				throw new BadRequestException("Title is required");
			}

			// Check if description is empty
			if (reqBody.description === undefined
				|| reqBody.description === null
				|| reqBody.description === "") {
				throw new BadRequestException("Description is required");
			}

			// Delete images
			if (reqBody.delete_images !== undefined && reqBody.delete_images !== null) {
				reqBody.delete_images.forEach(imageUrl => {
					try {
						let image = imageUrl.replace(BASE_OFFER_LINK, '');
						Connector.executeQuery(QueryBuilder.deletePictureById(image));
						FileHandler.deleteImage(imageUrl);
					} catch (e) {
						throw new InternalServerErrorException("Could not delete image");
					}
				});
			}

			// upload images
			if (images !== undefined && images !== null) {

				// Check number of images
				let imagesFromDatabase;
				try {
					imagesFromDatabase = await Connector.executeQuery(QueryBuilder.getOfferPictures(offerToValidateUser.offer_id));

				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				let numberOfimages = imagesFromDatabase.length + images.length;

				if (numberOfimages > 10) {
					throw new BadRequestException("Too many images");
				} else {
					try {
						await this.uploadPicture({
							session_id: reqBody.session_id,
							user_id: reqBody.user_id,
							offer_id: offerToValidateUser.offer_id
						}, images);
					} catch (e) {
						throw new InternalServerErrorException("Something went wrong...");
					}
				}
			}

			// Update offer
			try {
				await Connector.executeQuery(QueryBuilder.updateOffer({
					offer_id: id,
					title: reqBody.title,
					description: reqBody.description,
					price: price,
					category_id: categoryId
				}));
			} catch (e) {
				throw new BadRequestException("Could not update offer");
			}

			// Check dates if given
			if (reqBody.blocked_dates !== undefined
				&& reqBody.blocked_dates !== null) {
				reqBody.blocked_dates.forEach(dateRange => {
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
							|| moment(dateRange.to_date.toString()).diff(dateRange.from_date.toString()) < 0) {
							throw new BadRequestException("Invalid date range for unavailablity of product");
						} else if (moment(dateRange.from_date.toString()).diff(moment()) < 0
							|| moment(dateRange.to_date.toString()).diff(moment()) < 0) {
							// Throw error, if from_date or to_date is in past
							throw new BadRequestException("Blocked dates cannot be set in past")
						}
					}
				});

				// Delete all blocked dates
				try {
					await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id));
				} catch (e) {
					throw new BadRequestException("Could not delete old unavailable dates of product");
				}

				// Insert blocked dates in database
				reqBody.blocked_dates.forEach(async (blockedDateRange) => {
					// Generate new uuid
					let offerBlockedId = uuid();
					// Insert new blocked dates
					try {
						await Connector.executeQuery(QueryBuilder.insertBlockedDateForOfferId({
							offer_blocked_id: offerBlockedId,
							offer_id: id,
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
		session_id?: string,
		user_id?: string,
		message?: string,
		date_range?: {
			from_date: Date,
			to_date: Date
		}
	}): Promise<{
		request_id: string,
		user_id: string,
		offer_id: string,
		status_id: number,
		from_date: Date,
		to_date: Date,
		message: string
	}> {
		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
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
				throw new BadRequestException("Invaild date/date range");
			} else {
				// Throw error, if a start_date, end_date
				// or range from start to end is invalid
				if (!moment(reqBody.date_range.from_date.toString()).isValid()
					|| !moment(reqBody.date_range.to_date.toString()).isValid()
					|| moment(reqBody.date_range.to_date.toString()).diff(reqBody.date_range.from_date.toString()) < 0) {
					throw new BadRequestException("Invalid date range for request");
				} else if (moment(reqBody.date_range.from_date.toString()).diff(moment()) < 0
					|| moment(reqBody.date_range.to_date.toString()).diff(moment()) < 0) {
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

			console.log(inputRange)

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

			// TODO: Create concept for status
			let request: {
				request_id: string,
				user_id: string,
				offer_id: string,
				status_id: number,
				from_date: Date,
				to_date: Date,
				message: string
			} = {
				request_id: requestUuid,
				user_id: reqBody.user_id,
				offer_id: id,
				status_id: 1,
				from_date: new Date(moment(
					reqBody.date_range.from_date.toString()
				).format("YYYY-MM-DD")),
				to_date: new Date(moment(
					reqBody.date_range.to_date.toString()
				).format("YYYY-MM-DD")),
				message: (reqBody.message === undefined || reqBody.message === null) ? "" : reqBody.message
			}

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

	public async rateOffer(id: string, reqBody: {}) {
		throw new Error("Method not implemented.");
	}

	/**
	 * Deletes a given offer after user is authenticated
	 * @param id ID of the offer to be deleted
	 * @param reqBody Additional data to authenticate user and delete offer
	 */
	public async deleteOffer(id: string, reqBody: {
		session_id?: string,
		user_id?: string
	}): Promise<Offer> {
		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {

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

			// Delete all blocked dates
			try {
				await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id));
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

			// Delete offer from database
			try {
				await Connector.executeQuery(QueryBuilder.deleteOfferById(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...")
			}

			return offer;
		} else {
			throw new BadRequestException("Could not delete offer");
		}
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

		if (offers.length === 1) {
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

		if (categories.length === 1) {
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

		if (offerList.length > 0) {
			for (let i = 0; i < offerList.length; i++) {
				let pictureUUIDList: Array<{
					uuid: string,
					offer_id: string
				}> = [];

				let lessorDataList: Array<{
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
					pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(offerList[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				try {
					lessorDataList = await Connector.executeQuery(QueryBuilder.getUserByOfferId(offerList[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (lessorDataList === undefined || lessorDataList === null || lessorDataList.length !== 1) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (pictureUUIDList.length > 0) {
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
						lessor: {
							first_name: lessorDataList[0].first_name,
							last_name: lessorDataList[0].last_name,
							user_id: offerList[i].user_id,
							post_code: lessorDataList[0].post_code,
							city: lessorDataList[0].city,
							verified: (lessorDataList[0].verified === 1 ? true : false),
							lessor_rating: lessorDataList[0].lessor_rating,
							number_of_lessor_ratings: lessorDataList[0].number_of_lessor_ratings
						}
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
						lessor: {
							first_name: lessorDataList[0].first_name,
							last_name: lessorDataList[0].last_name,
							user_id: offerList[i].user_id,
							post_code: lessorDataList[0].post_code,
							city: lessorDataList[0].city,
							verified: (lessorDataList[0].verified === 1 ? true : false),
							lessor_rating: lessorDataList[0].lessor_rating,
							number_of_lessor_ratings: lessorDataList[0].number_of_lessor_ratings
						}
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
					reason?: string
				}> = [];

				let o = offerList[i];

				try {
					blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(offerList[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (blockedDatesList.length > 0) {
					let blockedDates: Array<{
						from_date: Date,
						to_date: Date
					}> = [];

					for (let i = 0; i < blockedDatesList.length; i++) {
						blockedDates.push({
							from_date: blockedDatesList[i].from_date,
							to_date: blockedDatesList[i].to_date
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
}