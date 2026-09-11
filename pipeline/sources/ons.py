import csv
import io
import re
from zipfile import ZipFile

import openpyxl

from pipeline.sources.base import Asset, Source, links


def parse_population(records):
    output = []
    for r in records:
        if not {'LAD 2023 Code', 'LSOA 2021 Code', 'Total'} <= r.keys():
            raise ValueError('ONS population schema changed')
        if str(r['LAD 2023 Code']).startswith('E09'):
            n = float(r['Total'])
            if not 0 <= n <= 50000:
                raise ValueError('Invalid population estimate')
            output.append({'code': r['LSOA 2021 Code'], 'population': n})
    if not output:
        raise ValueError('No London population rows')
    return output


class ONSSource(Source):
    id = 'ons'
    name = 'ONS mid-year LSOA population estimates and Census households'
    publisher = 'Office for National Statistics / Nomis'
    url = ('https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/'
           'populationestimates/datasets/lowersuperoutputareamidyearpopulationestimates')
    critical = True

    def discover(self):
        candidates = [u for _, u in links(self.url) if u.endswith('.xlsx')]
        if not candidates:
            raise ValueError('No ONS population workbook found')
        household = [u for _, u in links('https://www.nomisweb.co.uk/census/2021/bulk')
                     if u.endswith('census2021-ts041.zip')]
        if not household:
            raise ValueError('No official Census household file discovered')
        year = max(int(y) for y in re.findall(r'20\d{2}', candidates[0]))
        return [Asset(candidates[0], 'population.xlsx', f'{year}-06-30', {'year': year}),
                Asset(household[0], 'households.zip', '2021-03-21')]

    def transform(self, directory, assets):
        w = openpyxl.load_workbook(directory / assets[0].filename, read_only=True, data_only=True)
        sheet = sorted(s for s in w.sheetnames if re.match(r'Mid-\d{4} LSOA 2021', s))[-1]
        year = int(sheet[4:8])
        ws = w[sheet]
        # Only all-person totals enter the warehouse. Age/sex columns are never used as features.
        it = ws.iter_rows(values_only=True, max_col=5)
        header = None
        for r in it:
            if r[0] == 'LAD 2023 Code':
                header = r
                break
        if not header:
            raise ValueError('ONS header not found')
        records = parse_population(dict(zip(header, r, strict=True)) for r in it if r[0])
        w.close()
        z = ZipFile(directory / assets[1].filename)
        member = next(n for n in z.namelist() if n.lower().endswith('-lsoa.csv'))
        reader = csv.DictReader(io.StringIO(z.read(member).decode('utf-8-sig')))
        headers = reader.fieldnames
        if 'geography code' not in headers:
            raise ValueError(f'Unknown Nomis geography schema: {headers}')
        total_col = next((k for k in headers if 'total' in k.lower() or k.startswith('Number of households:')), None)
        if not total_col:
            raise ValueError(f'No household total column: {headers}')
        households = {r['geography code']: float(r[total_col]) for r in reader}
        for r in records:
            r.update(households=households.get(r['code']), year=year)
        if len(records) < 4800 or len({r['code'] for r in records}) != len(records):
            raise ValueError('Invalid London population coverage or duplicate codes')
        self.notes = [f'All-person population totals: mid-{year}. Households: Census 2021.',
                      'H3 population is an area allocation proxy; no protected demographic inputs.',
                      'Displayed population estimates are rounded to the nearest 100 in line with ONS guidance.']
        return {'population': records}
