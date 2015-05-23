import os.path, sys, cgi, shutil
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import cv2
import config
import tempfile
import tracking
import trackutils
from turkic.server import handler, application
from turkic.database import session
from vision.track.interpolation import LinearFill
import cStringIO
from models import *
import dumptools
import numpy as np
import os
import subprocess
import merge

import logging
logger = logging.getLogger("vatic.server")

HOMOGRAPHY_DIR = "homographies"


@handler()
def getjob(id, verified):
    job = session.query(Job).get(id)

    logger.debug("Found job {0}".format(job.id))

    if int(verified) and job.segment.video.trainwith:
        # swap segment with the training segment
        training = True
        segment = job.segment.video.trainwith.segments[0]
        logger.debug("Swapping actual segment with training segment")
    else:
        training = False
        segment = job.segment

    video = segment.video
    labels = dict((l.id, l.text) for l in video.labels)

    attributes = {}
    for label in video.labels:
        attributes[label.id] = dict((a.id, a.text) for a in label.attributes)

    logger.debug("Giving user frames {0} to {1} of {2}".format(video.slug,
                                                               segment.start,
                                                               segment.stop))

    homography = video.gethomography()
    if homography is not None:
        homography = homography.tolist()

    return {
        "start":        segment.start,
        "stop":         segment.stop,
        "slug":         video.slug,
        "width":        video.width,
        "height":       video.height,
        "skip":         video.skip,
        "perobject":    video.perobjectbonus,
        "completion":   video.completionbonus,
        "blowradius":   video.blowradius,
        "jobid":        job.id,
        "training":     int(training),
        "labels":       labels,
        "attributes":   attributes,
        "homography":   homography,
        "trackers":     tracking.api.gettrackers(),
        "nextid":       video.nextid(),
        "pointmode":    int(video.pointmode),
    }

@handler()
def getboxesforjob(id):
    job = session.query(Job).get(id)
    result = []
    for path in job.paths:
        attrs = [(x.attributeid, x.frame, x.value) for x in path.attributes]
        result.append({"label": path.labelid,
                       "userid": path.userid,
                       "done": path.done,
                       "boxes": [tuple(x) for x in path.getboxes()],
                       "attributes": attrs})
    return result

def readpath(label, userid, done, track, attributes):
    path = Path()
    path.label = session.query(Label).get(label)
    path.done = int(done)
    path.userid = int(userid)
 
    logger.debug("Received a {0} track".format(path.label.text))

    visible = False
    for frame, userbox in track.items():
        box = Box(path = path)
        #box.xtl = max(int(userbox[0]), 0)
        #box.ytl = max(int(userbox[1]), 0)
        #box.xbr = max(int(userbox[2]), 0)
        #box.ybr = max(int(userbox[3]), 0)
        box.xtl = int(userbox[0])
        box.ytl = int(userbox[1])
        box.xbr = int(userbox[2])
        box.ybr = int(userbox[3])

        box.occluded = int(userbox[4])
        box.outside = int(userbox[5])
        box.generated = int(userbox[6])
        box.frame = int(frame)
        if not box.outside:
            visible = True

        logger.debug("Received box {0}".format(str(box.getbox())))

    if not visible:
        logger.warning("Received empty path! Skipping")
        return

    for attributeid, timeline in attributes.items():
        attribute = session.query(Attribute).get(attributeid)
        for frame, value in timeline.items():
            aa = AttributeAnnotation()
            aa.attribute = attribute
            aa.frame = frame
            aa.value = value
            path.attributes.append(aa)
    return path

def readpaths(tracks):
    paths = []
    logger.debug("Reading {0} total tracks".format(len(tracks)))
    return [readpath(label, userid, done, track, attributes) for label, userid, done, track, attributes in tracks]

@handler(post = "json")
def savejob(id, tracks):
    job = session.query(Job).get(id)

    # Update current job
    for path in job.paths:
        session.delete(path)
    session.commit()

    for path in readpaths(tracks):
        logger.info(path)
        job.paths.append(path)

    session.add(job)
    session.commit()

    # Update neigboring segments
    video = job.segment.video
    prevseg, nextseg = video.getsegmentneighbors(job.segment)

    mergesegments = [s for s in [prevseg, job.segment, nextseg] if s is not None]
    updatesegments = [s for s in [prevseg, nextseg] if s is not None]

    # Create list of merged boxes with given label and userid
    labeledboxes = []
    for boxes, paths in merge.merge(mergesegments):
        path = paths[0]
        for p in paths:
            if p.job.segmentid == job.segmentid:
                path = p
                break
        labeledboxes.append((path.label, path.userid, boxes))

    # Remove paths in neigboring segments
    for segment in updatesegments:
        for path in segment.paths:
            session.delete(path)
    session.commit()

    # Add merged paths to neigboring segments
    for label, userid, boxes in labeledboxes:
        frames = sorted([box.frame for box in boxes])
        for segment in updatesegments:
            for job in segment.jobs:
                path = Path()
                path.label = label
                path.userid = userid
                addedbox = False
                for box in boxes:
                    if segment.start <= box.frame <= segment.stop:
                        newbox = Box(path=path)
                        newbox.frombox(box)
                        if not box.lost:
                            addedbox = True

                # Some segments and paths might not overlap
                if addedbox:
                    # Add in first frame if it's missing
                    if (frames[0] < segment.start < frames[-1]
                            and segment.start not in frames):
                        newbox = Box(path=path)
                        newbox.generated = False
                        newbox.frombox(
                            [box for box in LinearFill(boxes)
                            if box.frame == segment.start][0]
                        )

                    job.paths.append(path)

                session.add(job)
    session.commit()

@handler(post = "json")
def validatejob(id, tracks):
    job = session.query(Job).get(id)
    paths = readpaths(tracks)

    return job.trainingjob.validator(paths, job.trainingjob.paths)

@handler()
def respawnjob(id):
    job = session.query(Job).get(id)

    replacement = job.markastraining()
    job.worker.verified = True
    session.add(job)
    session.add(replacement)
    session.commit()

    replacement.publish()
    session.add(replacement)
    session.commit()


""" TRACKING """
@handler(post = "json")
def trackforward(id, frame, tracker, trackid, tracks):
    frame = int(frame)
    trackid = int(trackid)
    job = session.query(Job).get(id)
    segment = job.segment
    video = segment.video
    paths = [path for path in readpaths(tracks) if path is not None]
    paths = trackutils.totrackpaths(paths)

    logger.info("Job Id: {0}".format(id))
    logger.info("Algorithm: {0}".format(tracker))

    start = frame
    stop = segment.stop
    
    outpath = tracking.api.online(tracker, start, stop, video.location, trackid, paths)
    path = trackutils.fromtrackpath(outpath, job, start, stop)
    attrs = [(x.attributeid, x.frame, x.value) for x in path.attributes]

    logger.info("Path: {0}".format(path))

    return {
        "label": 0,
        "boxes": [tuple(x) for x in path.getboxes()],
        "attributes": attrs
    }

@handler()
def trackfull(id, tracker):
    job = session.query(Job).get(id)
    segment = job.segment
    video = segment.video
    tracks = tracking.runfulltracker(tracker, segment.start, segment.stop, video.location)
    allpaths = [convert_track_to_path(segment.start, track, job) for track in tracks]
    allattrs = [[(x.attributeid, x.frame, x.value) for x in path.attributes] for path in allpaths]
    return [{
        "label": 0,
        "boxes":[tuple(x) for x in path.getboxes()],
        "attributes":attrs,
    } for path, attrs in zip(allpaths, allattrs)]

@handler(post = "json")
def trackbetweenframes(id, leftframe, rightframe, tracker, trackid, tracks):
    leftframe = int(leftframe)
    rightframe = int(rightframe)
    trackid = int(trackid)
    job = session.query(Job).get(id)
    segment = job.segment
    video = segment.video
    paths = [path for path in readpaths(tracks) if path is not None]
    paths = trackutils.totrackpaths(paths)

    logger.info("Job Id: {0}".format(id))
    logger.info("Algorithm: {0}".format(tracker))
    
    outpath = tracking.api.bidirectional(tracker, leftframe, rightframe, video.location, trackid, paths)
    path = trackutils.fromtrackpath(outpath, job, leftframe, rightframe)
    attrs = [(x.attributeid, x.frame, x.value) for x in path.attributes]

    logger.info("Path: {0}".format(path))

    return {
        "label": 0,
        "boxes": [tuple(x) for x in path.getboxes()],
        "attributes": attrs
    }


""" ADMIN PAGE """
@handler()
def getallvideos():
    query = session.query(Video)
    videos = []
    for video in query:
        newvideo = {
            "slug": video.slug,
            "segments": [],
        }
        for segment in video.segments:
            newsegment = {
                "start": segment.start,
                "stop":segment.stop,
                "jobs":[],
            }

            for job in segment.jobs:
                newsegment["jobs"].append({
                    "url": job.offlineurl(config.localhost),
                    "numobjects": len(job.paths),
                })

            newvideo["segments"].append(newsegment)

        videos.append(newvideo)
    return videos

@handler(type="text/plain", jsonify=False)
def videodump(slug, outputtype, groundplane, fields=None):
    logger.debug(os.getcwd())
    query = session.query(Video).filter(Video.slug == slug)
    if query.count() != 1:
        raise ValueError("Invalid video slug")
    video = query.one()

    #mergemethod = merge.userid
    groundplane = (groundplane == 1)
    mergemethod = merge.getpercentoverlap(groundplane)
    if fields is None:
        if groundplane:
            fields = dumptools.GROUND_PLANE_FORMAT
        else:
            fields = dumptools.DEFAULT_FORMAT
    fields = fields.split()

    data = dumptools.getdata(video, True, mergemethod, 0.5, None, groundplane)

    outfile = tempfile.TemporaryFile()
    if outputtype == "json":
        dumptools.dumpjson(outfile, data, groundplane, fields)
    elif outputtype == "xml":
        dumptools.dumpjson(outfile, data, groundplane, fields)
    else:
        dumptools.dumptext(outfile, data, groundplane, fields)

    outfile.seek(0)
    text = outfile.readlines()
    outfile.close()
    return text


""" HOMOGRAPHY PAGE """
@handler()
def getvideo(slug):
    query = session.query(Video).filter(Video.slug == slug)
    if query.count() != 1:
        raise ValueError("Invalid video slug")
    video = query[0]
    homography = video.gethomography()
    if homography is not None:
        homography = homography.tolist()

    return {
        "slug": video.slug,
        "width": video.width,
        "height": video.height,
        "homography": homography,
    }

def makehomographydir(video):
    logger.debug("cwd: {0}".format(os.getcwd()))
    savedir = os.path.join(HOMOGRAPHY_DIR, video.slug)
    absdir = os.path.abspath(savedir)
    if not os.path.isdir(absdir):
        os.makedirs(absdir)
    video.homographylocation = absdir
    session.add(video)
    session.commit()
    return absdir

@handler(post = "json")
def savehomography(slug, homography):
    query = session.query(Video).filter(Video.slug == slug)
    if query.count() != 1:
        raise ValueError("Invalid video slug")
    video = query[0]

    savedir = video.homographylocation
    if savedir is None:
        savedir = makehomographydir(video)
    savelocation = os.path.join(savedir, "homography.npy")
    np.save(savelocation, np.array(homography))
    session.add(video)
    session.commit()

@handler(post = True, environ = True)
def savetopview(slug, image, environ):
    logger.info("Saving topview image")

    query = session.query(Video).filter(Video.slug == slug)
    if query.count() != 1:
        raise ValueError("Invalid video slug")
    video = query[0]

    savedir = video.homographylocation
    if savedir is None:
        savedir = makehomographydir(video)

    savelocation = os.path.join(savedir, "topview.jpg")
    tempformfile = tempfile.TemporaryFile()
    tempformfile.write(image)
    tempformfile.seek(0)
    form = cgi.FieldStorage(fp=tempformfile, environ=environ, keep_blank_values=True)
    outfile = open(savelocation, "w+b")
    shutil.copyfileobj(form['photo'].file, outfile)
    tempformfile.close()
    outfile.close()

    newimage = cv2.imread(savelocation)
    scale = 1
    if newimage.shape[1] > video.width:
        scale = float(video.width) / float(newimage.shape[1])
        newimage = cv2.resize(newimage, (0, 0), None, scale, scale)

    if newimage.shape[0] > video.height:
        scale = float(video.height) / float(newimage.shape[0])
        newimage = cv2.resize(newimage, (0, 0), None, scale, scale)

    cv2.imwrite(savelocation, newimage)

