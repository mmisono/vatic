/*
 * Allows the user to draw a box on the screen.
 */
function BoxDrawer(container, defaultsize, oneclick)
{
    var me = this;

    this.defaultsize = defaultsize;
    this.oneclick = oneclick;

    this.onstartdraw = [];
    this.onstopdraw = []

    this.enabled = false;
    this.drawing = false;

    this.startx = 0;
    this.starty = 0;

    this.container = container;
    this.handle = null;
    this.color = null;

    this.vcrosshair = null;
    this.hcrosshair = null;

    /*
     * Enables the drawer.
     */
    this.enable = function()
    {
        this.enabled = true;

        this.container.css({
            'cursor': 'crosshair'
        });

        this.hcrosshair = $('<div></div>').appendTo(this.container);
        this.vcrosshair = $('<div></div>').appendTo(this.container);

        this.vcrosshair.css({
            width: '2px',
            height: '100%',
            position: 'relative',
            top: '0px',
            left: '0px',
            backgroundColor: this.color,
            zIndex: 1
        }).hide();

        this.hcrosshair.css({
            height: '2px',
            width: '100%',
            position: 'relative',
            top: '0px',
            left: '0px',
            backgroundColor: this.color,
            zIndex: 1
        }).hide();
    }

    /*
     * Disables the drawer. No boxes can be drawn and interface cues are
     * disabled.
     */
    this.disable = function()
    {
        this.enabled = false;

        this.container.css({
            'cursor': 'default'
        });

        this.vcrosshair.remove();
        this.hcrosshair.remove();
    }

    /*
     * Method called when we receive a click on the target area.
     */
    this.click = function(xc, yc)
    {
        if (this.enabled)
        {
            if (this.oneclick)
            {
                this.drawing = true;
                var minx = xc - (this.defaultsize["width"] / 2);
                var miny = yc - (this.defaultsize["height"] / 2);
                var maxx = xc + (this.defaultsize["width"] / 2);
                var maxy = yc + (this.defaultsize["height"] / 2);
                this.startx = minx;
                this.starty = miny;
                this.finishdrawing(maxx, maxy);
            }
            else if (!this.drawing)
            {
                this.startdrawing(xc, yc);
            }
            else
            {
                this.finishdrawing(xc, yc);
            }
        }
    }

    /*
     * Updates the current visualization of the current box.
     */
    this.updatedrawing = function(xc, yc)
    {
        if (this.drawing)
        {
            var pos = this.calculateposition(xc, yc);
            var offset = this.container.offset();
            this.handle.css({
                "top": pos.ytl + offset.top + "px",
                "left": pos.xtl + offset.left + "px",
                "width": (pos.width - 3) + "px",
                "height": (pos.height - 3)+ "px",
                "border-color": this.color
            });
        }
    }

    /*
     * Updates the cross hairs.
     */
    this.updatecrosshairs = function(visible, xc, yc)
    {
        if (this.enabled)
        {
            if (visible && !this.drawing)
            {
                this.vcrosshair.show().css('left', xc + 'px');
                this.hcrosshair.show().css('top', yc + 'px');
            }
            else
            {
                this.vcrosshair.hide();
                this.hcrosshair.hide();
            }
        }
    }

    /*
     * Calculates the position of the box given the starting coordinates and
     * some new coordinates.
     */
    this.calculateposition = function(xc, yc)
    {
        var xtl = Math.min(xc, this.startx);
        var ytl = Math.min(yc, this.starty);
        var xbr = Math.max(xc, this.startx);
        var ybr = Math.max(yc, this.starty);
        return new Position(xtl, ytl, xbr, ybr)
    }

    /*
     * Starts drawing a box.
     */
    this.startdrawing = function(xc, yc)
    {
        if (!this.drawing)
        {
            console.log("Starting new drawing");

            this.startx = xc;
            this.starty = yc;

            this.drawing = true;

            this.handle = $('<div class="boundingbox"><div>');
            this.updatedrawing(xc, yc);
            this.container.append(this.handle);

            for (var i in this.onstartdraw)
            {
                this.onstartdraw[i]();
            }
        }
    }

    /*
     * Completes drawing the box. This will remove the visualization, so you will 
     * have to redraw it.
     */
    this.finishdrawing = function(xc, yc)
    {
        if (this.drawing)
        {
            console.log("Finishing drawing");

            var position = this.calculateposition(xc, yc);

            // call callbacks
            for (var i in this.onstopdraw)
            {
                this.onstopdraw[i](position);
            }

            this.drawing = false;
            if (this.handle) this.handle.remove();
            this.startx = 0;
            this.starty = 0;
        }
    }
    
    /*
     * Cancels the current drawing.
     */
    this.canceldrawing = function()
    {
        if (this.drawing)
        {
            console.log("Cancelling drawing");
            this.drawing = false;
            this.handle.remove();
            this.startx = 0;
            this.starty = 0;
        }
    }

    var respondtoclick = function(e) {
        var offset = container.offset();
        me.click(e.pageX - offset.left, e.pageY - offset.top);
    };

    var ignoremouseup = false;

    container.mousedown(function(e) {
        ignoremouseup = true;
        window.setTimeout(function() { 
            ignoremouseup = false;
        }, 500);

        respondtoclick(e);
    });

    container.mouseup(function(e) {
        if (!ignoremouseup)
        {
            respondtoclick(e);
        }
    });

    container.click(function(e) {
        e.stopPropagation();
    });

    container.mousemove(function(e) {
        var offset = container.offset();
        var xc = e.pageX - offset.left;
        var yc = e.pageY - offset.top;

        me.updatedrawing(xc, yc);
        me.updatecrosshairs(true, xc, yc);
    });

    $("body").click(function(e) {
        me.canceldrawing();
    });
}

var track_collection_dump = null;

/*
 * A collection of tracks.
 */
function TrackCollection(player, topviewplayer, job)
{
    var me = this;

    this.player = player;
    this.topviewplayer = topviewplayer;
    this.job = job;
    this.tracks = [];
    this.autotrack = false;
    this.forwardtracker = null;
    this.bidirectionaltracker = null;

    this.onnewobject = []; 

    player.onupdate.push(function() {
        me.update(player.frame);
    });

    /*player.onpause.push(function() {
        for (var i in me.tracks)
        {
            me.tracks[i].recordposition();
        }
    });*/

    // if the window moves, we have to update boxes
    $(window).resize(function() {
        me.update(me.player.frame);
    });


    /*
     * Creates a new object.
     */
    this.add = function(frame, position, color)
    {
        var track = new Track(this, this.player, this.topviewplayer, color, position, this.autotrack, this.forwardtracker, this.bidirectionaltracker);
        this.tracks.push(track);

        console.log("Added new track");

        for (var i = 0; i < this.onnewobject.length; i++)
        {
            this.onnewobject[i](track);
        }

        return track;
    }

    this.setautotrack = function(value)
    {
        this.autotrack = value;
        for (var i in this.tracks)
        {
            this.tracks[i].autotrack = value;
        }
    }

    this.setforwardtracker = function(value)
    {
        this.forwardtracker = value;
        for (var i in this.tracks)
        {
            this.tracks[i].forwardtracker = value;
        }
    }

    this.setbidirectionaltracker = function(value)
    {
        this.bidirectionaltracker = value;
        for (var i in this.tracks)
        {
            this.tracks[i].bidirectionaltracker = value;
        }
    }

    this.removeall = function()
    {
        for (var i in this.tracks)
        {
            this.tracks[i].remove();
        }
    }

    /*
     * Changes the draggable functionality. If true, allow dragging,
     * otherwise disable.
     */
    this.draggable = function(value)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].draggable(value);
        }
    }

    /*
     * Changes the resize functionality. If true, allow resize, otherwise disable.
     */
    this.resizable = function(value)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].resizable(value);
        }
    }

    /*
     * Changes the visibility on the boxes. If true, show boxes, otherwise hide.
     */
    this.visible = function(value)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].visible(value);
        }
    }

    /*
     * Changes the opacity on the boxes.
     */
    this.dim = function(value)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].dim(value);
        }
    }

    this.drawingnew = function(value)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].drawingnew = value;
        }
    }

    /*
     * Updates boxes with the given frame
     */
    this.update = function(frame)
    {
        for (var i in this.tracks)
        {
            this.tracks[i].draw(frame);
        }
    }

    /*
     * Returns the number of tracks.
     */
    this.count = function()
    {
        var count = 0;
        for (var i in this.tracks)
        {
            if (!this.tracks[i].deleted)
            {
                count++;
            }
        }
        return count;
    }
    
    this.recordposition = function()
    {
        for (var i in this.tracks)
        {
            this.tracks[i].recordposition();
        }
    }

    /*
     * Serializes all tracks for sending to server.
     */
    this.serialize = function()
    {
        var count = 0;
        var str = "[";
        for (var i in this.tracks)
        {
            if (!this.tracks[i].deleted)
            {
                str += this.tracks[i].serialize() + ",";
                count++;
            }
        }
        if (count == 0)
        {
            return "[]";
        }
        return str.substr(0, str.length - 1) + "]";
    }

    track_collection_dump = function() {
        return me.serialize();
    };
}

/*
 * A track class.
 */
function Track(tracks, player, topviewplayer, color, position, autotrack, forwardtracker, bidirectionaltracker)
{
    var me = this;

    this.tracks = tracks;
    this.journal = new Journal(player.job.start, player.job.blowradius);
    this.attributejournals = {};
    this.label = null;
    this.id = null;
    this.player = player;
    this.topviewplayer = topviewplayer;
    this.handle = null;
    this.topviewhandle = null;
    this.color = color;
    this.htmloffset = 3;
    this.text = "";
    this.deleted = false;
    this.offset = 0;
    this.forwardtracker = forwardtracker;
    this.bidirectionaltracker = bidirectionaltracker;
    this.autotrack = autotrack;
    this.forwardrequest = null;
    this.backrequest = null;

    this.onmouseover = [];
    this.onmouseout = [];
    this.oninteract = [];
    this.onupdate = [];
    this.onstartupdate = [];
    this.onstarttracking = [];
    this.ondonetracking = [];

    this.candrag = true;
    this.canresize = true;

    this.locked = false;
    this.drawingnew = false;

    this.journal.mark(this.player.job.start,
        new Position(position.xtl, position.ytl,
                     position.xbr, position.ybr, 
                     false, true, true, []));

    this.journal.mark(this.player.frame, position);

    this.journal.artificialrightframe = this.player.job.stop;
    this.journal.artificialright = position;

    /*
     * Polls the on screen position of the box and returns it.
     */
    this.pollposition = function()
    {
        var hidden = this.handle.css("display") == "none";
        this.handle.show();

        var pos = this.handle.position();
        var width = this.handle.width();
        var height = this.handle.height();
        var offset = this.player.handle.offset();

        if (hidden)
        {
            this.handle.hide();
        }

        if (width < 1)
        {
            width = 1;
        }

        if (height < 1)
        {
            height = 1;
        }

        var xtl = pos.left - offset.left;
        var ytl = pos.top - offset.top;
        var xbr = xtl + width + this.htmloffset;
        var ybr = ytl + height + this.htmloffset;

        var estimate = this.estimate(this.player.frame);
        var position = new Position(xtl, ytl, xbr, ybr)
        position.occluded = estimate.occluded;
        position.outside = estimate.outside;
        return position;
    }

    /*
     * Polls the on screen position of the box and returns it.
     */
    this.polltopviewposition = function()
    {
        var hidden = this.topviewhandle.css("display") == "none";
        this.topviewhandle.show();

        var pos = this.topviewhandle.position();
        var width = this.topviewhandle.width();
        var height = this.topviewhandle.height();
        var offset = this.topviewplayer.handle.offset();

        if (hidden)
        {
            this.topviewhandle.hide();
        }

        if (width < 1)
        {
            width = 1;
        }

        if (height < 1)
        {
            height = 1;
        }

        var estimate = this.estimate(this.player.frame);

        var x = pos.left - offset.left + 5 + this.htmloffset;
        var y = pos.top - offset.top + 5 + this.htmloffset;

        var newpos = this.topviewplayer.invtransformposition([x, y]);
        var xbr = newpos[0] / newpos[2];
        var ybr = newpos[1] / newpos[2];
        var xtl = xbr - estimate.width;
        var ytl = ybr - estimate.height;

        var position = new Position(xtl, ytl, xbr, ybr)
        position.occluded = estimate.occluded;
        position.outside = estimate.outside;
        return position;
    }

    /*
     * Polls the on screen position and marks it in the journal.
     */
    this.recordposition = function()
    {
        this.journal.mark(this.player.frame, this.pollposition());
        this.journal.artificialright = this.journal.rightmost();
    }

    this.recordtopviewposition = function()
    {
        this.journal.mark(this.player.frame, this.polltopviewposition());
        this.journal.artificialright = this.journal.rightmost();
    }

    /*
     * Fixes the position to force box to be inside frame.
     */
    this.fixposition = function()
    {
        var width = this.player.job.width;
        var height = this.player.job.height;
        var pos = this.pollposition();

        if (pos.xtl > width)
        {
            pos = new Position(width - pos.width, pos.ytl, width, pos.ybr);
        }
        if (pos.ytl > height)
        {
            pos = new Position(pos.xtl, height - pos.height, pos.xbr, height);
        }
        if (pos.xbr < 0)
        {
            pos = new Position(0, pos.ytl, pos.width, pos.ybr);
        }
        if (pos.ybr < 0)
        {
            pos = new Position(pos.xtl, 0, pos.xbr, pos.height);
        }

        var xtl = Math.max(pos.xtl, 0);
        var ytl = Math.max(pos.ytl, 0); 
        var xbr = Math.min(pos.xbr, width - 1);
        var ybr = Math.min(pos.ybr, height - 1);

        var fpos = new Position(xtl, ytl, xbr, ybr);
        fpos.occluded = pos.occluded;
        fpos.outside = pos.outside;

        this.draw(this.player.frame, fpos);
    }

    /*
     * Notifies that there was an update to this box.
     */
    this.notifyupdate = function()
    {
        for (var i in this.onupdate)
        {
            this.onupdate[i]();
        }
    }

    this.notifystartupdate = function()
    {
        for (var i in this.onstartupdate)
        {
            this.onstartupdate[i]();
        }
    }

    this.notifystarttracking = function()
    {
        for (var i in this.onstarttracking)
        {
            this.onstarttracking[i]();
        }
    }

    this.notifydonetracking = function()
    {
        for (var i in this.ondonetracking)
        {
            this.ondonetracking[i]();
        }
    }

    /*
     * Sets the current position as occluded.
     */
    this.setocclusion = function(value)
    {
        if (value)
        {   
            console.log("Marking object as occluded here.");
        }
        else
        {
            console.log("Marking object as not occluded here.");
        }

        var pos = this.estimate(this.player.frame);
        if (pos == null)
        {
            pos = this.pollposition();
        }
        pos = pos.clone();
        pos.occluded = value;
        pos.generated = false;
        this.journal.mark(this.player.frame, pos);
        this.journal.artificialright = this.journal.rightmost();
        this.journal.cleartonextkeyframe(this.player.frame);
        this.draw(this.player.frame, pos);
    }

    /*
     * Sets the current position as outside.
     */
    this.setoutside = function(value)
    {
        if (value)
        {   
            console.log("Marking object as outside here.");
        }
        else
        {
            console.log("Marking object as not outside here.");
        }


        var pos = this.estimate(this.player.frame);
        if (pos == null)
        {
            pos = this.pollposition();
        }
        pos = pos.clone();
        pos.outside = value;
        pos.generated = false;
        this.journal.mark(this.player.frame, pos);
        this.journal.artificialright = this.journal.rightmost();
        this.journal.cleartonextkeyframe(this.player.frame);
        this.journal.artificialright = this.journal.rightmost();
        this.draw(this.player.frame, pos);
    }

    this.setattribute = function(id, value)
    {
        var journal = this.attributejournals[id];
        journal.mark(this.player.frame, value);
        //journal.artificialright = journal.rightmost();
    }

    this.initattributes = function(attributes)
    {
        for (var i in attributes)
        {
            var journal = new Journal(this.player.job.start, 
                                      this.player.job.blowradius);
            journal.mark(this.player.job.start, false);
            //journal.artificialright = journal.rightmost();
            //journal.artificialrightframe = this.player.job.stop;

            this.attributejournals[i] = journal;
        }
    }

    this.estimateattribute = function(id, frame)
    {
        if (this.attributejournals[id] == null)
        {
            return false;
        }

        var bounds = this.attributejournals[id].bounds(frame);
        if (bounds['left'] == null)
        {
            return bounds['right'];
        }

        return bounds['left'];
    }

    /*
     * Changes the text on the bounding box.
     */
    this.settext = function(value)
    {
        if (this.handle != null)
        {
            if (value != this.text) {
                this.text = value;
                var t = this.handle.children(".boundingboxtext");
                t.html(this.text).show();
            }
        }

    }

    /*
     * Changes the lock state
     */
    this.setlock = function(value)
    {
        if (this.deleted)
        {
            return;
        }

        this.locked = value;

        if (value)
        {
            this.handle.draggable("option", "disabled", true);
            this.handle.resizable("option", "disabled", true);
        }
        else
        {
            this.handle.draggable("option", "disabled", !this.candrag);
            this.handle.resizable("option", "disabled", !this.canresize);
        }

        if (value)
        {
            this.handle.addClass("boundingboxlocked");
        }
        else
        {
            this.handle.removeClass("boundingboxlocked");
        }
    }

    /*
     * Draws the current box on the screen. 
     */
    this.draw = function(frame, position)
    {
        this.drawboundingbox(frame, position);
        if (this.topviewplayer) {
            this.drawtopmarker(frame, position);
        }
    }

    this.drawtopmarker = function(frame, position)
    {
        if (this.topviewhandle == null)
        {
            this.topviewhandle = $('<div class="boundingbox"><div class="boundingboxtext"></div></div>');
            this.topviewhandle.css("border-color", this.color);
            var fill = $('<div class="fill"></div>').appendTo(this.topviewhandle);
            fill.css("background-color", this.color);
            this.topviewplayer.handle.append(this.topviewhandle);

            this.topviewhandle.children(".boundingboxtext").hide().css({
                "border-color": this.color,
                //"color": this.color
                });

            this.topviewhandle.draggable({
                start: function() {
                    player.pause();
                    me.notifystartupdate();
                    //me.triggerinteract();
                },
                stop: function() { 
                    //me.fixposition();
                    me.recordtopviewposition();
                    me.notifyupdate();
                    eventlog("draggable", "Drag-n-drop a box");
                },
                cancel: ".boundingboxtext"
            });

            this.topviewhandle.mouseover(function() {
                if (!me.locked && !me.drawingnew)
                {
                    for (var i in me.onmouseover)
                    {
                        me.onmouseover[i]();
                    }
                }
            });

            this.topviewhandle.mouseout(function() {
                if (!me.locked && !me.drawingnew)
                {
                    for (var i in me.onmouseout)
                    {
                        me.onmouseout[i]();
                    }
                }
            });

            this.topviewhandle.click(function() {
                me.triggerinteract();
            });
        }

        if (position == null)
        {
            position = this.estimate(frame);
        }

        if (position.outside)
        {
            this.topviewhandle.hide();
            return;
        }

        this.topviewhandle.show();
        
        if (position.occluded)
        {
            this.topviewhandle.addClass("boundingboxoccluded");
        }
        else
        {
            this.topviewhandle.removeClass("boundingboxoccluded");
        }

        if (position.generated)
        {
            this.topviewhandle.addClass("boundingboxgenerated");
        } else
        {
            this.topviewhandle.removeClass("boundingboxgenerated");
        }

        var offset = this.topviewplayer.handle.offset();
        var newpos = this.topviewplayer.transformposition([position.xbr, position.ybr]);
        var newx = newpos[0] / newpos[2];
        var newy = newpos[1] / newpos[2];

        this.topviewhandle.css({
            top: newy  + offset.top - 5 + "px",
            left: newx + offset.left - 5 + "px",
            width: (10 - this.htmloffset) + "px",
            height: (10 - this.htmloffset) + "px"
        });
    }

    this.drawboundingbox = function(frame, position)
    {
        if (this.handle == null)
        {
            this.handle = $('<div class="boundingbox"><div class="boundingboxtext"></div></div>');
            this.handle.css("border-color", this.color);
            var fill = $('<div class="fill"></div>').appendTo(this.handle);
            fill.css("background-color", this.color);
            this.player.handle.append(this.handle);

            this.handle.children(".boundingboxtext").hide().css({
                "border-color": this.color,
                //"color": this.color
                });

            this.handle.resizable({
                handles: "n,w,s,e",
                autoHide: true,
                ghost: true, /* need to fix this bug soon */
                start: function() {
                    player.pause();
                    me.notifystartupdate();
                    //me.triggerinteract();
                    for (var i in me.onmouseover)
                    {
                        me.onmouseover[i]();
                    }
                },
                stop: function() {
                    me.fixposition();
                    me.recordposition();
                    me.notifyupdate();
                    eventlog("resizable", "Resize a box");
                    me.highlight(false);
                },
                resize: function() {
                    me.highlight(true);
                }
            });

            this.handle.draggable({
                start: function() {
                    player.pause();
                    me.notifystartupdate();
                    //me.triggerinteract();
                },
                stop: function() { 
                    me.fixposition();
                    me.recordposition();
                    me.notifyupdate();
                    if (me.autotrack) me.runautotracker(function() {});
                    eventlog("draggable", "Drag-n-drop a box");
                },
                cancel: ".boundingboxtext"
            });

            this.handle.mouseover(function() {
                if (!me.locked && !me.drawingnew)
                {
                    for (var i in me.onmouseover)
                    {
                        me.onmouseover[i]();
                    }
                }
            });

            this.handle.mouseout(function() {
                if (!me.locked && !me.drawingnew)
                {
                    for (var i in me.onmouseout)
                    {
                        me.onmouseout[i]();
                    }
                }
            });

            this.handle.click(function() {
                me.recordposition();
                me.triggerinteract();
            });

            this.offset = this.player.handle.offset();
        }

        if (position == null)
        {
            position = this.estimate(frame);
        }

        if (position.outside)
        {
            this.handle.hide();
            return;
        }

        this.handle.show();
        
        if (position.occluded)
        {
            this.handle.addClass("boundingboxoccluded");
        }
        else
        {
            this.handle.removeClass("boundingboxoccluded");
        }

        if (position.generated)
        {
            this.handle.addClass("boundingboxgenerated");
        } else
        {
            this.handle.removeClass("boundingboxgenerated");
        }

        this.handleposition(position);
    }

    this.handleposition = function(position)
    {
        this.handle.css({
            top: position.ytl + this.offset.top + "px",
            left: position.xtl + this.offset.left + "px",
            width: (position.width - this.htmloffset) + "px",
            height: (position.height - this.htmloffset) + "px"
        });
    }

    this.triggerinteract = function() 
    {
        if (!this.locked && !this.drawingnew)
        {
            for (var i in this.oninteract)
            {
                this.oninteract[i]();
            }
        }
    }

    this.draggable = function(value)
    {
        if (this.deleted)
        {
            return;
        }

        this.candrag = value;

        if (value && !this.locked && !this.drawingnew)
        {
            this.handle.draggable("option", "disabled", false);
        }
        else
        {
            this.handle.draggable("option", "disabled", true);
        }
    }

    this.moveboundingbox = function(position)
    {
        this.handleposition(position);
        this.fixposition();
        this.recordposition();
        this.notifyupdate();
        if (this.autotrack) this.runautotracker(function() {});
    }

    this.resizable = function(value)
    {
        if (this.deleted)
        {
            return;
        }

        this.canresize = value;

        if (value && !this.locked &&!this.drawingnew)
        {
            this.handle.resizable("option", "disabled", false);
        }
        else
        {
            this.handle.resizable("option", "disabled", true);
        }
    }

    this.visible = function(value)
    {
        if (value && !this.pollposition().outside)
        {
            this.handle.show();
        }
        else
        {
            this.handle.hide();
        }
    }

    /*
     * Dims the visibility of the box.
     */
    this.dim = function(value)
    {
        if (value)
        {
            this.handle.addClass("boundingboxdim");
        }
        else
        {
            this.handle.removeClass("boundingboxdim");
        }
    }

    /*
     * Highlights a box.
     */
    this.highlight = function(value)
    {
        if (value)
        {
            this.handle.addClass("boundingboxhighlight");
        }
        else
        {
            this.handle.removeClass("boundingboxhighlight");
        }
    }

    /*
     * Serializes the tracks.
     */
    this.serialize = function()
    {
        if (this.deleted)
        {
            return "";
        }
        var str = "[" + this.label + "," + this.id + "," + this.journal.serialize() + ",{";

        var length = 0;
        for (var i in this.attributejournals)
        {
            str += '"' + i + '":' + this.attributejournals[i].serialize() + ",";
            length++;
        }

        if (length > 0)
        {
            str = str.substr(0, str.length - 1);
        }

        return str += "}]";
    }

    /*
     * Removes the box.
     */
    this.remove = function()
    {
        this.handle.remove();
        if (this.topviewhandle) {
            this.topviewhandle.remove();
        }
        this.deleted = true;
    }

    /*
     * Estimates the position of the box for visualization purposes.
     * If the frame was annotated, returns that position, otherwise
     * attempts to interpolate or extrapolate.
     */
    this.estimate = function(frame)
    {
        var bounds = this.journal.bounds(frame);
        if (bounds['leftframe'] == bounds['rightframe'])
        {
            return bounds['left'];
        }

        if (bounds['right'] == null || bounds['left'].outside)
        {
            return bounds['left'];
        }

        if (bounds['right'].outside)
        {
            return bounds['right'];
        }

        var fdiff = bounds['rightframe'] - bounds['leftframe'];
        var xtlr = (bounds['right'].xtl - bounds['left'].xtl) / fdiff;
        var ytlr = (bounds['right'].ytl - bounds['left'].ytl) / fdiff;
        var xbrr = (bounds['right'].xbr - bounds['left'].xbr) / fdiff;
        var ybrr = (bounds['right'].ybr - bounds['left'].ybr) / fdiff;

        var off = frame - bounds['leftframe'];
        var xtl = bounds['left'].xtl + xtlr * off;
        var ytl = bounds['left'].ytl + ytlr * off;
        var xbr = bounds['left'].xbr + xbrr * off;
        var ybr = bounds['left'].ybr + ybrr * off;

        var occluded = false;
        var outside = false;

//        if (Math.abs(bounds['rightframe'] - frame) > Math.abs(bounds['leftframe'] - frame))
//        {
//            occluded = bounds['right'].occluded;
//            outside = bounds['right'].outside;
//        }
//        else
//        {
            occluded = bounds['left'].occluded;
            outside = bounds['left'].outside;
//        }

        var keyframe = ((Math.abs(bounds['leftframe'] - frame) < 2) && !bounds['left'].generated)
            || (Math.abs(bounds['rightframe'] - frame) < 2 && !bounds['right'].generated)

        return new Position(xtl, ytl, xbr, ybr, occluded, outside, !keyframe);
    }

    this.cleartoend = function(frame) {
        this.journal.clearfromframe(frame);
        this.journal.artificialright = this.journal.rightmost();
        this.notifyupdate();
    }

    this.cleartopreviouskeyframe = function(frame) {
        this.journal.cleartopreviouskeyframe(frame);
        this.journal.artificialright = this.journal.rightmost();
        this.notifyupdate();
    }

    this.cleartonextkeyframe = function(frame) {
        this.journal.cleartonextkeyframe(frame);
        this.journal.artificialright = this.journal.rightmost();
        this.notifyupdate();
    }

    this.clearbetweenframes = function(frame1, frame2) {
        this.journal.clearbetweenframes(frame1, frame2);
        this.journal.artificialright = this.journal.rightmost();
        this.notifyupdate();
    }

    this.addannotations = function(annotations) {
        for (var t in annotations) {
            this.journal.mark(t, annotations[t]);
        }
        this.journal.artificialright = this.journal.rightmost();
        this.notifyupdate();
    }

    this.annotationsinrange = function(frame1, frame2) {
        return this.journal.getannotationsinrange(frame1, frame2);
    }

    this.annotationstoend = function(frame) {
        return this.journal.getannotationstoend(frame);
    }

    this.recordtrackdata = function(data, start, stop) {
        if (!data) return;

        var path = data.boxes;
        for (var i = 1; i < path.length; i++)
        {
            var frame = path[i][4];
            if ((start == null || start < frame) && (stop == null || frame < stop))
                me.journal.mark(frame, Position.fromdata(path[i]));
        }
        me.journal.artificialright = me.journal.rightmost();
    }

    this.cleanuptracking = function() {
        me.setlock(false);
        me.notifydonetracking();
        me.notifyupdate();
    }

    this.previouskeyframe = function(frame) {
        var prev = this.journal.previouskeyframe(frame);
        if (prev['pos'] == null) return null;
        return prev['frame'];
    }

    this.nextkeyframe = function(frame) {
        var next = this.journal.nextkeyframe(frame);
        if (next['pos'] == null) return null;
        return next['frame'];
    }

    this.istracking = function() {
        return this.forwardrequest || this.backrequest;
    }

    this.abortrequests = function() {
        if (this.forwardrequest) this.forwardrequest.abort();
        if (this.backrequest) this.backrequest.abort();
    }

    this.runautotracker = function(callback) {
        var callcount = 0;
        function c() {
            if (callcount == 1) callback()
            else callcount++;
        }

        this.abortrequests();
        this.recordposition();

        var frame = this.player.frame;

        var prev = this.previouskeyframe(frame);
        if (prev == null) {
            c();
        } else {
            this.cleartopreviouskeyframe(frame);
            this.bidirectionaltrackrequest(prev, frame, c);
        }

        var next = this.nextkeyframe(frame);
        if (next == null) {
            this.cleartoend(frame);
            this.forwardautotrackrequest(frame, c);
        } else {
            this.cleartonextkeyframe(frame);
            this.bidirectionaltrackrequest(frame, next, c);
        }

        this.notifystarttracking();
    }

    this.autotrackrequest = function(args, api, start, stop, callback) {
        return server_post(api, args, this.tracks.serialize(), function(data) {
            me.recordtrackdata(data, start, stop);
            me.cleanuptracking();
            me.currentrequest = null;
            callback();
            console.log("Successful tracked object");
        });
    }

    this.forwardautotrackrequest = function(frame, callback) {
        if (this.forwardtracker) {
            var args = [this.player.job.jobid, frame, this.forwardtracker, this.id];
            this.forwardrequest = this.autotrackrequest(args, "trackforward", frame, null,
                function() {
                    me.forwardrequest = null;
                    callback();
                });
        } else {
            alert("Please select a forward tracking algorithm");
            callback();
        }
    }

    this.bidirectionaltrackrequest = function(frame1, frame2, callback) {
        if (this.bidirectionaltracker == null) {
            alert("Please select a bidirectional tracking algorithm");
            callback();
            return;
        }

        var args = [this.player.job.jobid, frame1, frame2, this.bidirectionaltracker, this.id];
        this.backrequest = this.autotrackrequest(args, "trackbetweenframes", frame1, frame2,
            function() {
                me.backrequest = null;
                callback();
            });
    }

    this.draw(this.player.frame);
}

/*
 * A journal to store a set of positions.
 */
function Journal(start, blowradius)
{
    this.annotations = {};
    this.artificialright = null;
    this.artificialrightframe = null;
    this.blowradius = blowradius;
    this.start = start;

    /*
     * Marks the boxes position.
     */
    this.mark = function(frame, position) 
    {
        console.log("Marking " + frame);

        var newannotations = {};

        for (var i in this.annotations)
        {
            if (Math.abs(i - frame) >= this.blowradius)
            {
                newannotations[i] = this.annotations[i];
            }
            else if (i == this.start)
            {
                console.log("Start would blow, so propagating");
                newannotations[i] = position;
            }
            else
            {
                console.log("Blowing out annotation at " + i);
            }
        }

        this.annotations = newannotations;
        this.annotations[frame] = position;
    }

    this.nextkeyframe = function(frame) {
        var next = null;
        var nexttime = 0;

        for (t in this.annotations)
        {
            var item = this.annotations[t];
            itemtime = parseInt(t);

            if (itemtime > frame && !item.generated)
            {
                if (next == null || itemtime < nexttime) 
                {
                    next = item;
                    nexttime = itemtime;;
                }
            }
        }

        return {'frame': nexttime,
                'pos': next};
    }

    this.previouskeyframe = function(frame) {
        var previous = null;
        var previoustime = 0;

        for (t in this.annotations)
        {
            var item = this.annotations[t];
            itemtime = parseInt(t);

            if (itemtime < frame && !item.generated)
            {
                if (previous == null || itemtime > previoustime) 
                {
                    previous = item;
                    previoustime = itemtime;;
                }
            }
        }

        return {'frame': previoustime,
                'pos': previous};
    }

    this.cleartonextkeyframe = function(frame) {
        var nextkeyframe = this.nextkeyframe(frame);
        if (nextkeyframe['pos'] == null) {
            this.clearfromframe(frame);
        } else {
            this.clearbetweenframes(frame, nextkeyframe['frame']);
        }
    }

    this.cleartopreviouskeyframe = function(frame) {
        var previouskeyframe = this.previouskeyframe(frame);
        if (previouskeyframe['pos'] == null) {
            this.cleartobeginning(frame);
        } else {
            this.clearbetweenframes(previouskeyframe['frame'], frame);
        }
    }

    this.clearbetweenframes = function(frame1, frame2) {
        clearframes = []
        for (t in this.annotations) {
            time = parseInt(t);
            if (time > frame1 && time < frame2) clearframes.push(time);
        }
        for (t in clearframes) {
            delete this.annotations[clearframes[t]];
        }
    }

    this.cleartobeginning = function(frame) {
        clearframes = []
        for (t in this.annotations) {
            time = parseInt(t);
            if (time < frame) clearframes.push(time);
        }
        for (t in clearframes) {
            delete this.annotations[clearframes[t]];
        }
    }

    this.clearfromframe = function(frame) {
        clearframes = []
        for (t in this.annotations) {
            time = parseInt(t);
            if (time > frame) clearframes.push(time);
        }
        for (t in clearframes) {
            delete this.annotations[clearframes[t]];
        }
    }

    this.getannotationsinrange = function(frame1, frame2) {
        var retframes = []
        for (t in this.annotations) {
            var time = parseInt(t);
            if (time > frame1 && time < frame2) retframes[time] = this.annotations[time];
        }
        return retframes;
    }

    this.getannotationstoend = function(frame) {
        var retframes = []
        for (t in this.annotations) {
            var time = parseInt(t);
            if (time > frame) retframes[time] = this.annotations[time];
        }
        return retframes;
    }

    this.bounds = function(frame)
    {
        if (this.annotations[frame])
        {
            var item = this.annotations[frame];
            return {'left': item,
                    'leftframe': frame,
                    'right': item,
                    'rightframe': frame};
        }

        var left = null;
        var right = null;
        var lefttime = 0;
        var righttime = 0;

        for (t in this.annotations)
        {
            var item = this.annotations[t];
            itemtime = parseInt(t);

            if (itemtime <= frame)
            {
                if (left == null || itemtime > lefttime) 
                {
                    left = item;
                    lefttime = itemtime;;
                }
            }
            else
            {
                if (right == null || itemtime < righttime)
                {
                    right = item;
                    righttime = itemtime;
                }
            }
        }

        return {'left': left,
                'leftframe': lefttime,
                'right': right,
                'rightframe': righttime};
    }

    /*
     * Gets the right most annotation.
     */
    this.rightmost = function()
    {
        var item = null
        var itemtime = null;
        for (var idx in this.annotations)
        {
            var t = parseInt(idx);
            if (itemtime == null || t > itemtime)
            {
                item = this.annotations[idx];
                itemtime = t;
            }
        }
        return item;
    }

    /*
     * Serializes this journal based on position.
     */
    this.serialize = function()
    {
        if (this.annotations.length == 0)
        {
            return "{}";
        }

        str = "{";
        for (var frame in this.annotations)
        {
            var dat = this.annotations[frame];
            if (dat instanceof Object)
            {
                dat = dat.serialize();
            }
            str += "\"" + frame + "\":" + dat + ",";
        }

        if (this.artificialrightframe != null && this.annotations[this.artificialrightframe] == null)
        {
            console.log("Using artificial in serialization");
            var dat = this.artificialright;
            if (dat instanceof Object)
            {
                dat = dat.serialize();
            }
            str += "\"" + this.artificialrightframe + "\":" + dat + ",";
        }
        return str.substr(0, str.length - 1) + "}";
    }
}

/*
 * A structure to store a position.
 * Occlusion and outside is optional.
 */
function Position(xtl, ytl, xbr, ybr, occluded, outside, generated)
{
    this.xtl = xtl;
    this.ytl = ytl;
    this.xbr = xbr;
    this.ybr = ybr;
    this.occluded = occluded ? true : false;
    this.outside = outside ? true : false;
    this.width = xbr - xtl;
    this.height = ybr - ytl;
    this.generated = generated ? true : false;

    if (this.xbr <= this.xtl)
    {
        this.xbr = this.xtl + 1;
    }

    if (this.ybr <= this.ytl)
    {
        this.ybr = this.ytl + 1;
    }
    this.serialize = function()
    {
        return "[" + this.xtl + "," +
                     this.ytl + "," +
                     this.xbr + "," +
                     this.ybr + "," +
                     this.occluded + "," +
                     this.outside + "," +
                     this.generated + "]";
    }

    this.clone = function()
    {
        return new Position(this.xtl,
                            this.ytl,
                            this.xbr,
                            this.ybr,
                            this.occluded,
                            this.outside,
                            this.generated);
    }
}

Position.fromdata = function(box) {
    return new Position(box[0], box[1], box[2], box[3],
            box[6], box[5], box[9]);
}
