import { Controller } from '@nestjs/common';
import { Get, Param, Put, Patch, Delete, Query, Body, Post, UseInterceptors, UploadedFiles, Res, NotFoundException, NotImplementedException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as StaticConsts from 'src/util/static-consts';
import { ChatMessage } from './chat-message.model';
import { UserSession } from 'src/user/user-session.model';
const fileConfig = require('../../file-handler-config.json');

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    /**
     * Accepts up to ten files to upload images
     * @param images field key for files array
     */
    @Post('images')
    @UseInterceptors(FilesInterceptor('images', StaticConsts.MAX_NUMBER_OF_OFFER_IMAGES))
    uploadChatPicture(
        @UploadedFiles() images,
        @Body() reqBody: {}
    ) {
        return this.chatService.uploadPictures(reqBody, images);
    }

    /**
     * Is used to create a new chat message, returns the sent message
     * @param session user + session for authentication
     * @param message message from user
     */
    @Put()
    receiveChatMessage(
        @Body('session') session: UserSession,
        @Body('message') message: ChatMessage
    ) {
        return this.chatService.receiveChatMessage(session, message);
    }

    /**
     * Returns the that messages for a given chat id after authentication
     * @param id Chat id
     * @param reqBody authentication
     */
    @Post(':id')
    getMessagesByChatId(
        @Param('id') chatId: string,
        @Body('session') session: UserSession,
        @Body('query') query: {
            page: number
        }
    ) {
        return this.chatService.getMessagesByChatId(chatId, session, query);
    }


    /**
     * Returns all(paged) chats for a given userId
     * @param userId ID of user
     * @param session user + session for authentication
     * @param query used for paging
     */
    @Post('all/:id')
    getChatsForUser(
        @Param('id') userId: string,
        @Body('session') session: UserSession,
        @Body('query') query: {
            page: number
        }
    ) {
        return this.chatService.getChatsForUser(userId, session, query);
    }

    /**
     * USED FOR TESTING
     */
    // @Get('test/generate')
    // generateFakeData() {
    //     return this.chatService.generateTestData();
    // }
}
