function AutoTracker(job, tracks) {
    this.fulltracker = null;
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
}
