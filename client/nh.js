Template.main.events({
    "click .carouselSlide": function (evt) {
        var measureName = $(evt.target).attr("data-name");
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


var width = 600,
    height = 500,
    maxRate = 60;
var measure = null;
var bBox = [[-97,43.5], [-89,49]];


var canvas;
var context;
var sites, siteMap;
var svg;

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

function loadMap() {
    createSvg();
    d3.json("minnesota.geojson", function (error, mn) {
        var path = d3.geo.path()
            .projection(projection);
        debugger;
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
    });
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
}

function averageTravel(cell) {
    var x = 0;
    var center = cell.point;
    for (var j = 0; j < cell.length; j++) {
        var pt = cell[j];
        var d = d3.geo.greatArc().distance({
            source: center,
            target: pt
        }) * 6371;
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
        addMeasure('travel', travel);
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
    var path = d3.geo.path()
        .projection(projection);
    svg.append("path")
        .datum(cellFeature)
        .attr("class", style)
        .attr("d", path)
        .attr("clip-path", "url(#clipper)")
        .append("svg:title").text(label);

    var p = projection(cell.point);
    svg.append("circle")
        .attr("class", "hospital")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", 2)
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
    } else {
        m = existing.fetch()[0];
    }
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
    Meteor.autorun(function() {
        Hospitals.find();
        loadPoints();
    });
}
Meteor.startup(init);

