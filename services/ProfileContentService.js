import profileService from './ProfileService.js';

export default class ProfileContentService {
  static async loadPosts(username, limit, page, options = {}) {
    if (!username) {
      throw new Error('Username is required');
    }
    
    // Delegate to the existing ProfileService for now
    return await profileService.getUserPosts(username, limit, page, options);
  }
  
  static async loadComments(username, limit, page, options = {}) {
    if (!username) {
      throw new Error('Username is required');
    }
    
    // Delegate to the existing ProfileService for now
    return await profileService.getUserComments(username, limit, page, options);
  }
  
  static async getFollowerCount(username) {
    return await profileService.getFollowerCount(username);
  }
  
  static async getFollowingCount(username) {
    return await profileService.getFollowingCount(username);
  }
  
  static async isFollowing(targetUsername, currentUser) {
    return await profileService.isFollowing(targetUsername, currentUser);
  }
  
  static async followUser(targetUsername, currentUser) {
    return await profileService.followUser(targetUsername, currentUser);
  }
  
  static async unfollowUser(targetUsername, currentUser) {
    return await profileService.unfollowUser(targetUsername, currentUser);
  }
}
