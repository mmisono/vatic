import os
import sys
import math
import argparse
import config
import shutil
from turkic.cli import handler, importparser, Command, LoadCommand
from turkic.database import session
import sqlalchemy
import random
from vision import Box
from vision import ffmpeg
import vision.visualize
import vision.track.interpolation
import turkic.models
from models import *
from tracking import *
import cStringIO
import Image, ImageDraw, ImageFont
import qa
import merge
import dumpcommands
import parsedatetime
import datetime, time
import vision.pascal
import itertools
from xml.etree import ElementTree

@handler("Decompresses an entire video into frames")
class extract(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("video")
        parser.add_argument("output")
        parser.add_argument("--width", default=720, type=int)
        parser.add_argument("--height", default=480, type=int)
        parser.add_argument("--image-dir", action="store_true", default=False)
        parser.add_argument("--no-resize",
            action="store_true", default = False)
        parser.add_argument("--no-cleanup",
            action="store_true", default=False)
        return parser

    def sequencefromdir(self, imagedir):
        lastframe = None
        imagefiles = [os.path.join(imagedir, f) for f in os.listdir(imagedir)]
        imagefiles = [f for f in imagefiles if os.path.isfile(f)]
        imagefiles = sorted(imagefiles)
        for imagepath in imagefiles:
            try:
                lastframe = Image.open(imagepath)
                yield lastframe
            except IOError:
                print "Error loading image {0}. Trying previous frame.".format(imagepath)
                yield lastframe

    def __call__(self, args):
        try:
            os.makedirs(args.output)
        except:
            pass
        sequence = []
        if args.image_dir:
            sequence = self.sequencefromdir(args.video)
        else:
            sequence = ffmpeg.extract(args.video)
        try:
            for frame, image in enumerate(sequence):
                if frame % 100 == 0:
                    print ("Decoding frames {0} to {1}"
                        .format(frame, frame + 100))
                if not args.no_resize:
                    try:
                        image.thumbnail((args.width, args.height), Image.BILINEAR)
                    except IOError:
                        print "ERROR: resizing image {0}".format(frame)
                path = Video.getframepath(frame, args.output)
                try:
                    image.save(path)
                except IOError:
                    os.makedirs(os.path.dirname(path))
                    image.save(path)
        except:
            if not args.no_cleanup:
                print "Aborted. Cleaning up..."
                shutil.rmtree(args.output)
            raise

@handler("Formats existing frames ")
class formatframes(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("video")
        parser.add_argument("output")
        parser.add_argument("--extension", default="jpg")
        parser.add_argument("--no-cleanup",
            action="store_true", default=False)
        return parser

    def __call__(self, args):
        try:
            os.makedirs(args.output)
        except:
            pass
        extension = ".{0}".format(args.extension)
        files = os.listdir(args.video)
        files = (x for x in files if x.endswith(extension))
        files = [(int(x.split(".")[0]), x) for x in files]
        files.sort()
        files = [(x, y) for x, (_, y) in enumerate(files)]
        if not files:
            print "No files ending with {0}".format(extension)
            return
        for frame, file in files:
            path = Video.getframepath(frame, args.output)
            file = os.path.join(args.video, file)
            try:
                os.link(file, path)
            except OSError:
                os.makedirs(os.path.dirname(path))
                os.link(file, path)
        print "Formatted {0} frames".format(len(files))

@handler("Imports a set of video frames")
class load(LoadCommand):
    def setup(self):
        parser = argparse.ArgumentParser(parents = [importparser])
        parser.add_argument("slug")
        parser.add_argument("location")
        parser.add_argument("labels", nargs="+")
        parser.add_argument("--length", type=int, default = 300)
        parser.add_argument("--overlap", type=int, default = 20)
        parser.add_argument("--skip", type=int, default = 0)
        parser.add_argument("--per-object-bonus", type=float)
        parser.add_argument("--completion-bonus", type=float)
        parser.add_argument("--use-frames", default = None)
        parser.add_argument("--start-frame", type = int, default = 0)
        parser.add_argument("--stop-frame", type = int, default = None)
        parser.add_argument("--train-with")
        parser.add_argument("--for-training", action="store_true")
        parser.add_argument("--for-training-start", type=int)
        parser.add_argument("--for-training-stop", type=int)
        parser.add_argument("--for-training-overlap", type=float, default=0.25)
        parser.add_argument("--for-training-tolerance", type=float, default=0.2)
        parser.add_argument("--for-training-mistakes", type=int, default=0)
        parser.add_argument("--for-training-data", default = None)
        parser.add_argument("--blow-radius", default = 3)
        parser.add_argument("--run-initial-tracking", action="store_true")
        parser.add_argument("--homography")
        return parser

    def title(self, args):
        return "Video annotation"

    def description(self, args):
        return "Draw boxes around objects moving around in a video."

    def cost(self, args):
        return 0.05

    def duration(self, args):
        return 7200 * 3

    def keywords(self, args):
        return "video, annotation, computer, vision"

    def __call__(self, args, group):
        print "Checking integrity..."

        # read first frame to get sizes
        path = Video.getframepath(0, args.location)
        try:
            im = Image.open(path)
        except IOError:
            print "Cannot read {0}".format(path)
            return
        width, height = im.size

        print "Searching for last frame..."

        # search for last frame
        toplevel = max(int(x)
            for x in os.listdir(args.location))
        secondlevel = max(int(x)
            for x in os.listdir("{0}/{1}".format(args.location, toplevel)))
        maxframes = max(int(os.path.splitext(x)[0])
            for x in os.listdir("{0}/{1}/{2}"
            .format(args.location, toplevel, secondlevel))) + 1

        print "Found {0} frames.".format(maxframes)

        # can we read the last frame?
        path = Video.getframepath(maxframes - 1, args.location)
        try:
            im = Image.open(path)
        except IOError:
            print "Cannot read {0}".format(path)
            return

        # check last frame sizes
        if im.size[0] != width and im.size[1] != height:
            print "First frame dimensions differs from last frame"
            return

        if session.query(Video).filter(Video.slug == args.slug).count():
            print "Video {0} already exists!".format(args.slug)
            return

        if args.train_with:
            if args.for_training:
                print "A training video cannot require training"
                return
            print "Looking for training video..."
            trainer = session.query(Video)
            trainer = trainer.filter(Video.slug == args.train_with)
            if not trainer.count():
                print ("Training video {0} does not exist!"
                    .format(args.train_with))
                return
            trainer = trainer.one()
        else:
            trainer = None

        homographydir = os.path.abspath(os.path.join("homographies", args.slug))
        if not os.path.isdir(homographydir):
            os.makedirs(homographydir)

        if args.homography is not None:
            shutil.copy(args.homography, os.path.join(homographydir, "homography.npy"))
        else:
            np.save(os.path.join(homographydir, "homography.npy"), np.identity(3))

        # create video
        video = Video(slug = args.slug,
                      location = os.path.realpath(args.location), 
                      width = width,
                      height = height,
                      totalframes = maxframes,
                      skip = args.skip,
                      perobjectbonus = args.per_object_bonus,
                      completionbonus = args.completion_bonus,
                      trainwith = trainer,
                      isfortraining = args.for_training,
                      blowradius = args.blow_radius,
                      homographylocation = homographydir)

        if args.for_training:
            video.trainvalidator = qa.tolerable(args.for_training_overlap,
                                                args.for_training_tolerance,
                                                args.for_training_mistakes)
            print "Training validator is {0}".format(video.trainvalidator)

        session.add(video)

        print "Binding labels and attributes..."

        # create labels and attributes
        labelcache = {}
        attributecache = {}
        lastlabel = None
        for labeltext in args.labels:
            if labeltext[0] == "~":
                if lastlabel is None:
                    print "Cannot assign an attribute without a label!"
                    return
                labeltext = labeltext[1:]
                attribute = Attribute(text = labeltext)
                session.add(attribute)
                lastlabel.attributes.append(attribute)
                attributecache[labeltext] = attribute
            else:
                label = Label(text = labeltext)
                session.add(label)
                video.labels.append(label)
                labelcache[labeltext] = label
                lastlabel = label

        print "Creating symbolic link..."
        symlink = "public/frames/{0}".format(video.slug)
        try:
            os.remove(symlink)
        except:
            pass
        os.symlink(video.location, symlink)

        print "Creating segments..."
        # create shots and jobs
       
        if args.for_training:
                segment = Segment(video = video)
                if args.for_training_start:
                    segment.start = args.for_training_start
                    if segment.start < 0:
                        segment.start = 0
                else:
                    segment.start = 0
                if args.for_training_stop:
                    segment.stop = args.for_training_stop
                    if segment.stop > video.totalframes - 1:
                        segment.stop = video.totalframes - 1
                else:
                    segment.stop = video.totalframes - 1
                job = Job(segment = segment, group = group, ready = False)
                session.add(segment)
                session.add(job)
        elif args.use_frames:
            with open(args.use_frames) as useframes:
                for line in useframes:
                    ustart, ustop = line.split()
                    ustart, ustop = int(ustart), int(ustop)
                    validlength = float(ustop - ustart)
                    numsegments = math.ceil(validlength / args.length)
                    segmentlength = math.ceil(validlength / numsegments)

                    for start in range(ustart, ustop, int(segmentlength)):
                        stop = min(start + segmentlength + args.overlap + 1,
                                   ustop)
                        segment = Segment(start = start,
                                          stop = stop, 
                                          video = video)
                        job = Job(segment = segment, group = group)
                        session.add(segment)
                        session.add(job)
        else:
            startframe = args.start_frame
            stopframe = args.stop_frame
            if not stopframe:
                stopframe = video.totalframes - 1
            for start in range(startframe, stopframe, args.length):
                stop = min(start + args.length + args.overlap + 1,
                           stopframe)
                segment = Segment(start = start,
                                    stop = stop,
                                    video = video)
                job = Job(segment = segment, group = group)
                session.add(segment)
                session.add(job)

        if args.per_object_bonus:
            group.schedules.append(
                PerObjectBonus(amount = args.per_object_bonus))
        if args.completion_bonus:
            group.schedules.append(
                CompletionBonus(amount = args.completion_bonus))

        session.add(group)

        if args.for_training and args.for_training_data:
            print ("Loading training ground truth annotations from {0}"
                        .format(args.for_training_data))
            with open(args.for_training_data, "r") as file:
                pathcache = {}
                for line in file:
                    (id, xtl, ytl, xbr, ybr,
                     frame, outside, occluded, generated,
                     label) = line.split(" ")

                    if int(generated):
                        continue

                    if id not in pathcache:
                        print "Imported new path {0}".format(id)
                        label = labelcache[label.strip()[1:-1]]
                        pathcache[id] = Path(job = job, label = label)

                    box = Box(path = pathcache[id])
                    box.xtl = int(xtl)
                    box.ytl = int(ytl)
                    box.xbr = int(xbr)
                    box.ybr = int(ybr)
                    box.frame = int(frame)
                    box.outside = int(outside)
                    box.occluded = int(occluded)
                    pathcache[id].boxes.append(box)
        elif args.run_initial_tracking:
            # Add initial paths
            path_dict = get_paths(video)

        session.commit()

        if args.for_training:
            if args.for_training and args.for_training_data:
                print "Video and ground truth loaded."
            else:
                print "Video loaded and ready for ground truth:"
                print ""
                print "\t{0}".format(job.offlineurl(config.localhost))
                print ""
                print "Visit this URL to provide training with ground truth."
        else:
            print "Video loaded and ready for publication."

@handler("Deletes an already imported video")
class delete(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("slug")
        parser.add_argument("--force", action="store_true", default=False)
        return parser

    def __call__(self, args):
        video = session.query(Video).filter(Video.slug == args.slug)
        if not video.count():
            print "Video {0} does not exist!".format(args.slug)
            return
        video = video.one()

        query = session.query(Path)
        query = query.join(Job)
        query = query.join(Segment)
        query = query.filter(Segment.video == video)
        numpaths = query.count()
        if numpaths and not args.force:
            print ("Video has {0} paths. Use --force to delete."
                .format(numpaths))
            return

        for segment in video.segments:
            for job in segment.jobs:
                if job.published and not job.completed:
                    hitid = job.disable()
                    print "Disabled {0}".format(hitid)

        session.delete(video)
        session.commit()

        print "Deleted video and associated data."

class DumpCommand(Command):
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument("slug")
    parent.add_argument("--merge", "-m", action="store_true", default=False)
    parent.add_argument("--merge-threshold", "-t",
                        type=float, default = 0.5)
    parent.add_argument("--groundplane", action = "store_true", default=False)
    parent.add_argument("--worker", "-w", nargs = "*", default = None)

    class Tracklet(object):
        def __init__(self, label, labelid, paths, boxes, workers):
            self.label = label
            self.paths = paths
            self.boxes = sorted(boxes, key = lambda x: x.frame)
            self.workers = workers
            self.labelid = labelid

        def bind(self):
            for path in self.paths:
                self.boxes = Path.bindattributes(path.attributes, self.boxes)

    def getdata(self, args):
        response = []
        video = session.query(Video).filter(Video.slug == args.slug)
        if video.count() == 0:
            print "Video {0} does not exist!".format(args.slug)
            raise SystemExit()
        video = video.one()

        if args.merge:
            for boxes, paths in merge.merge(video.segments, 
                                            threshold = args.merge_threshold,
                                            groundplane = args.groundplane):
                workers = list(set(x.job.workerid for x in paths))
                tracklet = DumpCommand.Tracklet(paths[0].label.text, paths[0].labelid,
                                                paths, boxes, workers)
                response.append(tracklet)
        else:
            for segment in video.segments:
                for job in segment.jobs:
                    if not job.useful:
                        continue
                    worker = job.workerid
                    for path in job.paths:
                        tracklet = DumpCommand.Tracklet(path.label.text, path.labelid
                                                        [path],
                                                        path.getboxes(),
                                                        [worker])
                        response.append(tracklet)

        if args.worker:
            workers = set(args.worker)
            response = [x for x in response if set(x.workers) & workers]

        interpolated = []
        for track in response:
            path = vision.track.interpolation.LinearFill(track.boxes)
            tracklet = DumpCommand.Tracklet(track.label, track.labelid, track.paths,
                                            path, track.workers)
            interpolated.append(tracklet)
        response = interpolated

        for tracklet in response:
            tracklet.bind()

        return video, response

@handler("Highlights a video sequence")
class visualize(DumpCommand):
    def setup(self):
        parser = argparse.ArgumentParser(parents = [self.parent])
        parser.add_argument("output")
        parser.add_argument("--no-augment", action="store_true", default = False)
        parser.add_argument("--labels", action="store_true", default = False)
        parser.add_argument("--renumber", action="store_true", default = False)
        return parser

    def __call__(self, args):
        video, data = self.getdata(args)
        
        # prepend class label
        for track in data:
            for box in track.boxes:
                box.attributes.insert(0, track.label)

        paths = [x.boxes for x in data]
        print "Highlighting {0} tracks...".format(len(data))

        if args.labels:
            font = ImageFont.truetype("arial.ttf", 14)
        else:
            font = None

        if args.groundplane:
            width = max([box.xbr for path in paths for box in path])
            height = max([box.xbr for path in paths for box in path])
            class GroundPlane:
                def __init__(self, width, height):
                    self.width = width
                    self.height = height

                def __getitem__(self, index):
                    return Image.new("RGB", (width, height), "white")

            it = vision.visualize.highlight_paths(GroundPlane(width, height), paths, font = font)
        else:
            it = vision.visualize.highlight_paths(video, paths, font = font)

        if not args.no_augment:
            it = self.augment(args, video, data, it)

        if args.renumber:
            it = self.renumber(it)

        try:
            os.makedirs(args.output)
        except:
            pass

        vision.visualize.save(it,
            lambda x: "{0}/{1}.jpg".format(args.output, x))

    def renumber(self, it):
        for count, (im, _) in enumerate(it):
            yield im, count

    def augment(self, args, video, data, frames):
        offset = 100
        for im, frame in frames:
            aug = Image.new(im.mode, (im.size[0], im.size[1] + offset))
            aug.paste("black")
            aug.paste(im, (0, 0))
            draw = ImageDraw.ImageDraw(aug)

            s = im.size[1]
            font = ImageFont.truetype("arial.ttf", 14)

            # extract some data
            workerids = set()
            sum = 0
            for track in data:
                if frame in (x.frame for x in track.boxes):
                    for worker in track.workers:
                        if worker not in workerids and worker is not None:
                            workerids.add(worker)
                    sum += 1
            ypos = s + 5
            for worker in workerids:
                draw.text((5, ypos), worker, fill="white", font = font)
                ypos += draw.textsize(worker, font = font)[1] + 3

            size = draw.textsize(video.slug, font = font)
            draw.text((im.size[0] - size[0] - 5, s + 5),
                      video.slug, font = font)

            text = "{0} annotations".format(sum)
            numsize = draw.textsize(text, font = font)
            draw.text((im.size[0] - numsize[0] - 5, s + 5 + size[1] + 3),
                      text, font = font)

            yield aug, frame

@handler("Load tracks from file")
class loadtracks(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("slug")
        parser.add_argument("labelfile")
        parser.add_argument("--scale", "-s", default = 1.0, type = float)
        parser.add_argument("--dimensions", "-d", default = None)
        parser.add_argument("--original-video", "-v", default = None)
        parser.add_argument("--original-frame", "-f", default = None)
        parser.add_argument("--json", "-j",
            action="store_true", default=False)
        parser.add_argument("--matlab", "-ml",
            action="store_true", default=False)
        return parser

    def getdatajson(self, filename):
        returndata = {}
        import json
        with open(filename, "r") as jsonfile:
            returndata = json.load(jsonfile)
        return returndata

    def getdatatext(self, filename, maxframe):
        # Input format:
        # id xtl ytl xbr ybr frame lost occluded generated label attributes
        annotations = {}
        labelfile = open(filename, "r")
        for line in labelfile:
            box = line.split()
            boxid, xtl, ytl, xbr, ybr, frame, lost, occluded, generated, label = box[:10]
            attributes = box[10:]
            if boxid not in annotations:
                annotations[boxid] = {'label': label, 'boxes':{}}
            boxdict = {}
            boxdict['xtl'] = int(xtl)
            boxdict['ytl'] = int(ytl)
            boxdict['xbr'] = int(xbr)
            boxdict['ybr'] = int(ybr)
            boxdict['outside'] = int(lost)
            boxdict['occluded'] = int(occluded)
            boxdict['generated'] = int(generated)
            boxdict['attributes'] = attributes
            annotations[boxid]['boxes'][int(frame)] = boxdict

        for boxid, annotation in annotations.iteritems():
            lastframe = max(annotation['boxes'].keys())
            firstframe = min(annotation['boxes'].keys())
            startboxdict = annotation['boxes'][firstframe].copy()
            startboxdict['outside'] = 1
            stopboxdict = annotation['boxes'][lastframe].copy()
            stopboxdict['outside'] = 1
            for i in range(0, maxframe, 5):
                if i < firstframe:
                    annotations[boxid]['boxes'][i] = startboxdict
                elif i > lastframe:
                    annotations[boxid]['boxes'][i] = stopboxdict

        labelfile.close()
        return annotations

    def __call__(self, args):
        video = session.query(Video).filter(Video.slug == args.slug)
        if video.count() == 0:
            print "Video {0} does not exist!".format(args.slug)
            raise SystemExit()
        video = video.one()

        print "Parsing text data"
        data = {}
        if args.json:
            data = self.getdatajson(args.labelfile)
        else:
            data = self.getdatatext(args.labelfile, video.totalframes)

        scale = args.scale
        if args.dimensions or args.original_video or args.original_frame:
            print "Computing scale"
            if args.original_video:
                w, h = ffmpeg.extract(args.original_video).next().size
            elif args.original_frame:
                w, h = Image.open(args.original_frame).size
            else:
                w, h = args.dimensions.split("x")
            w = float(w)
            h = float(h)
            s = float(video.width) / w
            if s * h > video.height:
                s = float(video.height) / h
            scale = s
            print "Scale = {0}".format(scale)

        segmentcount = 1
        for segment in video.segments:
            print "Segment {0} of {1}".format(segmentcount, len(video.segments))
            segmentcount += 1
            for job in segment.jobs:
                for boxid in data:
                    label = data[boxid]['label']
                    boxes = data[boxid]['boxes']

                    query = session.query(Label).filter(Label.videoid == video.id).filter(Label.text == label)
                    if query.count() == 0:
                        continue
                    label = query.one()
 
                    newpath = Path(label=label)
                    visible = False
                    for frame, boxdata in boxes.iteritems():
                        frame = int(frame)
                        if frame < segment.start or segment.stop <= frame or (frame % video.blowradius != 0):
                            continue
                        newbox = Box(path=newpath)
                        #newbox.xtl = max(boxdata['xtl'], 0)
                        #newbox.ytl = max(boxdata['ytl'], 0)
                        #newbox.xbr = max(boxdata['xbr'], 0)
                        #newbox.ybr = max(boxdata['ybr'], 0)
                        newbox.xtl = boxdata['xtl']
                        newbox.ytl = boxdata['ytl']
                        newbox.xbr = boxdata['xbr']
                        newbox.ybr = boxdata['ybr']

                        newbox.occluded = boxdata['occluded']
                        newbox.outside = boxdata['outside']
                        newbox.generated = boxdata['generated']
                        newbox.frame = frame

                        scalebox = newbox.getbox()
                        scalebox = scalebox.transform(scale)
                        newbox.xtl = scalebox.xtl
                        newbox.ytl = scalebox.ytl
                        newbox.xbr = scalebox.xbr
                        newbox.ybr = scalebox.ybr

                        if not newbox.outside:
                            visible = True

                    if visible:
                        job.paths.append(newpath)

                session.add(job)
        session.commit()


@handler("Dumps the tracking data")
class dump(DumpCommand):
    def setup(self):
        parser = argparse.ArgumentParser(parents = [self.parent])
        parser.add_argument("--output", "-o")
        parser.add_argument("--xml", "-x",
            action="store_true", default=False)
        parser.add_argument("--json", "-j",
            action="store_true", default=False)
        parser.add_argument("--matlab", "-ml",
            action="store_true", default=False)
        parser.add_argument("--pickle", "-p",
            action="store_true", default=False)
        parser.add_argument("--labelme", "-vlm",
            action="store", default=False)
        parser.add_argument("--forecast", "-frc",
            action="store_true", default=False)
        parser.add_argument("--positions", "-pos",
            action="store_true", default=False)
        parser.add_argument("--pascal", action="store_true", default=False)
        parser.add_argument("--pascal-difficult", type = int, default = 100)
        parser.add_argument("--pascal-skip", type = int, default = 15)
        parser.add_argument("--pascal-negatives")
        parser.add_argument("--scale", "-s", default = 1.0, type = float)
        parser.add_argument("--dimensions", "-d", default = None)
        parser.add_argument("--original-video", "-v", default = None)
        parser.add_argument("--lowercase", action="store_true", default=False)
        return parser

    def __call__(self, args):
        video, data = self.getdata(args)

        if args.pascal:
            if not args.output:
                print "error: PASCAL output needs an output"
                return
            file = args.output
            print "Dumping video {0}".format(video.slug)
        elif args.output:
            file = open(args.output, 'w')
            print "Dumping video {0}".format(video.slug)
        else:
            file = cStringIO.StringIO()

        scale = args.scale
        if args.dimensions or args.original_video:
            if args.original_video:
                w, h = ffmpeg.extract(args.original_video).next().size
            else:
                w, h = args.dimensions.split("x")
            w = float(w)
            h = float(h)
            s = w / video.width
            if s * video.height > h:
                s = h / video.height
            scale = s

        for track in data:
            track.boxes = [x.transform(scale) for x in track.boxes]
            if args.lowercase:
                track.label = track.label.lower()

        if args.xml:
            dumpcommands.dumpxml(file, data, args.groundplane)
        elif args.json:
            dumpcommands.dumpjson(file, data, args.groundplane)
        elif args.matlab:
            dumpcommands.dumpmatlab(file, data, video, scale)
        elif args.pickle:
            dumpcommands.dumppickle(file, data)
        elif args.labelme:
            dumpcommands.dumplabelme(file, data, args.slug, args.labelme)
        elif args.pascal:
            if scale != 1:
                print "Warning: scale is not 1, yet frames are not resizing!"
                print "Warning: you should manually update the JPEGImages"
            dumpcommands.dumppascal(file, video, data, args.pascal_difficult,
                            args.pascal_skip, args.pascal_negatives)
        elif args.forecast:
            dumpcommands.dumpforecastdata(file, data)
        elif args.positions:
            dumpcommands.dumppositions(file, data)
        else:
            dumpcommands.dumptext(file, data, args.groundplane)

        if args.pascal:
            return
        elif args.output:
            file.close()
        else:
            sys.stdout.write(file.getvalue())

    
@handler("Samples the performance by worker")
class sample(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("directory")
        parser.add_argument("--number", "-n", type=int, default=3)
        parser.add_argument("--frames", "-f", type=int, default=4)
        parser.add_argument("--since", "-s")
        parser.add_argument("--labels", action="store_true", default = False)
        return parser

    def __call__(self, args):
        try:
            os.makedirs(args.directory)
        except:
            pass

        since = None
        if args.since:
            since = parsedatetime.Calendar().parse(args.since)
            since = time.mktime(since[0])
            since = datetime.datetime.fromtimestamp(since)

        if args.labels:
            font = ImageFont.truetype("arial.ttf", 14)
        else:
            font = None

        workers = session.query(turkic.models.Worker)
        for worker in workers:
            print "Sampling worker {0}".format(worker.id)

            jobs = session.query(Job)
            jobs = jobs.filter(Job.worker == worker)
            jobs = jobs.join(Segment)
            jobs = jobs.join(Video)
            jobs = jobs.filter(Video.isfortraining == False)

            if since:
                jobs = jobs.filter(turkic.models.HIT.timeonserver >= since)

            jobs = jobs.order_by(sqlalchemy.func.rand())
            jobs = jobs.limit(args.number)

            for job in jobs:
                print "Visualizing HIT {0}".format(job.hitid)
                paths = [x.getboxes(interpolate = True,

                                    bind = True,
                                    label = True) for x in job.paths]

                if args.frames > job.segment.stop - job.segment.start:
                    frames = range(job.segment.start, job.segment.stop + 1) 
                else:
                    frames = random.sample(xrange(job.segment.start,
                                                job.segment.stop + 1),
                                           args.frames)

                size = math.sqrt(len(frames))
                video = job.segment.video
                bannersize = (video.width * int(math.floor(size)),
                              video.height * int(math.ceil(size)))
                image = Image.new(video[0].mode, bannersize)
                size = int(math.floor(size))

                offset = (0, 0)
                horcount = 0

                paths = vision.visualize.highlight_paths(video, paths,
                                                         font = font)
                for frame, framenum in paths:
                    if framenum in frames:
                        image.paste(frame, offset)
                        horcount += 1
                        if horcount >= size:
                            offset = (0, offset[1] + video.height)
                            horcount = 0
                        else:
                            offset = (offset[0] + video.width, offset[1])

                image.save("{0}/{1}-{2}.jpg".format(args.directory,
                                                    worker.id,
                                                    job.hitid))

@handler("Provides a URL to fix annotations during vetting")
class find(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--id")
        parser.add_argument("--frame", "-f", type = int,
                            nargs = '?', default = None)
        parser.add_argument("--hitid")
        parser.add_argument("--workerid")
        parser.add_argument("--ids", action="store_true", default = False)
        return parser

    def __call__(self, args):
        jobs = session.query(Job)
        jobs = jobs.join(Segment).join(Video)

        if args.id:
            jobs = jobs.filter(Video.slug == args.id)
            if args.frame is not None:
                jobs = jobs.filter(Segment.start <= args.frame)
                jobs = jobs.filter(Segment.stop >= args.frame)
        if args.hitid:
            jobs = jobs.filter(Job.hitid == args.hitid)
        if args.workerid:
            jobs = jobs.filter(Job.workerid == args.workerid)
        jobs = jobs.filter(turkic.models.HIT.useful == True)

        if jobs.count() > 0:
            for job in jobs:
                if args.ids:
                    if job.published:
                        print job.hitid,
                        if job.completed:
                            print job.assignmentid,
                            print job.workerid,
                        print ""
                    else:
                        print "(not published)"
                else:
                    print job.offlineurl(config.localhost)
        else:
            print "No jobs matching this criteria."

@handler("List all videos loaded", "list")
class listvideos(Command):
    def setup(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--completed", action="store_true", default=False)
        parser.add_argument("--published", action="store_true", default=False)
        parser.add_argument("--training", action="store_true", default=False)
        parser.add_argument("--count", action="store_true", default=False)
        parser.add_argument("--worker")
        parser.add_argument("--stats", action="store_true", default=False)
        return parser

    def __call__(self, args):
        videos = session.query(Video)

        if args.training:
            videos = videos.filter(Video.isfortraining == True)
        else:
            videos = videos.filter(Video.isfortraining == False)
            if args.worker:
                videos = videos.join(Segment)
                videos = videos.join(Job)
                videos = videos.filter(Job.workerid == args.worker)
            elif args.published:
                videos = videos.join(Segment)
                videos = videos.join(Job)
                videos = videos.filter(Job.published == True)
            elif args.completed:
                videos = videos.join(Segment)
                videos = videos.join(Job)
                videos = videos.filter(Job.completed == True)
        
        if args.count:
            print videos.count()
        else:
            for video in videos.distinct():
                print "{0:<25}".format(video.slug),
                if args.stats:
                    print "{0:>3}/{1:<8}".format(video.numcompleted, video.numjobs),
                    print "${0:<15.2f}".format(video.cost),
                print ""
