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
    var videoslist = $("<ul />").appendTo(container).addClass("videolist");
    for (var i in data) {
        var video = data[i];
        var videoitem = $("<li />").appendTo(videoslist);
        var rowtitle = $("<span/>").addClass("rowtitle");
        rowtitle.append(video["slug"]);

        var segmenttable = $("<table />").appendTo(videoitem).addClass("videotable");
        var titlerow = $("<tr />").appendTo(segmenttable);
        var titlecell = $("<th />").appendTo(titlerow).attr("colspan", 5);
        titlecell.append(rowtitle);

        var jsonlink = $('<a>',{
            text: "json",
            title: "json",
            href: "/server/videodump/" + video["slug"] + "/json"
        });
        var textlink = $('<a>',{
            text: "text",
            title: "text",
            href: "/server/videodump/" + video["slug"] + "/text"
        });
        var xmllink = $('<a>',{
            text: "xml",
            title: "xml",
            href: "/server/videodump/" + video["slug"] + "/xml"
        });

        titlecell.append("<br />");
        titlecell.append(" Download tracks: ");
        titlecell.append(textlink);
        titlecell.append(", ");
        titlecell.append(jsonlink);
        titlecell.append(", ");
        titlecell.append(xmllink);
        titlecell.append("<br />");

        var headerrow = $("<tr />").appendTo(segmenttable);
        headerrow.append("<th>Sequence</th>");
        headerrow.append("<th>Start Frame</th>");
        headerrow.append("<th>End Frame</th>");
        headerrow.append("<th>Number of Objects</th>");
        headerrow.append("<th>Link</th>");

        for (var j in video["segments"]) {
            var segment = video["segments"][j];
            var segmentitem = $("<tr />").appendTo(segmenttable);
            segmentitem.append("<td>" + j + "</td>");
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
