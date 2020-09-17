import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
const fs = require('fs');
const FileType = require('file-type');
const config = require('../../../file-handler-config.json');

export class FileHandler {

	/**
	 * Checks if the image is valid and saves it on disk
	 * @param image Image object to save on disk
	 * @param imageId Created UUID to save the image with a new file
	 */
	public static async saveImage(image: {
		fieldname: string,
		originalname: string,
		encoding: string,
		mimetype: string,
		buffer: Buffer,
		size: number
	}, imageId: string) {
		// Check file ending
		let fileEnding = ('.' + image.originalname.replace(/^.*\./, ''));
		if (!config.accepted_file_endings.includes(fileEnding)) {
			throw new BadRequestException("Not a valid image type");
		}

		// Check Mime type
		let mimetype = await FileType.fromBuffer(image.buffer);
		if (!config.accepted_mime_types.includes(mimetype.mime)) {
			throw new BadRequestException("Not a valid image type");
		}

		// Write to disk
		try {
			fs.writeFileSync((config.file_storage_path + imageId + fileEnding), image.buffer, { mode: 0o755 });
		} catch (e) {
			throw new InternalServerErrorException("Could not process images");
		}
	}

	public static deleteImage(imageUrl: string) {
		//remove url part, which is stored together with the image in the database
		let image = imageUrl.replace(config.image_base_link, '');
		try {
			fs.unlinkSync((config.file_storage_path + image));
		} catch (e) {
			console.log(e)
			throw new InternalServerErrorException("Could not delete image");
		}
	}

	/**
	 * Returns true or false wether the image exists on the disk or not
	 * @param image image which is requested in format <image-name>.<ending>
	 */
	public static isValidImagePath(image: string): boolean {
		try {
			if (fs.existsSync(config.file_storage_path + image)) {
				return true;
			} else {
				return false;
			}
		} catch (e) {
			throw e;
		}
	}
}