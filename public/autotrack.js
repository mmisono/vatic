function AutoTracker(job, tracks) {
    this.fulltracker = null;
    this.forwardtracker = null;
    this.bidirectionaltracker = null;
    this.job = job;
    this.tracks = tracks;

    this.full = function(callback) {
	    // Disable interaction
        if (this.fulltracker) {
            server_request("trackfull", [this.job.jobid, this.fulltracker], function(data) {
                console.log("Successful tracked object");
                callback(data);
            });
        } else {
            alert("Please select a full tracking algorithm");
            callback();
        }
    }

    this.fromframe = function(frame, track, callback) {
        // Disable interaction
        if (this.forwardtracker) {
            track.setuptracking();
            track.recordposition();
            track.cleartoend(frame);
            var args = [this.job.jobid, frame, this.forwardtracker, track.id];
            server_post("trackforward", args, this.tracks.serialize(), function(data) {
                track.recordtrackdata(data);
                track.cleanuptracking();
                callback();
                console.log("Successful tracked object");
            });
        } else {
            alert("Please select a forward tracking algorithm");
            callback();
        }
    }

    this.betweenframes = function(leftframe, leftpos, rightframe, rightpos, label, callback) {
        if (this.bidirectionaltracker) {
            server_post("trackbetweenframes", [this.job.jobid, leftframe, rightframe, this.bidirectionaltracker, label], "["+leftpos.serialize()+","+rightpos.serialize()+"]", function(data) {
                console.log("Successful tracked object");
                callback(data);
            });
        } else {
            alert("Please select a bidirectional tracking algorithm");
            callback();
        }
    }
}
