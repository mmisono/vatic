function TrackEditor(shortcuts, videoframe)
{
    var me = this;

    this.shortcuts = shortcuts;
    this.videoframe = videoframe;
    this.track = null;
    this.enabled = false;

    this.enable = function() {
        if (!this.track || this.track.locked) {
            this.enabled = false;
        } else {
            this.enabled = true;
        }
    }

    this.disable = function() {
        this.enabled = false;
    }

    this.settrack = function(track) {
        this.track = track;

        if (!this.track || this.track.locked) {
            this.enabled = false;
        }

        this.videoframe.click(function(e) {
            if (!me.enabled) return;
            var offset = me.videoframe.offset();
            var x = e.pageX - offset.left;
            var y = e.pageY - offset.top;
            var pos = me.track.pollposition();
            pos.xbr = x + (0.5 * pos.width);
            pos.ybr = y + (0.5 * pos.height);
            pos.xtl = x - (0.5 * pos.width);
            pos.ytl = y - (0.5 * pos.height);
            pos.generated = false;
            me.track.moveboundingbox(pos);
            if (pos.outside) me.track.setoutside(false);
        });
    }

    this.initializeshortucts = function() {
        // U decrease width
        this.shortcuts.addshortcut([85], function() {
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.xbr -= 1;
            pos.width -= 1;
            me.track.moveboundingbox(pos);
        });

        // I increase width
        this.shortcuts.addshortcut([73], function() {
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.xbr += 1;
            pos.width += 1;
            me.track.moveboundingbox(pos);
        });

        // O decrease height
        this.shortcuts.addshortcut([79], function() {
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.ybr -= 1;
            pos.height -= 1;
            me.track.moveboundingbox(pos);
        });

        // P decrease height
        this.shortcuts.addshortcut([80], function() {
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.ybr += 1;
            pos.height += 1;
            me.track.moveboundingbox(pos);
        });

        // Left arrow and H
        this.shortcuts.addshortcut([37, 72], function(){
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.xtl -= 1;
            pos.xbr -= 1;
            me.track.moveboundingbox(pos);
        });

        // Up arrow and K
        this.shortcuts.addshortcut([38, 75], function(){
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.ytl -= 1;
            pos.ybr -= 1;
            me.track.moveboundingbox(pos);
        });

        // Right arrow and L
        this.shortcuts.addshortcut([39, 76], function(){
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.xtl += 1;
            pos.xbr += 1;
            me.track.moveboundingbox(pos);
        });

        // Down arrow and J
        this.shortcuts.addshortcut([40, 74], function(){
            if (!me.enabled) return;
            var pos = me.track.pollposition();
            pos.ytl += 1;
            pos.ybr += 1;
            me.track.moveboundingbox(pos);
        });
    }

    this.initializeshortucts();
}

/*
 * TrackObjectUI:
 *   - object creation
 *   - object selection
 *   - new object defaults
 */
function TrackObjectUI(button, container, copypastecontainer, videoframe, job, player, tracks, shortcuts)
{
    var me = this;

    this.button = button;
    this.container = container;
    this.videoframe = videoframe;
    this.job = job;
    this.player = player;
    this.tracks = tracks;
    this.shortcuts = shortcuts;

    this.activecontainer = null;
    this.donecontainer = null;
    this.showingdone = false;

    this.copypastehandler = new CopyPasteHandler(copypastecontainer, this.job);
    this.trackeditor = new TrackEditor(this.shortcuts, this.videoframe);

    this.drawer = new BoxDrawer(videoframe, {"width":10, "height":10}, this.job.pointmode);
    this.defaultclass = null;

    this.counter = job.nextid;

    this.currentobject = null;
    this.currentcolor = null;

    this.objects = [];

    this.selectedobject = null;

    this.defaultsize = function(container) {
        $("<p>Default bounding box</p>").appendTo(container);
        $("<input type=checkbox id=usedefaultsize />" +
        "<label for=usedefaultsize>Enabled</label>").appendTo(container);

        var sizeeditor = $("<div>").appendTo(container);
        var testbox = $("<div id=testbox>").css({
            "border": "solid 2px blue",
            "width": this.drawer.defaultsize["width"] + "px",
            "height": this.drawer.defaultsize["height"] + "px",
            "margin-bottom": "10px",
            "margin-top": "20px"
        })

        $("<label for=defaultwidth>Width:</label>").appendTo(sizeeditor);
        $("<div id=defaultwidth>")
            .slider({
                min: 0,
                max: 200,
                value: this.drawer.defaultsize ["width"],
                slide: function (event, ui) {
                    testbox.css({width: ui.value});
                }
            })
            .css({"width":"200px"})
            .appendTo(sizeeditor);

        $("<label for=defaultheigh>Height:</label>").appendTo(sizeeditor);
        $("<div id=defaultheight>")
            .slider({
                min: 0,
                max: 200,
                value: this.drawer.defaultsize ["height"],
                slide: function (event, ui) {
                    testbox.css({height: ui.value});
                }
            })
            .css({"width":"200px"})
            .appendTo(sizeeditor);
 
        testbox.appendTo(sizeeditor);

        if (this.drawer.oneclick) {
            $("#usedefaultsize").attr('checked', 'checked');
        } else {
            sizeeditor.hide();
        }    

        $("#usedefaultsize").change(function() {
            if ($(this).is(":checked")) {
                sizeeditor.show();
            } else {
                sizeeditor.hide();
            }
        });
    }

    this.editdefaultclass = function(container) {
        var html = "<p>Select default class</p>";
        html += "<div class='label'>";
        html += "<input type='radio' name='classification' id='classificationnone' value='none' checked>";
        html += "<label for='classificationnone'>None</label></div>";

        for (var i in job.labels)
        {
            html += "<div class='label'>" +
                "<input type='radio' name='classification' id='classification" + i + "' value='" + i + "'>" +
                "<label for='classification" + i + "'>" + job.labels[i] + "</label></div>";
        }

        this.classifyinst = $("<div>" + html + "</div><br />").appendTo(container);

        if (this.defaultclass) {
            $("#classification" + this.defaultclass).attr("checked", "checked");
        } else {
            $("#classificationnone").attr("checked", "checked");
        }
    }

    this.defaultsdialog = function(container) {
        this.editdefaultclass(container);
        if (!this.job.pointmode) {
            this.defaultsize(container);
        }
    }

    this.savedefaults = function() {
        if (!this.job.pointmode) {
            if (!this.job.pointmode) this.drawer.oneclick = $("#usedefaultsize").attr('checked');
            this.drawer.defaultsize["width"] = $('#defaultwidth').slider("option", "value");
            this.drawer.defaultsize["height"] = $('#defaultheight').slider("option", "value");
        }

        this.defaultclass = $("input[name=classification]:checked").val();
        if (this.defaultclass == "none") {
            this.defaultclass = null;
        }

        for (var i in this.objects)
        {
            this.objects[i].defaultclass = this.defaultclass;
        }
    }

    this.deselectcurrentobject = function()
    {
        // Update state of all objects
        for (var i in this.objects)
        {
            this.objects[i].setobjectselected(null);
        }

        this.selectedobject = null;
        this.trackeditor.disable();
    }

    this.selectobject = function(object)
    {
        this.selectedobject = object;

        // Update state of all objects
        for (var i in this.objects)
        {
            this.objects[i].setobjectselected(this.selectedobject);
        }

        // Setup track editor
        this.trackeditor.settrack(this.selectedobject.track);
        this.trackeditor.enable();
    }

    this.setupnewobject = function(object)
    {
        object.onselected.push(function() {
            if (me.selectedobject == object) {
                me.deselectcurrentobject();
            } else {
                me.selectobject(object);
            }
        });

        object.ondone.push(function(obj) {
            if (obj.track.done && !me.showingdone) {
                me.doneheader.show();
                me.showingdone = true;
                me.donecontainer.slideDown();
            } else {
                var hasdone = false;
                for (var i in me.objects)
                {
                    if (me.objects[i].track.done) {
                        hasdone = true;
                        break;
                    }
                    if (!hasdone) {
                        me.doneheader.hide();
                        me.showingdone = false;
                        me.donecontainer.slideUp();
                    }
                }
            }
        });
    }

    this.startnewobject = function()
    {
        if (this.button.button("option", "disabled"))
        {
            return;
        }

        this.deselectcurrentobject();
        tracks.drawingnew(true);

        console.log("Starting new track object");

        eventlog("newobject", "Start drawing new object");

        //this.instructions.fadeOut();

        this.currentcolor = this.pickcolor();
        this.drawer.color = this.currentcolor[0];
        this.drawer.enable();

        this.button.button("option", "disabled", true);

        this.currentobject = new TrackObject(this.job,
                                             this.player,
                                             this.activecontainer,
                                             this.donecontainer,
                                             this.currentcolor,
                                             this.copypastehandler,
                                             this.defaultclass,
                                             false);
        this.currentobject.statedraw();

        this.tracks.resizable(false);
        this.tracks.draggable(false);
    }

    this.stopdrawing = function(position)
    {
        console.log("Received new track object drawing");

        var track = tracks.add(player.frame, position, this.currentcolor[0]);
        if (this.job.pointmode) this.tracks.resizable(false);

        this.drawer.disable();
        ui_disable();

        this.currentobject.onready.push(function() {
            me.stopnewobject();
        });
        
        this.currentobject.initialize(this.counter, track, this.tracks);
        this.currentobject.stateclassify();
    }

    this.stopnewobject = function()
    {
        console.log("Finished new track object");

        ui_enable();
        tracks.drawingnew(false);

        this.objects.push(this.currentobject);
        this.setupnewobject(this.currentobject);

        this.tracks.draggable(true);
        if (!this.job.pointmode && $("#annotateoptionsresize:checked").size() == 0)
        {
            this.tracks.resizable(true);
        }
        else
        {
            this.tracks.resizable(false);
        }

        this.tracks.dim(false);
        this.currentobject.track.highlight(false);
        this.selectobject(this.currentobject);

        this.button.button("option", "disabled", false);

        this.counter++;
    }

    this.injectnewobject = function(label, id, done, path, attributes)
    {
        console.log("Injecting existing object");

        //this.instructions.fadeOut();

        this.currentcolor = this.pickcolor();
        var obj = new TrackObject(this.job,
                                  this.player,
                                  this.activecontainer,
                                  this.donecontainer,
                                  this.currentcolor,
                                  this.copypastehandler,
                                  this.defaultclass,
                                  true);

        var track = tracks.add(path[0][4], Position.fromdata(path[0]),
                               this.currentcolor[0]);
        for (var i = 1; i < path.length; i++)
        {
            track.journal.mark(path[i][4], Position.fromdata(path[i]));
        }
        track.journal.artificialright = track.journal.rightmost();

        obj.initialize(id, track, this.tracks);
        obj.finalize(label, done);

        for (var i = 0; i < attributes.length; i++)
        {
            track.attributejournals[attributes[i][0]].mark(attributes[i][1], attributes[i][2]);
            console.log("Injecting attribute " + attributes[i][0] + " at frame " + attributes[i][1] + " to " + attributes[i][2]);
        }

        obj.statefolddown();
        obj.updatecheckboxes();
        obj.updateboxtext();
        this.objects.push(obj);
        this.setupnewobject(obj);

        return obj;
    }

    this.setup = function()
    {
        this.activecontainer = $("<div id='objectcontaineractive'></div>")
            .appendTo(this.container);
        this.doneheader = $("<div id='doneheader'><strong>Done: </strong></p>")
            .appendTo(this.container);
        this.donecontainer = $("<div id='objectcontainerdone'></div>")
            .appendTo(this.container);

        this.doneheader.click(function() {
            if (me.showingdone) {
                me.showingdone = false;
                me.donecontainer.slideUp();
            } else {
                me.showingdone = true;
                me.donecontainer.slideDown();
            }
        });
 
        this.donecontainer.hide();
        this.doneheader.hide();

        this.button.button({
            icons: {
                primary: "ui-icon-plusthick",
            },
            disabled: false
        }).click(function() {
            me.startnewobject();
        });

        this.drawer.onstopdraw.push(function(position) {
            me.stopdrawing(position);
        });

        var html = "<p>In this video, please track all of these objects:</p>";
        html += "<ul>";
        for (var i in this.job.labels)
        {
            html += "<li>" + this.job.labels[i] + "</li>";
        }
        html += "</ul>";

        this.instructions = $(html).appendTo(this.container);
    }

    this.removeall = function()
    {
        for (var i in this.objects)
        {
            this.objects[i].remove();
        }
    }

    this.disable = function()
    {
        for (var i in this.objects)
        {
            this.objects[i].disable();
        }
    }

    this.enable = function()
    {
        for (var i in this.objects)
        {
            this.objects[i].enable();
        }
    }

    this.setup();

    this.availcolors = [["#FF00FF", "#FFBFFF", "#FFA6FF"],
                        ["#FF0000", "#FFBFBF", "#FFA6A6"],
                        ["#FF8000", "#FFDCBF", "#FFCEA6"],
                        ["#FFD100", "#FFEEA2", "#FFEA8A"],
                        ["#008000", "#8FBF8F", "#7CBF7C"],
                        ["#0080FF", "#BFDFFF", "#A6D2FF"],
                        ["#0000FF", "#BFBFFF", "#A6A6FF"],
                        ["#000080", "#8F8FBF", "#7C7CBF"],
                        ["#800080", "#BF8FBF", "#BF7CBF"]];

    this.pickcolor = function()
    {
        return this.availcolors[this.availcolors.push(this.availcolors.shift()) - 1];
    }
}

function TrackObject(job, player, activecontainer, donecontainer, color, copypastehandler, defaultclass, loaded)
{
    var me = this;

    this.job = job;
    this.player = player;
    this.activecontainer = activecontainer;
    this.donecontainer = donecontainer;
    this.color = color;
    this.copypastehandler = copypastehandler;
    this.defaultclass = defaultclass;
    this.loaded = loaded;

    this.id = null;
    this.track = null;
    this.tracks = null;
    this.label = null;

    this.onready = [];
    this.onfolddown = [];
    this.onfoldup = [];
    this.onselected = [];
    this.ondone = [];

    this.handle = $("<div class='trackobject'><div>");
    this.handle.prependTo(this.activecontainer);
    this.handle.css({
        'background-color': color[2],
        'border-color': color[2]});
    this.handle.mouseover(function() {
        me.mouseover();
    });
    this.handle.mouseout(function() {
        me.mouseout();
    });

    this.header = null;
    this.headerdetails = null;
    this.details = null;
    this.drawinst = null;
    this.classifyinst = null;
    this.opencloseicon = null;

    this.ready = false;
    this.foldedup = false;

    this.tooltip = null;
    this.tooltiptimer = null;

    this.objectselected = null;

    this.initialize = function(id, track, tracks)
    {
        this.id = id;
        this.track = track;
        this.tracks = tracks;

        this.track.onmouseover.push(function() {
            me.mouseover();
        });

        this.track.onmouseout.push(function() {
            me.mouseout();
            me.hidetooltip();
        });

        this.track.onstartupdate.push(function() {
            me.hidetooltip();
        });

        this.player.onupdate.push(function() {
            me.hidetooltip();
        });

        this.track.onstarttracking.push(function() {
            me.updateboxtext();
        })

        this.track.ondonetracking.push(function() {
            me.updateboxtext();
        })

        this.track.oninteract.push(function() {
            me.click();
            //var pos = me.handle.position().top + me.container.scrollTop() - 30;
            //pos = pos - me.handle.height();
            //me.container.stop().animate({scrollTop: pos}, 750);

            me.toggletooltip();
        });

        this.track.onupdate.push(function() {
            me.hidetooltip();
            eventlog("interact", "Interact with box " + me.id);
        });

        this.track.notifyupdate();
        eventlog("newobject", "Finished drawing new object");
    }

    this.remove = function()
    {
        this.handle.slideUp(null, function() {
            me.handle.remove(); 
        });
        this.track.remove();
    }

    this.statedraw = function()
    {
        var html = "<p>Draw a box around one of these objects:</p>"; 

        html += "<ul>";
        for (var i in this.job.labels)
        {
            html += "<li>" + this.job.labels[i] + "</li>";
        }
        html += "</ul>";
        html += "<p>Do not annotate the same object twice.</p>";

        this.drawinst = $("<div>" + html + "</div>").appendTo(this.handle);
        this.drawinst.hide().slideDown();

        //this.container.stop().animate({scrollTop: 0}, 750);

    }

    this.showclassifier = function(container, headertext, callback)
    {
        var html = "<p>" + headertext + "</p>";
        for (var i in job.labels)
        {
            var id = "classification" + this.id + "_" + i;
            html += "<div class='label'><input type='radio' name='classification" + this.id + "' id='" + id + "'> <label for='" + id + "'>" + job.labels[i] + "</label></div>";
        }

        this.classifyinst = $("<div>" + html + "</div>").appendTo(container);
        this.classifyinst.hide().slideDown();

        $("input[name='classification" + this.id + "']").click(function() {
            me.classifyinst.slideUp(null, function() {
                me.classifyinst.remove(); 
            });

            for (var i in me.job.labels)
            {
                var id = "classification" + me.id + "_" + i;
                if ($("#" + id + ":checked").size() > 0)
                {
                    callback(i);
                    break;
                }
            }

        });
    }

    this.stateclassify = function()
    {
        this.drawinst.slideUp(null, function() {
            me.drawinst.remove(); 
        });

        var length = 0;
        var firsti = 0;
        for (var i in this.job.labels)
        {
            length++;
            firsti = i;
        }

        if (length == 1)
        {
            this.finalize(firsti, false);
            this.statefolddown();
        }
        else if (this.defaultclass)
        {
            this.finalize(this.defaultclass, false);
            this.statefolddown();
        }
        else
        {
            this.showclassifier(
                this.handle, 
                "What type of object did you just annotate?",
                function(i) {
                    me.finalize(i, false);
                    me.statefolddown();
                
                });
        }
    }

    this.setupid = function() {
        me.track.id = me.id;

        var textbox = $("#trackid"+this.id);
        textbox.val(this.id);
        textbox.on('input propertychange paste', function() {
            me.id = textbox.val();
            me.track.id = me.id;
            me.setupheader();
            me.updateboxtext();
        });
    }

    this.setupheader = function() {
        this.header.html("<strong>" + this.job.labels[this.label] + " " + (this.id) + "</strong>");
    }
    
    this.finalize = function(labelid, done)
    {
        this.label = labelid;
        this.track.label = labelid;
        this.track.done = done;

        this.headerdetails = $("<div style='float:right;'></div>").appendTo(this.handle);
        this.header = $("<p class='trackobjectheader'>").appendTo(this.handle);
        this.setupheader();
        //this.opencloseicon = $('<div class="ui-icon ui-icon-triangle-1-e"></div>').prependTo(this.header);
        var editor = $("<div>").appendTo(this.handle);
        this.classifier = $("<div id='classifier" + this.id + "'>").appendTo(this.handle);

        editor.append("<label for='trackid" + this.id + "'>Id: </label>");
        editor.append("<input type=text id='trackid" + this.id + "' size=5 />");
        $("<input type=button id='trackclass" + this.id + "' value='Classify' />")
            .appendTo(editor)
            .click(function() {
                me.showclassifier(me.classifier, "Select a class:", function(i) {
                    me.label = i;
                    me.track.label = i;
                    me.setupheader();
                    me.updateboxtext();
                });
            });

        this.details = $("<div class='trackobjectdetails'></div>").appendTo(this.handle).hide();
        this.setupid();
        this.setupdetails();

        this.updateboxtext();

        this.track.initattributes(this.job.attributes[this.track.label]);

        this.header.mouseup(function() {
            me.click();
        });

        this.ready = true;
        this._callback(this.onready);

        this.player.onupdate.push(function() {
            me.updateboxtext();
        });

        if (this.track.done) this.setdone(this.track.done);
        if (this.track.autotrack && !this.loaded) this.track.autotrackmanager.addkeyframe();
    }

    this.updateboxtext = function()
    {
        if (this.track.istracking()) {
            var str = "<strong>Tracking</strong>";
            this.track.settext(str);
            return;
        }

        var str = "<strong>" + this.job.labels[this.label] + " " + (this.id) + "</strong>";

        var count = 0;
        for (var i in this.job.attributes[this.track.label])
        {
            if (this.track.estimateattribute(i, this.player.frame))
            {
                str += "<br>";
                str += this.job.attributes[this.track.label][i];
                count++;
            }
        }

        this.track.settext(str);

        if ($("#annotateoptionshideboxtext").attr("checked"))
        {
            $(".boundingboxtext").hide();
        }
    }

    this.setupdetails = function()
    {
        this.details.append("<input type='checkbox' id='trackobject" + this.id + "lost'> <label for='trackobject" + this.id + "lost'>Outside of view frame</label><br>");
        this.details.append("<input type='checkbox' id='trackobject" + this.id + "occluded'> <label for='trackobject" + this.id + "occluded'>Occluded or obstructed</label><br>");
        this.trackingdetails = $("<div style='float:left'></div>").appendTo(this.details);
        this.trackingdetails.append("<div style='float:left;'>Tracking: </div>");
        //this.trackingdetails.append("<div style='float:left; cursor:pointer;'>" + 
        //    "<div class='ui-icon ui-icon-arrow-1-w' id='trackobject" + this.id + "trackbackward' title='Track to beginning'></div>" + 
        //    "</div>");
        /*
        this.trackingdetails.append("<div style='float:left;cursor:pointer;'>" + 
            "<div class='ui-icon ui-icon-arrowstop-1-w' id='trackobject" + this.id + "trackbackwardstop' title='Track to previous key frame'></div>" + 
            "</div>");
        this.trackingdetails.append("<div style='float:left;cursor:pointer;'>" + 
            "<div class='ui-icon ui-icon-arrowstop-1-e' id='trackobject" + this.id + "trackforwardstop' title='Track to next key frame'></div>" + 
            "</div>");
        this.trackingdetails.append("<div style='float:left;cursor:pointer;'>" + 
            "<div class='ui-icon ui-icon-arrow-1-e' id='trackobject" + this.id + "trackforward' title='Track to end'></div>" + 
            "</div>");
        */
        this.trackingdetails.append("<div style='float:left;cursor:pointer;'>" + 
            "<div class='ui-icon ui-icon-scissors' id='trackobject" + this.id + "cutend' title='Cut to end'></div>" + 
            "</div>");
        this.trackingdetails.append("<div style='float:left;cursor:pointer;'>" + 
            "<div class='ui-icon ui-icon-clipboard' id='trackobject" + this.id + "paste' title='Paste'></div>" + 
            "</div>");
        this.details.append("<br />");

        for (var i in this.job.attributes[this.track.label])
        {
            this.details.append("<input type='checkbox' id='trackobject" + this.id + "attribute" + i + "'> <label for='trackobject" + this.id + "attribute" + i +"'>" + this.job.attributes[this.track.label][i] + "</label><br>");

            // create a closure on attributeid
            (function(attributeid) {

                $("#trackobject" + me.id + "attribute" + i).click(function() {
                    me.player.pause();

                    var checked = $(this).attr("checked");
                    me.track.setattribute(attributeid, checked ? true : false);
                    me.track.notifyupdate();

                    me.updateboxtext();

                    if (checked) 
                    {
                        eventlog("markattribute", "Mark object as " + me.job.attributes[me.track.label][attributeid]);
                    }
                    else
                    {
                        eventlog("markattribute", "Mark object as not " + me.job.attributes[me.track.label][attributeid]);
                    }
                });

            })(i);
        }


        $("#trackobject" + this.id + "lost").click(function() {
            me.player.pause();

            var outside = $(this).is(":checked");
            me.track.setoutside(outside);
            me.track.notifyupdate();

            if (outside)
            {
                eventlog("markoutside", "Mark object outside");
            }
            else
            {
                eventlog("markoutside", "Mark object inside");
            }
        });
        $("#trackobject" + this.id + "occluded").click(function() {
            me.player.pause();

            var occlusion = $(this).is(":checked");
            me.track.setocclusion(occlusion);
            me.track.notifyupdate();

            if (occlusion)
            {
                eventlog("markocclusion", "Mark object as occluded");
            }
            else
            {
                eventlog("markocclusion", "Mark object as not occluded");
            }
        });
        /*
        $("#trackobject" + this.id + "trackforward").click(function() {
            me.track.autotrackend(function(){});
        });
        $("#trackobject" + this.id + "trackforwardstop").click(function() {
            me.track.autotracknext(function(){});
        });
        $("#trackobject" + this.id + "trackbackwardstop").click(function() {
            me.track.autotrackprev(function(){});
        });
        */
        $("#trackobject" + this.id + "cutend").click(function() {
            me.copypastehandler.cut(me, me.player.frame);
        });
        $("#trackobject" + this.id + "paste").click(function() {
            me.copypastehandler.paste(me);
        });

        this.player.onupdate.push(function() {
            me.updatecheckboxes();
        });

        //this.details.append("<br><input type='button' id='trackobject" + this.id + "label' value='Change Type'>");
        this.headerdetails.append("<div style='float:right;'><div class='ui-icon ui-icon-trash' id='trackobject" + this.id + "delete' title='Delete this track'></div></div>");
        this.headerdetails.append("<div style='float:right;'><div class='ui-icon ui-icon-image' id='trackobject" + this.id + "tooltip' title='Show preview of track'></div></div>");
        this.headerdetails.append("<div style='float:right;'><div class='ui-icon ui-icon-check' id='trackobject" + this.id + "lock' title='Mark track as done'></div></div>");

        $("#trackobject" + this.id + "delete").click(function() {
            if (window.confirm("Delete the " + me.job.labels[me.label] + " " + (me.id + 1) + " track? If the object just left the view screen, click the \"Outside of view frame\" check box instead."))
            {
                me.remove();
                eventlog("removeobject", "Deleted an object");
            }
        });

        $("#trackobject" + this.id + "lock").click(function() {
            me.setdone(!me.track.done);
        });

        $("#trackobject" + this.id + "tooltip").click(function() {
            me.toggletooltip(false);
        }).mouseout(function() {
            me.hidetooltip(); 
        });
    }

    this.setdone = function(value)
    {
        var donebutton = $("#trackobject" + this.id + "lock");
        this.track.setdone(value);
        this.updatebackground();
        if (value)
        {
            this.handle.slideUp(null, function() {
                donebutton.addClass("ui-icon-pencil").removeClass("ui-icon-check");
                donebutton.attr('title', 'Continue to edit track');
                me.handle.appendTo(me.donecontainer);
                me.handle.slideDown();
                me._callback(me.ondone);
            });
        }
        else
        {
            this.handle.slideUp(null, function() {
                donebutton.removeClass("ui-icon-pencil").addClass("ui-icon-check");
                donebutton.attr('title', 'Mark track as done');
                me.handle.appendTo(me.activecontainer);
                me.handle.slideDown();
                me._callback(me.ondone);
            });
        }
    }

    this.updatecheckboxes = function()
    {
        var e = this.track.estimate(this.player.frame);
        $("#trackobject" + this.id + "lost").attr("checked", e.outside);
        $("#trackobject" + this.id + "occluded").attr("checked", e.occluded);

        for (var i in this.job.attributes[this.track.label])
        {
            if (!this.track.estimateattribute(i, this.player.frame))
            {
                $("#trackobject" + this.id + "attribute" + i).attr("checked", false);
            }
            else
            {
                $("#trackobject" + this.id + "attribute" + i).attr("checked", true);
            }
        }
    }

    this.toggletooltip = function(onscreen)
    {
        if (this.tooltip == null)
        {
            this.showtooltip(onscreen);
        }
        else
        {
            this.hidetooltip();
        }
    }

    this.showtooltip = function(onscreen)
    {
        if (this.tooltip != null)
        {
            return;
        }

        var x;
        var y;

        if (onscreen || onscreen == null)
        {
            var pos = this.track.handle.position();
            var width = this.track.handle.width();
            var height = this.track.handle.height();

            var cpos = this.player.handle.position();
            var cwidth = this.player.handle.width();
            var cheight = this.player.handle.height();

            var displacement = 15;

            x = pos.left + width + displacement;
            if (x + 200 > cpos.left + cwidth)
            {
                x = pos.left - 200 - displacement;
            }

            y = pos.top;
            if (y + 200 > cpos.top + cheight)
            {
                y = cpos.top + cheight - 200 - displacement;
            }
        }
        else
        {
            var pos = this.handle.position();
            x = pos.left - 210;

            var cpos = this.player.handle.position();
            var cheight = this.player.handle.height();

            y = pos.top;
            if (y + 200 > cpos.top + cheight)
            {
                y = cpos.top + cheight - 215;
            }
        }
        
        var numannotations = 0;
        var frames = [];
        for (var i in this.track.journal.annotations)
        {
            if (!me.track.journal.annotations[i].outside)
            {
                numannotations++;
                frames.push(i);
            }
        }

        if (numannotations == 0)
        {
            return;
        }

        frames.sort();

        this.tooltip = $("<div class='boxtooltip'></div>").appendTo("body");
        this.tooltip.css({
            top: y + "px",
            left: x + "px"
        });
        this.tooltip.hide();
        var boundingbox = $("<div class='boxtooltipboundingbox boundingbox'></div>").appendTo(this.tooltip);

        var annotation = 0;
        var update = function() {
            if (annotation >= numannotations)
            {
                annotation = 0;
            }

            var frame = frames[annotation];
            var anno = me.track.journal.annotations[frame];
            var bw = anno.xbr - anno.xtl;
            var bh = anno.ybr - anno.ytl;

            var scale = 1;
            if (bw > 200)
            {
                scale = 200 / bw;
            }
            if (bh > 200)
            {
                scale = Math.min(scale, 200 / bh);
            }

            var x = (anno.xtl + (anno.xbr - anno.xtl) / 2) * scale - 100;
            var y = (anno.ytl + (anno.ybr - anno.ytl) / 2) * scale - 100;

            var bx = 100 - (anno.xbr - anno.xtl) / 2 * scale;
            var by = 100 - (anno.ybr - anno.ytl) / 2 * scale;
            bw = bw * scale;
            bh = bh * scale;

            if (x < 0)
            {
                bx += x;
                x = 0;
            }
            if (x > me.job.width * scale - 200)
            {
                bx = 200 - (me.job.width - anno.xtl) * scale;
                x = me.job.width * scale - 200;
            }
            if (y < 0)
            {
                by += y;
                y = 0;
            }
            if (y > me.job.height * scale - 200)
            {
                by = 200 - (me.job.height - anno.ytl) * scale;
                y = (me.job.height) * scale - 200;
            }

            x = -x;
            y = -y;

            console.log("Show tooltip for " + frame);
            me.tooltip.css("background-image", "url('" + me.job.frameurl(frame) + "')");
            me.tooltip.css("background-position", x + "px " + y + "px");
            var bgsize = (me.job.width * scale) + "px " + (me.job.height * scale) + "px";
            me.tooltip.css("background-size", bgsize);
            me.tooltip.css("-o-background-size", bgsize);
            me.tooltip.css("-webkit-background-size", bgsize);
            me.tooltip.css("-khtml-background-size", bgsize);
            me.tooltip.css("-moz-background-size", bgsize);
            annotation++;

            boundingbox.css({
                top: by + "px",
                left: bx + "px",
                width: (bw-4) + "px",
                height: (bh-4) + "px",
                borderColor: me.color[0]
            });
        }


        this.tooltiptimer = window.setInterval(function() {
            update();
        }, 500);

        this.tooltip.hide().slideDown(250);
        update();
    }

    this.hidetooltip = function()
    {
        if (this.tooltip != null)
        {
            this.tooltip.slideUp(250, function() {
                $(this).remove(); 
            });
            this.tooltip = null;
            window.clearInterval(this.tooltiptimer);
            this.tooltiptimer = null;
        }
    }

    this.disable = function()
    {
        if (this.ready)
        {
            $("#trackobject" + this.id + "lost").attr("disabled", true);
            $("#trackobject" + this.id + "occluded").attr("disabled", true);
        }
    }

    this.enable = function()
    {
        if (this.ready)
        {
            $("#trackobject" + this.id + "lost").attr("disabled", false);
            $("#trackobject" + this.id + "occluded").attr("disabled", false);
        }
    }

    this.statefoldup = function()
    {
        this.handle.addClass("trackobjectfoldedup");
        this.handle.removeClass("trackobjectfoldeddown");
        this.details.slideUp();
        this.headerdetails.fadeOut();
        this.foldedup = true;
        this._callback(this.onfoldup);

        //this.opencloseicon.removeClass("ui-icon-triangle-1-s");
        //this.opencloseicon.addClass("ui-icon-triangle-1-e");
    }

    this.statefolddown = function()
    {
        this.handle.removeClass("trackobjectfoldedup");
        this.handle.addClass("trackobjectfoldeddown");
        this.details.slideDown();
        this.headerdetails.fadeIn();
        this.foldedup = false;
        this._callback(this.onfolddown);

        //this.opencloseicon.removeClass("ui-icon-triangle-1-e");
        //this.opencloseicon.addClass("ui-icon-triangle-1-s");
    }

    this.updatebackground = function() {
        if (this.track.done) {
            this.inactive();
        } else if (this.objectselected == null) {
            this.normal();
        } else if (this.objectselected == this) {
            this.highlight();
        } else if (this.objectselected != null) {
            this.inactive();
        }
    }

    this.setobjectselected = function(object) {
        this.objectselected = object;
        this.updatebackground();
        if (this.track.done) return;
        if (object == null || object == this) {
            this.track.setlock(false);
        } else {
            this.track.setlock(true);
        }
    }

    this.mouseover = function()
    {
        if (this.objectselected || (this.track && this.track.done)) return;
        this.highlight();

        if (this.track)
        {
            this.tracks.dim(true);
            this.track.dim(false);
            this.track.highlight(true);
        }

        if (this.opencloseicon)
        {
            this.opencloseicon.addClass("ui-icon-triangle-1-se");
        }
    }
 
    this.mouseout = function()
    {
        if (this.objectselected || (this.track && this.track.done)) return;
        this.normal();

        if (this.track)
        {
            this.tracks.dim(false);
            this.track.highlight(false);
        }

        if (this.opencloseicon)
        {
            this.opencloseicon.removeClass("ui-icon-triangle-1-se");
        }
    }

    this.inactive = function()
    {
        this.handle.css({
            'background-color': me.color[1],
            'border-color': me.color[1]
        });
    }

    this.highlight = function()
    {
        this.handle.css({
            'border-color': me.color[0],
            'background-color': me.color[1],
        });
    }

    this.normal = function()
    {
        this.handle.css({
            'border-color': me.color[2],
            'background-color': me.color[2],
        });
    }

    this.click = function()
    {
        if (this.ready && !this.track.done)
        {
            this._callback(this.onselected);
        }
    }

    this._callback = function(list)
    {
        for (var i = 0; i < list.length; i++)
        {
            list[i](me);
        }
    }
}

function CopyPasteHandler(container, job)
{
    var me = this;

    this.annotations = null;
    this.job = job;
    this.container = container;
    this.container.hide();

    this.cut = function(trackobject, frame) {
        var track = trackobject.track;
        this.annotations = track.annotationstoend(frame);

        this.container.empty();
        this.container.append("<div class='title'>Clipboard</div>");
        this.container.append("<strong>Cut: </strong>" + this.annotations.length + " frames<br />");
        this.container.append("<strong>From: </strong> " + this.job.labels[track.label] + " " + track.id + "<br />");
        $("<input type=button value='Clear' />")
            .appendTo(this.container)
            .click(function() {
                me.annotations = null;
                me.container.slideUp(null, function() {me.container.empty();});
            });

        this.container.slideDown();
        track.cleartoend(frame);
    }

    this.paste = function(trackobject) {
        if (!this.annotations) {
            alert("Nothing to paste");
            return;
        }

        var track = trackobject.track;
        var range = this.framerange();
        track.clearbetweenframes(range['min'], range['max']);
        track.addannotations(this.annotations);
        trackobject.toggletooltip(false);
        setTimeout(function() {trackobject.hidetooltip();}, 3000);
    }

    this.framerange = function() {
        var minframe = null;
        var maxframe = null;
        for (t in this.annotations) {
            var time = parseInt(t);
            if (minframe == null || time < minframe) minframe = time;
            if (maxframe == null || time > maxframe) maxframe = time;
        }
        return {'min':minframe, 'max':maxframe};
    }
}
