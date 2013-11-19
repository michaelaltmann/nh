function loadMeasureDescriptions() {
    Measures.remove({});
    Measures.insert({name:"travel", description: "Average distance (km)", sort: 1 , higherIsBetter : false });    
}

function addMeasure(name, value) {
    name = name.trim();
    var selector = {name: name};
    var existing = Measures.find(selector);
    var m;
    if (existing.count() == 0) {
        m = {name: name, min: 1000, max: 0};
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
                provnum : obj.provnum,
                name : obj.provname,
                address : obj.geocode_address,
                measures : {}
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
        Hospitals.update(selector, hosp);
    }
    console.log("newlyLoaded: " + newlyLoaded 
               + ", previouslyLoaded: " + previouslyLoaded);
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
    return {lng: lng, lat: lat};
}

function init() {
    loadMeasureDescriptions();
    loadAllHospitals();
}
Meteor.startup(init);