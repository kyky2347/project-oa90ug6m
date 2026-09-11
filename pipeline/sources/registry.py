from pipeline.sources.geography import GeographySource, GLASource
from pipeline.sources.ons import ONSSource
from pipeline.sources.osm import OSMSource
from pipeline.sources.police import PoliceSource
from pipeline.sources.tfl import TfLSource
from pipeline.sources.voa import VOASource

SOURCES = {
    s.id: s
    for s in [
        GeographySource(),
        ONSSource(),
        OSMSource(),
        TfLSource(),
        PoliceSource(),
        VOASource(),
        GLASource(),
    ]
}
