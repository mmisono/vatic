import pickle, argparse, os

from models import Video #need this for Video
import vision.visualize
import Image, ImageDraw, ImageFont


import pdb

def renumber(it):
    for count, (im, _) in enumerate(it):
        yield im, count

if __name__ == '__main__':
    #args:
    video_dir = '/vatic2/uavdata-bryan/raw/4k-04-09-4p-1/full'
    merged_tracks = '/vatic2/uavdata-bryan/annotations/4k-04-09-4p-1/merged.pkl'
    args_output = '/vatic2/uavdata-bryan/visualize/debug3_frames'

    
    args_labels = False
    args_groundplane = False
    args_renumber = True
    width = 3840
    height = 2160


    video = Video( location = video_dir, width = width, height = height)

    with open(merged_tracks, 'rb') as f:
        data = pickle.load(f)

    # prepend class label
    for track in data:
        for box in track['boxes']:
            box.attributes.insert(0, track['label'])

    paths = [x['boxes'] for x in data]
    print "Highlighting {0} tracks...".format(len(data))

    if args_labels:
        font = ImageFont.truetype("arial.ttf", 14)
    else:
        font = None

    if args_groundplane:
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

    if args_renumber:
        it = renumber(it)

    try:
        os.makedirs(args_output)
    except:
        pass

    vision.visualize.save(it,
        lambda x: "{0}/{1}.jpg".format(args_output, x))


    #pdb.set_trace()


