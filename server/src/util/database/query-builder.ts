import { User } from "src/user/user.model";
import { Query } from "./query.model";

export class QueryBuilder {
	/**
	* Structure of an query Object
	*/

	public static createUser(user: User): Query {
		return {
			query: "INSERT INTO user (user_id, first_name, last_name, email, phone_number, password_hash, verified, place_id, street, house_number, lessee_rating, number_of_lessee_ratings, lessor_rating, number_of_lessor_ratings, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				user.user_id,
				user.first_name,
				user.last_name,
				user.email,
				user.phone_number,
				user.password_hash,
				user.verified,
				user.place_id,
				user.street, 
				user.house_number,
				user.lessee_rating,
				user.number_of_lessee_ratings,
				user.lessor_rating,
				user.number_of_lessor_ratings,
				user.date_of_birth
			]
		}
	}

	public static getUser(user_id?: number, email?: string, password_hash?: string) {

	}



}