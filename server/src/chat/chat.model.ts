import { User } from "src/user/user.model";
import { ChatMessage } from "./chat-message.model";

export interface Chat {
    chat_id: string,
    chat_partner: User,
    last_message: ChatMessage,
    unread_messages: boolean,
    is_allowed_to_chat: boolean
}