"""Normalize actual SNS post URLs without dropping identifiers stored in queries."""
import re
from urllib.parse import urlsplit, urlunsplit, parse_qs, urlencode


def post_url(value, platform):
    try:
        u = urlsplit(value)
        if u.scheme not in ('https', 'http') or u.username or u.password:
            return ''
        host = (u.hostname or '').lower().removeprefix('www.').removeprefix('m.')
        path = u.path.rstrip('/')
        q = parse_qs(u.query)
        query = {}
        if platform == 'FB':
            if host != 'facebook.com':
                return ''
            identifier = r'(?:\d+|pfbid[A-Za-z0-9]+)'
            if path == '/permalink.php':
                if not re.fullmatch(identifier, q.get('story_fbid', [''])[0]) or not re.fullmatch(r'\d+', q.get('id', [''])[0]):
                    return ''
                query = {k: q[k][0] for k in ('story_fbid', 'id')}
            elif path == '/photo' or path == '/photo.php':
                if not re.fullmatch(r'\d+', q.get('fbid', [''])[0]):
                    return ''
                query = {'fbid': q['fbid'][0]}
                if q.get('id'): query['id'] = q['id'][0]
            elif path == '/watch':
                if not re.fullmatch(r'\d+', q.get('v', [''])[0]):
                    return ''
                query = {'v': q['v'][0]}
            elif not re.fullmatch(r'/(?:reel/\d+|[^/]+/(?:posts|videos)/' + identifier + ')', path):
                return ''
        elif platform == 'YT':
            if host == 'youtu.be' and re.fullmatch(r'/[\w-]{11}', path):
                pass
            elif host == 'youtube.com' and path == '/watch' and re.fullmatch(r'[\w-]{11}', q.get('v', [''])[0]):
                query = {'v': q['v'][0]}
            elif host != 'youtube.com' or not re.fullmatch(r'/(?:shorts|live)/[\w-]{11}', path):
                return ''
        elif platform == 'IG':
            if host != 'instagram.com': return ''
            path = re.sub(r'^/[^/]+/(p|reel)/', r'/\1/', path)
            if not re.fullmatch(r'/(?:p|reel)/[\w-]+', path): return ''
        elif platform == 'X':
            if host not in ('x.com', 'twitter.com') or not re.fullmatch(r'/(?:[^/]+|i/web)/status/\d+', path): return ''
            host = 'x.com'
        elif platform == 'TT':
            if host != 'tiktok.com' or not re.fullmatch(r'/@[^/]+/video/\d+', path): return ''
        else:
            return ''
        return urlunsplit(('https', host, path, urlencode(query), ''))
    except (ValueError, TypeError):
        return ''
