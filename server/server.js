var props = JSON.parse(Assets.getText("app.properties"));

function addMeasure(name, value) {
    name = name.trim();
    var selector = {
        name: name
    };
    var existing = Measures.find(selector);
    var m;
    if (existing.count() == 0) {
        m = {
            name: name,
            min: 1000,
            max: 0
        };
        Measures.insert(m);
    } else {
        m = existing.fetch()[0];
    }
    if (m.min == null) m.min = 1000;
    if (m.max == null) m.max = 0;
    if (value < m.min) m.min = value;
    if (value > m.max) m.max = value;
    Measures.update(selector, m);
}
var minLat = 43.5,
    maxLat = 49,
    minLng = -97,
    maxLng = -89;

function loadAllGrocers() {
    var dLat = 0.5,
        dLng = 0.5;
    for (var lat = minLat; lat < maxLat; lat += dLat) {
        for (var lng = minLng; lng < maxLng; lng += dLng) {
            if (GrocerSearches.find({
                lat: lat,
                lng: lng
            }).count() == 0) {
                GrocerSearches.insert({
                    lat: lat,
                    lng: lng,
                    grocers: loadGrocers(lat, lng)
                });
            } else {
                console.log("Skipping ", lat,lng);
            }
        }
    }
}

function loadGrocers(lat, lng) {
    console.log("----- ", lat, " " , lng);
    var retries = 0;
    var grocers = [];
    var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
    for (var pagetoken = ""; pagetoken != null; ) {
        var params = {
                location: lat + "," + lng,
                key: props.google_api_key,
                radius: 50000,
                types: "grocery_or_supermarket",
                sensor: 'false'
            };
        if (pagetoken != "") {
            params.pagetoken = pagetoken;
        }
        var response = HTTP.get(
            url, {
                params: params,
                contentType: JSON,
                headers: {
                    Accept: 'application/xml',
                    'User-Agent': 'Mozilla/5.0 Ubuntu/8.10 Firefox/3.0.4'
                }
            });
        var json = JSON.parse(response.content);
        if (json.status == "OK") {
            retries = 0;
        } else {
          //  console.log(response);
            if (retries ++ < 5) {
                console.log("Retry", retries, " for " , params.location + " " + params.pagetoken);
                continue;
            } else {
                console.log("*** Failed to load " + params.location + " " + params.pagetoken);
            }
        }
        var list = json.results;
        console.log("For " + lat + "," + lng + " got " + list.length + " next " + json.next_page_token);
        for (var i = 0; i < list.length; i++) {
            var g = list[i];
            var grocer = {
                id: g.id,
                name: g.name,
                lat: g.geometry.location.lat,
                lng: g.geometry.location.lng,
                types: g.types,
                vicinity: g.vicinity
            };
 //           console.log(grocer);
            if (Grocers.find({
                id: g.id
            }).count() == 0) {
                Grocers.insert(grocer);
            }
            grocer = Grocers.findOne({
                id: g.id
            });
            grocers[grocers.length] = grocer;
        }
        pagetoken = json.next_page_token || null;
        if (pagetoken != null) {
            /// Javascript doesn't have a sleep sleep(500);
            sleep(3);
        }
       // console.log("pagetoken = " + pagetoken);
    };
    return grocers;
}
    function sleep (n) {
        for ( ; n>0; n--) {
        var response = HTTP.get(
            "http://search.google.com", {
                contentType: JSON,
                headers: {
                    Accept: 'application/xml',
                    'User-Agent': 'Mozilla/5.0 Ubuntu/8.10 Firefox/3.0.4'
                }
            });
        }
    }

function loadAllHospitals() {
    var res = {};
    res = JSON.parse(Assets.getText("nursing_homes.json"));
    var previouslyLoaded = 0;
    var newlyLoaded = 0;
    for (var i = 0; i < res.features.length; i++) {
        var obj = res.features[i].properties;
        var selector = {
            provnum: obj.provnum
        };
        var existing = Hospitals.find(selector);
        var hosp;
        if (existing.count() == 0) {
            hosp = {
                provnum: obj.provnum,
                name: obj.provname,
                address: obj.geocode_address,
                measures: {}
            };
            try {
                var pt = geocode(hosp.address);
                hosp.lat = pt.lat;
                hosp.lng = pt.lng;
                Hospitals.insert(hosp);
                newlyLoaded++;
            } catch (err) {
                console.error(err);
            }
        } else {
            hosp = existing.fetch()[0];
            previouslyLoaded++;
        }
        //        console.log(hosp.provider_id + "." + obj.measure + " = " + obj.rate);
        //        addMeasure(obj.measure, parseInt(obj.rate));
        //        hosp.measures[obj.measure] = obj.rate;
        if (hosp.grocers == null) {
            loadGrocers(hosp);
        }
        Hospitals.update(selector, hosp);
    }
    console.log("newlyLoaded: " + newlyLoaded + ", previouslyLoaded: " + previouslyLoaded);
    console.log("--- END --- ");
}

function geocode(address) {
    var response = HTTP.get(
        'https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                sensor: 'false'
            },
            contentType: JSON,
            headers: {
                Accept: 'application/xml',
                'User-Agent': 'Mozilla/5.0 Ubuntu/8.10 Firefox/3.0.4'
            }
        });
    var json = JSON.parse(response.content);
    var lat = json.results[0].geometry.location.lat;
    var lng = json.results[0].geometry.location.lng;
    console.log(address + " -> " + lat + " " + lng);
    return {
        lng: lng,
        lat: lat
    };
}

function init() {
   //loadAllGrocers();

    //    loadAllHospitals();
    console.log("Grocers " , Grocers.find().count());
    console.log("GrocerSearches " , GrocerSearches.find().count());
}
Meteor.startup(init);