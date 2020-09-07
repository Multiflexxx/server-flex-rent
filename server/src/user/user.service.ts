import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from './user.model';
import { Connector } from 'src/util/database/connector';
import * as EmailValidator from 'email-validator';

@Injectable()
export class UserService {

    public async getUser(id: number): Promise<User>{
      console.log(await Connector.executeQuery({query: "SELECT * FROM user", args: []}));
        throw new Error("Method not implemented.");
    }
    
    public async createUser(user: any) : Promise<User> {
        // Validate User input:
        if(!this.validateRegistrationInput(user)) {
            throw new BadRequestException("Invalid user input");
        }
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
