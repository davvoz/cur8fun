from flask import Flask, send_from_directory, send_file
import os

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True)