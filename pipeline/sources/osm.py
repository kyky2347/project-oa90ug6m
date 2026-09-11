import re

import h3
import osmium
from shapely import Point, from_wkb

from pipeline.sources.base import Asset, Source, links, request


def taxonomy(tags):
    """First matching canonical class; one OSM object has exactly one category."""
    amenity, shop, leisure = tags.get('amenity'), tags.get('shop'), tags.get('leisure')
    if amenity == 'cafe' or shop == 'coffee':
        return 'coffee'
    if shop == 'bakery':
        return 'bakery'
    if amenity in ('restaurant', 'fast_food'):
        return amenity
    if amenity in ('pub', 'bar', 'biergarten'):
        return 'pub_bar'
    if shop in ('supermarket', 'convenience'):
        return shop
    if leisure in ('fitness_centre', 'fitness_station', 'sports_centre'):
        return 'gym_fitness'
    if amenity == 'coworking_space' or tags.get('office') == 'coworking':
        return 'coworking'
    if tags.get('office') and tags.get('office') not in ('no', 'vacant'):
        return 'office'
    if tags.get('tourism') in ('hotel', 'hostel', 'guest_house', 'motel'):
        return 'hotel'
    if amenity in ('school', 'university', 'college'):
        return 'university' if amenity in ('university', 'college') else 'school'
    if tags.get('railway') in ('station', 'halt') or amenity == 'bus_station':
        return 'transport'
    if leisure in ('park', 'garden'):
        return 'park'
    if amenity in ('cinema', 'theatre', 'arts_centre') or leisure in ('bowling_alley', 'amusement_arcade'):
        return 'entertainment'
    if shop and shop not in ('no', 'vacant', 'closed'):
        return 'retail'
    if tags.get('tourism') in ('attraction', 'museum', 'gallery', 'viewpoint'):
        return 'tourism'
    return None


class POIHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.records = {}
        self.factory = osmium.geom.WKBFactory()

    def add(self, key, tags, point):
        category = taxonomy(tags)
        if not category or point.is_empty:
            return
        lon, lat = point.x, point.y
        if not (-0.65 < lon < 0.4 and 51.25 < lat < 51.75):
            return
        self.records[key] = dict(id=key, name=tags.get('name', ''), category=category,
                                 geom=point.wkt, h3_8=h3.latlng_to_cell(lat, lon, 8),
                                 h3_9=h3.latlng_to_cell(lat, lon, 9))

    def node(self, n):
        if taxonomy(n.tags) and n.location.valid():
            self.add(f'n{n.id}', n.tags, Point(n.location.lon, n.location.lat))

    def area(self, a):
        if taxonomy(a.tags):
            try:
                geom = from_wkb(self.factory.create_multipolygon(a))
                key = ('w' if a.from_way() else 'r') + str(a.orig_id())
                self.add(key, a.tags, geom.representative_point())
            except (RuntimeError, ValueError):
                pass


class OSMSource(Source):
    id = 'osm'
    name = 'Greater London OpenStreetMap regional extract'
    publisher = 'OpenStreetMap contributors / Geofabrik'
    url = 'https://download.geofabrik.de/europe/united-kingdom/england/greater-london.html'
    license = 'Open Database Licence (ODbL) 1.0; © OpenStreetMap contributors'
    cadence_days = 7
    critical = True

    def discover(self):
        candidates = [u for _, u in links(self.url) if u.endswith('greater-london-latest.osm.pbf')]
        if not candidates:
            raise ValueError('No Greater London PBF asset on Geofabrik page')
        page = request(self.url).text
        timestamp = re.search(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', page)
        # Download the dated immutable asset linked on the page to avoid checksum races at rollover.
        dated = [u for _, u in links(self.url) if re.search(r'greater-london-\d{6}\.osm\.pbf$', u)]
        url = sorted(dated)[-1] if dated else candidates[0]
        md5 = request(url + '.md5').text.split()[0]
        return [Asset(url, 'london.osm.pbf', timestamp.group(0) if timestamp else None, {'md5': md5})]

    def transform(self, directory, assets):
        handler = POIHandler()
        handler.apply_file(str(directory / assets[0].filename), locations=True, idx='flex_mem')
        # Collapse colocated identical name/category nodes and area representations within an H3-12 cell.
        from shapely import from_wkt
        seen, result = set(), []
        for r in sorted(handler.records.values(), key=lambda r: r['id']):
            p = from_wkt(r['geom'])
            key = (r['name'].casefold().strip(), r['category'], h3.latlng_to_cell(p.y, p.x, 12))
            if r['name'] and key in seen:
                continue
            seen.add(key)
            result.append(r)
        if len(result) < 10000:
            raise ValueError(f'Unexpectedly small London POI extraction: {len(result)}')
        self.notes = ['Nodes and polygon representative points; one category per OSM object.',
                      'Same-name/category representations within an H3-12 cell collapsed.',
                      'OSM is incomplete and category coverage varies; counts are mapped supply, not a business census.']
        return {'pois': result}
