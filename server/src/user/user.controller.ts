import { Controller, Get, Param, Put, Body, Patch, Delete, Req } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    /**
     * Returns a single user specified by the ID passed in the URL
     * @param id ID of user
     */
    @Get(':id')
    getUser(
        @Param('id') id: number
    ) {
        return this.userService.getUser(id);
    }

    /**
     * Creates a user with the Specified parameters in the request's body
     * @param reqBody Parameters of user to be created
     */
    @Put()
    createUser(
        @Body() reqBody: {},
    ) {
        return this.userService.createUser(reqBody);
    }

    /**
     * Updates a specified user with the data passed in the request's body.
     * @param id ID of user to be updated
     * @param reqBody Parameters-Value pairs to be updated, also contains authorization
     */
    @Patch(':id')
    updateUser(
        @Param('id') id: number,
        @Body() reqBody: {},
        @Req() req: any
    ) {
        return this.userService.updateUser(id, req.cookies['session_id'], reqBody);
    }

    /**
     * Deletes user given a ID and sufficient authorization
     * @param id 
     * @param reqBody 
     */
    @Delete(':id')
    deleteUser(
        @Param('id') id: number,
        @Body() reqBody: {}
    ) {
        return this.userService.deleteUser(id, reqBody);
    }
}
