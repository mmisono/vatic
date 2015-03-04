function AutoTracker(job) {
	this.algorithm = "bidirectional";
	this.job = job;
	this.fromframe = function(frame, position, callback) {
	    // Disable interaction
	    server_post("trackfromframe", [this.job.jobid, frame, this.algorithm], position.serialize(), function(data) {
	        console.log("Successful tracked object");
	        callback(data);
	    });
	}

    this.betweenframes = function(leftframe, rightframe, leftpos, rightpos, callback) {
	    // Disable interaction
	    server_post("trackbetweenframes", [this.job.jobid, leftframe, rightframe, this.algorithm], "["+leftpos.serialize()+","+rightpos.serialize()+"]", function(data) {
	        console.log("Successful tracked object");
	        callback(data);
	    });
    }
}
