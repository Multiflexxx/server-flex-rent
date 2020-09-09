import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import { Offer } from './offer.model';
import { Category } from './category.model';

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
	}): Promise<Offer> {
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

		let offers = await Connector.executeQuery(
			QueryBuilder.getOffer({
				query: {
					limit: limit,
					category: category,
					search: search
				}
			}));

		if (offers.length > 0) {
			for (let i = 0; i < offers.length; i++) {
				let pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(offers[i].offer_id));
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
			throw new NotFoundException("No offers found");
		}
	}

	/**
	 * Returns an offer object containing the offer by ID.
	 * @param id ID of offer to be found
	 */
	public async getOfferById(id: number): Promise<Offer> {
		let offers: Array<Offer> = await Connector.executeQuery(QueryBuilder.getOffer({ offer_id: id }));

		if (offers.length > 0) {
			let pictureUUIDList = await Connector.executeQuery(QueryBuilder.getOfferPictures(id));
			let blockedDatesList = await Connector.executeQuery(QueryBuilder.getBlockedOfferDates(id));
			if (pictureUUIDList.length > 0) {
				let pictureLinks: Array<string> = [];

				for (let i = 0; i < pictureUUIDList.length; i++) {
					pictureLinks.push(BASE_OFFER_LINK + pictureUUIDList[i].uuid)
				}
				offers[0].picture_links = pictureLinks;
			} else {
				offers[0].picture_links = [];
			}
			if(blockedDatesList.length > 0) {
				let blockedDates: Array<{
					from_date: Date,
					to_date: Date
				}> = [];

				for(let i = 0; i < blockedDatesList.length; i++) {
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
		let categories = await Connector.executeQuery(QueryBuilder.getCategory());
		if (categories.length > 0) {
			return categories;
		} else {
			throw new InternalServerErrorException("Could not get categories");
		}
	}

	public async createOffer(reqBody: {}) {
		throw new Error("Method not implemented.");
	}

	public async updateOffer(id: any, reqbody: any) {
		throw new Error("Method not implemented.");
	}

	public async bookOffer(id: number, reqBody: {}) {
		throw new Error("Method not implemented.");
	}

	public async deleteOffer(id: any, reqBody: any) {
		throw new Error("Method not implemented.");
	}
}
