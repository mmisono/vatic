Developers
==========

This document will describe how to modify VATIC for your own purposes. If you
only want to use VATIC, please see README instead.

This fork of VATIC is broken up into four different packages:

1. **vatic** - video annotation tool
2. **turkic** - a platform for easy MTurk management
3. **pyvision** - a simple Python computer vision toolkit
4. **vatic_tracking** - a simple tracking framework that integrates with vatic

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

vatic_tracking is a tracking framework meant to interact with vatic. It provides
an api that is called by our fork of vatic and is meant to be easily extensible
with tracking algorithms in a variety of languages.


Front end
---------

All of the front end code is located in javascript files in vatic/public. There
is an HTML file whose only purpose is to call load the scripts. The files and their
purposes are described here:

**bootstrap.js**: This script is incharge of bootstrapping the interface. It starts
up the loading screen and starts preloading the frames from the video. You can most
likely ignore this file when making changes to the interface, but it might be useful
to see how things get lauched.


**job.js**: This defines a class that stores all of the metadata for a job. You will
need to modify this if you plan on adding any addition video metadata that you would
like passed from the server to the interface.


**ui.js**: This handles basically of the ui initialization and is will be important
to learn. It essentially defines a table layout for the interface and initializes
the annotations, the videoplayer, and the column of annotations on the right side 
of the video player


**videoplayer.js**: This file sets up the video player. It is in charge of displaying
each frame when the user scrubs the frames or presses play. It doesn't do anything
with the annotations so is probably not necessary to change.


**tracks.js**: This defines two important classes that you will interface with regularly.
First, Track stores all of the information about a single annotation. It also sets up
the bounding box that you use to move the track in each frame of the video. Track stores
its data in what is know as a Journal.

Journal is the key datastructure for a track. A tracks Journal stores a set of annotations
in a dictionary mapping frames to bounding boxes. It provides an interface for querying that
dictionary which is important for linear interpolation between marked frames.

This file also provides a class called AutoTrackManager that is responsible for running the
tracking algorithms on the server. Changes to the trackers and tracking interface may
require changes here.

TrackCollection is simply a collection of tracks and provides some interfaces for mananging
the collection.


**objectui.js**: This defines a couple of classes. Most notably TrackObjectUI and
TrackObject. Together these two classes manage the lifecycle of the annotations for a
single object. They also manage the column you see on the right side of the video player.
This file will almost certainly require changes if you want to add additional ways of
interacting with an annotation.

TrackObject provides ways of interacting with a Track via cells in the table on the right
side of the video player. Specifically, this handles marking tracks as outside of the frame
or occluded.

TrackObjectUI is a container for TrackObjects. This also handles the initialization of new
TrackObjects as well as the ui for selecting objects for editing.

Server
---------

Unlike the frontend, the server code is actually limited to a couple of key files. These
files handle the storage of annotations in a MySQL database and provide all of the handlers
for the web interface. The backend is all written in Python and relys on a couple of other
libraries including pyvision, turkic, and vatic_tracking. Documentation for these libraries
can be found in the READMEs of their respective repositiories.

**start_server.py** This is a small script that is used to run the tool locally. You should
not have to make changes this, but if you are having trouble running it on your machine, this
might be a good place to look. It runs a simple werkzeug server.


**models.py**: This is the file that controls all of the models used to store the annotations
in the MySQL database. You will certainly need to make changes to this file. VATIC uses 
sqlalchemy to manage the databases in Python so it might be a good idea to read up on that
(http://www.sqlalchemy.org/). It is a good idea to look through this file and see what is 
being stored on the server and to understand the relationships between tables. A couple of
conventions used in sqlalchemy that will help you understand this file:

- A Python class correspnds to a table. Adding a new table will require ceating a new class
and defining the \__tablename\__ property. There is more to creating a new table that I will
get into later.
- Table columns are defined as properties of the Python class. It is a good idea to look through
the fie at the different types columns in use. The trickiest are the relational columns that
look something like this:

    video = relationship(Video, backref = backref("labels", cascade = "all,delete"))

and define relationships between tables.

Making changes to your database schema will require changes to this file as well as a couple
of additional commands. If you are new to VATIC or sqlalchemy I recommend you make changes first
on a system that does not contain any valuable data to test it out.

To add a column to a table follow these steps:

1. Add a field to the table in the models.py file.

If you have valuable information in the database:

2. Log into the MySQL shell:

    $ mysql -u root -p

3. In the MySQL shell run the following commands to add your column.

    $ use vatic;
    $ describe table_name
    $ ALTER TABLE table_name ADD column_name datatype

Note: Look up instructions on descibing a column in MySQL if you are not familiar with this process.

If you can afford to clear your database, a less error prone method is:

2. Run the following commands

    NOTE: THIS WILL CLEAR YOUR DATABASE.

    $ turkic setup --database --reset
    $ turkic setup --database


**server.py**


**cli.py**


Tips
----


