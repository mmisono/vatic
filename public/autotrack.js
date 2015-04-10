function AutoTracker(job) {
    this.fulltracker = null;
	this.forwardtracker = null;
	this.bidirectionaltracker = null;
	this.job = job;

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

	this.fromframe = function(frame, position, label, callback) {
	    // Disable interaction
        if (this.forwardtracker) {
            server_post("trackforward", [this.job.jobid, frame, this.forwardtracker, label], position.serialize(), function(data) {
                console.log("Successful tracked object");
                callback(data);
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
