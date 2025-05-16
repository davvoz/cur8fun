export const TYPES = {
    ALL : 'all',
    REPLIES : 'replies-notification',
    MENTIONS : 'mentions',
    FOLLOWS : 'follows',
    UPVOTES : 'upvotes',
    RESTEEMS : 'resteems'
}

export default class Notification {
    constructor(type, data, timestamp, isRead) {
        if (!Object.values(TYPES).includes(type)) {
            throw new Error(`Invalid notification type: ${type}`);
        }
        this.type = type;
        this.data = data;
        this.timestamp = timestamp;
        this.isRead = isRead;
    }
}
