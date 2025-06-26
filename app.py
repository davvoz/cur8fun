from flask import Flask, send_from_directory, send_file, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
import sys

# Aggiungi la directory app alla path per poter importare il modulo models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
from python.models import db, ScheduledPost
from python.publisher import publisher

app = Flask(__name__)
CORS(app)  # Abilita CORS per tutte le routes

# Configurazione database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///steemee.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Inizializzazione del database
with app.app_context():
    db.create_all()

# Serve static files
@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory('assets', filename)

# Serve JavaScript modules with correct MIME type
@app.route('/<path:filename>.js')
def javascript_files(filename):
    return send_file(f'{filename}.js', mimetype='application/javascript')

# Serve specific root files
@app.route('/manifest.json')
def manifest():
    return send_file('manifest.json', mimetype='application/json')

@app.route('/sw.js')
def service_worker():
    return send_file('sw.js', mimetype='application/javascript')

@app.route('/favicon.ico')
def favicon():
    return send_file('favicon.ico')

# Serve files from specific directories with correct MIME types
@app.route('/components/<path:filename>')
def components(filename):
    if filename.endswith('.js'):
        return send_file(f'components/{filename}', mimetype='application/javascript')
    return send_from_directory('components', filename)

@app.route('/services/<path:filename>')
def services(filename):
    if filename.endswith('.js'):
        return send_file(f'services/{filename}', mimetype='application/javascript')
    return send_from_directory('services', filename)

@app.route('/utils/<path:filename>')
def utils(filename):
    if filename.endswith('.js'):
        return send_file(f'utils/{filename}', mimetype='application/javascript')
    return send_from_directory('utils', filename)

@app.route('/views/<path:filename>')
def views(filename):
    if filename.endswith('.js'):
        return send_file(f'views/{filename}', mimetype='application/javascript')
    return send_from_directory('views', filename)

@app.route('/models/<path:filename>')
def models(filename):
    if filename.endswith('.js'):
        return send_file(f'models/{filename}', mimetype='application/javascript')
    return send_from_directory('models', filename)

@app.route('/controllers/<path:filename>')
def controllers(filename):
    if filename.endswith('.js'):
        return send_file(f'controllers/{filename}', mimetype='application/javascript')
    return send_from_directory('controllers', filename)

# Serve main app for all other routes (SPA fallback)
@app.route('/')
@app.route('/<path:path>')
def serve_spa(path=''):
    # Lista delle route dell'applicazione che devono servire index.html
    spa_routes = [
        '', 'trending', 'hot', 'new', 'login', 'register', 'search', 'create-post',
        'drafts', 'settings', 'menu', 'faq', 'new-releases', 'communities',
        'notifications', 'wallet', 'edit-profile'
    ]
    
    # Route con parametri (come /tag/sometag, /@username, ecc.)
    spa_patterns = [
        'tag/', '@', 'post/', 'community/', 'edit-post/', 'comment/'
    ]
    
    # Se è un file con estensione, non è una route SPA
    if '.' in path and not path.endswith('.html'):
        return "File not found", 404
    
    # Se è una route SPA conosciuta o corrisponde a un pattern, servi index.html
    if path in spa_routes or any(path.startswith(pattern) for pattern in spa_patterns):
        return send_file('index.html')
    
    # Se non è una route conosciuta, servi comunque index.html (il router gestirà il 404)
    return send_file('index.html')

# API per i post schedulati
@app.route('/api/scheduled_posts', methods=['GET'])
def get_scheduled_posts():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Username required"}), 400
    posts = ScheduledPost.query.filter_by(username=username).all()
    return jsonify([p.to_dict() for p in posts])

@app.route('/api/scheduled_posts', methods=['POST'])
def create_scheduled_post():
    try:
        data = request.json
        print(f"[DEBUG] Received data: {data}")
        
        if not data or not data.get('username') or not data.get('title') or not data.get('body') or not data.get('scheduled_datetime'):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Parse the scheduled datetime - handle different formats
        scheduled_datetime_str = data['scheduled_datetime']
        print(f"[DEBUG] Parsing datetime: {scheduled_datetime_str}")
        
        try:
            # Try parsing ISO format with Z suffix
            if scheduled_datetime_str.endswith('Z'):
                # Remove Z and parse as UTC
                scheduled_datetime_str = scheduled_datetime_str[:-1]
                scheduled_datetime = datetime.fromisoformat(scheduled_datetime_str)
            else:
                scheduled_datetime = datetime.fromisoformat(scheduled_datetime_str)
        except ValueError as e:
            print(f"[DEBUG] DateTime parsing error: {e}")
            return jsonify({"error": f"Invalid datetime format: {scheduled_datetime_str}"}), 400
            
        post = ScheduledPost(
            username=data['username'],
            title=data['title'],
            body=data['body'],
            tags=','.join(data.get('tags', [])),
            community=data.get('community'),
            permlink=data.get('permlink'),
            scheduled_datetime=scheduled_datetime
        )
        db.session.add(post)
        db.session.commit()
        
        print(f"[DEBUG] Successfully created scheduled post: {post.id}")
        return jsonify(post.to_dict()), 201
    except Exception as e:
        print(f"[DEBUG] Error creating scheduled post: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/scheduled_posts/<int:post_id>', methods=['GET'])
def get_scheduled_post(post_id):
    post = ScheduledPost.query.get_or_404(post_id)
    return jsonify(post.to_dict())

@app.route('/api/scheduled_posts/<int:post_id>', methods=['PUT'])
def update_scheduled_post(post_id):
    try:
        post = ScheduledPost.query.get_or_404(post_id)
        data = request.json
        
        # Aggiorna i campi se presenti nei dati
        if 'title' in data:
            post.title = data['title']
        if 'body' in data:
            post.body = data['body']
        if 'tags' in data:
            post.tags = ','.join(data['tags'])
        if 'community' in data:
            post.community = data['community']
        if 'permlink' in data:
            post.permlink = data['permlink']
        if 'scheduled_datetime' in data:
            post.scheduled_datetime = datetime.fromisoformat(data['scheduled_datetime'])
        if 'status' in data:
            post.status = data['status']
            
        db.session.commit()
        return jsonify(post.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/scheduled_posts/<int:post_id>', methods=['DELETE'])
def delete_scheduled_post(post_id):
    try:
        post = ScheduledPost.query.get_or_404(post_id)
        db.session.delete(post)
        db.session.commit()
        return jsonify({"success": True, "message": f"Post {post_id} deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
# Initialize publisher with app context
publisher.init_app(app)

# API endpoints for publisher management
@app.route('/api/publisher/status', methods=['GET'])
def get_publisher_status():
    """Get the current status of the publisher service"""
    return jsonify(publisher.get_status())

@app.route('/api/publisher/retry-failed', methods=['POST'])
def retry_failed_posts():
    """Retry all failed posts"""
    retry_count = publisher.retry_failed_posts()
    return jsonify({
        "success": True,
        "message": f"Marked {retry_count} posts for retry"
    })

# Start publisher service in development
if __name__ == '__main__':
    publisher.start()
    try:
        app.run(debug=True)
    finally:
        publisher.stop()

