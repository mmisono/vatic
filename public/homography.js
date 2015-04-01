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
    this.imageset = false;

    this.setupimage = function() {
        this.handle.addClass("toimageloaded");
        this.image.attr("src", me.video.topimageurl + "?" + new Date().getTime());
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


        handle.on("drop", function(e) {
            e.preventDefault && e.preventDefault();
            console.log(e);
            var files = e.originalEvent.dataTransfer.files
            var formdata = new FormData();
            formdata.append("photo", files[0]);
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

    var videoimagetag = "<img id='fromimage' src='" + video.videoimageurl + "' width=" + video.width +" height=" + video.height + "/>";
    this.fromimage = $(videoimagetag).appendTo(this.container);
    this.toimage = null;
    var toimagecontainer = $("<div />").appendTo(this.container);
    this.container.append("<br />");

    this.frompoints = [];
    this.topoints = [];

    this.donebutton = $("<input type='button' id='donebutton' value='Done' />").appendTo(me.container).hide();
    this.donebutton.click(function(){
        me.computehomography();
    });

    this.resetbutton = $("<input type='button' id='resetbutton' value='Reset' />").appendTo(me.container).hide();
    this.resetbutton.click(function(){
        me.reset();
    });



    this.reset = function() {
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
    }

    this.toimageclicked = function(e) {
        var point = me.getclicklocation(me.toimage, e);
        console.log(point);
        me.topoints.push(point);
        if (me.topoints.length != me.frompoints.length) {
            console.log("ERROR: invalid state");
        }
        if (me.topoints.length > 4) {
            me.donebutton.show();
        }
        me.toimage.off("click");
        me.fromimage.click(me.fromimageclicked);
    }

    this.startmatching = function () {
        this.toimage = this.topimage.image;
        this.topimage.callback = function() {
            me.reset();
        }
        this.resetbutton.show();
        
        this.fromimage.click(me.fromimageclicked);
        this.toimage.click(function(e){});
    }

    this.getclicklocation = function(element, e)
    {
        var posX = element.offset().left;
        var posY = element.offset().top;
        return {'x':e.pageX - posX, 'y':e.pageY - posY};
    }

    this.computehomography = function()
    {
        var homo_kernel = new jsfeat.motion_model.homography2d();
        var homo_transform = new jsfeat.matrix_t(3, 3, jsfeat.F32_t | jsfeat.C1_t);
        homo_kernel.run(this.frompoints, this.topoints, homo_transform, this.frompoints.length);

        // you can also calculate transform error for each point
        var error = new jsfeat.matrix_t(this.frompoints.length, 1, jsfeat.F32_t | jsfeat.C1_t);
        homo_kernel.error(this.frompoints, this.topoints, homo_transform, error.data, this.frompoints.length);
        var data = homo_transform.data;
        homography = [[data[0], data[1], data[2]], [data[3], data[4], data[5]], [data[6], data[7], data[8]]];
        console.log(data);
        console.log(homography);
        server_post("savehomography", [this.video.slug], JSON.stringify(homography), function(data) {});
    }

    this.topimage = new TopImage(toimagecontainer, this.video, function() {});

    if (this.topimage.imageset) {
        me.startmatching();
    } else {
        this.topimage.callback = function() {me.startmatching()};
    }
}


