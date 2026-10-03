
from flask import Flask, send_from_directory, send_file, request, jsonify, render_template_string
from flask_cors import CORS
from datetime import datetime
import os
import sys
import re
import hashlib


# Aggiungi la directory app alla path per poter importare il modulo models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
from python.models import db, ScheduledPost
from python.publisher import publisher
from python.meta_generator import meta_generator
from python.asset_bundler import AssetBundler

app = Flask(__name__)
CORS(app)  # Abilita CORS per tutte le routes

asset_bundler = AssetBundler(app.root_path)
# I fogli di stile collegati da index.html, nell'ordine in cui li carica
STYLESHEETS = ['/assets/css/main.css', '/assets/css/components/markdown-formatter.css']
CSS_BUNDLE_URL = '/bundle/app.css'

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
# Tutti i fogli di stile dell'app in un solo file (vedi python/asset_bundler.py)
@app.route(CSS_BUNDLE_URL)
def css_bundle():
    css, etag = asset_bundler.css_bundle(STYLESHEETS)
    response = app.response_class(css, mimetype='text/css')
    response.set_etag(etag)
    response.cache_control.no_cache = True
    return response.make_conditional(request)

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

# Percorsi della SPA che hanno un'anteprima dedicata per i social (l'ordine conta)
CONTENT_PATTERNS = [
    ('ping', re.compile(r'^pings/@([^/]+)/(.+?)/?$')),           # /pings/@author/permlink
    ('ping_tag', re.compile(r'^pings/tag/([^/]+)/?$')),           # /pings/tag/tagname
    ('post', re.compile(r'^(?:comment/)?@([^/]+)/(.+?)/?$')),     # /@author/permlink, /comment/@author/permlink
    ('profile', re.compile(r'^@([^/]+)/?$')),                     # /@username
    ('community', re.compile(r'^community/([^/]+)/?$')),          # /community/name
    ('tag', re.compile(r'^tag/([^/]+)/?$')),                      # /tag/tagname
]

def get_content_type_from_path(path):
    """Determina il tipo di contenuto dalla path"""
    for content_type, pattern in CONTENT_PATTERNS:
        match = pattern.match(path or '')
        if match:
            return content_type, match.groups()
    return 'default', ()

def generate_meta_for_path(path, base_url):
    """Restituisce i meta dati per l'anteprima social della path, o None se non previsti"""
    content_type, groups = get_content_type_from_path(path)

    if content_type in ('post', 'ping'):
        author, permlink = groups
        return meta_generator.generate_post_meta(author, permlink, base_url, is_ping=content_type == 'ping')
    if content_type == 'profile':
        return meta_generator.generate_profile_meta(groups[0], base_url)
    if content_type == 'community':
        return meta_generator.generate_community_meta(groups[0], base_url)
    if content_type in ('tag', 'ping_tag'):
        return meta_generator.generate_tag_meta(groups[0], base_url, pings=content_type == 'ping_tag')
    return None

def load_index_html():
    """
    index.html ottimizzato per il primo caricamento: un solo foglio di stile al
    posto della catena di @import e i moduli JS dichiarati come modulepreload.
    Il file su disco resta valido anche servito da un server statico.
    """
    # Path assoluto: su PythonAnywhere la cwd del processo WSGI non è la cartella del progetto
    with open(os.path.join(app.root_path, 'index.html'), 'r', encoding='utf-8') as f:
        content = f.read()

    content = re.sub(r'<!-- styles:start.*?<!-- styles:end -->',
                     lambda _: f'<link rel="stylesheet" href="{CSS_BUNDLE_URL}">',
                     content, count=1, flags=re.DOTALL)

    preloads = ''.join(f'\n    <link rel="modulepreload" href="{url}">'
                       for url in asset_bundler.module_preloads('/index.js'))
    return re.sub(r'(<!-- modulepreload:.*?-->)', lambda m: m.group(1) + preloads,
                  content, count=1, flags=re.DOTALL)

def html_response(content):
    response = app.response_class(content, mimetype='text/html')
    response.set_etag(hashlib.sha1(content.encode('utf-8')).hexdigest())
    response.cache_control.no_cache = True
    return response.make_conditional(request)

def render_index_with_meta(meta_data):
    """Renderizza index.html con i meta tag dinamici al posto di quelli statici"""
    content = load_index_html()

    meta_tags_html = meta_generator.generate_meta_tags_html(meta_data)

    # Sostituisci il <title> statico invece di aggiungerne un secondo
    title = meta_data['title']
    if title != 'cur8.fun':
        title = f"{title} | cur8.fun"
    content = re.sub(r'<title>.*?</title>',
                     lambda _: f'<title>{meta_generator.escape_html(title)}</title>',
                     content, count=1, flags=re.DOTALL)

    # Sostituisci i meta tag statici compresi tra i due marker
    marker_start = '<!-- Social Media Sharing Preview Metadata -->'
    marker_end = '<!-- Server-side rendered meta elements will be generated here -->'
    meta_start = content.find(marker_start)
    meta_end = content.find(marker_end)

    if meta_start != -1 and meta_end != -1:
        return content[:meta_start] + marker_start + '\n    ' + meta_tags_html + '\n    ' + content[meta_end:]

    # Fallback: aggiungi i meta tag prima della chiusura del head
    return content.replace('</head>', '    ' + meta_tags_html + '\n</head>', 1)



# Serve la landing page solo su / e /start
@app.route('/')
def serve_landing():
    return send_file('start/index_start.html')

# Serve la SPA/PWA per tutti i path non gestiti da route statiche
@app.route('/<path:path>')
def serve_spa(path):
    # Post, commenti, ping, profili, community e tag: meta tag dinamici per l'anteprima social
    try:
        meta_data = generate_meta_for_path(path, get_base_url(request))
        if meta_data:
            return html_response(render_index_with_meta(meta_data))
    except Exception as e:
        print(f"[DEBUG] Error generating meta tags for /{path}: {e}")

    # Per tutti gli altri casi (pagine generiche, errori), serve la SPA normale
    return html_response(load_index_html())

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
        app.run(debug=True, threaded=True)
    finally:
        publisher.stop()

