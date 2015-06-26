Developers
==========

This document will describe how to modify VATIC for your own purposes. If you
only want to use VATIC, please see README instead.

This fork of VATIC is broken up into four different packages:

1. **vatic** - video annotation tool
2. **turkic** - a platform for easy MTurk management
3. **pyvision** - a simple Python computer vision toolkit
4. **vatic_tracking** - a simple tracking framework that integrates with VATIC

In general, you likely want to only modify VATIC, which houses the essential
tools for video annotation, such as: the JavaScript video player, instructions,
entire user interface, merging paths, quality assurance, etc.

pyvision contains a couple of routines useful for vision research (e.g.,
convolution, tracking, svm, bounding boxes). You probably should only modify
pyvision if you want to tweak our tracking algorithms, linear interpolation
schemes, or support new type of annotations besides bounding boxes.

turkic is a framework that makes it easy to send jobs to MTurk. It manages
workers, payment, and training. You probably should only modify turkic if you
want to change protocols to how workers are paid and quality control is done.

vatic_tracking is a tracking framework meant to interact with VATIC. It provides
an API that is called by our fork of VATIC and is meant to be easily extensible
with tracking algorithms in a variety of languages.


Front end
---------

All of the front end code is located in JavaScript files in vatic/public. There
is an HTML file whose only purpose is to load these scripts. The files and their
purposes are described here:

**bootstrap.js**: This script is in charge of bootstrapping the interface. It starts
the loading screen and begins preloading the frames from the video. You can probably
ignore this file when making changes to the interface, but it might be useful to see
how things get launched.


**job.js**: This defines the `Job` class that stores all of the metadata for a job. 
You will need to modify this if you plan on passing any additional video metadata 
from the server.


**ui.js**: This basically handles the ui initialization. It defines a table layout
for the interface and initializes the annotations, the video player, and the column
of annotations on the right side of the video player. This also handles the creation
of all of the other buttons and ui elements that you see.


**videoplayer.js**: This file sets up the video player. It is in charge of displaying
each frame when the user scrubs the frames or presses play. It does not do anything
with the annotations so you probably will not be touching this fill often.


**tracks.js**: This defines a couple of important classes that you will interface with
and modify regularly. First, `Track` stores all of the information about a single
annotation. There might be confusion in the naming here because our fork of VATIC 
provides tracking capabilities. This class is much more general purpose and handles
all of interactions with a single object annotation, including tracking. The `Track`
class also sets up the bounding box handle that you use to move the track in each
frame of the video. `Track` stores its data in what is know as a `Journal`.

`Journal` is the key data structure for a track. A track's `Journal` stores a set of
annotations in a dictionary mapping frames to bounding boxes. It provides an interface
for querying and modifying that dictionary.

This file also provides a class called `AutoTrackManager` that is responsible for running
the tracking algorithms on the server. Changes to the trackers and tracking interface may
require changes here.

`TrackCollection` is simply a collection of tracks and provides some interfaces for managing
the collection.


**objectui.js**: This defines a couple of classes, most notably `TrackObjectUI` and
`TrackObject`. Together these two classes manage the life cycle of the annotations for a
single object. They also manage the column you see on the right side of the video player.
This file will almost certainly require changes if you want to add additional ways of
interacting with an annotation.

`TrackObject` provides ways of interacting with a `Track` via cells in the table on the right
side of the video player. For example, this handles marking tracks as outside of the frame
or occluded.

`TrackObjectUI` is a container for `TrackObjects`. This also handles the initialization of new
`TrackObjects` as well as the ui for selecting objects for editing.

Server
---------

Unlike the front end, the server code is actually limited to just a couple of key files. These
files handle the storage of annotations in a MySQL database and provide all of the handlers
for the API used by the web interface. The back end is written in Python and relies on a couple
of other libraries including pyvision, turkic, and vatic_tracking. Documentation for these
libraries can be found in the READMEs of their respective repositories.

**start_server.py** This is a small script that is used to run the annotation tool locally. You
should not have to make changes this, but if you are having trouble running it on your machine, this
might be a good place to look. It runs a simple werkzeug server. I recommend using this while
developing for VATIC.


**models.py**: This is the file that controls all of the models used to store the annotations
in the MySQL database. You will certainly need to make changes to this file. VATIC uses 
sqlalchemy to manage the databases in Python so it might be a good idea to read up on that
(http://www.sqlalchemy.org/). It is a good idea to look through this file and see what is 
being stored on the server and to understand the relationships between tables in the database.
Here are a couple of conventions used in sqlalchemy that will help you understand this file:

- A Python class corresponds to a table in the database. Adding a new table will require creating
a new class and defining the `__tablename__` property. There is more to creating a new table that
I will get into later.
- Table columns are defined as properties of the Python class. It is a good idea to look through
the file at the different types columns in use. The trickiest are the relational columns that
look something like this:
 
        video = relationship(Video, backref = backref("labels", cascade = "all,delete"))

See the [Tips](#Tips) section below for information about modifying the MySQL database
schema.

**server.py**: This file provides all of the handles for the API that the web interface uses to
get information about a job. The server interface is broken into four sections:

*Basic Commands*: This provides the basic API for the web interface and is how the user will get data
about a video or store annotations. You will probably have to make changes here, but the code is pretty
self explanatory.

*Tracking*: This provides the API for performing tracking on a video sequence. 

*Admin Page*: This provides the API used by the admin page. 

*Homography*: This provides the API used for the homographies that appear under the video frame. This
can probably be ignored and is still a little buggy.

**cli.py**: This file provides the command line interface used to interact with the annotation tool from
the back end. This script is the one that allows you to extract, load, and publish videos to the server.
If you want to add features to the back end interface, you will have to modify this file. The commands are 
given in the form:

    $ vatic vatic_command --options

`vatic` is the base for all VATIC commands. To add a new `vatic` command, you must add a new `Command`
subclass with the name of your command to cli.py. This subclass also must have the `@handler` decorator
and will probably have to implement the `setup` and `__call__` methods.

It is worth first getting familiar with the commands VATIC provides and then seeing how they are
implemented in cli.py


Tips
----

### Database Changes ###
Making changes to your database schema will require changes to the models.py as well as a couple
of additional commands. If you are new to VATIC or sqlalchemy I recommend you make changes first
on a system that does not contain any valuable data.

To add a column to a table follow these steps:

1. Add a field to the table in the models.py file.

    If you have valuable information in the database:

2. Log into the MySQL shell:

        $ mysql -u root -p
        $ Enter your password

3. In the MySQL shell run the following commands to add your column.

        $ use vatic;
        $ describe table_name;
        $ ALTER TABLE table_name ADD column_name datatype;

    Note: Look up instructions on describing a column in MySQL if you are not familiar with this process.

If you can afford to clear your database, a less error prone method is:

2. Run the following commands

    **NOTE: THIS WILL CLEAR YOUR DATABASE.**

        $ turkic setup --database --reset
        $ turkic setup --database


