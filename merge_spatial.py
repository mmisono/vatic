"""
Module loads in .pkl files for tracklets at different spatial positions:
###############################
#         #         #         #
#         #  0-1-0  #         #
#         #         #         #
#         #         #         #
###############################
#         #         #         #
#  1-0-0  #  1-1-0  #  1-2-0  #
#         #         #         #
#         #         #         #
###############################
#         #         #         #
#         #  2-1-0  #         #
#         #         #         #
#         #         #         #
###############################


Calculates the relative coordinates of the tracklets
in each frame, and 


Will also need a script to visualize the tracks.
Look into: class visualize(DumpCommand()

"""

import pickle, argparse, os
from collections import defaultdict

from match import match


import pdb


#######################################################
################   Classes          ###################
#######################################################
class Path(object):
    def __init__(self, id, label, boxes):
        self.id = id
        self.label = label
        self.boxes = boxes

    def __repr__(self):
        return "<Path {0}>".format(self.id)

def make_paths(segment):
    """
    Turns an existing segment, which is a list of dictoinaries where each dictionary (D)
    corresponds to a path. Where D['label'] returns the path label, and D['pathes'] returns`
    a list of boxes.
    """
    new = []
    for i in xrange(len(segment)):
        new.append(Path(i,segment[i]['label'],segment[i]['boxes']))
    return new

def unmake_paths(segment):
    """
    Undoes make_paths
    """
    new = []
    for i in xrange(len(segment)):
        new.append({'label' : segment[i].label, 'boxes' : segment[i].boxes})
    return new

#######################################################
################   Offsets          ###################
#######################################################


def offset_boxes(segment,offset):
    """
    Add offset to each of the bounding box coordinates.
    where offset = (x, y)
    """
    for path in segment:
        for box in path.boxes:
            box.xtl += offset[0]
            box.xbr += offset[0]
            box.ytl += offset[1]
            box.ybr += offset[1]

def offset(y,x,overlap, default_box = (1280, 720)):
    """
    Compute the upper left corner coordinates given the offset, 
    """
    this_x = default_box[0]*x
    this_y = default_box[1]*y
    if x > 0:
        this_x -= overlap
    if y > 0:
        this_y -= overlap
    return this_x, this_y


def find_start_end(boxes):
    """
    Finds the index of the first bounding box where the box is visible
    in the frame (lost=0).
    Finds the index of the last bounding box where the box is visible
    in the frame
    """
    visible = False
    start = -1
    end = -1
    for i in xrange(len(boxes)):
        if boxes[i].lost == 0 and visible == False:
            start = i
            visible = True
        if boxes[i].lost == 1 and visible == True:
            end = i-1
            visible = False
            break
    return (start,end)

def build_start_end_dict(tracks):
    """
    Returns a dictionary where the key=track, value = (start,end) of the track.
    """
    out = defaultdict(tuple)
    for i in xrange(len(tracks)):
        out[i] = find_start_end(tracks[i]['boxes'])
    return out


def merge_tracks(track1, track2, idx1, idx2):
    """
    Combines track1 from 0:idx1, with track2 from idx2:end.
    Returns merged track.
    Linearly interpolates between the two tracks.
    """
    #Linear interpolation between idx1:idx2
    for i in xrange(idx1+1,idx2+1):
        track1['boxes'][i].lost = 0 #the object is visible
        #interpolate the position as well.
    for i in xrange(idx2,len(track2['boxes'])):
        track1['boxes'][i] = track2['boxes'][i]
    return track1


def inBoundary(box,boundary):
    """
    Returns whether the box is in the boundary defined for this merge.
    """
    x1, y1, x2, y2 = boundary
    xc, yc = box.center
    return xc > x1 and xc < x2 and yc > y1 and yc < y2


def getpercentoverlap(boundary):
    def percentoverlap(first, second):
        """
        Scores two paths, first and second, to see if they are the same path.

        A lower score is better. 0 is a perfect match. This method will assign a
        an extremely high score to paths that disagree on labels (a car cannot
        suddenly transform into a person). If labels match, then scores based
        off percent overlap in the intersecting boundary. The score is actually
        the average overlap of the bounding boxes form the two paths during the
        intersection period.

        Assumes that the paths pass through the boundary at some point.
        """
        firstboxes  = first.boxes
        secondboxes = second.boxes
        secondboxes = dict((x.frame, x) for x in secondboxes)

        if first.label != second.label:
            return max(len(firstboxes), len(secondboxes)) + 1

        cost = 1
        count = 0
        for firstbox in firstboxes:
            if inBoundary(firstbox,boundary):
                #Assume that the second box is defined in all the frames where the first box is defined.
                secondbox = secondboxes[firstbox.frame]
                if inBoundary(secondbox,boundary):
                    count += 1
                    #don't care if one is considered out of bounds (as long as they are both in boundary)
                    #if firstbox.lost != secondbox.lost:
                    #    cost += 1
                    cost += 1 - firstbox.percentoverlap(secondbox)
        if count > 0:
            cost = cost / count
        return cost
    return percentoverlap


def merge(segment1, segment2, boundary, threshold=0.5):
    """
    Combines the tracks from segment1 with the tracks from segment2.
    The tracks have to enter to boundary region to qualify to be merged.
    boundary = (x1, y1, x2, y2)

    boundary defines a rectangle. (x1,y1) is the top left corner, 
    (x2, y2) is the bottom right corner

    Uses 'method' to score two candidate paths. If the score returned by
    'method' is greater than threshold, 
    then the correspondance is considered bunk and a new path
    is created instead.

    threshold corresponds to the "average overlap of the bounding
    boxes across the frames where the boxs are in the boundary"

    In general, if 'method' returns 0 for a perfect match and 1 for a
    horrible match, then 'threshold' = 0.5 is pretty good.
    """


    def filtered_paths(segment):
        """
        Filter the paths in segment1 and segment2 by whether they enter the boundary rectangle.
        """
        paths = []
        for i in xrange(len(segment)):
            for box in segment[i].boxes:
                if inBoundary(box,boundary):
                    paths.append(segment[i])
                    break
        return paths


    ###################################
    ########## other stuff ###########
    ###################################
    method = getpercentoverlap(boundary)


    ###################################
    ############ Code #################
    ###################################
    #Smaller segment with the qualifying Pathes
    segment1_filtered = filtered_paths(segment1)
    segment2_filtered = filtered_paths(segment2)


    #We will append the new paths to segment2
    for first, second, score in match(segment1_filtered, segment2_filtered, method):
        print("{0} associated to {1} with score {2}".format(first, second, score))
        if first is None:
            continue

        #append first onto segment2
        addFirst = second is None
    
        if not addFirst:
            scorerequirement = threshold
            if score > scorerequirement:
                # They don't overlap enough during the boundary, so we can interpret the two paths
                # as two different paths. (dont merge)
                print("Score {0} exceeds merge threshold of {1}".format(score, scorerequirement))
                addFirst = True
            else:
                print("Score {0} satisfies merge threshold of {1}".format(score, scorerequirement))
        
        if addFirst:
            #we should append the first onto the seconds
            first.id = len(segment2)
            segment2.append(first)
        else:
            path = mergepath(first, second, boundary)
            segment2[path.id] = path
    #don't need to return anything because segment2 should have already been updated.

def mergepath(left, right, boundary):
    """
    Takes two paths, left and right, and combines them into a single path by
    removing the duplicate annotations in the overlap region.
    """
    #The path will replace the right path from the segment2
    response = Path(right.id, right.label, None)

    leftboxes = left.boxes
    rightboxes = right.boxes
    rightboxes = dict((x.frame, x) for x in rightboxes)

    for leftbox in leftboxes:
        #assume right and left always contain the same frame range.
        rightbox = rightboxes[leftbox.frame]
        #The frame is visible in the left path, but not visible from the right
        if not leftbox.lost and rightbox.lost:
            rightboxes[leftbox.frame] = leftbox
        if leftbox.lost and rightbox.lost and inBoundary(leftbox,boundary) and inBoundary(rightbox,boundary):
            #both of the boxes are lost, but both are in the boundary (then they actually aren't lost)
            rightboxes[leftbox.frame].lost = 0

    response.boxes = [value for key, value in rightboxes.iteritems()]
    return response




def delete_short_paths(segment):
    """
    Deletes the paths from segment which are shorter than the average length path.
    """
    total_len = 0
    for path in segment:
        total_len += len(path['boxes'])
    avg_len = float(total_len) / len(segment)
    indices = []
    for i, path in enumerate(segment):
        if len(path['boxes']) < avg_len:
            indices.append(i)
    #delete these indices
    for i in indices:
        del segment[i]





if __name__ == '__main__':
    ann_dir = '../../uavdata-bryan/annotations/4k-04-09-4p-1-new/'
    file1 = '0-1-0.pkl'
    file2 = '1-0-0.pkl'
    file3 = '1-1-0.pkl'

    merged_output= '../../uavdata-bryan/annotations/4k-04-09-4p-1-new/merged.pkl'
    threshold = 0.6
    no_merge = False

    overlap = 50
    quadrant_sz = (1280, 720)


    with open(os.path.join(ann_dir,file1),'rb') as f1, open(os.path.join(ann_dir,file2),'rb') as f2, open(os.path.join(ann_dir,file3),'rb') as f3:
        segment1 = pickle.load(f1)
        segment2 = pickle.load(f2)
        segment3 = pickle.load(f3)

    #delete those paths which were not merged properly, so those paths which are very short.
    delete_short_paths(segment1)
    delete_short_paths(segment2)
    delete_short_paths(segment3)

    segment1 = make_paths(segment1)
    segment2 = make_paths(segment2)
    segment3 = make_paths(segment3)

    #add offset to the tracks.
    offset_boxes(segment1,offset(0,1,overlap,default_box= quadrant_sz))
    offset_boxes(segment2,offset(1,0,overlap,default_box= quadrant_sz))
    offset_boxes(segment3,offset(1,1,overlap,default_box= quadrant_sz))
    

    if no_merge: #don't do any spatial merging, just concatenate the segments together.
        merged_output= '../../uavdata-bryan/annotations/4k-04-09-4p-1-new/nomerge.pkl'
        for path in segment1:
            path.id = len(segment3)
            segment3.append(path)
        for path in segment2:
            path.id = len(segment3)
            segment3.append(path)
    else:
        #pdb.set_trace()
        #merges segment1 into segment3. Updates the second segment (discards the first)
        #top boundary
        boundary = (quadrant_sz[0]-overlap, quadrant_sz[1]-overlap, 2*quadrant_sz[0]+overlap, quadrant_sz[1]+overlap)
        merge(segment1, segment3, boundary, threshold=threshold)
        #left boundary
        boundary = (quadrant_sz[0]-overlap, quadrant_sz[1]-overlap, quadrant_sz[0]+overlap, 2*quadrant_sz[1]+overlap)
        merge(segment2,segment3,boundary, threshold=threshold)





    segment3 = unmake_paths(segment3)
    #save the annotations in a pickle file
    with open(merged_output, 'wb') as f:
        pickle.dump(segment3, f, protocol=2)


    #pdb.set_trace()


"""
    #Merge 010 with 110.
    for currIdx, track in enumerate(tracks1):
        label1 = track['label']
        start,end = find_start_end(track['boxes'])

        #Distance between current track and the center tracks.
        dists = [(10000,None,None)]*len(tracks3) #upperbound
        for idx, center in enumerate(tracks3):
            c_start, c_end = find_start_end(center['boxes'])
            #track starts in center, and goes to current sector
            if start >= c_end and start-c_end < temporal_margin:
                dists[idx] = (track['boxes'][start].distance(center['boxes'][c_end]), start, c_end)
            #track starts in current sector, and goes to center
            elif c_start >= end and c_start-end < temporal_margin:
                dists[idx] = (track['boxes'][c_start].distance(center['boxes'][end]), end, c_start)
        
        #The minimum distance is the track which is most likely to match with our
        min_idx, min_dist = min(enumerate(dists), key=lambda x: x[1][0])

        if min_dist[0] < distance_margin:
            # Combine current track with the min_dist track. Delete current track
            # from its list

            starts_in_center = min_dist[1] >= min_dist[2]

            if starts_in_center:
            #if track starts in center, and goes to current sector 
                idx1 = min_dist[2]
                idx2 = min_dist[1]
                track1 = tracks3[min_idx]
                track2 = track
            else:
                #if track starts in current sector, and goes to center
                idx1 = min_dist[1]
                idx2 = min_dist[2]
                track1 = track
                track2 = tracks3[min_idx]

            #merged:  track1[0:idx1] + interpolate + track2[idx2:]
            merged_track = merge_tracks(track1, track2, idx1, idx2)

            #assign the new track to the center
            tracks3[min_idx] = merged_track
            del tracks1[currIdx]
"""