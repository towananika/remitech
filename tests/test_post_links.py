import datetime
import unittest
from types import SimpleNamespace
from tools.post_links import post_url
from tools.posts_fetch import merge, fb_check_link


class PostLinksTest(unittest.TestCase):
    def test_preserve_post_identifiers(self):
        self.assertEqual(post_url('https://www.facebook.com/permalink.php?story_fbid=123&id=456&__cft__=x', 'FB'), 'https://facebook.com/permalink.php?story_fbid=123&id=456')
        self.assertEqual(post_url('https://www.facebook.com/watch/?v=123&tracking=x', 'FB'), 'https://facebook.com/watch?v=123')
        self.assertEqual(post_url('https://www.youtube.com/watch?v=abcdefghijk&t=10', 'YT'), 'https://youtube.com/watch?v=abcdefghijk')
        self.assertEqual(post_url('https://www.instagram.com/account/p/AbCd/?tracking=x', 'IG'), 'https://instagram.com/p/AbCd')

    def test_reject_missing_identity_and_wrong_domain(self):
        for url in ['https://facebook.com/permalink.php', 'https://facebook.com/permalink.php?story_fbid=123', 'https://facebook.com/watch', 'https://facebook.com/login', 'https://evil.com/reel/123']:
            self.assertEqual(post_url(url, 'FB'), '')

    def test_merge_removes_corrupt_records_without_truncating_valid_queries(self):
        at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        data = {'accounts': {'hiyoko|FB': {'posts': [{'url': 'https://facebook.com/permalink.php', 'at': at}]}}}
        merge(data, 'hiyoko|FB', [{'url': 'https://www.facebook.com/permalink.php?story_fbid=123&id=456', 'at': at}], 'test')
        posts = data['accounts']['hiyoko|FB']['posts']
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['url'], 'https://facebook.com/permalink.php?story_fbid=123&id=456')

    def test_direct_access_requires_readable_matching_post(self):
        url = 'https://facebook.com/permalink.php?story_fbid=123&id=456'
        text = 'HIYOKO NFT series. This is a real synthetic caption.'
        class Element:
            first = property(lambda self: self)
            def __init__(self, kind, page): self.kind, self.page = kind, page
            def count(self): return 1
            def get_attribute(self, attr): return self.page.canonical if attr == 'href' else self.page.content
            def inner_text(self, **kwargs): return self.page.content
            def all_inner_texts(self): return [self.page.content]
        class Page:
            def __init__(self, status=200, final=url, canonical=url, content=text): self.status, self.url, self.canonical, self.content = status, final, canonical, content
            def goto(self, *args, **kwargs): return SimpleNamespace(status=self.status)
            def wait_for_timeout(self, *args): pass
            def locator(self, kind): return Element(kind, self)
        candidate = {'url': url, 'text': text}
        self.assertEqual(fb_check_link(Page(), candidate)['state'], 'ok')
        for page in [Page(status=404), Page(final='https://facebook.com/login'), Page(canonical='https://facebook.com/'), Page(content='Log in to Facebook'), Page(content="This content isn't available right now")]:
            self.assertNotEqual(fb_check_link(page, candidate)['state'], 'ok')
        self.assertEqual(fb_check_link(Page(), {'url': 'https://facebook.com/permalink.php'})['state'], 'invalid')

if __name__ == '__main__':
    unittest.main()
