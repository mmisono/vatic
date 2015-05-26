$(document).ready(function() {
    boot();
});

var MAX_WIDTH = 400
var MAX_HEIGHT = 600
var exporttypes = ["json", "xml", "text"]

function boot()
{
    server_request("getallvideos", [], function(data) {
        buildlist($("#container"), data);
    });
}

function getdownloadurl(video) {
    var slug = video["slug"];
    var type = $("#exportvideotype" + slug).val();
    var gp = $("#exportvideogp" + slug).attr("checked") ? 1 : 0;
    var fields = $("#exportvideofields" + slug).val();
    return "/server/videodump/" + video["slug"] + "/" + type + "/" + gp + "/" + fields;
}

function setupexportpane(video, container) {
    var exporttype = $("<select>").appendTo(container).attr("id", "exportvideotype"+video["slug"]);
    var link = $('<a>',{
        text: "download",
        title: "download",
        href: ""
    });

    for (var i in exporttypes) {
        $("<option>").appendTo(exporttype).attr("value",exporttypes[i]).text(exporttypes[i]);
    }
    exporttype.change(function() {
        link.attr("href", getdownloadurl(video));
    });

    var exportgroundplane = $("<input type='checkbox' />")
        .appendTo(container)
        .attr("id", "exportvideogp"+video["slug"]);

    $("<label>").appendTo(container)
        .attr("for", "exportvideogp"+video["slug"])
        .text("Ground plane");
 
    exportgroundplane.button().click(function() {
        link.attr("href", getdownloadurl(video));
    });

    var exportfields = $("<input type='text' />")
        .appendTo(container)
        .attr("id", "exportvideofields" + video["slug"]);

    exportfields.change(function() {
        link.attr("href", getdownloadurl(video));
    });

    link.appendTo(container);
    container.append("<br />");
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
        var titlecell = $("<th />").appendTo(titlerow).attr("colspan", 6);
        titlecell.append(rowtitle);

        titlecell.append("<br />");
        var exportpane = $("<div id='videoexport" + video["slug"] + "' class='videoexport'>")
            .appendTo(titlecell);
        setupexportpane(video, exportpane);

        titlecell.append("<br />");

        var homographylink = $('<a>',{
            text: "Edit homography",
            title: "Edit homography",
            href: "/homography.html?slug=" + video["slug"]
        });
        titlecell.append(homographylink);
        titlecell.append("<br />");



        var headerrow = $("<tr />").appendTo(segmenttable);
        headerrow.append("<th>Sequence</th>");
        headerrow.append("<th>Start Frame</th>");
        headerrow.append("<th>End Frame</th>");
        headerrow.append("<th>Tracks</th>");
        headerrow.append("<th>Completed Tracks</th>");
        headerrow.append("<th>Link</th>");

        for (var j in video["segments"]) {
            var segment = video["segments"][j];
            var segmentitem = $("<tr />").appendTo(segmenttable);
            segmentitem.append("<td>" + j + "</td>");
            segmentitem.append("<td>" + segment["start"] + "</td>");
            segmentitem.append("<td>" + segment["stop"] + "</td>");
            segmentitem.append("<td>" + segment["jobs"][0]["numobjects"] + "</td>");
            segmentitem.append("<td>" + segment["jobs"][0]["numdone"] + "</td>");
            var linkcell = $("<td />").appendTo(segmentitem);
            $('<a>',{
                text: segment["jobs"][0]["url"],
                title: 'Segment' + j,
                href: segment["jobs"][0]["url"]
            }).appendTo(linkcell);
    }
    }
}
