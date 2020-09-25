import { Controller, Get, Param, Put, Patch, Delete, Query, Body, Post, UseInterceptors, UploadedFiles, Res, NotFoundException } from '@nestjs/common';
import { OfferService } from './offer.service';
import { FilesInterceptor } from '@nestjs/platform-express';
const fileConfig = require('../../file-handler-config.json');

@Controller('offer')
export class OfferController {
	constructor(private readonly offerService: OfferService) { }

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
	 * Returns all offers for a user after validation of the user
	 * @param reqBody user_id and session_id to validate user
	 */
	@Get('user-offers/')
	getOffersByUserId(
		@Body() reqBody: {}
	) {
		return this.offerService.getOffersByUserId(reqBody);
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
	 * @param images An array of images 
	 */
	@Patch(':id')
	@UseInterceptors(FilesInterceptor('images', 10))
	updateOffer(
		@Body() reqBody: {},
		@Param('id') id: string,
		@UploadedFiles() images
	) {
		return this.offerService.updateOffer(id, reqBody, images);
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
	@Put('images')
	@UseInterceptors(FilesInterceptor('images', 10))
	uploadOfferPicture(
		@UploadedFiles() images,
		@Body() reqBody
	) {
		return this.offerService.uploadPicture(reqBody, images);
	}

	/**
	 * Deletes an offer given an ID and sufficient authorization.
	 * @param id ID of offer to be deleted
	 * @param reqBody body of the request is used for passing authorization details
	 */
	@Delete(':id')
	deleteOffer(
		@Param('id') id: string,
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
		@Param('id') id: string,
		@Body() reqBody: {}
	) {
		// User-ID, offer-ID, date-range, message, (payment?)
		return this.offerService.bookOffer(id, reqBody);
	}

	@Post('rate/:id')
	rateOffer(
		@Param('id') id: string,
		@Body() reqBody: {}
	) {
		return this.offerService.rateOffer(id, reqBody);
	}
}
