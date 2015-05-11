
# return is t -> (vx, vy)
def velocityforboxes(boxes):
    frametobox = {box.frame: box for box in boxes} 
    times = sorted(frametobox.keys())
    vels = {}
    for i, time in enumerate(times):
        last = times[max(0, i - 3)]
        nxt = times[min(len(times)-1, i + 3)]
        delta = nxt - last
        if frametobox[time].lost == 0 or delta == 0:
            velx = 0
            vely = 0
        else:

            velx = float(frametobox[nxt].xbr - frametobox[last].xbr) / float(delta)
            vely = float(frametobox[nxt].ybr - frametobox[last].ybr) / float(delta)
        vels[time] = (velx, vely)
    return vels
 
