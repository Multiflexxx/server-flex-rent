import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';
import { QueryBuilder } from 'src/util/database/query-builder';

@Injectable()
export class UserService {

	/**
	 * Returns a User Object containing publicly visible user information
	 * @param id ID of user
	 */
	public async getUser(id: string): Promise<User>{
		let user: User;
		// try {
		// 	let result = await Connector.executeQuery(QueryBuilder.getUser({user_id: id}))[0];
		// 	user = {
		// 		user_id = result.user_id,
		// 		first_name: result.first_name,
		// 		last_name: result.last_name,
		// 		email: result.email,
		// 		phone_number: result.phone_number,
		// 		password_hash: result.password_hash,
		// 		verified: result.verified,
		// 		place_id: result.place_id,
		// 		street: "",
				
		// 	}

		// }
		// await Connector.executeQuery(QueryBuilder.testQuery());

		// console.log(await Connector.executeQuery(QueryBuilder.testQuery()));
		return null;
		/* let user;
		try {
			user = await Connector.executeQuery(
				QueryBuilder.getUser({
					user_id: id
				})
			);
		} catch(e) {
			throw new InternalServerErrorException("Something went wrong...");
		}


		if(!user) {
			throw new 
		} */
	}
	
	public async createUser(user: any) : Promise<User> {
		// Validate User input:
		this.validateRegistrationInput(user);

		// Get place_id from postcode
			
		throw new Error("Method not implemented.");
	}

	public updateUser(id: number, cookie: any, req: any) {
		console.log(id, cookie, req);
		throw new Error("Method not implemented.");
	}
	
	public deleteUser(id: number, reqBody: {}) {
		throw new Error("Method not implemented.");
	}
   
	/**
	 * Checks whether user input is valid for registration. Returns true if input is valid, otherwise false
	 * @param user Input to be checked, format should follow the {User} schema
	 */
	private validateRegistrationInput(user: any) {
		// Validate Email format
		if (!user.email || !EmailValidator.validate(user.email)) {
			throw new BadRequestException("Invalid Email address");
		}

		// Check if Email is already registered
		if(Connector.executeQuery(QueryBuilder.getUser({email: user.email})))

		// Check if phone is already registered

		// Validate date of birth
		if (Object.prototype.toString.call(user.date_of_birth) === '[object Date]') {
			// Check if Birthdate is valid and in acceptable time range
			const presentDate: Date = new Date(); // Format:2020-03-24T14:30:42.836Z
			const date_of_birth: Date = new Date(user.date_of_birth); // Format: 2000-06-05T22:00:00.000Z
			// it is a date
			if (isNaN(date_of_birth.getTime())) {
				// date is not valid
				throw new BadRequestException("Invalid date of birth");
			} else {
				// date is valid
				if (date_of_birth > presentDate) {
					throw new BadRequestException("Invalid date of birth");
				}
			}
		} else {
			// not a date
			throw new BadRequestException("Invalid date of birth");
		}

		// Check region/place
		// TODO
		if(false) {
			throw new BadRequestException("Invalid post code / city");
		}

		return true;
	}
}
