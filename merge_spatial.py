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

import pdb

def offset_boxes(tracks,offset):
    """
    Add offset to each of the bounding box coordinates.
    """
    for track in tracks:
        for box in track['boxes']:
            box.xtl += offset[0]
            box.xbr += offset[0]
            box.ytl += offset[1]
            box.ybr += offset[1]

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







if __name__ == '__main__':
    ann_dir = '../../uavdata-bryan/annotations/4k-04-09-4p-1/'
    file1 = '0-1-0.pkl'
    file2 = '1-0-0.pkl'
    file3 = '1-1-0.pkl'

    merged_output= '../../uavdata-bryan/annotations/4k-04-09-4p-1/merged.pkl'

    temporal_margin = 15
    distance_margin = 50

    with open(os.path.join(ann_dir,file1),'rb') as f1, open(os.path.join(ann_dir,file2),'rb') as f2, open(os.path.join(ann_dir,file3),'rb') as f3:
        tracks1 = pickle.load(f1)
        tracks2 = pickle.load(f2)
        tracks3 = pickle.load(f3)

    #offset (x,y)
    offset010 = (1280,0)
    offset100 = (0,720)
    offset110 = (1280,720)
    offset120 = (2560,720)
    offset210 = (1280,1440)

    offset_boxes(tracks1,offset010)
    offset_boxes(tracks2,offset100)
    offset_boxes(tracks3,offset110)

    #center_dict = build_start_end_dict(tracks3)

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


    tracks3 += tracks1
    #save the annotations in a pickle file
    with open(merged_output, 'wb') as f:
        pickle.dump(tracks3, f, protocol=2)


    #pdb.set_trace()


