$(document).ready(function() {
    boot();
});

var MAX_WIDTH = 400
var MAX_HEIGHT = 600

function boot()
{
    var parameters = mturk_parameters();
    if (!parameters["slug"]) {
        var form = "<form><input type='text' name='slug' /></form>"
    } else {
        server_request("getvideo", [parameters["slug"]], function(data) {
            var video = new Video(data);
            var container = $("#container");
            var matcher = new Matcher(container, video);
        });
    }
}

function Video(data) {
    this.slug = data["slug"];
    this.width = data["width"];
    this.height = data["height"];
    this.homography = data["homography"];
    this.videoimageurl = "frames/" + this.slug + "/0/0/0.jpg";
    this.topimageurl = "homographies/" + this.slug + "/topview.jpg";
}

function TopImage(handle, video, callback) {
    var me = this;

    this.handle = handle;
    this.video = video;
    this.callback = callback;
    this.handle.addClass("toimagewaiting");
    var imagetag = "<img id='toimage' src='#' />";
    this.image = $(imagetag).appendTo(handle).hide();
    this.notify = $("<div/>").appendTo(handle).text("Loading...");
    this.imageset = false;
    this.overlay = null;

    this.setupimage = function() {
        //this.overlay = $("<div id='droptargetoverlay'>").appendTo(handle).show();
        this.handle.addClass("toimageloaded");
        this.image.attr("src", me.video.topimageurl + "?" + new Date().getTime());
        this.notify.hide();
        this.image.show();
        this.imageset = true;
        this.callback();
    }

    this.setupdroptarget = function() {
        handle.on("dragover", function() {
            me.handle.addClass("hover");
            return false;
        });

        handle.on("dragend", function() {
            me.handle.removeClass("hover");
            return false;
        });

        handle.on("dragleave", function() {
            me.handle.removeClass("hover");
            return false;
        });


        handle.on("drop", function(e) {
            e.preventDefault && e.preventDefault();
            console.log(e);
            var files = e.originalEvent.dataTransfer.files
            var formdata = new FormData();
            formdata.append("photo", files[0]);
            me.notify.show();
            me.image.hide();
            me.handle.removeClass("hover");
            $.ajax({
                url: server_geturl("savetopview", [me.video.slug]),
                type: "POST",             // Type of request to be send, called as method
                data: formdata, // Data sent to server, a set of key/value pairs (i.e. form fields and values)
                contentType: false,       // The content type used when sending data to the server.
                cache: false,             // To unable request pages to be cached
                processData:false,        // To send DOMDocument or non processed data file it is set to false
                success: function(data)   // A function to be called if request succeeds
                {
                    console.log(data);
                    me.setupimage();
                }
            });
            return false;
        });
    }
    
    this.loadimage = function() {
        if (me.video.homography) {
            me.setupimage();
        }
    }

    this.setupdroptarget();
    this.loadimage();
}

function Matcher(container, video) {

    var me = this;
    this.container = container;
    this.video = video;

    this.instructionpane = $("<div id='instructionpane'>").appendTo(me.container);
    this.statuspane = $("<div id='statuspane'>").appendTo(me.container);

    var videoimagetag = "<img id='fromimage' src='" + video.videoimageurl + "' width=" + video.width +" height=" + video.height + "/>";
    this.fromimage = $(videoimagetag).appendTo(this.container);
    this.toimage = null;
    var toimagecontainer = $("<div />").appendTo(this.container);
    this.container.append("<br />");
    
    this.colors = ["#00FF00", "#FF0000", "#0000FF", "#FF00FF", "#FFFF00", "#00FFFF"];

    this.frompoints = [];
    this.topoints = [];
    this.tomarkers = [];
    this.frommarkers = [];
    this.totofromhomo = null;
    this.fromtotohomo = null;

    this.homomark = $('<div class="boundingbox"></div>');
    this.homomark.css("border-color", "#FF00FF");
    this.homomark.css("background-color", "#FF00FF");
    this.homomark.hide();
    this.container.append(this.homomark)

        

    this.donebutton = $("<input type='button' id='donebutton' value='Save' />").appendTo(me.container).hide();
    this.donebutton.click(function(){
        me.savehomography();
    });

    this.resetbutton = $("<input type='button' id='resetbutton' value='Reset' />").appendTo(me.container).hide();
    this.resetbutton.click(function(){
        me.reset();
    });

    this.transformposition = function(coord, homo) {
        var point = numeric.dot(homo, [coord[0], coord[1], 1]);
        var newx = point[0] / point[2];
        var newy = point[1] / point[2];
        return [newx, newy];
    }

    this.fromimagemousemoved = function(e) {
        if(me.fromtotohomo) {
            var loc = me.getclicklocation(me.fromimage, e);
            var point = me.transformposition([loc['x'], loc['y']], me.fromtotohomo);
            var offset = me.toimage.offset();
            me.homomark.show();
            me.homomark.css({
                top: point[1] + (offset.top - 1.5) + "px",
                left: point[0] + (offset.left - 1.5) + "px",
                width: 3 + "px",
                height: 3 + "px"
            });

        }
    }

    this.toimagemousemoved = function(e) {
        if(me.totofromhomo) {
            var loc = me.getclicklocation(me.toimage, e);
            var point = me.transformposition([loc['x'], loc['y']], me.totofromhomo);
            var offset = me.fromimage.offset();
            me.homomark.show();
            me.homomark.css({
                top: point[1] + (offset.top - 1.5) + "px",
                left: point[0] + (offset.left - 1.5) + "px",
                width: 3 + "px",
                height: 3 + "px"
            });
        }
    }

    this.makemarker = function(image, point, color) {
        var marker = $('<div class="boundingbox"></div>');
        marker.css("border-color", color);
        marker.css("background-color", color);
        //var fill = $('<div class="fill"></div>').appendTo(marker);
        //fill.css("background-color", color);
        this.container.append(marker)

        var offset = image.offset();
        marker.css({
            top: point['y']  + (offset.top - 1.5) + "px",
            left: point['x'] + (offset.left - 1.5) + "px",
            width: 3 + "px",
            height: 3 + "px"
        });
    }

    this.updatestatus = function() {
        this.statuspane.text("Number of matches: " + me.topoints.length);
    }

    this.updateinstruction = function(instruction) {
        this.instructionpane.text(instruction);
    }

    this.reset = function() {
        me.fromimage.off("click");
        me.toimage.off("click");
        for (var i in me.frommarkers) {
            me.frommarkers[i].remove();
        }
        for (var i in me.tomarkers) {
            me.tomarkers[i].remove();
        }
        me.frompoints = [];
        me.topoints = [];
        me.startmatching();
    }

    this.fromimageclicked = function(e) {
        var point = me.getclicklocation(me.fromimage, e);
        console.log(point);
        me.frompoints.push(point);
        me.toimage.click(me.toimageclicked);
        me.fromimage.off("click");
        me.updateinstruction("Click the corresponding point in the right image");
        me.frommarkers.push(me.makemarker(me.fromimage, point, me.colors[me.frompoints.length % me.colors.length]));
    }

    this.toimageclicked = function(e) {
        var point = me.getclicklocation(me.toimage, e);
        console.log(point);
        me.topoints.push(point);
        if (me.topoints.length != me.frompoints.length) {
            console.log("ERROR: invalid state");
        }
        if (me.topoints.length >= 4) {
            me.donebutton.show();
        }
        me.toimage.off("click");
        me.fromimage.click(me.fromimageclicked);
        var instruction = "Click a point in the left image. ";
        if (me.topoints.length < 4)
            instruction += "You need  " + (4 - me.topoints.length) + " more. ";
        else {
            instruction += "Click the done button below when you are satisfied"
        }
        me.updateinstruction(instruction);
        me.updatestatus();
        me.tomarkers.push(me.makemarker(me.toimage, point, me.colors[me.frompoints.length % me.colors.length]));
        if (me.topoints.length >= 4) {
            me.totofromhomo = me.computehomography(me.topoints, me.frompoints);
            me.fromtotohomo = me.computehomography(me.frompoints, me.topoints);
        }
    }

    this.startmatching = function () {
        this.toimage = this.topimage.image;
        this.topimage.callback = function() {
            me.reset();
        }
        this.resetbutton.show();
        this.donebutton.hide();
        
        this.fromimage.click(me.fromimageclicked);
        this.toimage.click(function(e){});
        this.toimage.mousemove(this.toimagemousemoved);
        this.fromimage.mousemove(this.fromimagemousemoved);
        this.updateinstruction("Start by clicking a point in the left image");
        me.updatestatus();
    }

    this.getclicklocation = function(element, e)
    {
        var posX = element.offset().left;
        var posY = element.offset().top;
        return {'x':e.pageX - posX, 'y':e.pageY - posY};
    }

    this.computehomography = function(from, to)
    {
        if (from.length != to.length) {
            console.log("Points do not match");
        }
        var homo_kernel = new jsfeat.motion_model.homography2d();
        var homo_transform = new jsfeat.matrix_t(3, 3, jsfeat.F32_t | jsfeat.C1_t);
        homo_kernel.run(from, to, homo_transform, from.length);

        // you can also calculate transform error for each point
        var error = new jsfeat.matrix_t(this.frompoints.length, 1, jsfeat.F32_t | jsfeat.C1_t);
        homo_kernel.error(from, to, homo_transform, error.data, from.length);
        var data = homo_transform.data;
        homography = [[data[0], data[1], data[2]], [data[3], data[4], data[5]], [data[6], data[7], data[8]]];
        console.log(data);
        console.log(homography);
        return homography;
    }

    this.savehomography = function() {
        var homography = this.computehomography(this.frompoints, this.topoints);
        server_post("savehomography", [this.video.slug], JSON.stringify(homography), function(data) {alert("Saved!")});
    }

    this.topimage = new TopImage(toimagecontainer, this.video, function() {});

    if (this.topimage.imageset) {
        me.startmatching();
    } else {
        this.topimage.callback = function() {me.startmatching()};
    }
}


