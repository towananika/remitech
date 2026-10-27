import datetime
import unittest
from tools.posts_fetch import telegram_unshared, telegram_targets

KST = datetime.timezone(datetime.timedelta(hours=9))
L = lambda k: {'kind': k}
CH = [{'id': 'hiyoko', 'telegramAt': {'time': '17:00'}, 'links': [L('X'), L('Instagram'), L('YouTube')]},
      {'id': 'nacha', 'telegramAt': {'time': '09:00'}, 'shareDayOffset': -1, 'links': [L('X'), L('TikTok')]},
      {'id': 'ret', 'links': [L('X')]}]
at = lambda hm: datetime.datetime.fromisoformat('2026-10-21T%s:00' % hm).replace(tzinfo=KST)
post = lambda url, when, **kw: {'posts': [dict(url=url, at=when, **kw)]}


class TelegramFetchTests(unittest.TestCase):
    def test_notification_date_and_undo(self):
        channels=[{'id':'nacha','telegramAt':{'time':'20:00'},'shareDayOffset':-1}, {'id':'reel','telegramAt':{'time':'17:00'}}, {'id':'ret'}]
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-21|nacha':True}),{'reel'})
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-21|nacha':True,'2026-10-21|reel':True}),set())
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-20|nacha':True,'2026-10-21|reel':False}),{'nacha','reel'})
    def test_bad_date_rejected(self):
        with self.assertRaises(ValueError):telegram_unshared([], '2026-02-31',{})

    def test_only_due_channels(self):
        self.assertEqual(telegram_targets(CH, '2026-10-21', {}, {}, at('08:59')), {})
        self.assertEqual(set(telegram_targets(CH, '2026-10-21', {}, {}, at('09:00'))), {'nacha'})
        self.assertEqual(set(telegram_targets(CH, '2026-10-21', {}, {}, at('17:00'))), {'nacha', 'hiyoko'})
        self.assertEqual(set(telegram_targets(CH, '2026-10-21', {'2026-10-21|nacha': True}, {}, at('17:00'))), {'hiyoko'})

    def test_fetched_links_not_fetched_again(self):
        data = {'accounts': {'hiyoko|X': post('https://x.com/h/status/1', '2026-10-21T08:00:00Z'),
                             'nacha|X': post('https://x.com/n/status/1', '2026-10-20T11:00:00Z')}}
        got = telegram_targets(CH, '2026-10-21', {}, data, at('18:00'))
        self.assertEqual(got, {'hiyoko': {'IG', 'YT'}, 'nacha': {'TT'}})
        data['accounts']['hiyoko|IG'] = post('https://instagram.com/p/abc', '2026-10-21T08:00:00Z')
        data['accounts']['nacha|TT'] = post('https://tiktok.com/@n/video/1', '2026-10-20T11:00:00Z')
        self.assertEqual(telegram_targets(CH, '2026-10-21', {}, data, at('18:00')), {})

    def test_facebook_needs_ok_check(self):
        ch = [{'id': 'reel', 'telegramAt': {'time': '17:00'}, 'links': [L('Facebook')]}]
        data = {'accounts': {'reel|FB': post('https://facebook.com/reel/1', '2026-10-21T08:00:00Z')}}
        self.assertEqual(telegram_targets(ch, '2026-10-21', {}, data, at('18:00')), {'reel': {'FB'}})
        data['accounts']['reel|FB']['posts'][0]['linkCheck'] = {'state': 'ok'}
        self.assertEqual(telegram_targets(ch, '2026-10-21', {}, data, at('18:00')), {})

if __name__=='__main__':unittest.main()
