Template.main.events({
    "click .carouselSlide": function (evt) {
        drawGrocers();
        var measureName = "travel";
        measure = Measures.find({
            name: measureName
        }).fetch()[0];
        drawDiagram();
    }
});

Template.main.measures = function () {
    return Measures.find({}, {
        sort: {
            sort: 1
        }
    });
}


var width = 400,
    height = 400,
    maxRate = 60;
var measure = null;
var bBox = [[-97, 43.5], [-89, 49]];


var canvas;
var context;
var sites, siteMap;
var svg;
var mn;
var projection;
var voronoi;

function readOnePoint(hospital) {
    var pt = [hospital.lng, hospital.lat];
    if (pt != null && pt.length == 2) {
        if (siteMap[pt] != null) {
            console.info("Skipping dup: " + pt);
        } else {
            siteMap[pt] = hospital;
            sites[sites.length] = pt;
        }
    }
}

function createSvg() {
    if (svg == null) {
        svg = d3.select("#map").select("svg")
            .attr("overflow", "hidden")
            .attr("width", width)
            .attr("height", height);
        var el = document.getElementById("svg");
        var clipper = document.createElement("clipPath");
        clipper.setAttribute("id", "clipper");
        el.appendChild(clipper);
    }
}
function pointInPolygon (point, vs) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        var xi, xj, i, intersect,
            x = point[0],
            y = point[1],
            inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          xi = vs[i][0],
          yi = vs[i][1],
          xj = vs[j][0],
          yj = vs[j][1],
          intersect = ((yi > y) != (yj > y))
              && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
function loadMap() {
    createSvg();
    var svg2 = d3.select("#map2").select("svg")
        .attr("overflow", "hidden")
        .attr("width", width)
        .attr("height", height);
    d3.json("minnesota.geojson", function (error, data) {
        mn = data;
        var path = d3.geo.path()
            .projection(projection);
        svg.append("path")
            .datum({
                type: "FeatureCollection",
                features: mn.features
            })
            .attr("class", "map")
            .attr("d", path);
        svg.append("clipPath")
            .attr("id", "clipper")
            .append("path")
            .datum({
                type: "FeatureCollection",
                features: mn.features
            })
            .attr("d", path);
    
        // Second map
        svg2.append("path")
            .datum({
                type: "FeatureCollection",
                features: mn.features
            })
            .attr("class", "map")
            .attr("d", path);
        svg2.append("clipPath")
            .attr("id", "clipper2")
            .append("path")
            .datum({
                type: "FeatureCollection",
                features: mn.features
            })
            .attr("d", path);
    });
}

function drawGrocers() {

    var allGrocers = Grocers.find().fetch();
    var svg2 = d3.select("#map2").select("svg");
    for (var i = 0; i < allGrocers.length; i++) {
        var x = allGrocers[i];
        console.log("Mapping ", x.name, " at ", x.lng, x.lat, " to ", projection([x.lng, x.lat]));
        var p = projection([x.lng, x.lat]);
        svg2.append("circle")
            .attr("class", "grocer")
            .attr("cx",p[0])
            .attr("cy", p[1])
            .attr("r", 2)
            .attr("clip-path", "url(#clipper2)")
            .append("svg:title").text(x.name);
    }
}

function loadPoints() {
    var iterator = Hospitals.find();
    sites = [];
    siteMap = {};
    iterator.forEach(readOnePoint);
    computeTravelTimes();
}


function drawDiagram() {
    redraw();
}

function generateVoronoiCells() {
    cells = voronoi(sites);
    console.log("sites " + sites.length + " cells " + cells.length);
    var path = d3.geo.path();
}

function averageTravel(cell) {
    var x = 0;
    var path = d3.geo.path();
    var center = cell.point;
    for (var j = 0; j < cell.length; j++) {
        var pt = cell[j];
        var inMinnesota = true; //TODO
        if (inMinnesota) {
            var d = d3.geo.greatArc().distance({
                source: center,
                target: pt
            }) * 6371;
        }
        x += d;
    }
    x = x / cell.length;
    x = x * 2 / 3.0;
    return x;
}
var cells;

function computeTravelTimes() {
    generateVoronoiCells();
    for (var i = 0, n = cells.length; i < n; ++i) {
        var cell = cells[i];
        var screenPt = cell.point;
        hospital = siteMap[screenPt];
        var travel = averageTravel(cell);
        hospital.measures['travel'] = travel;
        //       addMeasure('travel', travel);
    }
}

function redraw() {
    createSvg();
    generateVoronoiCells();

    for (var i = 0, n = cells.length; i < n; ++i) {
        var cell = cells[i];
        var screenPt = cell.point;
        hospital = siteMap[screenPt];
        var rate = hospital.measures[measure.name];
        var level, label;
        if (rate == null) {
            level = -1;
            label = hospital.name + " NA";
        } else {
            // looks better not to use level 0
            level = 1 + Math.floor((rate - measure.min) * 15 / (1 + measure.max - measure.min));
            if (level < 1) level = 1;
            if (level > 15) level = 15;
            if (measure.higherIsBetter) {
                level = 1 + (15 - level);
            }
            label = hospital.name + " " + rate;
        }
        var style = "cell" + level;
        draw(cell, style, label);
    }
}


function cellToFeature(cell) {
    if (cell.length < 3) return null;
    var coordinates = cell.slice(0);
    //complete the loop of the polygon
    coordinates[coordinates.length] = coordinates[0];

    var cellFeature = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coordinates]
        },
        "properties": {}
    }
    return cellFeature;
}

function draw(cell, style, label) {
    var cellFeature = cellToFeature(cell);
    if (cellFeature == null) return;
    var path = d3.geo.path()
        .projection(projection);
    svg.append("path")
        .datum(cellFeature)
//        .attr("class", style)       
        .attr("class", "catchBasin")       
        .attr("d", path)
        .attr("clip-path", "url(#clipper)")
        .append("svg:title").text(label);

    var p = projection(cell.point);
    svg.append("circle")
        .attr("class", "hospital")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", 3)
        .append("svg:title").text(label);

}

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
    }
    m = Measures.find(selector).fetch()[0];

    if (m.min == null) m.min = 1000;
    if (m.max == null) m.max = 0;
    if (value < m.min) {
        Measures.update({
            '_id': m._id
        }, {
            $set: {
                'min': value
            }
        });
    }
    if (value > m.max) {
        Measures.update({
            '_id': m._id
        }, {
            $set: {
                'max': value
            }
        });
    }
}



function init() {

    projection = d3.geo.albers()
        .center([0, 46])
        .rotate([94, 0])
        .parallels([43, 49])
        .scale(5000)
        .translate([width / 2, height / 2]);
    voronoi = d3.geom.voronoi();
    voronoi.clipExtent(bBox);
    loadMap();
    loadPoints();
    Meteor.autorun(function () {
        Hospitals.find();
        loadPoints();
    });
    /*
    Meteor.autorun(function () {
        Grocers.find();
        drawGrocers();
    });
    */
}
Meteor.startup(init);