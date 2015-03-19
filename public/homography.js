$(document).ready(function() {
    boot();
});

function boot()
{
    var container = $("#container");
    var matcher = new Matcher(container);
    matcher.start();
}

function Matcher(container) {
    var me = this;
    this.container = container;
    this.fromimage = $("<img id='fromimage' src='#'>").appendTo(this.container).hide();
    this.toimage = $("<img id='toimage' src='#'>").appendTo(this.container).hide();
    this.fromimageuploaded = false;
    this.toimageuploaded = false;
    this.frompoints = [];
    this.topoints = [];
    this.matchstate = 0;

    this.start = function ()
    {
        this.upload();
    }

    this.upload = function ()
    {
        var frominput = $("<input type='file' id='fromimageinp' />").appendTo(this.container);
        var toinput = $("<input type='file' id='toimageinp' />").appendTo(this.container);
        var startbutton = $("<input type='button' id='startbutton' value='start'>").appendTo(this.container).hide();

        frominput.change(function() {
            me.readurl(this, me.fromimage);
            me.fromimage.show();
            me.fromimageuploaded = true;
            me.readytomatch();
        });

        toinput.change(function() {
            me.readurl(this, me.toimage);
            me.toimage.show();
            me.toimageuploaded = true;
            me.readytomatch();
        });
    }

    this.readytomatch = function() {
        if (this.toimageuploaded && this.fromimageuploaded) {
            this.startmatching();
        }
    }

    this.startmatching = function () {
        var donebutton = $("<input type='button' id='donebutton' value='Done' />").appendTo(this.container).hide();
        donebutton.click(function(){
            me.matchstate = 2;
            me.computehomography();
        });

        var resetbutton = $("<input type='button' id='resetbutton' value='Reset' />").appendTo(this.container);
        resetbutton.click(function(){
            me.matchstate = 0;
            me.frompoints = [];
            me.topoints = [];
        });

        this.fromimage.click(function(e) {
            if (me.matchstate == 0) {
                var point = me.getclicklocation(me.fromimage, e);
                console.log(point);
                me.frompoints.push(point);
                me.matchstate = 1;
            }
        });

        this.toimage.click(function(e) {
            if (me.matchstate == 1) {
                var point = me.getclicklocation(me.toimage, e);
                console.log(point);
                me.topoints.push(point);
                if (me.topoints.length != me.frompoints.length) {
                    console.log("ERROR: invalid state");
                }
                if (me.topoints.length > 4) {
                    donebutton.show();
                }
                me.matchstate = 0;
            }
        });
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

    this.selectimagepoint = function(image)
    {

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


