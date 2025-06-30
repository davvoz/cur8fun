from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class ScheduledPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    tags = db.Column(db.String(255))
    community = db.Column(db.String(64))
    permlink = db.Column(db.String(255))
    scheduled_datetime = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(32), default='scheduled')  # scheduled, published, failed

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "title": self.title,
            "body": self.body,
            "tags": self.tags.split(',') if self.tags else [],
            "community": self.community,
            "permlink": self.permlink,
            "scheduled_datetime": self.scheduled_datetime.isoformat(),
            "created_at": self.created_at.isoformat(),
            "status": self.status
        }

class CurationTarget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    curator_username = db.Column(db.String(64), nullable=False, index=True)
    target_username = db.Column(db.String(64), nullable=False)
    vote_delay_minutes = db.Column(db.Integer, default=15)  # Minutes after post creation
    vote_percentage = db.Column(db.Integer, default=100)    # Vote percentage (1-100)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Add unique constraint to prevent duplicate targets
    __table_args__ = (db.UniqueConstraint('curator_username', 'target_username', name='unique_curator_target'),)

    def to_dict(self):
        return {
            "id": self.id,
            "curator_username": self.curator_username,
            "target_username": self.target_username,
            "vote_delay_minutes": self.vote_delay_minutes,
            "vote_percentage": self.vote_percentage,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }