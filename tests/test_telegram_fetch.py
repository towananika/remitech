import unittest
from tools.posts_fetch import telegram_unshared

class TelegramFetchTests(unittest.TestCase):
    def test_notification_date_and_undo(self):
        channels=[{'id':'nacha','telegramAt':{'time':'20:00'},'shareDayOffset':-1}, {'id':'reel','telegramAt':{'time':'17:00'}}, {'id':'ret'}]
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-21|nacha':True}),{'reel'})
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-21|nacha':True,'2026-10-21|reel':True}),set())
        self.assertEqual(telegram_unshared(channels,'2026-10-21',{'2026-10-20|nacha':True,'2026-10-21|reel':False}),{'nacha','reel'})
    def test_bad_date_rejected(self):
        with self.assertRaises(ValueError):telegram_unshared([], '2026-02-31',{})

if __name__=='__main__':unittest.main()
