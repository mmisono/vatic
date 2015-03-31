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
            matcher.start();
        });
    }
}

function Video(data) {
    this.slug = data["slug"];
    this.width = data["width"];
    this.height = data["height"];
    this.homography = data["homography"];
    this.videoimageurl = "frames/" + this.slug + "/0/0/0.jpg";
    this.topimageurl = "frames/" + this.slug + "/homography/topview.jpg";
}

function Matcher(container, video) {

    var me = this;
    this.container = container;
    this.video = video;

    var videoimagetag = "<img id='fromimage' src='" + video.videoimageurl + "' width=" + video.width +" height=" + video.height + "/>";
    this.fromimage = $(videoimagetag).appendTo(this.container);
    var topimagetag = "<img id='toimage' src='" + video.topimageurl + "?" + new Date().getTime() + "' />";
    this.toimage = $(topimagetag).appendTo(this.container);
    this.frompoints = [];
    this.topoints = [];

    this.start = function ()
    {
        $.ajax({
            url:me.video.topimageurl,
            type:'HEAD', 
            error:function(){
                me.toimage.hide();
                me.upload();
            },
            success:function(item){
                console.log(item);
            }
        });
    }

    this.upload = function ()
    {
        var toinputform = "<form id='toimageform' method=POST enctype=multipart/form-data action='" + 
            server_geturl("savetopview", [this.video.slug]) +"'>" +
            "<input type=file name=photo>" + 
            "<input type='submit' id='uploadbutton' value='Upload'>" +
            "</form>";
        var toinput = $(toinputform).appendTo(this.container);
        var startbutton = $("<input type='button' id='startbutton' value='start'>").appendTo(this.container).hide();

        $("#toimageform").on('submit',(function(e) {
            e.preventDefault();
            var url = server_geturl("savetopview", [me.video.slug]);
            $.ajax({
                url: url, // Url to which the request is send
                type: "POST",             // Type of request to be send, called as method
                data: new FormData(this), // Data sent to server, a set of key/value pairs (i.e. form fields and values)
                contentType: false,       // The content type used when sending data to the server.
                cache: false,             // To unable request pages to be cached
                processData:false,        // To send DOMDocument or non processed data file it is set to false
                success: function(data)   // A function to be called if request succeeds
                {
                    console.log(data);
                }
            });
        }));
    }

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
        me.fromimage.click(function(e){});
    }

    this.toimageclicked = function(e) {
        var point = me.getclicklocation(me.toimage, e);
        console.log(point);
        me.topoints.push(point);
        if (me.topoints.length != me.frompoints.length) {
            console.log("ERROR: invalid state");
        }
        if (me.topoints.length > 4) {
            donebutton.show();
        }
        me.toimage.click(function(e){});
        me.fromimage.click(fromimageclicked);
    }

    this.startmatching = function () {
        var donebutton = $("<input type='button' id='donebutton' value='Done' />").appendTo(this.container).hide();
        donebutton.click(function(){
            me.computehomography();
        });

        var resetbutton = $("<input type='button' id='resetbutton' value='Reset' />").appendTo(this.container);
        resetbutton.click(function(){
            me.reset();
        });

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
        console.log(homo_transform);
        var output = $("<div id='output'>"+ homo_transform.data +"</div>").appendTo(this.container).hide();
    }

    this.readurl = function(input, image)
    {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                image.attr('src', e.target.result);
            }

            reader.readAsDataURL(input.files[0]);
        }
    }

}


