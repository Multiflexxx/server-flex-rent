import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import { Offer } from './offer.model';
import { Category } from './category.model';
import { uuid } from 'uuidv4';
import moment = require('moment');

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
				throw new BadRequestException("Category does not exist");
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

			try {
				pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(id));
			} catch (error) {
				throw new InternalServerErrorException("Something went wrong...");
			}

			try {
				blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(id));
			} catch (e) {
				throw new InternalServerErrorException("something went wrong...");
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
	 * Method to update an offer with a given ID
	 * @param id ID of the offer which shall be updated
	 * @param reqBody Data to update the offer
	 */
	public async updateOffer(id: any, reqBody: {
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

	public async deleteOffer(id: any, reqBody: any) {
		throw new Error("Method not implemented.");
	}

	/**
	 * returns true if an offer is valid
	 * @param id ID of the offer which shall be validated
	 */
	private async isValidOfferId(id: string): Promise<boolean> {
		let offers = await Connector.executeQuery(
			QueryBuilder.getOffer({ offer_id: id })
		);

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
		let categories = await Connector.executeQuery(
			QueryBuilder.getCategories({ category_id: id })
		);

		if (categories.length === 1) {
			return true;
		} else {
			return false;
		}
	}
}
