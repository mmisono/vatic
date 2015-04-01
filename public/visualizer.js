function PlaneView(handle, player, homography)
{
    var me = this;

    this.handle = handle;
    this.player = player;
    this.homography = homography;
    this.handle.css("background-image", "url('" + player.job.topimageurl + "')");

    this.transformposition = function(coord) {
        return numeric.dot(this.homography, [coord[0], coord[1], 1]);
    }

    this.draw = function(frame)
    {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (var i in this.tracks.tracks)
        {
            var track = this.tracks.tracks[i];
            var position = track.estimate(frame);
            this.context.beginPath();
            var coord = this.imagetoground([position.xbr, position.ybr]);
            this.context.arc(coord[0], coord[1], 10, 0, 2*Math.PI);
            this.context.stroke();
        }
    }
}

function CubeView(handle, player, tracks)
{
    var me = this;

    this.player = player;
    this.handle = handle;
    this.tracks = tracks;

    player.onupdate.push(function() {
        me.draw(player.frame);
    });

    this.draw = function(frame)
    {
        
    }

    this.setuptrack = function(track)
    {
        track.onupdate.push(function()
        {

        });
    }
}
