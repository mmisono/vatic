"""
Merges paths across segments. Typical usage:

>>> for boxes, paths in merge(segments):
...     pass
"""

from match import match
from vision.track.interpolation import Linear

import logging

logging.basicConfig(filename='example.log',level=logging.DEBUG)
logger = logging.getLogger("vatic.merge")

def getpercentoverlap(groundplane):
    def percentoverlap(first, second):
        """
        Scores two paths, first and second, to see if they are the same path.

        A lower score is better. 0 is a perfect match. This method will assign a
        an extremely high score to paths that disagree on labels (a car cannot
        suddenly transform into a person). If labels match, then scores based
        off percent overlap in the intersecting timeline.
        """
        firstboxes  = first.getboxes(interpolate = True, groundplane=groundplane)
        secondboxes = second.getboxes(interpolate = True, groundplane=groundplane)
        secondboxes = dict((x.frame, x) for x in secondboxes)

        if first.label != second.label:
            return max(len(firstboxes), len(secondboxes)) + 1

        cost = 0
        for firstbox in firstboxes:
            if firstbox.frame in secondboxes:
                secondbox = secondboxes[firstbox.frame]
                if firstbox.lost != secondbox.lost:
                    cost += 1
                else:
                    cost += 1 - firstbox.percentoverlap(secondbox)
        return cost
    return percentoverlap

def overlapsize(first, second, groundplane):
    """
    Counts the number of frames in first that temporally overlap with second.
    """
    return len(
        set(
            f.frame 
            for f in  first.getboxes(interpolate = True, groundplane=groundplane)
        ) & set(
            s.frame
            for s in second.getboxes(interpolate = True, groundplane=groundplane)
        ))

def merge(segments, method = None, threshold = 0.5, groundplane = False):
    """
    Takes a list of segments and attempts to find a correspondance between
    them by returning a list of merged paths.

    Uses 'method' to score two candidate paths. If the score returned by
    'method' is greater than the number of overlaping frames times the 
    threshold, then the correspondance is considered bunk and a new path
    is created instead.

    In general, if 'method' returns 0 for a perfect match and 1 for a
    horrible match, then 'threshold' = 0.5 is pretty good.
    """
    if method is None:
        method = getpercentoverlap(groundplane)

    logger.debug("Starting to merge!")
    paths = {}
    segments.sort(key = lambda x: x.start)
    for path in segments[0].paths:
        paths[path.id] = path.getboxes(groundplane=groundplane), [path]
    for x, y in zip(segments, segments[1:]):
        logger.debug("Merging segments {0} and {1}".format(x.id, y.id))
        if x.stop < y.start:
            logger.debug("Segments {0} and {1} do not overlap"
                         .format(x.id, y.id))
            for path in y.paths:
                paths[path.id] = path.getboxes(groundplane=groundplane), [path]
        else:
            for first, second, score in match(x.paths, y.paths, method):
                logger.debug("{0} associated to {1} with score {2}"
                            .format(first, second, score))
                if second is None:
                    continue

                isbirth = first is None
                if not isbirth:
                    scorerequirement = threshold * overlapsize(first, second, groundplane)
                    if score > scorerequirement:
                        logger.debug("Score {0} exceeds merge threshold of {1}"
                                    .format(score, scorerequirement))
                        isbirth = True
                    else:
                        logger.debug("Score {0} satisfies merge threshold of "
                                     "{1}" .format(score, scorerequirement))

                if isbirth:
                    paths[second.id] = second.getboxes(groundplane=groundplane), [second]
                else:
                    path = mergepath(paths[first.id][0], second.getboxes(groundplane=groundplane))
                    paths[first.id][1].append(second)
                    paths[second.id] = (path, paths[first.id][1])
                    del paths[first.id]
    logger.debug("Done merging!")
    return paths.values()

def mergepath(left, right):
    """
    Takes two paths, left and right, and combines them into a single path by
    removing the duplicate annotations in the overlap region.
    """

    rightmin = min(x.frame for x in right)

    boundary = (max((x.frame, x) for x in left if x.frame < rightmin),
                min((x.frame, x) for x in left if x.frame >= rightmin))

    leftfill = Linear(boundary[0][1], boundary[1][1])
    pivot    = [x for x in leftfill if x.frame == rightmin][0]

    response = [x for x in left if x.frame < rightmin]
    response.append(pivot)
    response.extend(right[1:])
    return response
