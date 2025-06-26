"""
Scheduled Post Publisher Service

This service handles the automatic publishing of scheduled posts.
For testing purposes, this demonstrates the basic logic without actual blockchain publishing.
"""

import time
import threading
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from python.models import db, ScheduledPost

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ScheduledPostPublisher:
    """
    Service responsible for publishing scheduled posts at their designated time.
    
    This is a test implementation that demonstrates the logic flow without
    actually publishing to the blockchain.
    """
    
    def __init__(self, app=None):
        self.app = app
        self.running = False
        self.publisher_thread = None
        self.check_interval = 30  # Check every 30 seconds for more responsive testing
        
    def init_app(self, app):
        """Initialize the publisher with Flask app context"""
        self.app = app
        
        # Register cleanup handler
        import atexit
        atexit.register(self.stop)
        
    def start(self):
        """Start the publisher service"""
        if self.running:
            logger.warning("Publisher is already running")
            return
            
        self.running = True
        self.publisher_thread = threading.Thread(target=self._run_publisher, daemon=True)
        self.publisher_thread.start()
        logger.info("Scheduled post publisher started")
        
    def stop(self):
        """Stop the publisher service"""
        self.running = False
        if self.publisher_thread:
            self.publisher_thread.join(timeout=5)
        logger.info("Scheduled post publisher stopped")
        
    def _run_publisher(self):
        """Main publisher loop"""
        logger.info(f"Publisher loop started, checking every {self.check_interval} seconds")
        while self.running:
            try:
                logger.info("Publisher: Checking for scheduled posts...")
                with self.app.app_context():
                    self._check_and_publish_posts()
            except Exception as e:
                logger.error(f"Error in publisher loop: {e}")
                
            # Sleep but check every few seconds if we should stop
            for _ in range(self.check_interval):
                if not self.running:
                    break
                time.sleep(1)
        logger.info("Publisher loop ended")
            
    def _check_and_publish_posts(self):
        """Check for posts that need to be published and publish them"""
        now = datetime.utcnow()
        
        # Query for posts that should be published
        posts_to_publish = ScheduledPost.query.filter(
            ScheduledPost.scheduled_datetime <= now,
            ScheduledPost.status == 'scheduled'
        ).all()
        
        if not posts_to_publish:
            logger.info(f"No posts to publish at {now.strftime('%Y-%m-%d %H:%M:%S')} UTC")
            return
            
        logger.info(f"Found {len(posts_to_publish)} posts to publish")
        
        for post in posts_to_publish:
            try:
                self._publish_post(post)
            except Exception as e:
                logger.error(f"Failed to publish post {post.id}: {e}")
                self._mark_post_failed(post, str(e))
                
    def _publish_post(self, post: ScheduledPost):
        """
        Publish a single scheduled post.
        
        For testing purposes, this simulates the publishing process
        without actually posting to the blockchain.
        """
        logger.info(f"Publishing post: {post.id} - '{post.title}' by {post.username}")
        
        # Simulate blockchain publication preparation
        post_data = self._prepare_post_data(post)
        
        # TODO: In production, this would call the actual Steem API
        # For testing, we just simulate success
        if self._simulate_blockchain_publish(post_data):
            self._mark_post_published(post)
            logger.info(f"Successfully published post {post.id}")
        else:
            self._mark_post_failed(post, "Simulated blockchain error")
            logger.error(f"Failed to publish post {post.id}")
            
    def _prepare_post_data(self, post: ScheduledPost) -> dict:
        """Prepare post data for blockchain publishing"""
        tags = post.tags.split(',') if post.tags else []
        
        # Determine parent permlink
        parent_permlink = 'steemee'  # Default
        if post.community:
            parent_permlink = f"hive-{post.community.replace('hive-', '')}"
        elif tags:
            parent_permlink = tags[0]
            
        # Prepare metadata
        metadata = {
            'tags': tags,
            'app': 'steemee/1.0',
            'format': 'markdown'
        }
        
        if post.community:
            metadata['community'] = post.community
            
        return {
            'username': post.username,
            'title': post.title,
            'body': post.body,
            'permlink': post.permlink,
            'parent_permlink': parent_permlink,
            'metadata': metadata,
            'scheduled_datetime': post.scheduled_datetime,
            'post_id': post.id
        }
        
    def _simulate_blockchain_publish(self, post_data: dict) -> bool:
        """
        Simulate blockchain publishing for testing.
        
        In production, this would use the Steem API to actually publish the post.
        For testing, we simulate success/failure scenarios.
        """
        # Simulate processing time
        time.sleep(1)
        
        # Simulate 95% success rate for testing
        import random
        return random.random() < 0.95
        
    def _mark_post_published(self, post: ScheduledPost):
        """Mark a post as successfully published"""
        post.status = 'published'
        try:
            db.session.commit()
            logger.info(f"Marked post {post.id} as published")
        except Exception as e:
            logger.error(f"Failed to update post {post.id} status: {e}")
            db.session.rollback()
            
    def _mark_post_failed(self, post: ScheduledPost, error_message: str):
        """Mark a post as failed to publish"""
        post.status = 'failed'
        # In production, you might want to add an error_message field to the model
        try:
            db.session.commit()
            logger.error(f"Marked post {post.id} as failed: {error_message}")
        except Exception as e:
            logger.error(f"Failed to update post {post.id} status: {e}")
            db.session.rollback()
            
    def get_status(self) -> dict:
        """Get publisher status information"""
        with self.app.app_context():
            scheduled_count = ScheduledPost.query.filter_by(status='scheduled').count()
            published_count = ScheduledPost.query.filter_by(status='published').count()
            failed_count = ScheduledPost.query.filter_by(status='failed').count()
            
        return {
            'running': self.running,
            'check_interval': self.check_interval,
            'scheduled_posts': scheduled_count,
            'published_posts': published_count,
            'failed_posts': failed_count
        }
        
    def retry_failed_posts(self) -> int:
        """Retry all failed posts (for testing/recovery)"""
        with self.app.app_context():
            failed_posts = ScheduledPost.query.filter_by(status='failed').all()
            retry_count = 0
            
            for post in failed_posts:
                # Only retry posts that were supposed to be published in the last 24 hours
                if post.scheduled_datetime > datetime.utcnow() - timedelta(hours=24):
                    post.status = 'scheduled'
                    retry_count += 1
                    
            if retry_count > 0:
                db.session.commit()
                logger.info(f"Marked {retry_count} failed posts for retry")
                
        return retry_count

# Global publisher instance
publisher = ScheduledPostPublisher()
