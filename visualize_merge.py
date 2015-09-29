import pickle, argparse, os

from models import Video #need this for Video
import vision.visualize
import Image, ImageDraw, ImageFont


import pdb

def renumber(it):
    for count, (im, _) in enumerate(it):
        yield im, count


def print_boundary(images, boundary):
    for image, frame in images:
        yield highlight_box(image,boundary), frame



def highlight_box(image, box, color = 'red'):
    """
    Highlights the bounding box on the given image.
    """
    draw = ImageDraw.Draw(image)
    draw.rectangle(box, outline=color)
    return image



if __name__ == '__main__':
    #args:
    video_dir = '/vatic2/uavdata-bryan/raw/4k-04-09-4p-1/full'
    merged_tracks = '/vatic2/uavdata-bryan/annotations/4k-04-09-4p-1-new/merged.pkl'
    args_output = '/vatic2/uavdata-bryan/visualize/debug6_frames'


    args_labels = False
    args_groundplane = False
    args_renumber = True
    width = 3840
    height = 2160

    """"
    Primarily for debugging

    """
    draw_merge_boundaries = True
    #merged_tracks = '/vatic2/uavdata-bryan/annotations/4k-04-09-4p-1-new/nomerge.pkl'
    #args_output = '/vatic2/uavdata-bryan/visualize/nomerge_frames'
    
    overlap = 50
    quadrant_sz = (1280, 720)


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

    #pdb.set_trace()
    if draw_merge_boundaries:
        #Draws the merge boundaries. The rectangular region where the two spatial regions overlap.
        #top boundary
        boundary = (quadrant_sz[0]-overlap, quadrant_sz[1]-overlap, 2*quadrant_sz[0]+overlap, quadrant_sz[1]+overlap)
        it = print_boundary(it, boundary)
        #left boundary
        boundary = (quadrant_sz[0]-overlap, quadrant_sz[1]-overlap, quadrant_sz[0]+overlap, 2*quadrant_sz[1]+overlap)
        it = print_boundary(it, boundary)

    try:
        if not os.path.exists(args_output):
            os.makedirs(args_output)
    except:
        pass


    vision.visualize.save(it, lambda x: "{0}/{1}.jpg".format(args_output, x))


    #pdb.set_trace()


