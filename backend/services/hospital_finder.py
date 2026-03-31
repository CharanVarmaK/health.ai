"""
Hospital & Pharmacy Finder Service
-----------------------------------
Primary  : Google Places API (if GOOGLE_MAPS_API_KEY is set)
Fallback : Curated static dataset for Hyderabad & major Indian cities
"""
import asyncio
import httpx
from loguru import logger
from config import get_settings

settings = get_settings()

STATIC_HOSPITALS = [
    {"name":"Apollo Hospitals","area":"Jubilee Hills","city":"Hyderabad","dist_km":1.2,"rating":4.7,"reviews":2100,"phone":"040-23607777","emergency":True,"hours":"24/7","specialties":["Cardiology","Oncology","Neurology","Orthopedics","Emergency"],"lat":17.4239,"lng":78.4738},
    {"name":"KIMS Hospital","area":"Secunderabad","city":"Hyderabad","dist_km":3.4,"rating":4.5,"reviews":1400,"phone":"040-44885000","emergency":True,"hours":"24/7","specialties":["Cardiology","Nephrology","Urology","Gastroenterology"],"lat":17.4416,"lng":78.4986},
    {"name":"Yashoda Hospital","area":"Somajiguda","city":"Hyderabad","dist_km":4.1,"rating":4.6,"reviews":980,"phone":"040-45674567","emergency":True,"hours":"24/7","specialties":["Neurology","Spine","Gastroenterology","ICU"],"lat":17.4270,"lng":78.4490},
    {"name":"Care Hospitals","area":"Banjara Hills","city":"Hyderabad","dist_km":5.6,"rating":4.4,"reviews":750,"phone":"040-30418888","emergency":False,"hours":"24/7","specialties":["Oncology","Pediatrics","Nephrology"],"lat":17.4156,"lng":78.4487},
    {"name":"Medicover Hospitals","area":"Hitec City","city":"Hyderabad","dist_km":7.2,"rating":4.3,"reviews":620,"phone":"040-68334455","emergency":False,"hours":"8am-10pm","specialties":["Fertility","Laparoscopy","General Surgery"],"lat":17.4474,"lng":78.3763},
    {"name":"Sunshine Hospitals","area":"Paradise Circle","city":"Hyderabad","dist_km":8.8,"rating":4.2,"reviews":410,"phone":"040-44551234","emergency":False,"hours":"9am-9pm","specialties":["Orthopedics","Physiotherapy"],"lat":17.4476,"lng":78.4987},
    {"name":"NIMS","area":"Punjagutta","city":"Hyderabad","dist_km":5.1,"rating":4.1,"reviews":310,"phone":"040-23489000","emergency":True,"hours":"24/7","specialties":["All specialties","Govt Hospital"],"lat":17.4297,"lng":78.4544},
    {"name":"Osmania General Hospital","area":"Afzalgunj","city":"Hyderabad","dist_km":9.2,"rating":3.9,"reviews":540,"phone":"040-24600124","emergency":True,"hours":"24/7","specialties":["All specialties","Govt Hospital"],"lat":17.3780,"lng":78.4750},
]

STATIC_PHARMACIES = [
    {"name":"MedPlus Pharmacy","area":"Jubilee Hills","city":"Hyderabad","dist_km":0.8,"phone":"040-67451200","hours":"7am-11pm","delivery":True},
    {"name":"Apollo Pharmacy","area":"Road No. 36","city":"Hyderabad","dist_km":1.5,"phone":"040-23604141","hours":"24/7","delivery":True},
    {"name":"Wellness Forever","area":"Banjara Hills","city":"Hyderabad","dist_km":2.1,"phone":"040-45671234","hours":"8am-10pm","delivery":False},
    {"name":"Frank Ross Pharmacy","area":"Secunderabad","city":"Hyderabad","dist_km":3.2,"phone":"040-27802233","hours":"9am-9pm","delivery":False},
    {"name":"Netmeds Store","area":"Begumpet","city":"Hyderabad","dist_km":4.5,"phone":"040-23413411","hours":"8am-11pm","delivery":True},
    {"name":"1mg Store","area":"Gachibowli","city":"Hyderabad","dist_km":6.1,"phone":"1800-120-0230","hours":"9am-10pm","delivery":True},
]


async def find_hospitals(lat: float | None, lng: float | None, query: str = "", radius_km: int = 15) -> list[dict]:
    """Return hospitals sorted by distance. Uses Google Places if key available."""
    if settings.GOOGLE_MAPS_API_KEY and lat and lng:
        try:
            return await _google_places_hospitals(lat, lng, radius_km)
        except Exception as e:
            logger.warning(f"Google Places failed, using static data: {e}")
    return STATIC_HOSPITALS


async def find_pharmacies(lat: float | None, lng: float | None) -> list[dict]:
    if settings.GOOGLE_MAPS_API_KEY and lat and lng:
        try:
            return await _google_places_pharmacies(lat, lng)
        except Exception as e:
            logger.warning(f"Google Places pharmacy failed, using static: {e}")
    return STATIC_PHARMACIES


async def _google_places_hospitals(lat: float, lng: float, radius_m: int = 15000) -> list[dict]:
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m * 1000,
        "type": "hospital",
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    results = []
    for p in data.get("results", [])[:10]:
        loc = p.get("geometry", {}).get("location", {})
        results.append({
            "name": p.get("name", ""),
            "area": p.get("vicinity", ""),
            "city": "Hyderabad",
            "dist_km": _haversine(lat, lng, loc.get("lat", lat), loc.get("lng", lng)),
            "rating": p.get("rating", 0),
            "reviews": p.get("user_ratings_total", 0),
            "phone": "",
            "emergency": "emergency" in p.get("name", "").lower(),
            "hours": "See Google Maps",
            "specialties": [],
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "place_id": p.get("place_id"),
        })
    return sorted(results, key=lambda x: x["dist_km"])


async def _google_places_pharmacies(lat: float, lng: float) -> list[dict]:
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {"location": f"{lat},{lng}", "radius": 5000, "type": "pharmacy", "key": settings.GOOGLE_MAPS_API_KEY}
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    results = []
    for p in data.get("results", [])[:8]:
        loc = p.get("geometry", {}).get("location", {})
        results.append({
            "name": p.get("name", ""),
            "area": p.get("vicinity", ""),
            "city": "Hyderabad",
            "dist_km": _haversine(lat, lng, loc.get("lat", lat), loc.get("lng", lng)),
            "phone": "",
            "hours": "See Google Maps",
            "delivery": False,
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
        })
    return sorted(results, key=lambda x: x["dist_km"])


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Distance in km between two lat/lng points."""
    import math
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng/2)**2
    return round(R * 2 * math.asin(math.sqrt(a)), 1)
