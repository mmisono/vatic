function PlaneView(handle, player, homography)
{
    var me = this;

    this.drawimage = false;
    this.handle = handle;
    this.canvas = null;
    this.ctx = null;
    this.player = player;
    this.homography = homography;
    this.ready = false;
    this.backgroundimg = null;
    this.tracks = null;

    this.initializetracks = function(tracks) {
        this.tracks = tracks;
        tracks.onnewobject.push(function(track) {
            me.drawalltrajectories(tracks);
            track.onupdate.push(function() {
                me.clear();
                me.drawalltrajectories(tracks);
            });
        });
    }

    this.player.onupdate.push(function() {
        me.clear();
        me.drawalltrajectories(me.tracks);
    });

    this.clear = function() {
        if (!this.canvas) {
            return;
        }
        var width = this.canvas.width();
        var height = this.canvas.height();
        this.ctx.clearRect(0, 0, width, height);

        if (this.drawimage) {
            this.ctx.drawImage(this.backgroundimg, 0, 0, width, height);
        }
    }

    this.drawalltrajectories = function(tracks) {
        for (var i in tracks.tracks)
        {
            //this.drawtrajectory(tracks.tracks[i]);
        }
    }

    this.drawtrajectory = function(track) {
        if (!this.ready) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = track.color;

        var curframe = this.player.frame;
        var start = Math.max(this.player.job.start, curframe - 70);
        var stop = Math.min(this.player.job.stop, curframe + 70);

        var pos = track.estimate(start);
        var newpos = this.transformposition([pos.xbr, pos.ybr]);
        var newx = newpos[0] / newpos[2];
        var newy = newpos[1] / newpos[2];

        this.ctx.moveTo(newx, newy);

        for (var i = start; i < stop; i+=1) {
            pos = track.estimate(i);
            if (pos.outside) continue;

            newpos = this.transformposition([pos.xbr, pos.ybr]);
            newx = newpos[0] / newpos[2];
            newy = newpos[1] / newpos[2];
            this.ctx.lineTo(newx, newy);
        }

        this.ctx.stroke();
    }

    this.setupcanvas = function(width, height) {
        this.canvas = $("<canvas />").attr('height', height).attr('width', width);
        this.handle.append(this.canvas);
        this.ctx = this.canvas[0].getContext('2d');
        this.clear();
        this.ready = true;
    }

    this.transformposition = function(coord) {
        return numeric.dot(this.homography, [coord[0], coord[1], 1]);
    }

    this.invtransformposition = function(coord) {
        return numeric.dot(numeric.inv(this.homography), [coord[0], coord[1], 1]);
    }

    this.backgroundimg = new Image();
    this.backgroundimg.onload = function() {
        var height = me.backgroundimg.height;
        var width = me.backgroundimg.width;
        me.drawimage = true;
        me.setupcanvas(width, height);
    }

    this.backgroundimg.onerror = function() {
        var height = 240;
        var width = 320;
        me.drawimage = false;
        me.setupcanvas(width, height);
    }

    this.backgroundimg.src = player.job.topimageurl;
}

