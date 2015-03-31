$(document).ready(function() {
    boot();
});

var MAX_WIDTH = 400
var MAX_HEIGHT = 600

function boot()
{
    server_request("getallvideos", [], function(data) {
        buildlist($("#container"), data);
    });
}


function buildlist(container, data) {
    var videoslist = $("<ul />").appendTo(container);
    for (var i in data) {
        var video = data[i];
        var videoitem = $("<li />").appendTo(videoslist).addClass("videorow");
        videoitem.append(video["slug"] + "<br />");
        var segmenttable = $("<table />").appendTo(videoitem).addClass("videotable").hide();
        var headerrow = $("<tr />").appendTo(segmenttable);
        headerrow.append("<th>Start</th>");
        headerrow.append("<th>Stop</th>");
        headerrow.append("<th>Number of Objects</th>");
        headerrow.append("<th>Link</th>");

        videoitem.click(function() {
            segmenttable.toggle();
        });

        for (var j in video["segments"]) {
            var segment = video["segments"][j];
            var segmentitem = $("<tr />").appendTo(segmenttable);
            segmentitem.append("<td>" + segment["start"] + "</td>");
            segmentitem.append("<td>" + segment["stop"] + "</td>");
            segmentitem.append("<td>" + segment["jobs"][0]["numobjects"] + "</td>");
            var linkcell = $("<td />").appendTo(segmentitem);
            $('<a>',{
                text: segment["jobs"][0]["url"],
                title: 'Segment' + j,
                href: segment["jobs"][0]["url"]
            }).appendTo(linkcell);
    }
    }
}
