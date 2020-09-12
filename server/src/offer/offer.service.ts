import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import { FileHandler } from 'src/util/file-handler/file-handler'
import { Offer } from './offer.model';
import { Category } from './category.model';
import { uuid } from 'uuidv4';
import moment = require('moment');

// TODO: Change links (Create config file)
const BASE_OFFER_LINK = "https://flexrent.multiflexxx.de/pictures/";


@Injectable()
export class OfferService {
	public async getHomePageOffers() {
		throw new Error("Method not implemented.");
	}

	/**
	 * Returns an array of offer objects matching the given filter criteria
	 * @param query query wich is send to server
	 * If a parameter called 'limit' with a value greater 0 is provided,
	 * the limit is used for the return
	 * If a parameter called 'category' with a numeric value > 0 is provided,
	 * the result is filtered by category
	 * If a parameter called 'search' is provided wit a non empty string,
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

		if (query.limit !== null && query.limit !== undefined) {
			// Update limit, if given
			limit = parseInt(query.limit);
			if (isNaN(limit)) {
				// Not a number
				throw new BadRequestException("Limit is not a valid number");
			}
		}
		if (query.category !== null && query.category !== undefined) {
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
		if (query.search !== null && query.search !== undefined) {
			if (query.search === "") {
				throw new BadRequestException("Search string is invalid");
			} else {
				search = query.search;
			}
		}

		let offers: Array<Offer>;
		try {
			offers = await Connector.executeQuery(
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

		if (offers.length > 0) {
			for (let i = 0; i < offers.length; i++) {
				let pictureUUIDList: Array<{
					uuid: string,
					offer_id: string
				}> = [];

				try {
					pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(offers[i].offer_id));
				} catch (e) {
					throw new InternalServerErrorException("Something went wrong...");
				}

				if (pictureUUIDList.length > 0) {
					let pictureLinks: Array<string> = [];

					for (let j = 0; j < pictureUUIDList.length; j++) {
						pictureLinks.push(BASE_OFFER_LINK + pictureUUIDList[j].uuid)
					}
					offers[i].picture_links = pictureLinks;
				} else {
					offers[i].picture_links = [];
				}
			}
			return offers;
		} else {
			return [];
		}
	}

	/**
	 * Returns an offer object containing the offer by ID.
	 * @param id ID of offer to be found
	 */
	public async getOfferById(id: string): Promise<Offer> {
		let offers: Array<Offer>
		try {
			offers = await Connector.executeQuery(QueryBuilder.getOffer({ offer_id: id }));
		} catch (e) {
			throw new InternalServerErrorException("Something went wrong...");
		}

		if (offers.length > 0) {
			let pictureUUIDList: Array<{
				uuid: string,
				offer_id: string
			}> = [];

			let blockedDatesList: Array<{
				offer_blocked_id: string,
				offer_id: string,
				from_date: Date,
				to_date: Date,
				reason?: string
			}> = [];

			let userDataList: Array<{
				first_name: string,
				last_name: string,
				post_code: string,
				city: string,
				verified: number,
				rating: number
			}>;

			try {
				pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(id));
			} catch (error) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			try {
				blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			try {
				userDataList = await Connector.executeQuery(QueryBuilder.getUserByOfferId(id));
			} catch (e) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			if (pictureUUIDList.length > 0) {
				let pictureLinks: Array<string> = [];

				for (let i = 0; i < pictureUUIDList.length; i++) {
					pictureLinks.push(BASE_OFFER_LINK + pictureUUIDList[i].uuid)
				}
				offers[0].picture_links = pictureLinks;
			} else {
				offers[0].picture_links = [];
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

				offers[0].blocked_dates = blockedDates;
			} else {
				offers[0].blocked_dates = [];
			}

			if (userDataList.length > 0) {
				// SQL has no real boolean, so we need to change 0/1 to boolean
				// to achieve this, this helper object is used
				let o = {
					first_name: userDataList[0].first_name,
					last_name: userDataList[0].last_name,
					post_code: userDataList[0].post_code,
					city: userDataList[0].city,
					verified: (userDataList[0].verified === 1 ? true : false),
					rating: userDataList[0].rating
				}

				offers[0].user = o;
			} else {
				// It is impossible to have an offer without an user
				throw new InternalServerErrorException("Something went wrong...");
			}

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
		session_token?: string,
		user_id?: string,
		title?: string,
		description?: string,
		price?: number,
		category_id?: number,
		picture_links?: Array<string>,
		blocked_dates?: Array<{
			from_date: Date,
			to_date: Date
		}>
	}): Promise<Offer> {
		if (reqBody !== undefined && reqBody !== null) {
			let categoryId = 0;
			let price = 0;

			//TODO: Validate User 

			// convert category_id to number if not a number
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

			//TODO: validate picturelinks


			let offer: Offer = {
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
		session?: string,
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
			// Check if offer exists
			let validOffer = await this.isValidOfferId(reqBody.offer_id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
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
				try {
					await Connector.executeQuery(QueryBuilder.insertImageByOfferId(reqBody.offer_id, imageId))
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
	public async updateOffer(id: any, reqBody: {
		session_token?: string,
		user_id?: string,
		title?: string,
		description?: string,
		price?: number,
		category_id?: number,
		picture_links?: Array<string>,
		blocked_dates?: Array<{
			from_date: Date,
			to_date: Date
		}>
	}): Promise<Offer> {

		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {
			let categoryId: number = 0;
			let price: number = 0;

			//TODO: Authenticate User


			// Check if offer exists
			let validOffer = await this.isValidOfferId(id);
			if (!validOffer) {
				throw new BadRequestException("Not a valid offer");
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

			//TODO: Check picture links

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

	public async bookOffer(id: number, reqBody: {}) {
		throw new Error("Method not implemented.");
	}

	public async deleteOffer(id: string, reqBody: {
		session_token?: string,
		user_id?: string
	}): Promise<Offer> {
		if (id !== undefined && id !== null && id !== "" && reqBody !== undefined && reqBody !== null) {

			//TODO: Authenticate User

			//TODO: Check Session

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

			// Delete all blocked dates
			try {
				await Connector.executeQuery(QueryBuilder.deleteBlockedDatesForOfferId(id));
			} catch (e) {
				throw new BadRequestException("Could not delete old unavailable dates of product");
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
}
