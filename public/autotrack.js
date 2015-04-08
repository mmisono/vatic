function AutoTracker(job) {
	this.forwardtracker = null;
	this.bidirectionaltracker = null;
	this.job = job;
	this.fromframe = function(frame, position, callback) {
	    // Disable interaction
        if (this.forwardtracker) {
            server_post("trackforward", [this.job.jobid, frame, this.forwardtracker], position.serialize(), function(data) {
                console.log("Successful tracked object");
                callback(data);
            });
        } else {
            alert("Please select a forward tracking algorithm");
            callback();
        }
    }

    this.betweenframes = function(leftframe, leftpos, rightframe, rightpos, callback) {
        if (this.bidirectionaltracker) {
            server_post("trackbetweenframes", [this.job.jobid, leftframe, rightframe, this.bidirectionaltracker], "["+leftpos.serialize()+","+rightpos.serialize()+"]", function(data) {
                console.log("Successful tracked object");
                callback(data);
            });
        } else {
            alert("Please select a bidirectional tracking algorithm");
            callback();
        }
    }
}
