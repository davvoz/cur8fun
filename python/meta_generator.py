"""
Servizio per generare meta tag dinamici HTML
"""
from python.steem_client import steem_client

# Account che pubblica il muro giornaliero dei ping (vedi config/pings.js)
PINGS_WALL_ACCOUNT = 'micro.cur8'

class MetaTagGenerator:
    def __init__(self):
        self.default_meta = {
            'title': 'cur8.fun',
            'description': 'Your Steem community social platform',
            'image': 'https://www.cur8.fun/assets/img/og-default.png',
            'url': 'https://www.cur8.fun/',
            'type': 'website'
        }

    def avatar_url(self, username):
        return f"https://steemitimages.com/u/{username}/avatar"

    def generate_post_meta(self, author, permlink, base_url='https://www.cur8.fun', is_ping=False):
        """Genera meta tag per un post, un commento o un ping"""
        path = f"{'pings/' if is_ping else ''}@{author}/{permlink}"
        try:
            post = steem_client.get_content(author, permlink)

            if not post or post.get('id', 0) == 0:
                print(f"Warning: Post not found @{author}/{permlink}, using default meta")
                return self.generate_default_meta(f"{base_url}/{path}")

            # Estrai immagine e metadata
            metadata = steem_client.parse_metadata(post.get('json_metadata', ''))
            image_url = steem_client.extract_image_from_post(post.get('body', ''), metadata)

            # Crea descrizione
            description = steem_client.create_description(post.get('body', ''), 160)

            # Commenti e ping non hanno titolo su Steem.
            # Un ping è una risposta diretta al muro, qualunque sia l'URL usato per aprirlo
            if post.get('parent_author'):
                if post.get('parent_author') == PINGS_WALL_ACCOUNT:
                    title = f"Ping by @{author}"
                elif post.get('root_author') == PINGS_WALL_ACCOUNT:
                    title = f"Reply by @{author} on Pings"
                else:
                    title = f"@{author} commented on \"{post.get('root_title') or 'a post'}\""
            else:
                title = post.get('title') or f"Post by @{author}"

            meta = {
                'title': title,
                'description': description,
                'image': image_url,
                'url': f"{base_url}/{path}",
                'type': 'article',
                'author': author,
                'published_time': post.get('created', ''),
                'site_name': 'cur8.fun'
            }

            if not image_url:
                # Senza immagini: avatar dell'autore per commenti e ping, logo per i post
                if post.get('parent_author'):
                    meta['image'] = self.avatar_url(author)
                    meta['card'] = 'summary'
                else:
                    meta['image'] = self.default_meta['image']

            return meta
        except Exception as e:
            print(f"Error generating post meta for @{author}/{permlink}: {e}")
            return self.generate_default_meta(f"{base_url}/{path}")

    def generate_profile_meta(self, username, base_url='https://www.cur8.fun'):
        """Genera meta tag per un profilo utente"""
        try:
            accounts = steem_client.get_accounts([username])

            if not accounts:
                print(f"Warning: Profile not found @{username}, using default meta")
                return self.generate_default_meta(f"{base_url}/@{username}")

            account = accounts[0]
            profile_data = {}

            # Parse profile metadata
            for field in ('posting_json_metadata', 'json_metadata'):
                profile_data = steem_client.parse_metadata(account.get(field, '')).get('profile', {})
                if profile_data:
                    break

            name = profile_data.get('name')
            return {
                'title': f"{name} (@{username})" if name else f"@{username}",
                'description': profile_data.get('about') or f"@{username} on cur8.fun",
                'image': self.avatar_url(username),
                'url': f"{base_url}/@{username}",
                'type': 'profile',
                'card': 'summary',
                'site_name': 'cur8.fun'
            }
        except Exception as e:
            print(f"Error generating profile meta for @{username}: {e}")
            return self.generate_default_meta(f"{base_url}/@{username}")

    def generate_community_meta(self, name, base_url='https://www.cur8.fun'):
        """Genera meta tag per una community"""
        url = f"{base_url}/community/{name}"
        try:
            community = steem_client.get_community(name)
            if not community:
                return self.generate_default_meta(url)

            return {
                'title': community.get('title') or name,
                'description': community.get('about') or f"{name} community on cur8.fun",
                'image': self.avatar_url(name),
                'url': url,
                'type': 'website',
                'card': 'summary',
                'site_name': 'cur8.fun'
            }
        except Exception as e:
            print(f"Error generating community meta for {name}: {e}")
            return self.generate_default_meta(url)

    def generate_tag_meta(self, tag, base_url='https://www.cur8.fun', pings=False):
        """Genera meta tag per una pagina tag (post o ping)"""
        meta = self.generate_default_meta(f"{base_url}/{'pings/' if pings else ''}tag/{tag}")
        meta['title'] = f"#{tag} {'pings' if pings else 'posts'}"
        meta['description'] = f"Latest {'pings' if pings else 'posts'} tagged #{tag} on Steem"
        return meta

    def generate_default_meta(self, url=None):
        """Genera meta tag predefiniti"""
        meta = self.default_meta.copy()
        if url:
            meta['url'] = url
        return meta

    def generate_meta_tags_html(self, meta_data):
        """Genera HTML per i meta tag (il <title> viene gestito a parte)"""
        html_parts = []

        # Open Graph
        html_parts.append(f'<meta property="og:title" content="{self.escape_html(meta_data["title"])}" />')
        html_parts.append(f'<meta property="og:description" content="{self.escape_html(meta_data["description"])}" />')
        html_parts.append(f'<meta property="og:image" content="{self.escape_html(meta_data["image"])}" />')
        html_parts.append(f'<meta property="og:url" content="{self.escape_html(meta_data["url"])}" />')
        html_parts.append(f'<meta property="og:type" content="{meta_data["type"]}" />')
        html_parts.append(f'<meta property="og:site_name" content="{meta_data.get("site_name", "cur8.fun")}" />')

        # Le dimensioni 1200x630 valgono solo per le immagini grandi, non per avatar quadrati
        card_type = meta_data.get('card', 'summary_large_image')
        if card_type == 'summary_large_image':
            html_parts.append('<meta property="og:image:width" content="1200" />')
            html_parts.append('<meta property="og:image:height" content="630" />')
        html_parts.append(f'<meta property="og:image:alt" content="{self.escape_html(meta_data["title"])}" />')

        # Twitter Card
        html_parts.append(f'<meta name="twitter:card" content="{card_type}" />')
        html_parts.append(f'<meta name="twitter:title" content="{self.escape_html(meta_data["title"])}" />')
        html_parts.append(f'<meta name="twitter:description" content="{self.escape_html(meta_data["description"])}" />')
        html_parts.append(f'<meta name="twitter:image" content="{self.escape_html(meta_data["image"])}" />')

        # Article specific tags
        if meta_data.get('type') == 'article':
            if meta_data.get('author'):
                html_parts.append(f'<meta property="article:author" content="https://www.cur8.fun/@{meta_data["author"]}" />')
            if meta_data.get('published_time'):
                html_parts.append(f'<meta property="article:published_time" content="{meta_data["published_time"]}" />')

        # Description meta tag
        html_parts.append(f'<meta name="description" content="{self.escape_html(meta_data["description"])}" />')

        return '\n    '.join(html_parts)

    def escape_html(self, text):
        """Escape caratteri HTML"""
        if not text:
            return ''
        return (str(text)
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#x27;'))

# Istanza globale
meta_generator = MetaTagGenerator()
