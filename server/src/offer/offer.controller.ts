import { Controller, Get, Param, Put, Patch, Delete, Query, Body, Post } from '@nestjs/common';
import { OfferService } from './offer.service';

@Controller('offer')
export class OfferController {
	constructor(private readonly offerService: OfferService) {}

	/**
	 * Applies filters passed in the request and return a subset of all Offers 
	 */
	@Get('all')
	getAllOffers(
		@Query() query: {}
	) {
		return this.offerService.getAll(query);
	}

	/**
	 * Returns all available categories
	 */
	@Get('categories')
	getAllCategories() {
		return this.offerService.getAllCategories();
	}

	/**
	 * Returns a set of offers to be shown on the Homepage
	 */
	@Get()
	getHomePageOffers() {
		return this.offerService.getHomePageOffers();
	}
	
	
	/**
	 * Returns an offer object containing the offer by ID.
	 * @param id ID of offer to be found
	 */
	@Get(':id')
	getOfferById(
		@Param('id') id: string
	) {
		return this.offerService.getOfferById(id);
	}

	/**
	 * Updates an offer given the id and parameters to be updated, given sufficient authorization. 
	 * @param reqBody Update parameters
	 * @param id ID of offer to be updated
	 */
	@Patch(':id')
	updateOffer(
		@Body() reqBody: {},
		@Param('id') id: number
	) {
		return this.offerService.updateOffer(id, reqBody);
	}

	/**
	 * Creates a new offer using the parameters passed in the request's body
	 * @param reqBody Parameters of Offer to be created
	 */
	@Put()
	createOffer(
		@Body() reqBody: {}
	) {
		return this.offerService.createOffer(reqBody);
	}

	/**
	 * Deletes an offer given an ID and sufficient authorization.
	 * @param id ID of offer to be deleted
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Delete(':id')
	deleteOffer(
		@Param('id') id: number,
		@Body() reqBody: {}
	) {
		return this.offerService.deleteOffer(id, reqBody);
	}
	
	/**
	 * Books offer for a specified time frame, given sufficient authorization.
	 * @param id ID of offer to be booked
	 * @param reqBody 
	 */
	@Post(':id')
	bookOffer(
		@Param('id') id: number,
		@Body() reqBody: {}
	) {
		return this.offerService.bookOffer(id, reqBody);
	}
}
