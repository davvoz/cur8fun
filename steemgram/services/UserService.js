class UserService {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    async getUserProfile(username) {
        try {
            const response = await this.apiClient.get(`/users/${username}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            throw error;
        }
    }

    async updateUserProfile(username, profileData) {
        try {
            const response = await this.apiClient.put(`/users/${username}`, profileData);
            return response.data;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
}

export default UserService;
