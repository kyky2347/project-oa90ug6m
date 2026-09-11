from zipfile import ZipFile

import geopandas as gpd
import pandas as pd
from shapely import MultiPolygon, force_2d, make_valid

from pipeline.sources.base import Asset, Source, links

LONDON_BOROUGHS = {
    "Barking and Dagenham",
    "Barnet",
    "Bexley",
    "Brent",
    "Bromley",
    "Camden",
    "City of London",
    "Croydon",
    "Ealing",
    "Enfield",
    "Greenwich",
    "Hackney",
    "Hammersmith and Fulham",
    "Haringey",
    "Harrow",
    "Havering",
    "Hillingdon",
    "Hounslow",
    "Islington",
    "Kensington and Chelsea",
    "Kingston upon Thames",
    "Lambeth",
    "Lewisham",
    "Merton",
    "Newham",
    "Redbridge",
    "Richmond upon Thames",
    "Southwark",
    "Sutton",
    "Tower Hamlets",
    "Waltham Forest",
    "Wandsworth",
    "Westminster",
}


def valid_multi(geom):
    geom = force_2d(make_valid(geom))
    if geom.geom_type == "Polygon":
        geom = MultiPolygon([geom])
    if geom.geom_type == "GeometryCollection":
        parts = []
        for p in geom.geoms:
            if p.geom_type == "Polygon":
                parts.append(p)
            elif p.geom_type == "MultiPolygon":
                parts.extend(p.geoms)
        geom = MultiPolygon(parts)
    if geom.is_empty or not geom.is_valid or geom.geom_type != "MultiPolygon":
        raise ValueError("Expected valid non-empty polygon geometry")
    return geom


def validate_geo(df):
    if df.empty or df.crs is None:
        raise ValueError("Missing geometry or CRS")
    df = df.to_crs(4326)
    x0, y0, x1, y1 = df.total_bounds
    if not (-0.7 < x0 < x1 < 0.4 and 51.2 < y0 < y1 < 51.8):
        raise ValueError(f"Outside London / unexpected CRS: {df.total_bounds}")
    return df


class GeographySource(Source):
    id = "geography"
    name = "London LSOA 2021 boundaries"
    publisher = "ONS / Greater London Authority"
    url = "https://data.london.gov.uk/dataset/statistical-gis-boundary-files-london"
    cadence_days = 90
    critical = True

    def discover(self):
        candidates = [u for _, u in links(self.url) if "lsoa2021" in u.lower() and u.endswith(".zip")]
        if not candidates:
            raise ValueError("GLA statistical geography asset not found")
        return [Asset(candidates[0], "lsoa.zip", "2021", {"geography_year": 2021})]

    def transform(self, directory, assets):
        path = directory / assets[0].filename
        with ZipFile(path) as z:
            shps = [n for n in z.namelist() if n.endswith(".shp") and not n.startswith("__MACOSX")]
        parts = [gpd.read_file(f"zip://{path}!{shp}") for shp in shps]
        df = validate_geo(gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=parts[0].crs))
        code = next((k for k in df.columns if k.upper() == "LSOA21CD"), None)
        name = next((k for k in df.columns if k.upper() == "LSOA21NM"), None)
        if not code or not name:
            raise ValueError(f"Expected LSOA21CD and LSOA21NM, got {list(df.columns)}")
        result = []
        for _, r in df.iterrows():
            borough = r[name].rsplit(" ", 1)[0]
            if borough not in LONDON_BOROUGHS:
                raise ValueError(f"Unexpected borough {borough}")
            result.append(dict(code=r[code], name=r[name], borough=borough, geom=valid_multi(r.geometry).wkt))
        if len(result) != len({r["code"] for r in result}):
            raise ValueError("Duplicate LSOA codes")
        if {r["borough"] for r in result} != LONDON_BOROUGHS:
            raise ValueError("Incomplete London borough coverage")
        if not 4800 <= len(result) <= 5500:
            raise ValueError("Unexpected London LSOA row count")
        return {"geo_lsoa": result}


class GLASource(Source):
    id = "gla"
    name = "GLA High Street boundaries"
    publisher = "Greater London Authority"
    url = "https://data.london.gov.uk/dataset/gla-high-street-boundaries"
    cadence_days = 90

    def discover(self):
        candidates = [u for _, u in links(self.url) if u.lower().endswith(".gpkg")]
        if not candidates:
            raise ValueError("No openly downloadable GLA geopackage discovered")
        return [Asset(candidates[0], "high-streets.gpkg")]

    def transform(self, directory, assets):
        df = validate_geo(gpd.read_file(directory / assets[0].filename))
        col = next(
            (
                k
                for k in df.columns
                if k.lower() in ("name", "highstreet", "hs_name", "high_street_name", "highstreet_name")
            ),
            None,
        )
        if not col:
            raise ValueError(f"Unknown high street name column: {list(df.columns)}")
        if not 400 <= len(df) <= 1000:
            raise ValueError("Unexpected high street count")
        return {
            "geo_high_streets": [
                dict(id=str(i), name=str(r[col]), geom=valid_multi(r.geometry).wkt) for i, r in df.iterrows()
            ]
        }
