import datetime
import json
import unittest
from tools.tiktok_posts import creator_videos, video_post, tiktok_posts

VID = "7698949687394471189"
HANDLE = "nacha_project"


def script(name, data):
    return '<script type="application/json" id="' + name + '">' + json.dumps(data) + '</script>'


def creator(items, error=False):
    return script('__FRONTITY_CONNECT_STATE__', {'source': {'data': {'/embed/@' + HANDLE: {
        'videoList': items, 'isError': error}}}})


def detail(item):
    return script('__UNIVERSAL_DATA_FOR_REHYDRATION__', {'__DEFAULT_SCOPE__': {
        'webapp.video-detail': {'statusCode': 0, 'itemInfo': {'itemStruct': item}}}})


class TikTokTests(unittest.TestCase):
    def setUp(self):
        self.item = {'id': VID, 'author': {'uniqueId': HANDLE}, 'createTime': '1792666800',
                     'desc': 'Out of the whole world', 'privateItem': False,
                     'stats': {'diggCount': 9, 'commentCount': 0, 'playCount': 107, 'shareCount': 0}}
        self.candidate = {'id': VID, 'authorUniqueId': HANDLE, 'privateItem': False}

    def test_list_rejects_other_authors_private_items_and_duplicate_ids(self):
        rows = [self.candidate, self.candidate, dict(self.candidate, id='12345678901', authorUniqueId='other'),
                dict(self.candidate, id='12345678902', privateItem=True)]
        self.assertEqual(creator_videos(creator(rows), HANDLE), [self.candidate])

    def test_uses_publication_time_not_id_upload_time(self):
        post = video_post(detail(self.item), HANDLE, VID)
        self.assertEqual(post['at'], '2026-10-22T11:00:00+00:00')
        self.assertEqual(datetime.datetime.fromtimestamp(int(VID) >> 32, datetime.timezone.utc).day, 21)
        self.assertEqual(post['likes'], 9)
        self.assertEqual(post['comments'], 0)
        self.assertEqual(post['url'], 'https://www.tiktok.com/@nacha_project/video/' + VID)

    def test_unknown_or_invalid_publication_time_is_not_guessed(self):
        for value in [None, '', 'invalid', '0', '99999999999']:
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError, OverflowError)):
                video_post(detail(dict(self.item, createTime=value)), HANDLE, VID)

    def test_rejects_wrong_author_wrong_id_private_or_removed_video(self):
        for change in [{'author': {'uniqueId': 'other'}}, {'id': '12345678901'},
                       {'privateItem': True}, {'takeDown': 1}, {'forFriend': True}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                video_post(detail(dict(self.item, **change)), HANDLE, VID)

    def test_failed_list_does_not_look_like_successful_empty_result(self):
        for html in [creator([]), creator([self.candidate], error=True), '<html>Log in</html>']:
            with self.assertRaises((ValueError, KeyError)):
                creator_videos(html, HANDLE)

    def test_reader_uses_creator_embed_then_checks_individual_video(self):
        testcase = self
        class Page:
            urls = []
            def goto(self, url, **kwargs): self.urls.append(url)
            def wait_for_selector(self, *args, **kwargs): pass
            def content(self): return creator([testcase.candidate]) if len(self.urls) == 1 else detail(testcase.item)
        page = Page()
        posts = tiktok_posts(page, 'https://www.tiktok.com/@nacha_project')
        self.assertEqual(len(posts), 1)
        self.assertEqual(page.urls, ['https://www.tiktok.com/embed/@nacha_project', posts[0]['url']])

    def test_missing_detail_preserves_previous_records_by_raising(self):
        class Page:
            def goto(self, *args, **kwargs): pass
            def wait_for_selector(self, *args, **kwargs): pass
            def content(self): return creator([{'id': VID, 'authorUniqueId': HANDLE}])
        with self.assertRaises(ValueError):
            tiktok_posts(Page(), 'https://www.tiktok.com/@nacha_project')


if __name__ == '__main__':
    unittest.main()
