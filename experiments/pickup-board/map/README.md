# Yangjae actual map

Run parent server and open `/map`. Real OSM snapshot under data/, ODbL attribution in UI and dataset; Leaflet1.9.4 license under vendor/.

See ../../../docs/PICKUP_REAL_MAP_2026-11-04.md for API, source URLs, tests and partial-coverage limits. Map coordinates are [longitude,latitude], WGS84. Never interpret synthetic-diagram pickupPoint as mapPoint.

Refresh offline: `python map/import_osm.py input-osm.json map/data/yangjae.json` from pickup-board directory; input requires complete restriction multipolygon members and original download mtime. Restart server after validated refresh. Data expires after7days; no automatic refresh.
