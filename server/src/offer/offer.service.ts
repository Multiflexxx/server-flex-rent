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
import { User } from 'src/user/user.model';
import { Request } from './request.model';
import { request } from 'express';

const BASE_OFFER_LINK = require('../../file-handler-config.json').offer_image_base_url;

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
	 * @param id ID of the user
	 */
	public async getOffersByUserId(id: string): Promise<Array<Offer>> {
		console.log(id)
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
				if (isNaN(price) || price <= 0) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.offer.price <= 0) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.offer.price;
				}
			}

			// Check if title is empty
			if (reqBody.offer.title === undefined
				|| reqBody.offer.title === null
				|| reqBody.offer.title === "") {
				throw new BadRequestException("Title is required");
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
				price: reqBody.offer.price
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
				await reqBody.offer.blocked_dates.forEach(async (blockedDateRange) => {
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

				if (numberOfimages > 10) {
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
							|| images[i].size <= 0
							|| images[i].size > 5242880) {
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
				if (isNaN(price) || price <= 0) {
					throw new BadRequestException("Not a valid price");
				}
			} else {
				if (reqBody.offer.price <= 0) {
					throw new BadRequestException("Not a valid price");
				} else {
					price = reqBody.offer.price;
				}
			}

			// Check if title is empty
			if (reqBody.offer.title === undefined
				|| reqBody.offer.title === null
				|| reqBody.offer.title === "") {
				throw new BadRequestException("Title is required");
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
				reqBody.offer.blocked_dates.forEach(async (blockedDateRange) => {
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
			let request: Request = {
				request_id: requestUuid,
				user: user.user,
				offer: offer,
				status_id: 1,
				from_date: new Date(moment(
					reqBody.date_range.from_date.toString()
				).format("YYYY-MM-DD")),
				to_date: new Date(moment(
					reqBody.date_range.to_date.toString()
				).format("YYYY-MM-DD")),
				message: (reqBody.message === undefined || reqBody.message === null) ? "" : reqBody.message,
				qr_code_id: ""
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

	/**
	 * Returns an offer after rating the offer
	 * @param id ID of the offer to be rated
	 * @param reqBody data to validate user and rating (number between 1 and 5)
	 */
	public async rateOffer(id: string, reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		rating?: string
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
			if (offer.lessor.user_id === user.user.user_id) {
				throw new UnauthorizedException("Offer cannot be rated by lessor");
			}

			let userRating = 0;
			if (reqBody.rating !== undefined && reqBody.rating !== null) {
				// Update limit, if given
				userRating = parseFloat(reqBody.rating);
				if (isNaN(userRating) || userRating <= 0.0 || userRating > 5.0) {
					// Not a number
					throw new BadRequestException("Rating is not a valid number");
				}
			}

			let updatedRating = parseFloat(((offer.rating * offer.number_of_ratings + userRating) / (offer.number_of_ratings + 1)).toFixed(2));

			try {
				Connector.executeQuery(QueryBuilder.updateOfferRating({
					offer_id: id,
					rating: updatedRating,
					number_of_ratings: (offer.number_of_ratings + 1)
				}));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			return await this.getOfferById(id);
		} else {
			throw new BadRequestException("Invalid request");
		}
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
	 * Returns a single request for a given request OR all request for a user
	 * @param reqBody Data to authenticate user + statuscode to filter AND/OR request, if needed
	 */
	public async getRequests(reqBody: {
		session?: {
			session_id?: string,
			user_id?: string
		},
		request?: Request,
		status_code?: number
	}): Promise<Request | Array<Request>> {
		if (reqBody !== undefined && reqBody !== null && reqBody.session !== undefined && reqBody.session !== null) {
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

				if (dbRequests.length < 1) {
					throw new BadRequestException("Request does not exist");
				} else if (dbRequests.length === 1) {
					let offer: Offer;

					try {
						offer = await this.getOfferById(dbRequests[0].offer_id);
					} catch (error) {
						throw new InternalServerErrorException("Something went wrong...");
					}

					let o: Request = {
						request_id: dbRequests[0].request_id,
						user: user.user,
						offer: offer,
						status_id: dbRequests[0].status_id,
						from_date: dbRequests[0].from_date,
						to_date: dbRequests[0].to_date,
						message: dbRequests[0].message,
						qr_code_id: (dbRequests[0].qr_code_id === null) ? "" : dbRequests[0].qr_code_id
					}

					return o;
				} else {
					throw new InternalServerErrorException("Something went wrong...");
				}
			} else {
				//TODO:
				// check for status code to separate open/pending offers and closed(done) offers
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

				// TODO: change number
				if(reqBody.status_code !== undefined && reqBody.status_code === 100) {
					try {
					dbRequests = await Connector.executeQuery(QueryBuilder.getRequest({ 
						user_id: reqBody.session.user_id,
						status_code: reqBody.status_code 
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
				
				for (let i = 0; i < dbRequests.length; i++) {
					let offer: Offer;

					try {
						offer = await this.getOfferById(dbRequests[i].offer_id);
					} catch (error) {
						throw new InternalServerErrorException("Something went wrong...");
					}

					let o: Request = {
						request_id: dbRequests[i].request_id,
						user: user.user,
						offer: offer,
						status_id: dbRequests[i].status_id,
						from_date: dbRequests[i].from_date,
						to_date: dbRequests[i].to_date,
						message: dbRequests[i].message,
						qr_code_id: (dbRequests[i].qr_code_id === null) ? "" : dbRequests[0].qr_code_id
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