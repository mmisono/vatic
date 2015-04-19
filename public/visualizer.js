function PlaneView(handle, player, homography, tracks)
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
    this.tracks = tracks;

    this.tracks.onnewobject.push(function(track) {
            planeview.drawtrajectory(track);
            track.onupdate.push(function() {
                planeview.drawtrajectory(track);
            });
        });

    this.clear = function() {
        var width = this.canvas.width();
        var height = this.canvas.height();
        this.ctx.clearRect(0, 0, width, height);

        if (this.drawimage) {
            this.ctx.drawImage(this.backgroundimg, 0, 0, width, height);
        }
    }

    this.drawtrajectory = function(track) {
        if (!this.ready) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = track.color;
        var pos = track.estimate(player.job.start);
        var newpos = this.transformposition([pos.xbr, pos.ybr]);
        var newx = newpos[0] / newpos[2];
        var newy = newpos[1] / newpos[2];
        this.ctx.moveTo(newx, newy);
        for (var i = player.job.start; i < player.job.stop; i+=10) {
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
        this.drawimage = true;
        me.setupcanvas(width, height);
    }

    this.backgroundimg.onerror = function() {
        var height = 240;
        var width = 320;
        this.drawimage = false;
        me.setupcanvas(width, height);
    }

    this.backgroundimg.src = player.job.topimageurl;
}

