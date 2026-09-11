import csv
import io
import re
from zipfile import ZipFile

from pipeline.sources.base import Asset, Source, links

BANDS = [
    ("0_12000", 0, 12000),
    ("12001_15000", 12000, 15000),
    ("15001_50999", 15000, 51000),
    ("51000_499999", 51000, 500000),
    ("500000_plus", 500000, None),
]


def grouped_median(counts):
    """Interpolated median within published rateable-value bands; never a rent estimate."""
    if any(v is None for v in counts) or sum(counts) <= 0:
        return None
    target, cum = sum(counts) / 2, 0
    for (_, low, high), n in zip(BANDS, counts, strict=True):
        if cum + n >= target and n > 0:
            return None if high is None else low + (target - cum) / n * (high - low)
        cum += n
    return None


def parse_band_csv(data):
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    if not {"geography", "area_code", "area_name", "Total"} <= set(reader.fieldnames or []):
        raise ValueError("VOA band schema changed")
    result = {r["area_name"]: r for r in reader if r["area_code"].startswith("E09")}
    if not result:
        raise ValueError("No London rateable value bands")
    return result


class VOASource(Source):
    id = "voa"
    name = "Non-domestic rating stock: rateable value bands"
    publisher = "HM Revenue & Customs / Valuation Office Agency"
    url = "https://www.gov.uk/government/collections/non-domestic-rating-stock-of-properties-collection"

    def discover(self):
        pages = [u for _, u in links(self.url) if "/statistics/non-domestic-rating-stock-of-properties" in u]
        pages = sorted(
            set(pages), key=lambda u: max([int(y) for y in re.findall(r"20\d{2}", u)] or [0]), reverse=True
        )
        for page in pages:
            assets = [u for _, u in links(page) if "stock_scat_la_" in u and u.endswith(".zip")]
            if assets:
                year = max(int(y) for y in re.findall(r"20\d{2}", assets[0]))
                return [Asset(assets[0], "bands.zip", f"{year}-03-31", {"official_page": page, "year": year})]
        raise ValueError("No official rateable-value band archive found")

    def transform(self, directory, assets):
        z = ZipFile(directory / assets[0].filename)
        bands = [parse_band_csv(z.read(f"SOP_SCAT_LA_counts_{key}.csv")) for key, _, _ in BANDS]
        result = []
        for borough in sorted(bands[0]):
            counts = []
            for b in bands:
                value = b[borough]["Total"]
                counts.append(float(value) if value.replace(".", "", 1).isdigit() else None)
            result.append(
                dict(
                    code=borough,
                    sector="all",
                    property_count=sum(v or 0 for v in counts),
                    pressure=grouped_median(counts),
                    method="borough_interpolated_median_rv_band",
                )
            )
        if len(result) != 33:
            raise ValueError("VOA requires all 33 London boroughs")
        self.notes = [
            "Occupancy Cost Pressure Proxy: borough-level grouped median rateable value across commercial stock.",
            "Linear interpolation assumes uniform values within the median band; broad bands create uncertainty.",
            "Suppressed bands remain unavailable. This is not market rent or a property-level valuation.",
        ]
        return {"property_cost_proxy": result}
