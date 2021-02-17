import { Controller, Get, Param, Put, Patch, Delete, Query, Body, Post, UseInterceptors, UploadedFiles, Res, NotFoundException, NotImplementedException } from '@nestjs/common';
import { OfferService } from './offer.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as StaticConsts from 'src/util/static-consts';
const fileConfig = require('../../file-handler-config.json');

@Controller('offer')
export class OfferController {
	constructor(private readonly offerService: OfferService) { }

	/**
	 * Applies filters passed in the request and return a subset of all Offers
	 * post_code is a required query parameter!
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
	@Get('top-categories')
	getTopCategories() {
		return this.offerService.getTopCategories();
	}

	/**
	 * Returns all available categories
	 */
	@Get('categories')
	getAllCategories() {
		return this.offerService.getAllCategories();
	}

	/**
	 * Returns an image from disk
	 * @param image image name and ending in format <name>.<ending>
	 * @param response Image as file
	 */
	@Get('images/:id')
	getImages(
		@Param('id') image: string,
		@Res() response
	) {
		let filePath = this.offerService.checkImagePath(image);
		if (filePath !== "") {
			response.sendFile(fileConfig.file_storage_path + image);
		} else {
			throw new NotFoundException("Image not found");
		}
	}

	/**
	 * Returns all offers for a user id
	 * @param id  ID of the user
	 */
	@Get('user-offers/:id')
	getOffersByUserId(
		@Param('id') id: string
	) {
		return this.offerService.getOffersByUserId(id);
	}

	/**
	 * TODO: IMPlEMENT FILTERS
	 * Get all ratings for an offer
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Get('rating/:id')
	getOfferRating(
		@Param('id') id: string
	) {
		throw new NotImplementedException("Not implemented yet");
		//return this.offerService.rateOffer(id);
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
	 * INFO: Patch is used, because dart's http delete function does not support bodies
	 * Deletes an offer given an ID and sufficient authorization.
	 * @param id ID of offer to be deleted
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Patch('delete-offer/:id')
	deleteOffer(
		@Param('id') id: string,
		@Body() reqBody: {}
	) {
		return this.offerService.deleteOffer(id, reqBody);
	}

	/**
	* Updates an offer given the id and parameters to be updated, given sufficient authorization. 
	 * @param reqBody Update parameters
	 * @param id ID of offer to be updated
	 */
	@Patch(':id')
	updateOffer(
		@Body() reqBody: {},
		@Param('id') id: string,
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
	 * Accepts up to ten files to upload images
	 * @param images field key for files array
	 */
	@Post('images')
	@UseInterceptors(FilesInterceptor('images', StaticConsts.MAX_NUMBER_OF_OFFER_IMAGES))
	uploadOfferPicture(
		@UploadedFiles() images,
		@Body() reqBody
	) {
		return this.offerService.uploadPicture(reqBody, images);
	}

	/**
	 * Returns a request for a given request ID OR all requests for a given user and status code
	 * @param reqBody 
	 */
	@Post('user-requests')
	getRequests(
		@Body() reqBody: {}
	) {
		return this.offerService.getRequests(reqBody);
	}

	/**
	 * Handles accept/reject of requests to user
	 * handles QR-Code validation and item exchange between lessor and lessee
	 * @param reqBody needs a session + user AND a request object
	 * (status_id is used to check which request should be handled qr_code_id is needed if exchange process is triggered)
	 */
	@Post('handle-requests')
	handleRequests(
		@Body() reqBody: {}
	) {
		return this.offerService.handleRequests(reqBody);
	}

	/**
	 * Returns the number of new opened offer requests for lessor view
	 * and the number of accepted / rejected updates for lessee view
	 * and the total number of updates (sum of all)
	 * @param reqBody session object
	 */
	@Post('get-number-of-new-offer-requests')
	getNumberOfNewOfferRequestsPerUser(
		@Body() reqBody: {}
	) {
		return this.offerService.getNumberOfNewOfferRequestsPerUser(reqBody);
	}

	/**
	 * Books offer for a specified time frame, given sufficient authorization.
	 * @param id ID of offer to be booked
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Post(':id')
	bookOffer(
		@Param('id') id: string,
		@Body() reqBody: {}
	) {
		// User-ID, offer-ID, date-range, message, (payment?)
		return this.offerService.bookOffer(id, reqBody);
	}

	/**
	 * Rate an offer
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Put('rating')
	rateOffer(
		@Body() reqBody: {}
	) {
		return this.offerService.rateOffer(reqBody);
	}

	/**
	 * Update rating of an offer
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Patch('rating')
	updateOfferRating(
		@Body() reqBody: {}
	) {
		throw new NotImplementedException();
		//return this.offerService.rateOffer(reqBody);
	}

	// NEEDS TO BE LAST IN FILE!
	/**
	 * Returns a set of offers to be shown on the Homepage
	 * post_code is a required query parameter!
	 * distance is an optional query parameter
	 */
	@Get()
	getHomePageOffers(
		@Query() query: {}
	) {
		return this.offerService.getHomePageOffers(query);
	}
}
