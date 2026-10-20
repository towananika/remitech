"""Generate public Korean holiday names; requires holidays==0.107."""
import json
from pathlib import Path
import holidays

names = {
    "New Year's Day": '元日', 'Korean New Year': '旧正月（ソルラル）',
    'The day preceding Korean New Year': '旧正月の前日', 'The second day of Korean New Year': '旧正月の翌日',
    'Independence Movement Day': '三一節', 'Labor Day': '労働節', "Children's Day": 'こどもの日',
    "Buddha's Birthday": '釈迦誕生日', 'Memorial Day': '顕忠日', 'Constitution Day': '制憲節',
    'Liberation Day': '光復節', 'Chuseok': '秋夕（チュソク）', 'The day preceding Chuseok': '秋夕の前日',
    'The second day of Chuseok': '秋夕の翌日', 'National Foundation Day': '開天節',
    'Hangul Day': 'ハングルの日', 'Christmas Day': 'クリスマス', 'Local Election Day': '地方選挙投票日',
    'National Assembly Election Day': '国会議員選挙投票日', 'Presidential Election Day': '大統領選挙投票日',
    'Temporary Public Holiday': '臨時公休日',
}
def japanese(name):
    if '; ' in name:
        return '・'.join(japanese(part) for part in name.split('; '))
    prefix = 'Alternative holiday for '
    if name.startswith(prefix):
        return '振替休日：' + japanese(name[len(prefix):])
    return names[name]

years = range(2025, 2031)
en = holidays.country_holidays('KR', years=years, language='en_US')
ko = holidays.country_holidays('KR', years=years, language='ko')
data = {str(day): [japanese(name), name, ko[day]] for day, name in sorted(en.items())}
output = Path(__file__).resolve().parents[1] / 'korean-holidays.mjs'
output.write_text(
    '// Korean public holidays, including observed holidays, 2025–2030.\n'
    '// Source: python-holidays ' + holidays.__version__ + ' (KR/PUBLIC).\n'
    '// Regenerate: python3 scripts/generate-korean-holidays.py (holidays==0.107).\n'
    'const holidays = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
    "export function koreanHoliday(date, language='ja') {\n"
    "  return holidays[date]?.[({ja:0,en:1,ko:2})[language] ?? 0] || '';\n}\n"
)
print(f'Generated {len(data)} public holidays for 2025–2030')
