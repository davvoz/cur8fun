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