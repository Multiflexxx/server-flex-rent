export interface ChatMessage {
    chat_id: string,
    from_user_id: string,
    to_user_id: string,
    message_content: string,
    message_type: string,
    status_id: number,
    created_at: Date,
    message_id?: string
}