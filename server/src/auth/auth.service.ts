import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from 'src/user/user.model';

@Injectable()
export class AuthService {
    async validateUser(
        authorization: {
            login?: {
                email: string,
                passwordHash: string
            },
            session?: {
                session_id: string,
                user_id: string
            }
        }
    ): Promise<User> {
        let user: User;

        // Decide whether to use login or session data
        if(authorization.login) {
            // Authenticate using login data 
            
        } else if(authorization.session) {
            // Authenticate using session data 

        } else {
            throw new BadRequestException("Invalid authorization parameters");
        }

        return user;
    }
}
