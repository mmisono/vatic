# coords is t -> (x, y)
# return is t -> (vx, vy)
def velocityforcoords(coords):
    if len(coords) == 0:
        return {}
    times = sorted(coords.keys())
    vels = {}
    for last, curr in zip(times, times[1:]):
        delta = curr - last
        velx = float(coords[curr][0] - coords[last][0]) / float(delta)
        vely = float(coords[curr][1] - coords[last][1]) / float(delta)
        vels[last] = (velx, vely)
    vels[times[-1]] = (velx, vely)
    return vels
    
