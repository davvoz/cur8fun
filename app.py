
from flask import Flask, send_from_directory, send_file, request, jsonify, render_template_string
from flask_cors import CORS
from datetime import datetime
import os
import sys
import re


# Aggiungi la directory app alla path per poter importare il modulo models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
from python.models import db, ScheduledPost
from python.publisher import publisher
from python.meta_generator import meta_generator

app = Flask(__name__)
CORS(app)  # Abilita CORS per tutte le routes

# Configurazione database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///steemee.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Inizializzazione del database
with app.app_context():
    db.create_all()

# Serve static files from the start directory (e.g., /start/style.css)
@app.route('/start/<path:filename>')
def start_static(filename):
    return send_from_directory('start', filename)
# Serve static files
@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory('assets', filename)

# Serve JavaScript modules with correct MIME type
@app.route('/<path:filename>.js')
def javascript_files(filename):
    import os
    js_path = os.path.join(app.root_path, f"{filename}.js")
    if not os.path.isfile(js_path):
        return "File not found", 404
    return send_file(js_path, mimetype='application/javascript')

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

# Serve the start page
@app.route('/start')
def serve_start_page():
    return send_file('start/index_start.html')

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



def get_base_url(request):
    """Ottieni l'URL base corretto per l'ambiente"""
    # Usa l'URL della request
    return request.host_url.rstrip('/')

# Helper function per determinare il tipo di contenuto
def get_content_type_from_path(path):
    """Determina il tipo di contenuto dalla path"""
    if not path:
        return 'home', {}
    
    # Post: /@author/permlink
    post_pattern = r'^@([^/]+)/(.+)$'
    post_match = re.match(post_pattern, path)
    if post_match:
        return 'post', {'author': post_match.group(1), 'permlink': post_match.group(2)}
    
    # Profilo: /@username
    profile_pattern = r'^@([^/]+)/?$'
    profile_match = re.match(profile_pattern, path)
    if profile_match:
        return 'profile', {'username': profile_match.group(1)}
    
    # Community: /community/name
    community_pattern = r'^community/([^/]+)/?$'
    community_match = re.match(community_pattern, path)
    if community_match:
        return 'community', {'name': community_match.group(1)}
    
    # Tag: /tag/tagname
    tag_pattern = r'^tag/([^/]+)/?$'
    tag_match = re.match(tag_pattern, path)
    if tag_match:
        return 'tag', {'tag': tag_match.group(1)}
    
    return 'default', {}

def render_index_with_meta(meta_tags_html):
    """Renderizza index.html con meta tag dinamici"""
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sostituisci i meta tag esistenti con quelli dinamici
        # Trova la posizione dei meta tag statici e sostituiscili
        meta_start = content.find('<!-- Social Media Sharing Preview Metadata -->')
        meta_end = content.find('<!-- Server-side rendered meta elements will be generated here -->')
        
        if meta_start != -1 and meta_end != -1:
            # Mantieni il commento iniziale e aggiungi i nuovi meta tag
            new_content = (
                content[:meta_start] +
                '<!-- Social Media Sharing Preview Metadata -->\n    ' +
                meta_tags_html + '\n    ' +
                content[meta_end:]
            )
            return new_content
        else:
            # Fallback: aggiungi i meta tag prima della chiusura del head
            head_end = content.find('</head>')
            if head_end != -1:
                new_content = (
                    content[:head_end] +
                    '    ' + meta_tags_html + '\n' +
                    content[head_end:]
                )
                return new_content
        
        return content
    except Exception as e:
        print(f"Error rendering index with meta: {e}")
        return send_file('index.html')



# Serve la landing page solo su / e /start
@app.route('/')
def serve_landing():
    return send_file('start/index_start.html')

# Serve la SPA/PWA su /app e /app/<path:path>
@app.route('/app')
@app.route('/app/<path:path>')
def serve_spa(path=None):
    # Se non c'è un path, serve la SPA normale
    if not path:
        return send_file('index.html')
    
    # Determina il tipo di contenuto dal path
    content_type, params = get_content_type_from_path(path)
    
    # Se è un post, genera meta tag dinamici per l'anteprima
    if content_type == 'post':
        try:
            print(f"[DEBUG] Generating meta tags for post: @{params['author']}/{params['permlink']}")
            
            # Genera i meta tag per il post
            base_url = get_base_url(request)
            current_url = f"{base_url}/app/{path}"
            
            meta_data = meta_generator.generate_post_meta(
                author=params['author'],
                permlink=params['permlink'],
                base_url=base_url
            )
            
            if meta_data:
                # Aggiorna l'URL con quello corrente
                meta_data['url'] = current_url
                
                # Genera l'HTML dei meta tag
                meta_tags_html = meta_generator.generate_meta_tags_html(meta_data)
                
                print(f"[DEBUG] Generated meta tags for @{params['author']}/{params['permlink']}")
                return render_index_with_meta(meta_tags_html)
            else:
                print(f"[DEBUG] No meta tags generated for @{params['author']}/{params['permlink']}, falling back to default")
                
        except Exception as e:
            print(f"[DEBUG] Error generating meta tags for post: {e}")
    
    # Per tutti gli altri casi (profili, tag, community, errori), serve la SPA normale
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

