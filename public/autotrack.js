function AutoTracker(job) {
	this.algorithm = "bidirectional";
	this.job = job;
	this.fromframe = function(frame, bounds, callback) {
	    // Disable interaction
	    server_post("trackfromframe", [this.job.jobid, frame, this.algorithm], bounds.serialize(), function(data) {
	        console.log("Successful tracked object");
	        callback(data);
	    });
	}
}
