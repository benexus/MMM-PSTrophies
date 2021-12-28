const NodeHelper = require("node_helper");
const PSTrophiesFetcher = require("./pstrophiesfetcher.js");
const Log = require("logger");

module.exports = NodeHelper.create({

	start: function () {
		Log.log("Starting node helper for: " + this.name);
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "CREATE_FETCHER") {
			this.createFetcher(payload.config);
		}
	},

	createFetcher: function (config) {

		if (typeof this.fetcher === "undefined") {
			this.fetcher = new PSTrophiesFetcher(config, this.path);

			this.fetcher.onFriendsReady((friends) => {
				this.sendSocketNotification("FRIENDS_AVAILABLE", friends);
			});

			this.fetcher.onProfileReady((profile) => {
				this.sendSocketNotification("PROFILE_AVAILABLE", profile);
			});

			this.fetcher.onMissingToken(() => {
				this.sendSocketNotification("MISSING_TOKEN");
			});

			this.fetcher.onAuthenticationError(() => {
				this.sendSocketNotification("AUTHENTICATION_ERROR");
			});

			this.fetcher.onError((fetcher, error) => {
				Log.error("Error: ", error);
				let error_type = NodeHelper.checkFetchError(error);
				this.sendSocketNotification("PS_ERROR", {
					error_type
				});
			});
		}

		this.fetcher.startFetch();
	},

});
