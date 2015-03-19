function PlaneView(canvas, player, tracks, homography)
{
    var me = this;

    this.canvas = canvas;
    this.player = player;
    this.tracks = tracks;
    this.homography = homography;
    this.context = canvas.getContext('2d');

    tracks.onnewobject.push(function(track) {
        me.setuptrack(track);
        me.draw(me.player.frame);
    });

    player.onupdate.push(function() {
        me.draw(me.player.frame);
    });

    this.imagetoground = function(coord) {
        return coord;
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

    this.setuptrack = function(track)
    {
        track.onupdate.push(function() {
            me.draw(me.player.frame);
        });
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
