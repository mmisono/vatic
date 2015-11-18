import shutil
import os
import random
import vision.pascal
import itertools
import velocity
import numpy as np
import merge
from xml.etree import ElementTree
from models import Path

"""
This module dumps data as the desired file type.
"""

DEFAULT_FORMAT = "id xtl ytl xbr ybr frame lost occluded generated label attributes"
GROUND_PLANE_FORMAT = "id x y frame lost occluded generated label attributes"

class Tracklet(object):
    def __init__(self, label, labelid, userid, paths, boxes, workers, velocities):
        self.label = label
        self.paths = paths
        self.boxes = sorted(boxes, key = lambda x: x.frame)
        self.velocities = velocities
        self.workers = workers
        self.labelid = labelid
        self.userid = userid

    def bind(self):
        for path in self.paths:
            self.boxes = Path.bindattributes(path.attributes, self.boxes)

def getdata(video, domerge=True, mergemethod=None, mergethreshold=0.5,
        workers=None, groundplane=False):

    response = []
    if domerge:
        for boxes, paths in merge.merge(video.segments, 
                                        method=mergemethod,
                                        threshold = mergethreshold,
                                        groundplane = groundplane):
            trackworkers = list(set(x.job.workerid for x in paths))
            tracklet = Tracklet(
                paths[0].label.text,
                paths[0].labelid,
                paths[0].userid,
                paths,
                boxes,
                trackworkers,
                {}
            )
            response.append(tracklet)
    else:
        for segment in video.segments:
            for job in segment.jobs:
                if not job.useful:
                    continue
                worker = job.workerid
                for path in job.paths:
                    tracklet = Tracklet(
                        path.label.text,
                        path.labelid,
                        path.userid, 
                        [path],
                        path.getboxes(),
                        [worker],
                        {}
                    )
                    response.append(tracklet)

    if workers:
        response = [x for x in response if set(x.workers) & workers]

    interpolated = []
    for track in response:
        path = vision.track.interpolation.LinearFill(track.boxes)
        velocities = velocity.velocityforboxes(path)
        tracklet = Tracklet(track.label, track.labelid, track.userid,
                                        track.paths, path, track.workers, velocities)
        interpolated.append(tracklet)
    response = interpolated

    for tracklet in response:
        tracklet.bind()

    return response

def trackletdataforfield(tracklet, id, field):
    if field == "id":
        return id
    elif field == "userid":
        return tracklet.userid
    elif field == "label":
        return tracklet.label
    elif field == "labelid":
        return tracklet.labelid
    return None

# Get data for a given format string
# Will return either a string or a list in the case of box attributes
def boxdataforfield(box, velocity, field):
    try:
        return getattr(box, field)
    except AttributeError:
        if field == "x":
            return box.xbr
        elif field == "y":
            return box.ybr
        elif field == "vx":
            return velocity[0]
        elif field == "vy":
            return velocity[1]
        return None

# Format:
# time id x z y vx vz vy labelid
def dumpforecastdata(file, data):
    for id, track in enumerate(data):
        out = np.zeros((len(filteredboxes), 9))
        for i, box in enumerate(filteredboxes):
            vx, vy = velocities[box.frame]
            out[i, :] = np.array([box.frame, id, box.xbr, 0, box.ybr, vx, 0, vy, track.labelid])
        np.savetxt(file, out, fmt="%.7e")

def dumppositions(file, data):
    for id, track in enumerate(data):
        filteredboxes = [box for box in track.boxes if box.lost == 0]
        out = np.zeros((len(filteredboxes), 4))
        for i, box in enumerate(filteredboxes):
            x = float(box.xbr + box.xtl) / 2
            y = float(box.ybr + box.ytl) / 2
            out[i, :] = np.array([box.frame, id, x, y])
        np.savetxt(file, out, fmt="%.7e")

def dumpmatlab(file, data, video, scale, fields):
    results = []
    for id, track in enumerate(data):
        for box in track.boxes:
            if not box.lost:
                data = {}
                for f in fields:
                    d = trackletdataforfield(track, id, f)
                    if d is None:
                        d = boxdataforfield(box, track.velocities[box.frame], f)
                    if data:
                        data[f] = d

                results.append(data)

    from scipy.io import savemat as savematlab
    savematlab(file,
        {"annotations": results,
         "num_frames": video.totalframes,
         "slug": video.slug,
         "skip": video.skip,
         "width": int(video.width * scale),
         "height": int(video.height * scale),
         "scale": scale}, oned_as="row")

def dumpxml(file, data, groundplane, fields):
    file.write("<annotations count=\"{0}\">\n".format(len(data)))
    hidelost = "lost" not in fields
    for id, track in enumerate(data):
        file.write("\t<track ")
        for f in fields:
            d = trackletdataforfield(track, id, f)
            if d is not None:
                file.write("{0}=\"{1}\" ".format(f, d))
        file.write(">\n")
        for box in track.boxes:
            if hidelost and box.lost:
                continue
            file.write("\t\t<box ")
            hasattributes = False
            for f in fields:
                if f == "attributes":
                    hasattributes = True
                else:
                    d = boxdataforfield(box, track.velocities[box.frame], f)
                    if d is not None:
                        file.write("{0}=\"{1}\" ".format(f, d))
            file.write(">")
            if hasattributes:
                for attr in box.attributes:
                    file.write("<attribute id=\"{0}\">{1}</attribute>".format(
                               attr.id, attr.text))

            file.write("</box>\n")
        file.write("\t</track>\n")
    file.write("</annotations>\n")

def dumpjson(file, data, groundplane, fields):
    annotations = {}
    hidelost = "lost" not in fields
    for id, track in enumerate(data):
        result = {}
        for f in fields:
            d = trackletdataforfield(track, id, f)
            if d is not None:
                result[f] = d

        boxes = {}
        for box in track.boxes:
            if hidelost and box.lost:
                continue

            boxdata = {}
            for f in fields:
                d = boxdataforfield(box, track.velocities[box.frame], f)
                if d is not None:
                    boxdata[f] = d
            boxes[int(box.frame)] = boxdata
        result['boxes'] = boxes
        annotations[int(id)] = result

    import json
    json.dump(annotations, file)
    file.write("\n")

def dumppickle(file, data):
    annotations = []
    for track in data:
        result = {}
        result['label'] = track.label
        result['boxes'] = track.boxes
        annotations.append(result)

    import pickle
    pickle.dump(annotations, file, protocol = 2)

def dumptext(file, data, groundplane, fields):
    def printdata(d, f):
        if type(d) is int:
            f.write(str(d))
        elif type(d) is str:
            f.write("\"")
            f.write(d)
            f.write("\"")
        elif type(d) is list:
            [printdata(x, f) for x in d]

    hidelost = "lost" not in fields
    for id, track in enumerate(data):
        for box in track.boxes:

            if hidelost and box.lost:
                continue

            for f in fields:
                d = trackletdataforfield(track, id, f)
                if d is None:
                    d = boxdataforfield(box, track.velocities[box.frame], f)
                printdata(d, file)
                file.write(" ")
            file.write("\n")

def dumplabelme(file, data, slug, folder):
    file.write("<annotation>")
    file.write("<folder>{0}</folder>".format(folder))
    file.write("<filename>{0}.flv</filename>".format(slug))
    file.write("<source>")
    file.write("<type>video</type>")
    file.write("<sourceImage>vatic frames</sourceImage>")
    file.write("<sourceAnnotation>vatic</sourceAnnotation>")
    file.write("</source>")
    file.write("\n")

    data = list(enumerate(data))

    for id, track in data:
        eligibleframes = [x.frame for x in track.boxes if not x.lost]
        if not eligibleframes:
            continue
        startframe = min(eligibleframes)
        endframe = max(eligibleframes)

        file.write("<object>")
        file.write("<name>{0}</name>".format(track.label))
        file.write("<moving>true</moving>")
        file.write("<action/>")
        file.write("<verified>0</verified>")
        file.write("<id>{0}</id>".format(id))
        file.write("<createdFrame>{0}</createdFrame>".format(startframe))
        file.write("<startFrame>{0}</startFrame>".format(startframe))
        file.write("<endFrame>{0}</endFrame>".format(endframe))
        file.write("\n")
        for box in track.boxes:
            if box.lost:
                continue
            file.write("<polygon>")
            file.write("<t>{0}</t>".format(box.frame))
            file.write("<pt>")
            file.write("<x>{0}</x>".format(box.xtl))
            file.write("<y>{0}</y>".format(box.ytl))
            file.write("<l>{0}</l>".format(0 if box.generated else 1))
            file.write("</pt>")
            file.write("<pt>")
            file.write("<x>{0}</x>".format(box.xtl))
            file.write("<y>{0}</y>".format(box.ybr))
            file.write("<l>{0}</l>".format(0 if box.generated else 1))
            file.write("</pt>")
            file.write("<pt>")
            file.write("<x>{0}</x>".format(box.xbr))
            file.write("<y>{0}</y>".format(box.ybr))
            file.write("<l>{0}</l>".format(0 if box.generated else 1))
            file.write("</pt>")
            file.write("<pt>")
            file.write("<x>{0}</x>".format(box.xbr))
            file.write("<y>{0}</y>".format(box.ytl))
            file.write("<l>{0}</l>".format(0 if box.generated else 1))
            file.write("</pt>")
            file.write("</polygon>")
            file.write("\n")
        file.write("</object>")
        file.write("\n")

    eventcounter = 0
    for id, track in data:
        occlusions = [x for x in track.boxes if x.occluded and not x.lost]
        lastframe = None
        startframe = None
        for box in occlusions:
            output = box is occlusions[-1]
            if lastframe is None:
                lastframe = box.frame
                startframe = box.frame
            elif box.frame == lastframe + 1:
                lastframe = box.frame
            else:
                output = True
                
            if output:
                file.write("<event>");
                file.write("<username>anonymous</username>")
                file.write("<startFrame>{0}</startFrame>".format(startframe))
                file.write("<endFrame>{0}</endFrame>".format(lastframe))
                file.write("<createdFrame>{0}</createdFrame>".format(startframe))
                file.write("<eid>{0}</eid>".format(eventcounter))
                file.write("<x>0</x>")
                file.write("<y>0</y>")
                file.write("<sentence>")
                file.write("<word><text>{0}</text><id>{1}</id></word>"
                           .format(track.label, id))
                file.write("<word><text>is</text></word>")
                file.write("<word><text>occluded</text></word>")
                file.write("<word><text>by</text></word>")
                file.write("<word><text>unknown</text></word>")
                file.write("</sentence>")
                file.write("</event>")
                file.write("\n")

                eventcounter += 1
                lastframe = None
                startframe = None

    file.write("</annotation>")
    file.write("\n")

def dumppascal(folder, video, data, difficultthresh, skip, negdir):
    byframe = {}
    for track in data:
        for box in track.boxes:
            if box.frame not in byframe:
                byframe[box.frame] = []
            byframe[box.frame].append((box, track))

    hasit = {}
    allframes = range(0, video.totalframes, skip)

    try:
        os.makedirs("{0}/Annotations".format(folder))
    except:
        pass
    try:
        os.makedirs("{0}/ImageSets/Main/".format(folder))
    except:
        pass
    try:
        os.makedirs("{0}/JPEGImages/".format(folder))
    except:
        pass
    
    numdifficult = 0
    numtotal = 0

    pascalds = None
    allnegatives = set()
    if negdir:
        pascalds = vision.pascal.PascalDataset(negdir)

    print "Writing annotations..."
    for frame in allframes:
        if frame in byframe:
            boxes = byframe[frame]
        else:
            boxes = []

        strframe = str(frame+1).zfill(6)
        filename = "{0}/Annotations/{1}.xml".format(folder, strframe)
        file = open(filename, "w")
        file.write("<annotation>")
        file.write("<folder>{0}</folder>".format(folder))
        file.write("<filename>{0}.jpg</filename>".format(strframe))

        isempty = True
        for box, track in boxes:
            if box.lost:
                continue

            isempty = False

            if track.label not in hasit:
                hasit[track.label] = set()
            hasit[track.label].add(frame)

            numtotal += 1

            difficult = box.area < difficultthresh
            if difficult:
                numdifficult += 1
            difficult = int(difficult)

            file.write("<object>")
            file.write("<name>{0}</name>".format(track.label))
            file.write("<bndbox>")
            file.write("<xmax>{0}</xmax>".format(box.xbr))
            file.write("<xmin>{0}</xmin>".format(box.xtl))
            file.write("<ymax>{0}</ymax>".format(box.ybr))
            file.write("<ymin>{0}</ymin>".format(box.ytl))
            file.write("</bndbox>")
            file.write("<difficult>{0}</difficult>".format(difficult))
            file.write("<occluded>{0}</occluded>".format(box.occluded))
            file.write("<pose>Unspecified</pose>")
            file.write("<truncated>0</truncated>")
            file.write("</object>")

        if isempty:
            # since there are no objects for this frame,
            # we need to fabricate one
            file.write("<object>")
            file.write("<name>not-a-real-object</name>")
            file.write("<bndbox>")
            file.write("<xmax>10</xmax>")
            file.write("<xmin>20</xmin>")
            file.write("<ymax>30</ymax>")
            file.write("<ymin>40</ymin>")
            file.write("</bndbox>")
            file.write("<difficult>1</difficult>")
            file.write("<occluded>1</occluded>")
            file.write("<pose>Unspecified</pose>")
            file.write("<truncated>0</truncated>")
            file.write("</object>")

        file.write("<segmented>0</segmented>")
        file.write("<size>")
        file.write("<depth>3</depth>")
        file.write("<height>{0}</height>".format(video.width))
        file.write("<width>{0}</width>".format(video.height))
        file.write("</size>")
        file.write("<source>")
        file.write("<annotation>{0}</annotation>".format(video.slug))
        file.write("<database>vatic</database>")
        file.write("<image>vatic</image>")
        file.write("</source>")
        file.write("<owner>")
        file.write("<flickrid>vatic</flickrid>")
        file.write("<name>vatic</name>")
        file.write("</owner>")
        file.write("</annotation>")
        file.close()

    print "{0} of {1} are difficult".format(numdifficult, numtotal)

    print "Writing image sets..."
    for label, frames in hasit.items():
        filename = "{0}/ImageSets/Main/{1}_trainval.txt".format(folder,
                                                                label)
        file = open(filename, "w")
        for frame in allframes:
            file.write(str(frame+1).zfill(6))
            file.write(" ")
            if frame in frames:
                file.write("1")
            else:
                file.write("-1")
            file.write("\n")

        if pascalds:
            print "Sampling negative VOC for {0}".format(label)
            negs = itertools.islice(pascalds.find(missing = [label.lower()]), 1000)
            for neg in negs:
                source = "{0}/Annotations/{1}.xml".format(negdir, neg)
                tree = ElementTree.parse(source)
                tree.find("folder").text = folder
                tree.find("filename").text = "n{0}.jpg".format(neg)
                try:
                    os.makedirs(os.path.dirname("{0}/Annotations/n{1}.xml".format(folder, neg)))
                except OSError:
                    pass
                try:
                    os.makedirs(os.path.dirname("{0}/JPEGImages/n{1}.jpg".format(folder, neg)))
                except OSError:
                    pass
                tree.write("{0}/Annotations/n{1}.xml".format(folder, neg))
                shutil.copyfile("{0}/JPEGImages/{1}.jpg".format(negdir, neg),
                                "{0}/JPEGImages/n{1}.jpg".format(folder, neg))
                allnegatives.add("n{0}".format(neg))
                file.write("n{0} -1\n".format(neg))
        file.close()

        train = "{0}/ImageSets/Main/{1}_train.txt".format(folder, label)
        shutil.copyfile(filename, train)

    filename = "{0}/ImageSets/Main/trainval.txt".format(folder)
    file = open(filename, "w")
    file.write("\n".join(str(x+1).zfill(6) for x in allframes))
    for neg in allnegatives:
        file.write("n{0}\n".format(neg))
    file.close()

    train = "{0}/ImageSets/Main/train.txt".format(folder)
    shutil.copyfile(filename, train)

    print "Writing JPEG frames..."
    for frame in allframes:
        strframe = str(frame+1).zfill(6)
        path = Video.getframepath(frame, video.location)
        dest = "{0}/JPEGImages/{1}.jpg".format(folder, strframe)
        try:
            os.unlink(dest)
        except OSError:
            pass
        os.link(path, dest)

    print "Done."

def dumppascal2(folder, video, data, ratio=0.8):
    byframe = {}
    for track in data:
        for box in track.boxes:
            if box.frame not in byframe:
                byframe[box.frame] = []
            byframe[box.frame].append((box, track))

    hasit = {}
    allframes = [i for i in range(video.totalframes)]

    try:
        os.makedirs("{0}/Annotations".format(folder))
    except:
        pass
    try:
        os.makedirs("{0}/ImageSets/".format(folder))
    except:
        pass
    try:
        os.makedirs("{0}/Images/".format(folder))
    except:
        pass
    numtotal = 0

    print "Writing annotations..."
    for frame in allframes:
        if frame in byframe:
            boxes = byframe[frame]
        else:
            boxes = []

        strframe = str(frame+1).zfill(6)
        filename = "{0}/Annotations/{1}.xml".format(folder, strframe)
        file = open(filename, "w")
        file.write("<annotation>\n")
        file.write("  <folder>{0}</folder>\n".format(folder))
        file.write("  <filename>{0}.jpg</filename>\n".format(strframe))

        isempty = True
        for box, track in boxes:
            if box.lost:
                continue

            isempty = False

            if track.label not in hasit:
                hasit[track.label] = set()
            hasit[track.label].add(frame)

            numtotal += 1

            file.write("  <object>\n")
            file.write("    <name>{0}</name>\n".format(track.label))
            file.write("    <bndbox>\n")
            file.write("      <xmax>{0}</xmax>\n".format(box.xbr))
            file.write("      <xmin>{0}</xmin>\n".format(box.xtl))
            file.write("      <ymax>{0}</ymax>\n".format(box.ybr))
            file.write("      <ymin>{0}</ymin>\n".format(box.ytl))
            file.write("    </bndbox>\n")
            file.write("    <occluded>{0}</occluded>\n".format(box.occluded))
            file.write("  </object>\n")

        if isempty:
            print("!!! frame {} has no object".format(frame))
            # since there are no objects for this frame,
            # we need to fabricate one
            file.write("  <object>\n")
            file.write("  <name>not-a-real-object</name>\n")
            file.write("  <bndbox>\n")
            file.write("    <xmax>10</xmax>\n")
            file.write("    <xmin>20</xmin>\n")
            file.write("    <ymax>30</ymax>\n")
            file.write("    <ymin>40</ymin>\n")
            file.write("  </bndbox>\n")
            file.write("  </object>\n")

        file.write("  <size>\n")
        file.write("    <depth>3</depth>\n")
        file.write("    <height>{0}</height>\n".format(video.width))
        file.write("    <width>{0}</width>\n".format(video.height))
        file.write("  </size>\n")
        file.write("  <source>\n")
        file.write("    <annotation>{0}</annotation>\n".format(video.slug))
        file.write("    <database>vatic</database>\n")
        file.write("    <image>vatic</image>\n")
        file.write("  </source>\n")
        file.write("  <owner>\n")
        file.write("    <flickrid>vatic</flickrid>\n")
        file.write("    <name>vatic</name>\n")
        file.write("  </owner>\n")
        file.write("</annotation>\n")
        file.close()

    print "Writing image sets..."
    assert ratio <= 1.0
    files = [str(x+1).zfill(6) for x in allframes]
    random.shuffle(files)
    trainset = []
    testset = []
    i = 0
    while i < len(files)*ratio:
        trainset.append(files[i])
        i += 1
    while i < len(files):
        testset.append(files[i])
        i += 1
    trainset.sort()
    testset.sort()

    assert len(trainset) + len(testset) == len(files)

    with open("{0}/ImageSets/train.txt".format(folder),"w") as f:
        for n in trainset:
            f.write(n+"\n")

    with open("{0}/ImageSets/test.txt".format(folder),"w") as f:
        for n in testset:
            f.write(n+"\n")

    print "Writing JPEG frames..."
    for frame in allframes:
        strframe = str(frame+1).zfill(6)
        path = video.getframepath(frame, video.location)
        dest = "{0}/Images/{1}.jpg".format(folder, strframe)
        try:
            os.unlink(dest)
        except OSError:
            pass

        #os.link(path, dest)
        os.symlink(path, dest)

    print "Done."

